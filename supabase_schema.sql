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
-- Si ya tenés la tabla pedidos creada, ejecutá esto para agregar la columna cuotas:
-- alter table pedidos add column if not exists cuotas integer not null default 1;
-- Para actualizar pedidos con medio_pago='fiado' a 'tarjeta':
-- update pedidos set medio_pago = 'tarjeta' where medio_pago = 'fiado';
