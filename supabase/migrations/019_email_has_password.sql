-- ═══════════════════════════════════════════════════════════════════════════
-- email_has_password(email)
--
-- Permite al frontend saber si un email del whitelist ya tiene contraseña
-- configurada en auth.users. Si no la tiene (primer ingreso o usuario que
-- nunca seteó password), la única forma válida es magic link. El gate real
-- está en Supabase Auth — esta RPC es solo para UX: deja redirigir al magic
-- link automáticamente en vez de tirar "Credenciales incorrectas".
--
-- Security definer porque auth.users no es accesible a authenticated/anon.
-- Solo expone un booleano. No filtra emails: si el email no existe en
-- auth.users devuelve false (mismo resultado que "no tiene password").
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create or replace function email_has_password(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_has boolean;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    return false;
  end if;

  select (encrypted_password is not null and length(encrypted_password) > 0)
    into v_has
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  return coalesce(v_has, false);
end;
$$;

revoke all on function email_has_password(text) from public;
grant execute on function email_has_password(text) to anon, authenticated;

commit;
