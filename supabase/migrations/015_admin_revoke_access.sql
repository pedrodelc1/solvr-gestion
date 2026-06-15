-- ═══════════════════════════════════════════════════════════════════════════
-- SUPERADMIN — quitar acceso desde la whitelist
--
-- Par de admin_grant_owner. Permite al superadmin revocar el acceso de una
-- persona del equipo de un negocio:
--   - lo saca de la whitelist (allowed_emails)
--   - si ya tiene cuenta, desactiva su membresía (negocio_members) salvo que
--     sea owner, para que pierda el acceso de inmediato, no solo a futuro.
--
-- Gateada por es_superadmin(). No permite auto-revocarse.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create or replace function admin_revoke_access(p_email text)
returns jsonb
language plpgsql security definer set search_path = public, auth, pg_catalog
as $$
declare
  v_email text;
  v_uid   uuid;
begin
  if not es_superadmin() then
    raise exception 'No autorizado';
  end if;

  v_email := lower(trim(p_email));

  if v_email = lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'No podés revocar tu propio acceso';
  end if;

  -- Quitar de la whitelist (corta futuros logins / claim)
  delete from allowed_emails where lower(email) = v_email;

  -- Si ya tiene cuenta, desactivar sus membresías (excepto owner)
  select id into v_uid from auth.users where lower(email) = v_email limit 1;
  if v_uid is not null then
    update negocio_members
       set activo = false, deactivated_at = now()
     where user_id = v_uid and rol <> 'owner';
  end if;

  return admin_whitelist();
end;
$$;

commit;
