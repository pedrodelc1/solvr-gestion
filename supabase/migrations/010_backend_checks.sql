-- ═══════════════════════════════════════════════════════════════════════════
-- DOBLE VERIFICACIÓN — constraints de backend
--
-- El frontend valida formato y rangos, pero el backend no confía en él.
-- Estos CHECK garantizan que ningún cliente (ni un frontend bypasseado)
-- pueda insertar montos negativos, cantidades inválidas o textos vacíos.
--
-- NOT VALID: las filas existentes no se re-validan (evita que la migration
-- falle por datos históricos); todo INSERT/UPDATE nuevo sí se valida.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── clientes ──────────────────────────────────────────────
alter table clientes drop constraint if exists clientes_nombre_no_vacio;
alter table clientes add constraint clientes_nombre_no_vacio
  check (length(trim(nombre)) > 0) not valid;

alter table clientes drop constraint if exists clientes_saldo_inicial_no_negativo;
alter table clientes add constraint clientes_saldo_inicial_no_negativo
  check (saldo_inicial >= 0) not valid;

-- ── productos ─────────────────────────────────────────────
alter table productos drop constraint if exists productos_nombre_no_vacio;
alter table productos add constraint productos_nombre_no_vacio
  check (length(trim(nombre)) > 0) not valid;

alter table productos drop constraint if exists productos_precio_no_negativo;
alter table productos add constraint productos_precio_no_negativo
  check (precio >= 0) not valid;

alter table productos drop constraint if exists productos_costo_no_negativo;
alter table productos add constraint productos_costo_no_negativo
  check (costo >= 0) not valid;

alter table productos drop constraint if exists productos_mayorista_no_negativo;
alter table productos add constraint productos_mayorista_no_negativo
  check (precio_mayorista >= 0) not valid;

alter table productos drop constraint if exists productos_stock_no_negativo;
alter table productos add constraint productos_stock_no_negativo
  check (stock >= 0) not valid;

alter table productos drop constraint if exists productos_stock_minimo_no_negativo;
alter table productos add constraint productos_stock_minimo_no_negativo
  check (stock_minimo >= 0) not valid;

-- ── pedidos ───────────────────────────────────────────────
alter table pedidos drop constraint if exists pedidos_total_calculado_no_negativo;
alter table pedidos add constraint pedidos_total_calculado_no_negativo
  check (total_calculado >= 0) not valid;

alter table pedidos drop constraint if exists pedidos_total_final_no_negativo;
alter table pedidos add constraint pedidos_total_final_no_negativo
  check (total_final >= 0) not valid;

alter table pedidos drop constraint if exists pedidos_monto_abonado_no_negativo;
alter table pedidos add constraint pedidos_monto_abonado_no_negativo
  check (monto_abonado >= 0) not valid;

alter table pedidos drop constraint if exists pedidos_cuotas_validas;
alter table pedidos add constraint pedidos_cuotas_validas
  check (cuotas >= 1) not valid;

alter table pedidos drop constraint if exists pedidos_dias_plazo_no_negativo;
alter table pedidos add constraint pedidos_dias_plazo_no_negativo
  check (dias_plazo >= 0) not valid;

alter table pedidos drop constraint if exists pedidos_tasa_mora_no_negativa;
alter table pedidos add constraint pedidos_tasa_mora_no_negativa
  check (tasa_mora >= 0) not valid;

alter table pedidos drop constraint if exists pedidos_descuento_no_negativo;
alter table pedidos add constraint pedidos_descuento_no_negativo
  check (descuento_valor >= 0) not valid;

-- ── pedido_items ──────────────────────────────────────────
alter table pedido_items drop constraint if exists pedido_items_cantidad_positiva;
alter table pedido_items add constraint pedido_items_cantidad_positiva
  check (cantidad > 0) not valid;

alter table pedido_items drop constraint if exists pedido_items_precio_no_negativo;
alter table pedido_items add constraint pedido_items_precio_no_negativo
  check (precio_unitario >= 0) not valid;

-- ── gastos ────────────────────────────────────────────────
alter table gastos drop constraint if exists gastos_monto_positivo;
alter table gastos add constraint gastos_monto_positivo
  check (monto > 0) not valid;

alter table gastos drop constraint if exists gastos_descripcion_no_vacia;
alter table gastos add constraint gastos_descripcion_no_vacia
  check (length(trim(descripcion)) > 0) not valid;

-- ── devoluciones ──────────────────────────────────────────
alter table devoluciones drop constraint if exists devoluciones_monto_no_negativo;
alter table devoluciones add constraint devoluciones_monto_no_negativo
  check (monto_total >= 0) not valid;

alter table devolucion_items drop constraint if exists devolucion_items_cantidad_positiva;
alter table devolucion_items add constraint devolucion_items_cantidad_positiva
  check (cantidad > 0) not valid;

commit;
