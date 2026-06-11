-- ═══════════════════════════════════════════════════════════════════════════
-- COBROS SUELTOS — ingresos no asociados a ningún pedido
--
-- Tabla + RLS siguiendo el patrón multitenant post-Fase 5:
--   - negocio_id NOT NULL, seteado por trigger set_negocio_id_default()
--   - policies canónicas con puede_leer / puede_administrar
--   - constraints de backend: monto > 0, descripción y método no vacíos
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create table if not exists cobros (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references negocios(id),
  user_id     uuid default auth.uid(),
  fecha       date not null,
  monto       numeric not null,
  descripcion text not null,
  metodo      text not null,
  created_at  timestamptz not null default now(),
  constraint cobros_monto_positivo      check (monto > 0),
  constraint cobros_descripcion_valida  check (length(trim(descripcion)) between 1 and 300),
  constraint cobros_metodo_valido       check (length(trim(metodo)) between 1 and 50),
  constraint cobros_fecha_razonable     check (fecha >= '2000-01-01' and fecha <= current_date + interval '1 day')
);

create index if not exists cobros_negocio_idx on cobros(negocio_id);
create index if not exists cobros_fecha_idx   on cobros(negocio_id, fecha);

drop trigger if exists cobros_set_negocio on cobros;
create trigger cobros_set_negocio before insert on cobros
  for each row execute function set_negocio_id_default();

alter table cobros enable row level security;

drop policy if exists cobros_select on cobros;
create policy cobros_select on cobros
  for select using (puede_leer(negocio_id));

drop policy if exists cobros_insert on cobros;
create policy cobros_insert on cobros
  for insert with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists cobros_update on cobros;
create policy cobros_update on cobros
  for update
  using (puede_administrar(negocio_id))
  with check (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

drop policy if exists cobros_delete on cobros;
create policy cobros_delete on cobros
  for delete using (
    puede_administrar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

commit;
