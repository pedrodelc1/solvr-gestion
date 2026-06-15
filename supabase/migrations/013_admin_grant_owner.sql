-- ═══════════════════════════════════════════════════════════════════════════
-- SUPERADMIN — dar acceso a un NUEVO dueño de negocio
--
-- Hasta ahora autorizar un dueño nuevo se hacía a mano (insert en
-- allowed_emails). Esta RPC lo expone al panel de superadmin de forma segura:
--   - gateada por es_superadmin() en el backend (doble verificación)
--   - inserta el email como is_owner = true
--   - al iniciar sesión, claim_team_access() le crea su negocio + trial
--
-- Reutiliza admin_whitelist() para devolver la lista actualizada.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create or replace function admin_grant_owner(p_email text)
returns jsonb
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare
  v_email text;
begin
  if not es_superadmin() then
    raise exception 'No autorizado';
  end if;

  v_email := lower(trim(p_email));
  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Email inválido';
  end if;

  insert into allowed_emails (email, is_owner, rol, owner_user_id, trial_activo)
       values (v_email, true, 'owner', null, true)
  on conflict (email) do update
     set is_owner = true,
         rol = 'owner',
         owner_user_id = null;

  return admin_whitelist();
end;
$$;

commit;
