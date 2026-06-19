-- Agrega campo confirmado a pedidos.
-- true (default) = pedido real, cuenta en el saldo del cliente.
-- false = intención de compra/borrador, NO cuenta en el saldo.
-- Los pedidos existentes quedan como confirmado = true (backward compat).

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS confirmado boolean NOT NULL DEFAULT true;

-- Índice para filtrar saldo eficientemente
CREATE INDEX IF NOT EXISTS pedidos_confirmado_idx ON pedidos (negocio_id, confirmado)
  WHERE confirmado = true;

COMMENT ON COLUMN pedidos.confirmado IS
  'true = venta real (suma al saldo del cliente). false = intención de compra / draft (sin efecto en saldo).';
