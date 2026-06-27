-- ═══════════════════════════════════════════════════════════════════════════
-- check_primer_acceso(p_email text)
--
-- Verifica si un email está en la whitelist y si no posee contraseña aún.
-- Si ya tiene contraseña configurada o no está en la whitelist, lanza un error.
-- Esto actúa como doble verificación en el backend para el flujo de primer ingreso.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create or replace function check_primer_acceso(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_allowed boolean;
  v_has_password boolean;
  v_email text;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'El email no puede estar vacío';
  end if;

  v_email := lower(trim(p_email));

  -- 1. Verificar si está en la whitelist (allowed_emails)
  select exists (
    select 1 from public.allowed_emails
    where lower(email) = v_email
  ) into v_allowed;

  -- Bypassear whitelist si es superadmin (según tabla superadmins)
  if not v_allowed then
    select exists (
      select 1 from public.superadmins
      where lower(email) = v_email
    ) into v_allowed;
  end if;

  if not coalesce(v_allowed, false) then
    raise exception 'Este email no tiene acceso. Contactá al administrador.';
  end if;

  -- 2. Verificar si ya posee contraseña
  select (encrypted_password is not null and length(encrypted_password) > 0)
    into v_has_password
  from auth.users
  where lower(email) = v_email
  limit 1;

  if coalesce(v_has_password, false) then
    raise exception 'Este email ya está registrado y tiene una contraseña. Iniciá sesión con tu contraseña.';
  end if;

  return true;
end;
$$;

revoke all on function check_primer_acceso(text) from public;
grant execute on function check_primer_acceso(text) to anon, authenticated;

commit;
