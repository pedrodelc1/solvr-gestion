-- Schema baseline — Solvr Gestión (epiofjmtdegiobwvlhfz)
-- Generated: 2026-06-10 via Supabase Management API (Fase 0)
-- DO NOT EDIT manually — regenerar con scripts/fase0_dump.sh

-- ── alertas_config ────────────────────────────────────
create table if not exists alertas_config (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null references None(None) unique,
  dias_sin_cobro integer default 7 not null,
  created_at timestamptz default now()
);

alter table alertas_config enable row level security;

CREATE UNIQUE INDEX alertas_config_user_id_key ON public.alertas_config USING btree (user_id);

-- ── allowed_emails ────────────────────────────────────
create table if not exists allowed_emails (
  id uuid default gen_random_uuid() not null primary key,
  email text not null unique,
  created_at timestamptz default now(),
  is_owner boolean default false,
  trial_activo boolean default false not null,
  rol text default 'vendedor'::text,
  owner_user_id uuid
);

alter table allowed_emails enable row level security;

CREATE UNIQUE INDEX allowed_emails_email_key ON public.allowed_emails USING btree (email);

-- ── categorias ────────────────────────────────────────
create table if not exists categorias (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null references None(None) on delete cascade,
  nombre text not null
);

alter table categorias enable row level security;

-- ── clientes ──────────────────────────────────────────
create table if not exists clientes (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null references None(None) on delete cascade,
  nombre text not null,
  contacto text default ''::text,
  created_at timestamptz default now(),
  tipo_precio text default 'minorista'::text not null,
  saldo_inicial numeric(12,2) default 0 not null,
  email text default ''::text not null,
  direccion text default ''::text not null,
  foto_url text
);

alter table clientes enable row level security;

-- ── comunicaciones ────────────────────────────────────
create table if not exists comunicaciones (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null references None(None) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  fecha timestamptz default now(),
  tipo text not null,
  mensaje text
);

alter table comunicaciones enable row level security;

-- ── devolucion_items ──────────────────────────────────
create table if not exists devolucion_items (
  id uuid default gen_random_uuid() not null primary key,
  devolucion_id uuid not null references devoluciones(id) on delete cascade,
  producto_id uuid references productos(id) on delete set null,
  nombre text not null,
  cantidad integer default 1 not null,
  precio_unitario numeric default 0 not null
);

alter table devolucion_items enable row level security;

