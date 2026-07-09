-- ═══════════════════════════════════════════════════════════════════════════
-- CATALOGAR ÍTEMS MANUALES
--
-- Todo ítem de pedido cargado a mano (producto_id null) debe terminar en el
-- catálogo. El frontend ya crea el producto antes de guardar el pedido, pero
-- este trigger es la garantía server-side: cubre bypass del frontend y a los
-- roles que no pueden insertar en productos (vendedor), por eso es SECURITY
-- DEFINER y deriva negocio/usuario de la fila del pedido, nunca del cliente.
--
-- Dedup por nombre (case-insensitive) dentro del negocio: si el producto ya
-- existe se linkea, si no se crea con stock 0 y sin alerta de stock mínimo.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create or replace function catalogar_item_manual()
returns trigger
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare
  v_negocio uuid;
  v_user uuid;
  v_prod uuid;
  v_nombre text;
begin
  if new.producto_id is not null then
    return new;
  end if;

  v_nombre := nullif(trim(new.nombre), '');
  if v_nombre is null then
    return new;
  end if;

  select negocio_id, user_id into v_negocio, v_user
  from pedidos where id = new.pedido_id;
  if v_negocio is null then
    return new;
  end if;

  select id into v_prod
  from productos
  where negocio_id = v_negocio
    and lower(trim(nombre)) = lower(v_nombre)
  limit 1;

  if v_prod is null then
    insert into productos (id, negocio_id, user_id, nombre, precio, costo, stock, stock_minimo)
    values (
      gen_random_uuid(), v_negocio, v_user, v_nombre,
      greatest(0, coalesce(new.precio_unitario, 0)),
      greatest(0, coalesce(new.costo_unitario, 0)),
      0, 0
    )
    returning id into v_prod;
  end if;

  new.producto_id := v_prod;
  return new;
end;
$$;

drop trigger if exists trg_catalogar_item_manual on pedido_items;
create trigger trg_catalogar_item_manual
  before insert on pedido_items
  for each row execute function catalogar_item_manual();

commit;
