-- ═══════════════════════════════════════════════════════════════════════════
-- COBROS — asociar opcionalmente a un cliente
--
-- "Registrar cobro" pasa de Caja a Pedidos y ahora permite indicar de qué
-- cliente es el cobro (pagos de saldo pendiente, muchas veces importado).
-- El cobro asociado a un cliente reduce su saldo en el frontend (se trata
-- como crédito), igual que una devolución.
--
-- cliente_id es NULLABLE: los cobros realmente "sueltos" (mostrador, señas
-- sin cliente) siguen siendo válidos sin cliente.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table cobros
  add column if not exists cliente_id uuid references clientes(id) on delete set null;

create index if not exists cobros_cliente_idx on cobros(cliente_id);

commit;
