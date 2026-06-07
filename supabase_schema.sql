-- Solvr Gestión — Supabase Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ── clientes ─────────────────────────────────────────────
create table if not exists clientes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nombre      text not null,
  contacto    text default '',
  created_at  timestamptz default now()
);

alter table clientes enable row level security;

create policy "clientes_select" on clientes for select using (auth.uid() = user_id);
create policy "clientes_insert" on clientes for insert with check (auth.uid() = user_id);
create policy "clientes_update" on clientes for update using (auth.uid() = user_id);
create policy "clientes_delete" on clientes for delete using (auth.uid() = user_id);

-- ── productos ─────────────────────────────────────────────
create table if not exists productos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nombre      text not null,
  precio      numeric not null default 0,
  costo       numeric not null default 0,
  created_at  timestamptz default now()
);

alter table productos enable row level security;

create policy "productos_select" on productos for select using (auth.uid() = user_id);
create policy "productos_insert" on productos for insert with check (auth.uid() = user_id);
create policy "productos_update" on productos for update using (auth.uid() = user_id);
create policy "productos_delete" on productos for delete using (auth.uid() = user_id);

-- ── pedidos ───────────────────────────────────────────────
create table if not exists pedidos (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  cliente_id         uuid references clientes(id) on delete set null,
  fecha              date not null,
  total_calculado    numeric not null default 0,
  total_final        numeric not null default 0,
  medio_pago         text not null default 'efectivo', -- valores válidos: efectivo, transferencia, tarjeta
  cuotas             integer not null default 1,
  cobrado            boolean not null default false,
  monto_abonado      numeric not null default 0,
  created_at         timestamptz default now()
);

alter table pedidos enable row level security;

create policy "pedidos_select" on pedidos for select using (auth.uid() = user_id);
create policy "pedidos_insert" on pedidos for insert with check (auth.uid() = user_id);
create policy "pedidos_update" on pedidos for update using (auth.uid() = user_id);
create policy "pedidos_delete" on pedidos for delete using (auth.uid() = user_id);

-- ── pedido_items ──────────────────────────────────────────
create table if not exists pedido_items (
  id               uuid primary key default gen_random_uuid(),
  pedido_id        uuid not null references pedidos(id) on delete cascade,
  producto_id      uuid references productos(id) on delete set null,
  nombre           text not null,
  cantidad         integer not null default 1,
  precio_unitario  numeric not null default 0,
  costo_unitario   numeric not null default 0
);

alter table pedido_items enable row level security;

create policy "pedido_items_select" on pedido_items for select
  using (exists (select 1 from pedidos where pedidos.id = pedido_items.pedido_id and pedidos.user_id = auth.uid()));
create policy "pedido_items_insert" on pedido_items for insert
  with check (exists (select 1 from pedidos where pedidos.id = pedido_items.pedido_id and pedidos.user_id = auth.uid()));
create policy "pedido_items_update" on pedido_items for update
  using (exists (select 1 from pedidos where pedidos.id = pedido_items.pedido_id and pedidos.user_id = auth.uid()));
create policy "pedido_items_delete" on pedido_items for delete
  using (exists (select 1 from pedidos where pedidos.id = pedido_items.pedido_id and pedidos.user_id = auth.uid()));

-- ── gastos ────────────────────────────────────────────────
create table if not exists gastos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  fecha        date not null,
  descripcion  text not null,
  monto        numeric not null default 0,
  categoria    text not null default 'Otros',
  created_at   timestamptz default now()
);

alter table gastos enable row level security;

create policy "gastos_select" on gastos for select using (auth.uid() = user_id);
create policy "gastos_insert" on gastos for insert with check (auth.uid() = user_id);
create policy "gastos_update" on gastos for update using (auth.uid() = user_id);
create policy "gastos_delete" on gastos for delete using (auth.uid() = user_id);

-- ── categorias ────────────────────────────────────────────
create table if not exists categorias (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  nombre   text not null
);

alter table categorias enable row level security;

create policy "categorias_select" on categorias for select using (auth.uid() = user_id);
create policy "categorias_insert" on categorias for insert with check (auth.uid() = user_id);
create policy "categorias_update" on categorias for update using (auth.uid() = user_id);
create policy "categorias_delete" on categorias for delete using (auth.uid() = user_id);

