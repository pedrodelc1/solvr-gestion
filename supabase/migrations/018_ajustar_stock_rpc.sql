-- ═══════════════════════════════════════════════════════════════════════════
-- AJUSTE DE STOCK ATÓMICO (1 round-trip)
--
-- Antes, descontar stock al crear un pedido hacía SELECT + UPDATE por producto
-- (2 round-trips cada uno) y además no era atómico. Este RPC lo resuelve en una
-- sola ida, atómico y race-safe (greatest(0, ...) evita stock negativo).
--
-- Scopeado al negocio del usuario: solo toca productos del propio negocio, así
-- nadie puede alterar stock ajeno aunque pase un id arbitrario.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create or replace function ajustar_stock(p_producto_id uuid, p_delta numeric)
returns void
language sql security definer set search_path = public, pg_catalog
as $$
  update productos
  set stock = greatest(0, coalesce(stock, 0) + p_delta)
  where id = p_producto_id
    and negocio_id = mi_negocio_id();
$$;

grant execute on function ajustar_stock(uuid, numeric) to authenticated;

commit;
