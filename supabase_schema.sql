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