-- ── Migración para tablas existentes ─────────────────────────────────────────
-- alter table pedidos add column if not exists cuotas integer not null default 1;
-- update pedidos set medio_pago = 'tarjeta' where medio_pago = 'fiado';
-- alter table pedidos add column if not exists nota text;

-- ── F3: Presupuestos ─────────────────────────────────────
alter table pedidos add column if not exists tipo text not null default 'pedido';

-- ── F4: Stock básico ──────────────────────────────────────
alter table productos add column if not exists stock integer not null default 0;
alter table productos add column if not exists stock_minimo integer not null default 5;

-- ── F2: Alertas de cobro ──────────────────────────────────
create table if not exists alertas_config (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade unique,
  dias_sin_cobro integer not null default 7,
  created_at     timestamptz default now()
);

alter table alertas_config enable row level security;

create policy "alertas_config_select" on alertas_config for select using (auth.uid() = user_id);
create policy "alertas_config_insert" on alertas_config for insert with check (auth.uid() = user_id);
create policy "alertas_config_update" on alertas_config for update using (auth.uid() = user_id);
create policy "alertas_config_delete" on alertas_config for delete using (auth.uid() = user_id);

-- ── F6: Planes y suscripciones ────────────────────────────
create table if not exists planes (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  precio_mensual    numeric not null default 0,
  precio_activacion numeric not null default 0,
  features          text[] default '{}',
  activo            boolean default true,
  created_at        timestamptz default now()
);

