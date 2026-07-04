-- 024: Atomicidad al editar items de un pedido + nro de pedido único por negocio.
--
-- 1) reemplazar_pedido_items: antes el cliente hacía DELETE y luego INSERT en
--    requests separados; si el INSERT fallaba, el pedido quedaba sin items.
--    La función corre en una sola transacción. SECURITY INVOKER: las RLS
--    policies de pedido_items siguen aplicando (multitenancy intacta).
--
-- 2) Índice único (negocio_id, nro): el nro se calcula en el cliente y dos
--    dispositivos podían generar el mismo. Primero se renumeran los duplicados
--    existentes, después se crea el índice. El cliente reintenta ante 23505.

create or replace function reemplazar_pedido_items(p_pedido_id uuid, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from pedido_items where pedido_id = p_pedido_id;

  insert into pedido_items
    (pedido_id, producto_id, nombre, cantidad, precio_unitario, costo_unitario, entregado, fecha_entrega)
  select
    p_pedido_id,
    nullif(item->>'producto_id', '')::uuid,
    item->>'nombre',
    (item->>'cantidad')::numeric,
    (item->>'precio_unitario')::numeric,
    coalesce(nullif(item->>'costo_unitario', '')::numeric, 0),
    coalesce((item->>'entregado')::boolean, false),
    nullif(item->>'fecha_entrega', '')::date
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item;
end;
$$;

-- Renumerar nros duplicados dentro del mismo negocio (conserva el más antiguo)
do $$
declare
  r record;
  nuevo integer;
begin
  for r in
    select t.id, t.negocio_id from (
      select id, negocio_id,
             row_number() over (partition by negocio_id, nro order by created_at, id) as rn
      from pedidos
      where nro is not null and negocio_id is not null
    ) t
    where t.rn > 1
  loop
    select coalesce(max(nro), 0) + 1 into nuevo from pedidos where negocio_id = r.negocio_id;
    update pedidos set nro = nuevo where id = r.id;
  end loop;
end $$;

create unique index if not exists pedidos_negocio_nro_key
  on pedidos (negocio_id, nro)
  where nro is not null and negocio_id is not null;
