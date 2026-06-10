-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 0 — Auditoría y baseline pre-migración multi-tenant
-- Solvr Gestión — plan: docs/plan-rls-multitenant.md §7 Fase 0
--
-- QUÉ HACE:
--   Crea el schema `_baseline` con snapshots del estado actual de la base:
--     - policies vigentes en `public`
--     - row counts aproximados por tabla
--     - copia de `allowed_emails` y `team_members` (referenciadas por el código
--       pero no versionadas en supabase_schema.sql)
--     - definiciones de funciones helper del schema viejo
--       (get_my_role, is_my_owner_data, effective_user_id)
--
-- DÓNDE CORRER:
--   1. Producción (read-mostly: solo agrega un schema _baseline).
--   2. Staging recién clonado, antes de Fase 1.
--
-- IDEMPOTENTE: sí. `truncate` + `insert` permite re-snapshotear sin acumular.
--
-- TODO MANUAL COMPLEMENTARIO (NO en este script):
--   - pg_dump --schema-only --no-owner > docs/schema_baseline.sql
--   - pg_dump --data-only   --no-owner > backups/data_baseline_$(date +%F).sql
--   - Recuperar manualmente los DDL de allowed_emails / team_members /
--     get_my_role / is_my_owner_data desde `_baseline.*_snapshot` y agregarlos
--     a supabase_schema.sql.
--   - Levantar proyecto Supabase de staging y restaurar el dump.
--   - Correr la suite de tests existentes contra staging y confirmar verde.
--
-- ROLLBACK: ver final del archivo (drop schema _baseline cascade).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create schema if not exists _baseline;
comment on schema _baseline is
  'Snapshot pre-migración multi-tenant. Creado por 001_phase0_audit.sql. '
  'Seguro de dropear después de Fase 5 estable en producción.';

-- ────────────────────────────────────────────────────────────────────────
-- 1. Snapshot de policies vigentes
-- ────────────────────────────────────────────────────────────────────────

create table if not exists _baseline.policies_snapshot (
  schemaname     text,
  tablename      text,
  policyname     text,
  permissive     text,
  roles          text[],
  cmd            text,
  qual           text,
  with_check     text,
  snapshotted_at timestamptz default now()
);

truncate _baseline.policies_snapshot;

insert into _baseline.policies_snapshot
  (schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check)
  select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
   where schemaname = 'public';

-- ────────────────────────────────────────────────────────────────────────
-- 2. Snapshot de row counts (aproximados, basados en pg_stat_user_tables)
-- ────────────────────────────────────────────────────────────────────────

create table if not exists _baseline.table_counts (
  schemaname        text,
  tablename         text,
  approximate_count bigint,
  snapshotted_at    timestamptz default now()
);

truncate _baseline.table_counts;

insert into _baseline.table_counts (schemaname, tablename, approximate_count)
  select schemaname, relname, n_live_tup
    from pg_stat_user_tables
   where schemaname = 'public';

-- ────────────────────────────────────────────────────────────────────────
-- 3. Snapshot de tablas referenciadas pero no versionadas
--    (allowed_emails y team_members). Condicional: solo si existen.
-- ────────────────────────────────────────────────────────────────────────

do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'allowed_emails'
  ) then
    execute 'drop table if exists _baseline.allowed_emails_snapshot';
    execute $sql$
      create table _baseline.allowed_emails_snapshot as
      select *, clock_timestamp() as snapshotted_at from public.allowed_emails
    $sql$;
    raise notice 'allowed_emails snapshot creado';
  else
    raise notice 'allowed_emails no existe en este ambiente';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'team_members'
  ) then
    execute 'drop table if exists _baseline.team_members_snapshot';
    execute $sql$
      create table _baseline.team_members_snapshot as
      select *, clock_timestamp() as snapshotted_at from public.team_members
    $sql$;
    raise notice 'team_members snapshot creado';
  else
    raise notice 'team_members no existe en este ambiente';
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────
-- 4. Snapshot de definiciones de funciones helper del schema viejo
-- ────────────────────────────────────────────────────────────────────────

create table if not exists _baseline.function_defs (
  function_name  text,
  definition     text,
  snapshotted_at timestamptz default now()
);

truncate _baseline.function_defs;

insert into _baseline.function_defs (function_name, definition)
  select p.proname, pg_get_functiondef(p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (
       'get_my_role',
       'is_my_owner_data',
       'effective_user_id',
       'set_effective_user_id'
     );

-- ────────────────────────────────────────────────────────────────────────
-- 5. Snapshot de columnas con user_id (lista de tablas que migrarán a negocio_id)
-- ────────────────────────────────────────────────────────────────────────

create table if not exists _baseline.tables_with_user_id (
  tablename      text primary key,
  has_rls        boolean,
  policy_count   int,
  row_count_apx  bigint,
  snapshotted_at timestamptz default now()
);

truncate _baseline.tables_with_user_id;

insert into _baseline.tables_with_user_id (tablename, has_rls, policy_count, row_count_apx)
  select
    c.relname,
    c.relrowsecurity,
    (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname),
    s.n_live_tup
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   left join pg_stat_user_tables s on s.relname = c.relname and s.schemaname = 'public'
   join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped
  where n.nspname = 'public'
    and c.relkind = 'r'
  order by c.relname;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- QUERIES DE INSPECCIÓN (no modifican estado — usar para alimentar docs/baseline-policies.md)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Policies vigentes ordenadas:
--   select tablename, cmd, policyname, qual, with_check
--     from _baseline.policies_snapshot
--    order by tablename, cmd, policyname;
--
-- Tablas con user_id (futuras candidatas a negocio_id en Fase 2):
--   select * from _baseline.tables_with_user_id order by row_count_apx desc;
--
-- Funciones helper del schema viejo:
--   select function_name from _baseline.function_defs;
--   select definition from _baseline.function_defs where function_name = 'get_my_role';
--
-- Counts por tabla:
--   select tablename, approximate_count from _baseline.table_counts order by approximate_count desc;
--
-- Backup de membresías "team" actuales (si aplican):
--   select * from _baseline.allowed_emails_snapshot;
--   select * from _baseline.team_members_snapshot;
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK 001_phase0_audit.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- El rollback es trivial: el script solo agrega un schema aislado. Dropear el
-- schema completo borra todos los snapshots y no toca nada de producción.
--
-- begin;
--   drop schema if exists _baseline cascade;
-- commit;
-- ═══════════════════════════════════════════════════════════════════════════