create table if not exists suscripciones (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade unique,
  user_email        text,
  plan_id           uuid references planes(id),
  estado            text not null default 'activa', -- 'activa' | 'vencida' | 'bloqueada'
  fecha_inicio      date not null,
  fecha_vencimiento date not null,
  mp_preference_id  text,
  mp_payment_id     text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table suscripciones enable row level security;

-- Cada usuario ve su propia suscripción
create policy "suscripciones_select_own" on suscripciones for select using (auth.uid() = user_id);
-- Owner ve todas las suscripciones
create policy "suscripciones_select_owner" on suscripciones for select
  using (exists (select 1 from allowed_emails where email = (select email from auth.users where id = auth.uid()) and is_owner = true));
create policy "suscripciones_insert" on suscripciones for insert with check (auth.uid() = user_id);
create policy "suscripciones_update_own" on suscripciones for update using (auth.uid() = user_id);
create policy "suscripciones_update_owner" on suscripciones for update
  using (exists (select 1 from allowed_emails where email = (select email from auth.users where id = auth.uid()) and is_owner = true));

-- Plan base
insert into planes (nombre, precio_mensual, precio_activacion, features)
values ('Básico', 4990, 0, array['Clientes ilimitados', 'Pedidos ilimitados', 'Estadísticas', 'Exportar CSV'])
on conflict do nothing;

-- ══════════════════════════════════════════════════════════
-- FASE 1 — SaaS base
-- ══════════════════════════════════════════════════════════

-- Corregir constraint de estado para incluir 'prueba'
alter table suscripciones drop constraint if exists suscripciones_estado_check;
alter table suscripciones add constraint suscripciones_estado_check
  check (estado in ('prueba', 'activa', 'vencida', 'bloqueada'));

-- Configuración del negocio + flag de onboarding
create table if not exists negocio_config (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade unique,
  nombre           text not null default 'Mi Negocio',
  logo_url         text,
  moneda           text not null default '$',
  onboarding_done  boolean not null default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table negocio_config enable row level security;
do $$ begin
  create policy "negocio_config_select" on negocio_config for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "negocio_config_insert" on negocio_config for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "negocio_config_update" on negocio_config for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ══════════════════════════════════════════════════════════
-- FASE 2 — Ventas y stock
-- ══════════════════════════════════════════════════════════

-- F2.3: Descuentos en pedidos
alter table pedidos add column if not exists descuento_tipo  text;
alter table pedidos add column if not exists descuento_valor numeric not null default 0;

-- F2.4: Tipo de precio y precio mayorista
alter table clientes  add column if not exists tipo_precio      text not null default 'minorista';
alter table productos add column if not exists precio_mayorista numeric not null default 0;

-- F2.5: Devoluciones
create table if not exists devoluciones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  pedido_id   uuid not null references pedidos(id) on delete cascade,
  cliente_id  uuid references clientes(id) on delete set null,
  fecha       date not null,
  motivo      text,
  monto_total numeric not null default 0,
  created_at  timestamptz default now()
);

create table if not exists devolucion_items (
  id              uuid primary key default gen_random_uuid(),
  devolucion_id   uuid not null references devoluciones(id) on delete cascade,
  producto_id     uuid references productos(id) on delete set null,
  nombre          text not null,
  cantidad        integer not null default 1,
  precio_unitario numeric not null default 0
);

alter table devoluciones enable row level security;
alter table devolucion_items enable row level security;

do $$ begin
  create policy "devoluciones_all" on devoluciones using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "devolucion_items_select" on devolucion_items for select
    using (exists (select 1 from devoluciones where devoluciones.id = devolucion_items.devolucion_id and devoluciones.user_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "devolucion_items_insert" on devolucion_items for insert
    with check (exists (select 1 from devoluciones where devoluciones.id = devolucion_items.devolucion_id and devoluciones.user_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "devolucion_items_delete" on devolucion_items for delete
    using (exists (select 1 from devoluciones where devoluciones.id = devolucion_items.devolucion_id and devoluciones.user_id = auth.uid()));
exception when duplicate_object then null; end $$;

-- ══════════════════════════════════════════════════════════
-- FASE 3 — Documentos y comunicación
-- ══════════════════════════════════════════════════════════

create table if not exists comunicaciones (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  fecha      timestamptz default now(),
  tipo       text not null, -- 'recordatorio' | 'remito' | 'cuenta_corriente'
  mensaje    text
);

alter table comunicaciones enable row level security;
do $$ begin
  create policy "comunicaciones_all" on comunicaciones using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ══════════════════════════════════════════════════════════
-- FASE 4 — Finanzas
-- ══════════════════════════════════════════════════════════

-- F4.4: Historial de precios de productos
create table if not exists productos_precio_historial (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  producto_id      uuid not null references productos(id) on delete cascade,
  precio           numeric not null default 0,
  costo            numeric not null default 0,
  precio_mayorista numeric not null default 0,
  fecha_desde      timestamptz default now()
);

alter table productos_precio_historial enable row level security;
do $$ begin
  create policy "precio_historial_all" on productos_precio_historial using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ══════════════════════════════════════════════════════════
-- FASE 5 — Operaciones avanzadas
-- ══════════════════════════════════════════════════════════

-- F5.1: Pedidos recurrentes
create table if not exists pedidos_recurrentes (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  cliente_id          uuid references clientes(id) on delete set null,
  items               jsonb not null default '[]',
  frecuencia          text not null default 'mensual',
  proximo_vencimiento date not null,
  activo              boolean not null default true,
  created_at          timestamptz default now()
);

alter table pedidos_recurrentes enable row level security;
do $$ begin
  create policy "recurrentes_all" on pedidos_recurrentes using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- F5.2: Proveedores y órdenes de compra
create table if not exists proveedores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  nombre     text not null,
  contacto   text,
  created_at timestamptz default now()
);

create table if not exists ordenes_compra (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  proveedor_id uuid references proveedores(id) on delete set null,
  fecha        date not null,
  estado       text not null default 'borrador',
  total        numeric not null default 0,
  created_at   timestamptz default now()
);

create table if not exists ordenes_compra_items (
  id              uuid primary key default gen_random_uuid(),
  orden_id        uuid not null references ordenes_compra(id) on delete cascade,
  producto_id     uuid references productos(id) on delete set null,
  nombre          text not null,
  cantidad        integer not null default 1,
  precio_unitario numeric not null default 0
);

alter table proveedores enable row level security;
alter table ordenes_compra enable row level security;
alter table ordenes_compra_items enable row level security;

do $$ begin
  create policy "proveedores_all" on proveedores using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "ordenes_compra_all" on ordenes_compra using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "oc_items_select" on ordenes_compra_items for select
    using (exists (select 1 from ordenes_compra oc where oc.id = ordenes_compra_items.orden_id and oc.user_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "oc_items_insert" on ordenes_compra_items for insert
    with check (exists (select 1 from ordenes_compra oc where oc.id = ordenes_compra_items.orden_id and oc.user_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "oc_items_delete" on ordenes_compra_items for delete
    using (exists (select 1 from ordenes_compra oc where oc.id = ordenes_compra_items.orden_id and oc.user_id = auth.uid()));
exception when duplicate_object then null; end $$;

-- ── MIGRACIONES POST-LANZAMIENTO ───────────────────────────
alter table negocio_config add column if not exists moneda text not null default '$';
