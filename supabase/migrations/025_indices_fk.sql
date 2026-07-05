-- ═══════════════════════════════════════════════════════════════════════════
-- 025 — Índices para FKs consultadas sin índice (Postgres no indexa FKs solo)
--
--   pedido_items.pedido_id: cada edición/entrega/borrado de pedido filtra por
--     esta columna, y el ON DELETE CASCADE la escanea entera al borrar un pedido.
--   pedidos.cliente_id: saldos y filtros por cliente.
--   comunicaciones.cliente_id: historial por cliente en ClienteDetail.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create index if not exists pedido_items_pedido_idx    on pedido_items(pedido_id);
create index if not exists pedidos_cliente_idx        on pedidos(cliente_id);
create index if not exists comunicaciones_cliente_idx on comunicaciones(cliente_id);

commit;
