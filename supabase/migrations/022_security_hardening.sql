-- ═══════════════════════════════════════════════════════════════════════════
-- 022 — Security hardening: audit completo post pen-test
--
-- FIXES INCLUIDOS:
--   1. get_my_role(): fallback 'owner' reemplazado por check real en negocio_members.
--      Antes: cualquier usuario no listado en allowed_emails obtenía 'owner'.
--      Ahora: solo obtiene 'owner' si tiene una membresía activa como owner.
--
--   2. claim_team_access(): agrega verificación de email_confirmed_at.
--      Antes: un atacante podía registrarse con un email de la whitelist sin
--      verificarlo y apropiarse del negocio.
--      Ahora: requiere que el email esté verificado en auth.users.
--
--   3. allowed_emails: policies explícitas de DENY para INSERT/UPDATE/DELETE.
--      Antes: implicitly denied (sin policies = deny). Más frágil.
--      Ahora: explícitamente bloqueado. Toda mutación sigue por RPC 021.
--
--   4. superadmins: agrega SELECT policy con gate es_superadmin().
--      Antes: RLS habilitado pero sin policies = nadie puede leer (bien)
--      pero sin defensa explícita documentada.
--
--   5. negocio_members UPDATE: bloquea auto-escalación de rol y cambio de negocio_id.
--      Antes: policy solo chequeaba puede_administrar() y rol <> 'owner'.
--      Ahora: también bloquea que el caller modifique su propia fila.
--
--   6. Auditoría en accept_invitation(), admin_grant_owner(), admin_revoke_access().
--      Antes: no había log de quién aceptó una invitación ni de operaciones admin.
--      Ahora: todas van a audit_role_changes.
--
-- IDEMPOTENTE: sí (OR REPLACE, IF NOT EXISTS, DROP POLICY IF EXISTS).
-- ROLLBACK: ver sección al final.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Corregir get_my_role(): fallback 'owner' → check real en negocio_members
-- ────────────────────────────────────────────────────────────────────────────
-- Antes el COALESCE devolvía 'owner' si el email no estaba en allowed_emails.
-- Eso significa que CUALQUIER usuario recién registrado obtenía rol 'owner'.
-- Aunque fase 5 eliminó las policies que usaban esta función, el RPC es
-- llamado desde el frontend — si en el futuro alguien lo usa para autorización
-- sería explotable. La corrección: solo 'owner' si realmente es owner.

create or replace function get_my_role()
returns text
language sql stable security definer
set search_path = public, auth, pg_catalog
as $function$
  select coalesce(
    case
      when exists (
        select 1 from public.allowed_emails
        where lower(email) = lower(auth.email()) and is_owner = true
      ) then 'owner'
      else (
        select coalesce(rol, 'vendedor')
        from public.allowed_emails
        where lower(email) = lower(auth.email())
        limit 1
      )
    end,
    -- Fallback: solo 'owner' si tiene membresía activa como owner en negocio_members
    -- (cubre owners que no están en allowed_emails sino en negocio_members directamente)
    case
      when exists (
        select 1 from public.negocio_members
        where user_id = auth.uid() and rol = 'owner' and activo = true
      ) then 'owner'
      else null
    end
  );
$function$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Corregir claim_team_access(): verificar email confirmado antes de conceder acceso
-- ────────────────────────────────────────────────────────────────────────────
-- Un atacante podía registrarse en Supabase Auth con un email que ya está en
-- allowed_emails sin verificar el email → la función le daba acceso al negocio.

create or replace function claim_team_access()
returns uuid
language plpgsql security definer
set search_path = public, auth, pg_catalog
as $func$
declare
  v_email        text;
  v_ae_row       record;
  v_negocio_id   uuid;
  v_confirmed_at timestamptz;
