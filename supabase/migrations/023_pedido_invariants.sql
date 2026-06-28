-- 023_pedido_invariants.sql
-- Defense-in-depth: CHECK constraints que cierran agujeros de lógica de negocio
-- que el frontend podría bypassear (descuento > 100%, abonado > total, etc.)

-- Descuento porcentaje no puede superar el 100
alter table pedidos drop constraint if exists pedidos_descuento_porcentaje_max;
alter table pedidos add constraint pedidos_descuento_porcentaje_max
  check (
    descuento_tipo is null
    or descuento_tipo <> 'porcentaje'
    or descuento_valor is null
    or descuento_valor <= 100
  ) not valid;

-- Total final no puede ser mayor que total calculado (defensa: descuento no infla el total)
alter table pedidos drop constraint if exists pedidos_total_final_lte_calculado;
alter table pedidos add constraint pedidos_total_final_lte_calculado
  check (
    total_final is null
    or total_calculado is null
    or total_final <= total_calculado + 0.01
  ) not valid;

-- Monto abonado no negativo ni superior al total final
alter table pedidos drop constraint if exists pedidos_abonado_no_negativo;
alter table pedidos add constraint pedidos_abonado_no_negativo
  check (monto_abonado is null or monto_abonado >= 0) not valid;

alter table pedidos drop constraint if exists pedidos_abonado_lte_total;
alter table pedidos add constraint pedidos_abonado_lte_total
  check (
    monto_abonado is null
    or total_final is null
    or monto_abonado <= total_final + 0.01
  ) not valid;

-- Items: cantidad > 0, precio >= 0
alter table pedido_items drop constraint if exists pedido_items_cantidad_positiva;
alter table pedido_items add constraint pedido_items_cantidad_positiva
  check (cantidad > 0) not valid;

alter table pedido_items drop constraint if exists pedido_items_precio_no_negativo;
alter table pedido_items add constraint pedido_items_precio_no_negativo
  check (precio_unitario >= 0) not valid;
