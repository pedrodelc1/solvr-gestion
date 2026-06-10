-- RPC claim_team_access()
--
-- Solución general al problema de login:
-- El nuevo flujo (Fase 4) verifica negocio_members, pero los usuarios pueden
-- estar en allowed_emails sin tener entrada en negocio_members (agregados antes
-- del trigger actualizado, o cuya cuenta no existía cuando se corrió la Fase 1).
--
-- Esta función es llamada desde App.jsx al iniciar sesión. Si el usuario ya
-- tiene membresía, la devuelve. Si no tiene, busca en allowed_emails y crea
-- la membresía automáticamente. Así no se necesita ningún paso manual.

create or replace function claim_team_access()
returns uuid
language plpgsql security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_email      text;
  v_ae_row     record;
  v_negocio_id uuid;
begin
  -- 1. Ya es miembro activo → devolver su negocio_id
  select negocio_id into v_negocio_id
    from negocio_members
   where user_id = auth.uid() and activo
   order by joined_at
   limit 1;

  if v_negocio_id is not null then
    return v_negocio_id;
  end if;

  -- 2. No es miembro → buscar en allowed_emails por el email del JWT
  v_email := auth.jwt() ->> 'email';
  if v_email is null then
    return null;
  end if;

  select * into v_ae_row
    from allowed_emails
   where lower(email) = lower(v_email)
   limit 1;

  if v_ae_row.id is null then
    return null;  -- email no autorizado
  end if;

  -- Owner directo: su negocio_id = su propio user_id (Fase 1 lo creó así)
  if v_ae_row.is_owner then
    select id into v_negocio_id from negocios where owner_id = auth.uid() limit 1;
    if v_negocio_id is null then
      -- Crear negocio si no existe (usuario registrado antes de Fase 1)
      insert into negocios (nombre, owner_id, trial_hasta)
           values ('Mi Negocio', auth.uid(), current_date + interval '14 days')
        returning id into v_negocio_id;
      insert into negocio_members (negocio_id, user_id, rol)
           values (v_negocio_id, auth.uid(), 'owner');
      insert into suscripciones (negocio_id, estado, fecha_inicio, fecha_vencimiento)
           values (v_negocio_id, 'prueba', current_date, current_date + interval '14 days');
    else
      insert into negocio_members (negocio_id, user_id, rol)
           values (v_negocio_id, auth.uid(), 'owner')
      on conflict (negocio_id, user_id)
      do update set activo = true, deactivated_at = null;
    end if;
    return v_negocio_id;
  end if;

  -- Miembro de equipo: unirse al negocio del owner
  if v_ae_row.owner_user_id is null then
    return null;
  end if;

  select id into v_negocio_id from negocios where id = v_ae_row.owner_user_id;
  if v_negocio_id is null then
    return null;  -- el owner no tiene negocio todavía
  end if;

  insert into negocio_members (negocio_id, user_id, rol)
       values (
         v_negocio_id,
         auth.uid(),
         (case v_ae_row.rol
            when 'admin'    then 'admin'::rol_negocio
            when 'vendedor' then 'vendedor'::rol_negocio
            else                 'visualizador'::rol_negocio
          end)
       )
  on conflict (negocio_id, user_id)
  do update set
    rol           = excluded.rol,
    activo        = true,
    deactivated_at = null;

  return v_negocio_id;
end;
$$;