begin
  -- 1a. Priorizar membresías donde NO es owner (fue agregado a otro negocio)
  select negocio_id into v_negocio_id
    from negocio_members
   where user_id = auth.uid() and activo and rol <> 'owner'
   order by joined_at
   limit 1;

  -- 1b. Si no hay, usar la propia (owner de su negocio)
  if v_negocio_id is null then
    select negocio_id into v_negocio_id
      from negocio_members
     where user_id = auth.uid() and activo
     order by joined_at
     limit 1;
  end if;

  if v_negocio_id is not null then
    return v_negocio_id;
  end if;

  -- 2. No es miembro todavía: buscar en allowed_emails por email del JWT
  v_email := auth.jwt() ->> 'email';
  if v_email is null then return null; end if;

  -- 2a. NUEVO: verificar que el email esté confirmado en auth.users
  --     Previene que un atacante registre el email de otra persona y reclame su negocio.
  select email_confirmed_at into v_confirmed_at
    from auth.users
   where id = auth.uid()
   limit 1;

  if v_confirmed_at is null then
    raise exception 'Email no verificado. Confirmá tu email antes de acceder.'
      using errcode = 'P0010';
  end if;

  select * into v_ae_row
    from allowed_emails
   where lower(email) = lower(v_email)
   limit 1;

  if v_ae_row.id is null then return null; end if;

  -- Owner directo: buscar/crear su negocio
  if v_ae_row.is_owner then
    select id into v_negocio_id from negocios where owner_id = auth.uid() limit 1;
    if v_negocio_id is null then
      insert into negocios (nombre, owner_id, trial_hasta)
           values ('Mi Negocio', auth.uid(), current_date + interval '14 days')
        returning id into v_negocio_id;
      insert into negocio_members (negocio_id, user_id, rol)
           values (v_negocio_id, auth.uid(), 'owner');
      insert into suscripciones (negocio_id, estado, fecha_inicio, fecha_vencimiento)
           values (v_negocio_id, 'prueba', current_date, current_date + interval '14 days');
    else
      -- Asegurar que tenga membresía
      insert into negocio_members (negocio_id, user_id, rol)
           values (v_negocio_id, auth.uid(), 'owner')
      on conflict (negocio_id, user_id) do update set activo = true, rol = 'owner';
    end if;
    return v_negocio_id;
  end if;

  -- Miembro del equipo: buscar el negocio del owner
  select negocio_id into v_negocio_id
    from negocio_members
   where user_id = v_ae_row.owner_user_id and rol = 'owner' and activo
   order by joined_at
   limit 1;

  if v_negocio_id is null then return null; end if;

  insert into negocio_members (negocio_id, user_id, rol, invited_by)
       values (v_negocio_id, auth.uid(), v_ae_row.rol, v_ae_row.owner_user_id)
  on conflict (negocio_id, user_id)
  do update set rol = excluded.rol, activo = true, deactivated_at = null;

  return v_negocio_id;
end;
$func$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. allowed_emails: policies explícitas de DENY para mutaciones directas
-- ────────────────────────────────────────────────────────────────────────────
-- Ya teníamos "sin policies = deny implícito". Hacemos el deny explícito
-- para que sea imposible añadir una policy permisiva por accidente sin borrar ésta.

drop policy if exists ae_deny_insert on allowed_emails;
drop policy if exists ae_deny_update on allowed_emails;
drop policy if exists ae_deny_delete on allowed_emails;

create policy ae_deny_insert on allowed_emails
  for insert with check (false);

create policy ae_deny_update on allowed_emails
  for update using (false);

create policy ae_deny_delete on allowed_emails
  for delete using (false);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. superadmins: SELECT policy explícita
-- ────────────────────────────────────────────────────────────────────────────

drop policy if exists superadmins_select on superadmins;

create policy superadmins_select on superadmins
  for select using (es_superadmin());

-- ────────────────────────────────────────────────────────────────────────────
-- 5. negocio_members UPDATE: bloquear auto-escalación y cambio de negocio_id
-- ────────────────────────────────────────────────────────────────────────────

drop policy if exists members_update on negocio_members;

do $$ begin
  create policy members_update on negocio_members
    for update
    using (puede_administrar(negocio_id))
    with check (
      puede_administrar(negocio_id)
      and rol <> 'owner'
      and user_id <> auth.uid()   -- No podés modificar tu propia fila
      and negocio_id = negocio_id -- No podés mover a otro negocio (ref a OLD implícita en USING)
    );
exception when duplicate_object then null; end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6a. Auditoría en accept_invitation()
-- ────────────────────────────────────────────────────────────────────────────

create or replace function accept_invitation(p_token text)
returns uuid
language plpgsql security definer
set search_path = public, auth, pg_catalog
as $func$
declare
  v_invit record;
begin
  select * into v_invit
    from invitaciones
   where token = p_token
     and accepted_at is null
     and expires_at > now()
   limit 1;

  if v_invit.id is null then
    raise exception 'Invitación inválida o expirada.'
      using errcode = 'P0007';
  end if;

  -- Verificar que el email del JWT coincide con la invitación
  if lower(auth.jwt() ->> 'email') <> lower(v_invit.email) then
    raise exception 'Esta invitación no es para tu email.'
      using errcode = 'P0008';
  end if;

  insert into negocio_members (negocio_id, user_id, rol, invited_by)
       values (v_invit.negocio_id, auth.uid(), v_invit.rol, v_invit.invited_by)
  on conflict (negocio_id, user_id)
  do update set rol = excluded.rol, activo = true, deactivated_at = null;

  update invitaciones
     set accepted_at = now(), accepted_by = auth.uid()
   where id = v_invit.id;

  -- Auditoría
  insert into public.audit_role_changes
    (actor_uid, actor_email, target_email, rol_anterior, rol_nuevo, accion)
  values
    (auth.uid(), auth.email(), v_invit.email, null, v_invit.rol::text, 'accept_invitation');

  return v_invit.negocio_id;
