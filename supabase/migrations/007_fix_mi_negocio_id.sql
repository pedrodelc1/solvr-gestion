-- Fix mi_negocio_id(): priorizar membresías no-owner
--
-- Problema: usuarios con membresía en múltiples negocios (su propio como owner
-- + otro como admin/vendedor) veían su negocio vacío en lugar del negocio al
-- que fueron agregados. El trigger set_negocio_id_default también usaba la
-- función y asignaba el negocio_id incorrecto en los inserts.
--
-- Solución: misma lógica que claim_team_access — si hay membresía no-owner,
-- priorizarla sobre la propia.

create or replace function mi_negocio_id()
returns uuid
language sql stable security definer set search_path = public, pg_catalog
as $func$
  with claimed as (
    select nullif(
      coalesce(
        auth.jwt() -> 'user_metadata' ->> 'active_negocio_id',
        auth.jwt() ->> 'active_negocio_id'
      ), ''
    )::uuid as id
  ),
  validated as (
    select c.id from claimed c
     where c.id is not null
       and exists (
         select 1 from negocio_members
          where user_id = auth.uid() and negocio_id = c.id and activo
       )
  )
  select coalesce(
    (select id from validated),
    (select negocio_id from negocio_members
      where user_id = auth.uid() and activo and rol <> 'owner'
      order by joined_at limit 1),
    (select negocio_id from negocio_members
      where user_id = auth.uid() and activo
      order by joined_at limit 1)
  );
$func$;