-- ── devoluciones ──────────────────────────────────────
create table if not exists devoluciones (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null references None(None) on delete cascade,
  pedido_id uuid not null references pedidos(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete set null,
  fecha date not null,
  motivo text,
  monto_total numeric default 0 not null,
  created_at timestamptz default now()
);

alter table devoluciones enable row level security;

-- ── gastos ────────────────────────────────────────────
create table if not exists gastos (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null references None(None) on delete cascade,
  fecha date not null,
  descripcion text not null,
  monto numeric default 0 not null,
  categoria text default 'Otros'::text not null,
  created_at timestamptz default now()
);

alter table gastos enable row level security;

-- ── negocio_config ────────────────────────────────────
create table if not exists negocio_config (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null references None(None) on delete cascade unique,
  nombre text default 'Mi Negocio'::text not null,
  logo_url text,
  onboarding_done boolean default false not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  recordatorio_plantilla text,
  telefono text,
  direccion text,
  email text,
  cuit text,
  nota_pdf text,
  num_inicial integer default 1,
  metodos_pago text default 'Efectivo, Transferencia, Tarjeta'::text,
  moneda text default '$'::text not null
);

alter table negocio_config enable row level security;

CREATE UNIQUE INDEX negocio_config_user_id_key ON public.negocio_config USING btree (user_id);

-- ── ordenes_compra ────────────────────────────────────
create table if not exists ordenes_compra (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null references None(None) on delete cascade,
  proveedor_id uuid references proveedores(id) on delete set null,
  fecha date not null,
  estado text default 'borrador'::text not null,
  total numeric default 0 not null,
  created_at timestamptz default now()
);

alter table ordenes_compra enable row level security;

-- ── ordenes_compra_items ──────────────────────────────
create table if not exists ordenes_compra_items (
  id uuid default gen_random_uuid() not null primary key,
  orden_id uuid not null references ordenes_compra(id) on delete cascade,
  producto_id uuid references productos(id) on delete set null,
  nombre text not null,
  cantidad integer default 1 not null,
  precio_unitario numeric default 0 not null
);

alter table ordenes_compra_items enable row level security;

-- ── pedido_items ──────────────────────────────────────
create table if not exists pedido_items (
  id uuid default gen_random_uuid() not null primary key,
  pedido_id uuid not null references pedidos(id) on delete cascade,
  producto_id uuid references productos(id) on delete set null,
  nombre text not null,
  cantidad integer default 1 not null,
  precio_unitario numeric default 0 not null,
  costo_unitario numeric default 0 not null,
  entregado boolean default false not null,
  fecha_entrega date
);

alter table pedido_items enable row level security;

-- ── pedidos ───────────────────────────────────────────
create table if not exists pedidos (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null references None(None) on delete cascade,
  cliente_id uuid references clientes(id) on delete set null,
  fecha date not null,
  total_calculado numeric default 0 not null,
  total_final numeric default 0 not null,
  medio_pago text default 'efectivo'::text not null,
  cobrado boolean default false not null,
  monto_abonado numeric default 0 not null,
  created_at timestamptz default now(),
  cuotas integer default 1 not null,
  nota text,
  tipo text default 'pedido'::text not null,
  descuento_tipo text,
  descuento_valor numeric default 0 not null,
  dias_plazo integer default 0 not null,
  tasa_mora numeric default 0 not null,
  nro integer
);

alter table pedidos enable row level security;

-- ── pedidos_recurrentes ───────────────────────────────
create table if not exists pedidos_recurrentes (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null references None(None) on delete cascade,
  cliente_id uuid references clientes(id) on delete set null,
  items jsonb default '[]'::jsonb not null,
  frecuencia text default 'mensual'::text not null,
  proximo_vencimiento date not null,
  activo boolean default true not null,
  created_at timestamptz default now()
);

alter table pedidos_recurrentes enable row level security;

-- ── planes ────────────────────────────────────────────
create table if not exists planes (
  id uuid default gen_random_uuid() not null primary key,
  nombre text not null,
  precio_mensual numeric not null,
  descripcion text,
  activo boolean default true
);

alter table planes enable row level security;

-- ── productos ─────────────────────────────────────────
create table if not exists productos (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null references None(None) on delete cascade,
  nombre text not null,
  precio numeric default 0 not null,
  costo numeric default 0 not null,
  created_at timestamptz default now(),
  stock integer default 0 not null,
  stock_minimo integer default 5 not null,
  precio_mayorista numeric default 0 not null,
  marca text
);

alter table productos enable row level security;

-- ── productos_precio_historial ────────────────────────
create table if not exists productos_precio_historial (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null references None(None) on delete cascade,
  producto_id uuid not null references productos(id) on delete cascade,
  precio numeric default 0 not null,
  costo numeric default 0 not null,
  precio_mayorista numeric default 0 not null,
  fecha_desde timestamptz default now()
);

alter table productos_precio_historial enable row level security;

-- ── proveedores ───────────────────────────────────────
create table if not exists proveedores (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null references None(None) on delete cascade,
  nombre text not null,
  contacto text,
  created_at timestamptz default now()
);

alter table proveedores enable row level security;

-- ── suscripciones ─────────────────────────────────────
create table if not exists suscripciones (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null references None(None) unique,
  user_email text,
  plan_id uuid references planes(id),
  estado text default 'trial'::text not null,
  fecha_inicio timestamptz default now(),
  fecha_vencimiento timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint suscripciones_check check ((estado = ANY (ARRAY['prueba'::text, 'activa'::text, 'vencida'::text, 'bloqueada'::text])))
);

alter table suscripciones enable row level security;

CREATE UNIQUE INDEX suscripciones_user_id_key ON public.suscripciones USING btree (user_id);


-- ── Functions ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT COALESCE(
    CASE
      WHEN EXISTS (SELECT 1 FROM public.allowed_emails WHERE email = auth.email() AND is_owner = true)
      THEN 'owner'
      ELSE (SELECT COALESCE(rol, 'vendedor') FROM public.allowed_emails WHERE email = auth.email() LIMIT 1)
    END,
    'owner'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_my_owner_data(row_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_emails
    WHERE email = auth.email()
    AND owner_user_id = row_user_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;