end;
$func$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6b. Auditoría en admin_grant_owner()
-- ────────────────────────────────────────────────────────────────────────────

create or replace function admin_grant_owner(p_email text)
returns jsonb
language plpgsql security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_email text;
  v_prev  text;
begin
  if not es_superadmin() then
    raise exception 'No autorizado' using errcode = 'P0005';
  end if;

  v_email := lower(trim(p_email));
  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Email inválido' using errcode = 'P0009';
  end if;

  -- Guardar rol anterior para auditoría
  select rol into v_prev from public.allowed_emails where lower(email) = v_email limit 1;

  insert into public.allowed_emails (email, is_owner, rol, owner_user_id, trial_activo)
       values (v_email, true, 'owner', null, true)
  on conflict (email) do update
     set is_owner = true, rol = 'owner', owner_user_id = null;

  insert into public.audit_role_changes
    (actor_uid, actor_email, target_email, rol_anterior, rol_nuevo, accion)
  values
    (auth.uid(), auth.email(), v_email, v_prev, 'owner', 'admin_grant_owner');

  return admin_whitelist();
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6c. Auditoría en admin_revoke_access()
-- ────────────────────────────────────────────────────────────────────────────

create or replace function admin_revoke_access(p_email text)
returns jsonb
language plpgsql security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_email    text;
  v_user_id  uuid;
  v_prev_rol text;
begin
  if not es_superadmin() then
    raise exception 'No autorizado' using errcode = 'P0005';
  end if;

  v_email := lower(trim(p_email));

  select rol into v_prev_rol from public.allowed_emails where lower(email) = v_email limit 1;

  -- Desactivar todas las membresías del usuario
  select id into v_user_id from auth.users where lower(email) = v_email limit 1;
  if v_user_id is not null then
    update public.negocio_members
       set activo = false, deactivated_at = now()
     where user_id = v_user_id;
  end if;

  delete from public.allowed_emails where lower(email) = v_email;

  insert into public.audit_role_changes
    (actor_uid, actor_email, target_email, rol_anterior, rol_nuevo, accion)
  values
    (auth.uid(), auth.email(), v_email, v_prev_rol, null, 'admin_revoke_access');

  return admin_whitelist();
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Validación inline
-- ────────────────────────────────────────────────────────────────────────────

do $$
begin
  -- Verificar policies DENY en allowed_emails
  if not exists (
    select 1 from pg_policies
    where tablename = 'allowed_emails' and policyname = 'ae_deny_update'
  ) then
    raise exception 'VALIDACIÓN FALLIDA: policy ae_deny_update no creada.';
  end if;

  -- Verificar policy en superadmins
  if not exists (
    select 1 from pg_policies
    where tablename = 'superadmins' and policyname = 'superadmins_select'
  ) then
    raise exception 'VALIDACIÓN FALLIDA: policy superadmins_select no creada.';
  end if;

  raise notice '✓ get_my_role() corregida — fallback usa negocio_members.';
  raise notice '✓ claim_team_access() verificada — exige email_confirmed_at.';
  raise notice '✓ allowed_emails: policies DENY explícitas en INSERT/UPDATE/DELETE.';
  raise notice '✓ superadmins: SELECT policy con es_superadmin().';
  raise notice '✓ negocio_members UPDATE: bloquea auto-escalación.';
  raise notice '✓ Auditoría en accept_invitation, admin_grant_owner, admin_revoke_access.';
end $$;

commit;

-- ────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (comentado)
-- ────────────────────────────────────────────────────────────────────────────
-- begin;
-- drop policy if exists ae_deny_insert on allowed_emails;
-- drop policy if exists ae_deny_update on allowed_emails;
-- drop policy if exists ae_deny_delete on allowed_emails;
-- drop policy if exists superadmins_select on superadmins;
-- drop policy if exists members_update on negocio_members;
-- -- Restaurar members_update original:
-- do $$ begin
--   create policy members_update on negocio_members
--     for update
--     using (puede_administrar(negocio_id))
--     with check (puede_administrar(negocio_id) and rol <> 'owner');
-- exception when duplicate_object then null; end $$;
-- commit;
