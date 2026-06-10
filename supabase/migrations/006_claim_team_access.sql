-- RPC claim_team_access()
--
-- Resuelve qué negocio_id usar al iniciar sesión:
--   1. Si ya es miembro no-owner → devuelve ese negocio (fue agregado por alguien)
--   2. Si solo es owner → devuelve su propio negocio
--   3. Si no es miembro → busca en allowed_emails y crea la membresía

create or replace function claim_team_access()
returns uuid
language plpgsql security definer
set search_path = public, auth, pg_catalog
as $func$
declare
  v_email      text;
  v_ae_row     record;
  v_negocio_id uuid;
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
      insert into negocio_members (negocio_id, user_id, rol)
           values (v_negocio_id, auth.uid(), 'owner')
      on conflict (negocio_id, user_id)
      do update set activo = true, deactivated_at = null;
    end if;
    return v_negocio_id;
  end if;

  -- Miembro de equipo: unirse al negocio del owner
  if v_ae_row.owner_user_id is null then return null; end if;

  select id into v_negocio_id from negocios where id = v_ae_row.owner_user_id;
  if v_negocio_id is null then return null; end if;

  insert into negocio_members (negocio_id, user_id, rol)
       values (
         v_negocio_id,
         auth.uid(),
         (case v_ae_row.rol
            when 'admin'    then 'admin'
            when 'vendedor' then 'vendedor'
            else                 'visualizador'
          end)::rol_negocio
       )
  on conflict (negocio_id, user_id)
  do update set
    rol            = excluded.rol,
    activo         = true,
    deactivated_at = null;

  return v_negocio_id;
end;
$func$;
