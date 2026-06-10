# Plan de Arquitectura de Seguridad Multi-Tenant con RLS

**Proyecto:** Solvr Gestión
**Autor:** análisis técnico inicial
**Fecha:** 2026-06-10
**Estado:** Fase 0 completa ✅ — Fase 1 completa ✅ (2026-06-10) — Fase 2 pendiente

---

## 0. Resumen ejecutivo

Hoy Solvr Gestión usa **un modelo de tenancy implícito**: cada fila tiene `user_id` que apunta a `auth.users`, y ese `user_id` cumple **doble función**: identificador del usuario autenticado **y** identificador del negocio (tenant). Para que los miembros del equipo puedan escribir en los datos del owner, el frontend (`App.jsx → setEffectiveUserId(owner_user_id)` en `db.js`) sobrescribe el `user_id` que usa al hacer `INSERT`/`UPDATE`. Esto funciona porque las policies de RLS (a través de `is_my_owner_data()` y `allowed_emails`) permiten que un team member escriba con el `user_id` de su owner.

**Esto es frágil por tres motivos:**

1. **El cliente decide quién es el dueño de la escritura.** Un atacante con un token válido puede escribir como cualquier owner cuya whitelist lo incluya. La validación de rol queda mayormente en el frontend.
2. **No existe una entidad "negocio".** Hoy los datos pertenecen a un `auth.users.id`; mañana, cuando se quiera multi-sucursal o transferir un negocio entre owners, hay que tocar todas las tablas.
3. **Permisos por rol viven a medias en frontend y a medias en backend.** El `ALLOWED_TABS` está en `App.jsx`. Si alguien fuerza el `activeTab` o llama directo al SDK de Supabase, las policies de `INSERT`/`UPDATE`/`DELETE` no diferencian entre `owner`, `vendedor` y `visualizador`.

**Este documento propone:**

- Introducir una entidad `negocios` (el tenant) y una tabla de membresía `negocio_members` con rol explícito.
- Migrar todas las tablas de datos para que su columna de tenancy pase de `user_id` a `negocio_id` (manteniendo `user_id` como `created_by` para auditoría).
- Reemplazar las policies actuales (la mayoría son `FOR ALL` o repiten la misma expresión) por **policies separadas por operación** que checan `negocio_id` + `rol` + estado de la membresía.
- Hacer todo en fases additivas que se pueden deployar sin romper la app en producción.

---

## 1. Relevamiento del esquema actual

### 1.1 Tablas con datos por tenant

Todas hoy se vinculan al tenant vía `user_id uuid references auth.users(id) on delete cascade`.

| Tabla | RLS | Política dominante | Notas |
|---|---|---|---|
| `clientes` | ✅ | `auth.uid() = user_id` (4 policies separadas SELECT/INSERT/UPDATE/DELETE) | OK, base del esquema |
| `productos` | ✅ | `auth.uid() = user_id` (4 separadas) | OK |
| `pedidos` | ✅ | `auth.uid() = user_id` (4 separadas) | OK |
| `pedido_items` | ✅ | Lookup a `pedidos.user_id` (4 separadas) | Patrón correcto: no tiene `user_id` propio |
| `gastos` | ✅ | `auth.uid() = user_id` (4 separadas) | OK |
| `categorias` | ✅ | `auth.uid() = user_id` (4 separadas) | OK |
| `alertas_config` | ✅ | `auth.uid() = user_id`, `user_id` UNIQUE | OK |
| `suscripciones` | ✅ | `auth.uid() = user_id` + select/update para owner via `allowed_emails.is_owner` | Tiene rama de superadmin |
| `negocio_config` | ✅ | `auth.uid() = user_id`, UNIQUE | OK |
| `devoluciones` | ⚠️ | **`FOR ALL` con `auth.uid() = user_id`** | Una sola policy. Hay que separar por operación |
| `devolucion_items` | ✅ | Lookup a `devoluciones.user_id` (4 separadas) | OK |
| `comunicaciones` | ⚠️ | **`FOR ALL` con `auth.uid() = user_id`** | Separar |
| `productos_precio_historial` | ⚠️ | **`FOR ALL`** | Separar |
| `pedidos_recurrentes` | ⚠️ | **`FOR ALL`** | Separar |
| `proveedores` | ⚠️ | **`FOR ALL`** | Separar |
| `ordenes_compra` | ⚠️ | **`FOR ALL`** | Separar |
| `ordenes_compra_items` | ✅ | Lookup a `ordenes_compra.user_id` (3 separadas) | Falta `UPDATE` |

### 1.2 Tablas globales (no por tenant)

| Tabla | RLS | Cómo se protege |
|---|---|---|
| `planes` | ❌ | Tabla pública de catálogo. Lectura libre, escritura solo `service_role`. **Hoy no tiene policy de SELECT que la habilite a `anon`/`authenticated`. Si `enable row level security` se prende sin policy, queda inaccesible.** Revisar. |

### 1.3 Tablas de control de acceso

Referenciadas en código pero **no definidas en `supabase_schema.sql`**:

- `allowed_emails (id, email, owner_user_id, is_owner, rol, trial_activo, created_at)` — usada por `db.js` y por las policies de `suscripciones`. **No está en el schema versionado.**
- `team_members (id, owner_id, member_email, role)` — mencionada en `contexto.md`. No está en el schema. Puede ser equivalente a `allowed_emails` con otro nombre.
- Funciones `get_my_role()`, `is_my_owner_data(user_id)` — mencionadas en CLAUDE.md pero no aparecen en `supabase_schema.sql`.

**Riesgo:** parte de la lógica de seguridad vive solo en la base de datos de producción y no está versionada en el repo. La primera fase del plan incluye recuperar esas definiciones desde producción y dejarlas en `supabase_schema.sql`.

### 1.4 Mecanismo actual de "team member"

En `db.js:37-38`:

```js
// When a team member logs in, App.jsx calls this with the owner's user_id
// so all writes go to the owner's account.
setEffectiveUserId(ownerUserId)
```

Esto significa:

- El team member loguea con su propio `auth.uid()`.
- El frontend, después de mirar `allowed_emails`, decide usar el `owner_user_id` para todas las escrituras.
- Las policies de `INSERT` deben tener una rama que permita "el `user_id` insertado pertenece a un owner del cual yo soy team member" (es ahí donde entra `is_my_owner_data`).
- **Las policies de `INSERT/UPDATE/DELETE` no diferencian entre `owner`, `admin`, `vendedor`, `visualizador`.** Hoy esa diferencia la hace solo `App.jsx` ocultando UI.

**Consecuencia:** un usuario con rol `visualizador` que conoce el SDK y su token puede, en teoría, ejecutar inserts arbitrarios en las tablas del owner.

---

## 2. Modelo de tenancy propuesto

### 2.1 Opciones evaluadas

| Opción | Descripción | Pro | Contra |
|---|---|---|---|
| **A. Tabla intermedia `negocios` + `negocio_members`** | Cada fila de datos tiene `negocio_id`. Membresía explícita con rol. | Multi-tenancy real. Multi-usuario por negocio. Multi-negocio por usuario factible. No bloquea multi-sucursal. Auditable. | Migración tocando todas las tablas y todos los queries del frontend. |
| **B. Claim `negocio_id` en JWT** | Auth Hook que inyecta `negocio_id` activo en cada token. RLS lee `auth.jwt() ->> 'negocio_id'`. | Performance (no hace lookup). | Requiere Auth Hooks (feature relativamente nueva). Cambiar de negocio implica refresh del token. No cubre el caso de un service_role que actúa por nombre del usuario. |
| **C. Columna `negocio_id` directa, sin tabla membership** | Igual que A pero el rol vive en `negocio_config` o un campo en `auth.users`. | Menos tablas. | No soporta multi-usuario en un negocio salvo casos artificiales. No escala. |
| **D. Mantener `user_id` y agregar `is_owner_of(user_id, target_user_id)`** | Status quo refactoreado. | Migración cero. | Sigue mezclando "usuario" y "tenant". Bloquea multi-sucursal. No resuelve el problema de roles. |

### 2.2 Elección: **Opción A** (tabla intermedia) como fundación, **claim en JWT** como optimización opcional posterior

**Por qué A y no B/C/D:**

- **Vs. B (JWT claim solo):** B no tiene una entidad "negocio" en la base, solo un string en el token. Eso impide queries naturales tipo "listar miembros del negocio X" o "transferir un negocio a otro owner" o "agregar `sucursales` después". B sirve como optimización de performance, no como modelo de datos.
- **Vs. C (columna directa sin membership):** un negocio con un dueño + tres empleados necesita cuatro filas que digan "estos cuatro `user_id` ven los datos de este `negocio_id`, cada uno con su rol". Sin tabla de membership tenés que duplicar la columna en cada tabla o forzar a todos los empleados a compartir credenciales del owner — esto último es exactamente lo que hace hoy `setEffectiveUserId(owner_user_id)` y es la causa del bug de seguridad descrito en §0.
- **Vs. D (refactor del status quo):** no resuelve el problema de fondo (rol mezclado con tenancy). Patchear el patrón actual con `is_owner_of()` deja la decisión de "bajo qué `user_id` escribir" en el cliente — el problema raíz se mantiene.
- **A favor de A:** Solvr Gestión vende a PyMEs argentinas con dueño + empleados (vendedores, encargados). Multi-sucursal está diferido pero está en el horizonte. Con `negocios` como entidad, agregar `sucursales` y `sucursal_id` después es additivo. El modelo es el estándar de Supabase para SaaS multi-tenant y está bien documentado.

**Costo asumido:** la migración toca todas las tablas de datos y todos los queries del frontend. Es exactamente lo que cubren las fases 2–4 del plan.

### 2.2.1 Sobre el claim JWT (cómo se actualiza al cambiar de negocio)

**Estado en este plan:** la primera implementación NO usa JWT claim. Usa lookup en `negocio_members` desde `mi_negocio_id()` (lectura indexada, costo bajo). El JWT claim queda como **optimización opcional post-launch**, pendiente de evidencia de problema de performance.

**Cuando se introduzca, así funcionará:**

1. **Cómo se popula el claim:** Supabase tiene la feature "Custom Access Token Hook". Configurás una función PostgreSQL `auth.custom_access_token_hook(event jsonb)` que recibe el evento de emisión de token y devuelve un JSON con claims adicionales. Ejemplo:

   ```sql
   create or replace function public.custom_access_token_hook(event jsonb)
   returns jsonb language plpgsql stable as $$
   declare
     v_user_id uuid := (event->>'user_id')::uuid;
     v_negocio_id uuid;
     v_rol text;
   begin
     -- Negocio activo: el que el user marcó en su user_metadata, sino el primero activo
     v_negocio_id := coalesce(
       ((event->'claims'->'user_metadata')->>'active_negocio_id')::uuid,
       (select negocio_id from negocio_members
          where user_id = v_user_id and activo order by joined_at limit 1)
     );

     select rol::text into v_rol from negocio_members
      where user_id = v_user_id and negocio_id = v_negocio_id and activo;

     return jsonb_set(
       jsonb_set(event->'claims',
                 '{active_negocio_id}', to_jsonb(v_negocio_id::text)),
       '{active_rol}', to_jsonb(v_rol)
     );
   end;
   $$;
   ```

   Luego se habilita en **Supabase Dashboard → Authentication → Hooks → Custom Access Token**.

2. **Cómo se actualiza cuando el usuario cambia de negocio activo:**

   - **Setear preferencia:** la app llama `supabase.auth.updateUser({ data: { active_negocio_id: nuevoId } })`. Esto persiste en `auth.users.raw_user_meta_data`.
   - **Forzar emisión de nuevo token con el claim actualizado:** `updateUser` ya invalida el access token actual y dispara una nueva emisión que pasa por el hook. Como cinturón y tirantes, la app puede llamar `await supabase.auth.refreshSession()` inmediatamente después para garantizar que el token nuevo se obtenga antes de la siguiente query.
   - **Frontend invalida caches y refetcha datos** después del refresh (estado de React se rebuildea desde cero con los nuevos datos del nuevo `negocio_id`).

3. **Por qué `mi_negocio_id()` debe seguir teniendo el fallback a la tabla aún cuando exista el claim:**

   - Edge functions que reciben el JWT del usuario también lo tienen disponible vía RLS.
   - Si el hook está temporalmente inactivo (downtime, debug), el lookup de la tabla evita downtime de la app.
   - Tokens emitidos antes de habilitar el hook no tienen el claim — el fallback los hace funcionar sin signout forzado.

4. **Limitación conocida del claim:** un access token es válido por defecto 1 hora. Si el usuario cambia de rol (un admin lo demota a vendedor) y no se fuerza refresh, sigue ejecutando con el rol viejo por hasta una hora. Mitigación: cuando un admin modifica `negocio_members`, una edge function llama `auth.admin.signOut(user_id, scope='others')` para forzar refresh del afectado en el próximo intento de acción. Sin claim JWT esto no es necesario porque cada query mira la tabla.

### 2.3 Esquema propuesto

```sql
-- ── Entidad tenant ──────────────────────────────────────────
create table negocios (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  owner_id     uuid not null references auth.users(id) on delete restrict,
  -- Razón restrict: borrar el owner no debe huerfanar el negocio en silencio.
  --                 Si se borra el owner, hay que transferir primero (fase 6).
  trial_hasta  date,
  created_at   timestamptz default now(),
  archived_at  timestamptz
);

create index negocios_owner_id_idx on negocios(owner_id);

-- ── Membresía con rol ───────────────────────────────────────
create type rol_negocio as enum ('owner', 'admin', 'vendedor', 'visualizador');

create table negocio_members (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references negocios(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  rol            rol_negocio not null,
  activo         boolean not null default true,
  invited_by     uuid references auth.users(id) on delete set null,
  joined_at      timestamptz default now(),
  deactivated_at timestamptz,
  unique (negocio_id, user_id)
);

create index negocio_members_user_idx    on negocio_members(user_id) where activo;
create index negocio_members_negocio_idx on negocio_members(negocio_id) where activo;

-- ── Invitaciones ─────────────────────────────────────────────
create table invitaciones (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references negocios(id) on delete cascade,
  email       text not null,
  rol         rol_negocio not null,
  token       text not null unique,
  invited_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id)
);

create index invitaciones_token_idx on invitaciones(token) where accepted_at is null;
create index invitaciones_email_idx on invitaciones(lower(email));
```

### 2.4 Funciones helper

Todas declaradas `stable` y `security definer` para que la RLS pueda usarlas con cache por sentencia.

```sql
-- Negocio activo del usuario actual.
--
-- SEGURIDAD: el frontend setea su preferencia en auth.users.raw_user_meta_data
-- (vía supabase.auth.updateUser({ data: { active_negocio_id: ... } })). Ese
-- campo es ESCRIBIBLE por el propio usuario — no podemos confiar en él como
-- fuente de verdad. Por eso esta función SIEMPRE valida que el id reclamado
-- corresponda a una membresía ACTIVA del usuario en ese negocio. Si no, cae al
-- primero activo (orden estable por joined_at).
--
-- El claim llega a la base como parte del JWT: `auth.jwt() -> 'user_metadata'`.
-- Si más adelante se introduce el Custom Access Token Hook (§2.2.1) que coloca
-- `active_negocio_id` como claim de top-level, se lo lee con `auth.jwt() ->>
-- 'active_negocio_id'`. La validación contra negocio_members es la MISMA en
-- ambos casos: el claim solo se acepta si hay membresía activa.
create or replace function mi_negocio_id()
returns uuid
language sql stable security definer set search_path = public, pg_catalog
as $$
  with claimed as (
    select nullif(
      coalesce(
        auth.jwt() -> 'user_metadata' ->> 'active_negocio_id',
        auth.jwt() ->> 'active_negocio_id'   -- por si el access token hook lo eleva
      ), ''
    )::uuid as id
  ),
  validated as (
    -- El claim solo cuenta si el usuario es miembro activo de ese negocio.
    -- Esto bloquea el escenario donde el cliente edita su user_metadata para
    -- apuntar al negocio de otro tenant.
    select c.id from claimed c
     where c.id is not null
       and exists (
         select 1 from negocio_members
          where user_id = auth.uid() and negocio_id = c.id and activo
       )
  )
  select coalesce(
    (select id from validated),
    (select negocio_id from negocio_members
      where user_id = auth.uid() and activo
      order by joined_at
      limit 1)
  );
$$;

create or replace function es_miembro(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from negocio_members
    where user_id = auth.uid() and negocio_id = p_negocio_id and activo
  );
$$;

create or replace function mi_rol_en(p_negocio_id uuid)
returns rol_negocio
language sql stable security definer set search_path = public
as $$
  select rol from negocio_members
  where user_id = auth.uid() and negocio_id = p_negocio_id and activo
  limit 1;
$$;

create or replace function puede_leer(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select es_miembro(p_negocio_id);
$$;

create or replace function puede_escribir(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select mi_rol_en(p_negocio_id) in ('owner', 'admin', 'vendedor');
$$;

create or replace function puede_eliminar(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select mi_rol_en(p_negocio_id) in ('owner', 'admin');
$$;

create or replace function puede_administrar(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select mi_rol_en(p_negocio_id) in ('owner', 'admin');
$$;

create or replace function es_owner(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select mi_rol_en(p_negocio_id) = 'owner';
$$;

-- Gate de suscripción para operaciones de ESCRITURA.
--
-- Reglas de negocio:
--   - estado 'prueba'  + fecha_vencimiento >= hoy  → escritura permitida
--   - estado 'activa'  + fecha_vencimiento >= hoy  → escritura permitida
--   - estado 'vencida' (cualquier fecha)           → escritura bloqueada
--   - sin fila en suscripciones                    → escritura bloqueada
--
-- IMPORTANTE: esta función NO se usa en policies de SELECT. Aún con la
-- suscripción vencida el cliente debe poder leer sus datos (ver historial,
-- exportar CSV, decidir renovar). Solo se bloquea INSERT/UPDATE/DELETE en
-- tablas de datos transaccionales. La propia tabla `suscripciones` queda
-- exenta para que el webhook de Mercado Pago pueda reactivarla.
--
-- DESPLIEGUE: a diferencia del resto de los helpers (que viven en Fase 1),
-- esta función se crea en Fase 3 — la misma fase que introduce las policies
-- `_v2` que la consumen. Crearla en Fase 1 sin policies que la usen no aporta
-- valor, y crear las policies en Fase 3 sin la función falla.
create or replace function is_suscripcion_activa(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from suscripciones
     where negocio_id = p_negocio_id
       and estado in ('prueba', 'activa')
       and (fecha_vencimiento is null or fecha_vencimiento >= current_date)
  );
$$;
```

**Matriz rol → función:**

| Operación | owner | admin | vendedor | visualizador |
|---|---|---|---|---|
| `puede_leer` | ✅ | ✅ | ✅ | ✅ |
| `puede_escribir` (insert/update datos transaccionales) | ✅ | ✅ | ✅ | ❌ |
| `puede_eliminar` | ✅ | ✅ | ❌ | ❌ |
| `puede_administrar` (negocio_config, productos, miembros) | ✅ | ✅ | ❌ | ❌ |
| `es_owner` (suscripción, transferir negocio, archivar) | ✅ | ❌ | ❌ | ❌ |
| `is_suscripcion_activa` (gate transversal de escritura) | aplica a todos por igual: si la suscripción está vencida nadie escribe, sin importar el rol |

---

## 3. Políticas RLS por tabla

> **Regla:** una policy por operación. **Cero `FOR ALL` en este plan.**
>
> Las tablas que hoy usan `FOR ALL` (`devoluciones`, `comunicaciones`, `productos_precio_historial`, `pedidos_recurrentes`, `proveedores`, `ordenes_compra` — ver §1.1) se reemplazan en la Fase 3 por cuatro policies separadas siguiendo el patrón canónico §3.1. Las policies viejas se eliminan en la Fase 5. La razón de separar: con `FOR ALL` un bug en la expresión rompe simultáneamente lectura **y** escritura, y no se puede aplicar regla distinta a `DELETE` (que requiere `puede_eliminar`) que a `INSERT` (que requiere `puede_escribir`). Cada operación tiene su propia política con su propia expresión `USING` / `WITH CHECK`.

### 3.1 Patrón canónico para tablas con `negocio_id` directo

Ejemplo con `clientes`. Aplicable identicamente a `productos`, `pedidos`, `gastos`, `categorias`, `proveedores`, `pedidos_recurrentes`, `comunicaciones`, `productos_precio_historial`, `devoluciones`, `ordenes_compra`, `alertas_config`, `negocio_config`.

```sql
alter table clientes enable row level security;

-- SELECT: cualquier miembro activo del negocio.
-- No se gatea por suscripción: la lectura sigue disponible aún con la
-- suscripción vencida (modo "lectura forzada" hasta que el dueño renueve).
create policy clientes_select on clientes
  for select
  using (puede_leer(negocio_id));

-- INSERT: solo roles con permiso de escritura Y suscripción activa.
-- `with check` valida el negocio_id que llega (no se puede insertar a un negocio
-- al que no pertenezco).
create policy clientes_insert on clientes
  for insert
  with check (
    puede_escribir(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

-- UPDATE: el rol decide. La fila vieja y la nueva deben pertenecer al mismo
-- negocio donde tengo permiso (impide "robar" filas a otro negocio cambiando
-- el negocio_id en un update). Gate de suscripción aplica también acá.
create policy clientes_update on clientes
  for update
  using (puede_escribir(negocio_id))
  with check (
    puede_escribir(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

-- DELETE: solo owner|admin Y suscripción activa.
create policy clientes_delete on clientes
  for delete
  using (
    puede_eliminar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );
```

> **Aplica a todas las tablas de datos transaccionales** (clientes, productos, pedidos, pedido_items, gastos, categorias, devoluciones, devolucion_items, comunicaciones, productos_precio_historial, pedidos_recurrentes, proveedores, ordenes_compra, ordenes_compra_items, alertas_config, negocio_config).
>
> **Quedan exentas del gate** (motivo entre paréntesis):
> - `suscripciones` (necesita escritura del webhook para reactivar).
> - `negocios` (archivar/renombrar debe seguir disponible para el owner).
> - `negocio_members` e `invitaciones` (el admin debe poder reducir el equipo y revocar accesos aún con la suscripción vencida).
> - `planes` (catálogo global, no por tenant).

### 3.2 Tablas con `negocio_id` indirecto (vía padre)

Ejemplo `pedido_items` (padre `pedidos`). Mismo patrón para `devolucion_items` y `ordenes_compra_items`.

```sql
alter table pedido_items enable row level security;

create policy pedido_items_select on pedido_items
  for select
  using (exists (
    select 1 from pedidos p
    where p.id = pedido_items.pedido_id and puede_leer(p.negocio_id)
  ));

create policy pedido_items_insert on pedido_items
  for insert
  with check (exists (
    select 1 from pedidos p
    where p.id = pedido_items.pedido_id
      and puede_escribir(p.negocio_id)
      and is_suscripcion_activa(p.negocio_id)
  ));

create policy pedido_items_update on pedido_items
  for update
  using (exists (
    select 1 from pedidos p
    where p.id = pedido_items.pedido_id and puede_escribir(p.negocio_id)
  ))
  with check (exists (
    select 1 from pedidos p
    where p.id = pedido_items.pedido_id
      and puede_escribir(p.negocio_id)
      and is_suscripcion_activa(p.negocio_id)
  ));

create policy pedido_items_delete on pedido_items
  for delete
  using (exists (
    select 1 from pedidos p
    where p.id = pedido_items.pedido_id
      and puede_eliminar(p.negocio_id)
      and is_suscripcion_activa(p.negocio_id)
  ));
```

### 3.3 Tablas de gobernanza

#### `negocios`

```sql
alter table negocios enable row level security;

-- SELECT: cualquier miembro activo (incluido el owner).
create policy negocios_select on negocios
  for select using (es_miembro(id));

-- INSERT: solo durante el signup, vía trigger en auth.users (security definer).
-- Frontend NO debe poder insertar directo. Esto se logra no creando policy de INSERT
-- + permiso revocado para 'authenticated' a través de las policies (deny by default).
-- Si querés permitir crear un segundo negocio desde la UI, agregar policy:
-- create policy negocios_insert on negocios
--   for insert with check (owner_id = auth.uid());
-- Por ahora no se permite, así nos garantizamos UN negocio por owner al inicio.

-- UPDATE: solo owner|admin del negocio.
create policy negocios_update on negocios
  for update
  using (puede_administrar(id))
  with check (puede_administrar(id));

-- DELETE: solo el owner. (Soft delete preferible — usar update archived_at.)
create policy negocios_delete on negocios
  for delete using (es_owner(id));
```

#### `negocio_members`

```sql
alter table negocio_members enable row level security;

-- SELECT: cualquier miembro del negocio puede ver el roster.
create policy members_select on negocio_members
  for select using (es_miembro(negocio_id));

-- INSERT: solo owner|admin pueden agregar miembros directamente.
-- El flujo normal es vía invitaciones → trigger que crea el member.
create policy members_insert on negocio_members
  for insert with check (puede_administrar(negocio_id));

-- UPDATE: solo owner|admin pueden cambiar rol/activo.
-- Restricción adicional: NUNCA se puede degradar/eliminar al owner desde una policy.
create policy members_update on negocio_members
  for update
  using (puede_administrar(negocio_id))
  with check (puede_administrar(negocio_id) and rol <> 'owner');
-- ⚠️ Mecanismo de transferencia de ownership va por función rpc dedicada,
-- no por update directo. Ver §4.

-- DELETE: solo owner|admin. No se puede eliminar al owner.
create policy members_delete on negocio_members
  for delete using (
    puede_administrar(negocio_id) and rol <> 'owner'
  );
```

#### `invitaciones`

```sql
alter table invitaciones enable row level security;

-- SELECT: el invitador o miembros owner|admin del negocio.
create policy invit_select on invitaciones
  for select using (
    invited_by = auth.uid() or puede_administrar(negocio_id)
  );

-- INSERT: solo owner|admin del negocio.
create policy invit_insert on invitaciones
  for insert
  with check (puede_administrar(negocio_id) and invited_by = auth.uid());

-- UPDATE: solo para marcar como aceptada (via función rpc). Deny en RLS general.
-- No creamos policy de UPDATE: nadie hace UPDATE directo. La función accept_invitation
-- corre en security definer.

-- DELETE: invitador o admin del negocio (revocar invitación).
create policy invit_delete on invitaciones
  for delete using (invited_by = auth.uid() or puede_administrar(negocio_id));
```

#### `suscripciones`

```sql
alter table suscripciones enable row level security;

-- SELECT: cualquier miembro puede ver el estado (afecta su acceso). Detalle de
-- billing solo lo ve el owner.
create policy suscripciones_select on suscripciones
  for select using (es_miembro(negocio_id));

-- INSERT/UPDATE/DELETE: solo via service_role desde el webhook de Mercado Pago.
-- No hay policies de write para authenticated.
```

#### `planes`

```sql
alter table planes enable row level security;

-- SELECT: público autenticado.
create policy planes_select on planes
  for select using (auth.role() = 'authenticated');

-- INSERT/UPDATE/DELETE: solo service_role (sin policy = denegado).
```

### 3.4 Resumen de la matriz

Columna **Sub** = ¿la policy de escritura suma `and is_suscripcion_activa(negocio_id)`?
- ✅ aplica a INSERT/UPDATE/DELETE
- — exenta (motivo en notas)

| Tabla | SELECT | INSERT | UPDATE | DELETE | Sub | Notas |
|---|---|---|---|---|---|---|
| `clientes` | `puede_leer` | `puede_escribir` | `puede_escribir` | `puede_eliminar` | ✅ | Patrón base |
| `productos` | `puede_leer` | `puede_administrar` | `puede_administrar` | `puede_administrar` | ✅ | Catálogo, más restrictivo |
| `pedidos` | `puede_leer` | `puede_escribir` | `puede_escribir` | `puede_eliminar` | ✅ | |
| `pedido_items` | via `pedidos` | via `pedidos` | via `pedidos` | via `pedidos` | ✅ | Gate también via padre |
| `gastos` | `puede_leer` | `puede_administrar` | `puede_administrar` | `puede_administrar` | ✅ | Solo admin/owner toca finanzas |
| `categorias` | `puede_leer` | `puede_administrar` | `puede_administrar` | `puede_administrar` | ✅ | |
| `negocio_config` | `puede_leer` | `puede_administrar` | `puede_administrar` | `es_owner` | ✅ | |
| `alertas_config` | `puede_leer` | `puede_administrar` | `puede_administrar` | `puede_administrar` | ✅ | |
| `devoluciones` | `puede_leer` | `puede_escribir` | `puede_escribir` | `puede_eliminar` | ✅ | |
| `devolucion_items` | via padre | via padre | via padre | via padre | ✅ | |
| `comunicaciones` | `puede_leer` | `puede_escribir` | `puede_escribir` | `puede_eliminar` | ✅ | |
| `productos_precio_historial` | `puede_leer` | `puede_administrar` | `puede_administrar` | `puede_administrar` | ✅ | Auditoría de precios |
| `pedidos_recurrentes` | `puede_leer` | `puede_administrar` | `puede_administrar` | `puede_administrar` | ✅ | |
| `proveedores` | `puede_leer` | `puede_administrar` | `puede_administrar` | `puede_administrar` | ✅ | |
| `ordenes_compra` | `puede_leer` | `puede_administrar` | `puede_administrar` | `puede_administrar` | ✅ | |
| `ordenes_compra_items` | via padre | via padre | via padre | via padre | ✅ | |
| `negocios` | `es_miembro` | (denied) | `puede_administrar` | `es_owner` | — | Archivar/renombrar debe seguir disponible |
| `negocio_members` | `es_miembro` | `puede_administrar` | `puede_administrar` (no owner) | `puede_administrar` (no owner) | — | Admin debe poder reducir equipo aún con suscripción vencida |
| `invitaciones` | invitador o admin | `puede_administrar` | (rpc) | invitador o admin | — | Revocar invitaciones siempre disponible |
| `suscripciones` | `es_miembro` | (service_role) | (service_role) | (service_role) | — | Webhook MP necesita escribir para reactivar |
| `planes` | authenticated | (service_role) | (service_role) | (service_role) | — | Catálogo global |

---

## 4. Casos borde

### 4.1 Usuario miembro de dos negocios

**Caso:** un contador externo presta servicio a varios PyMEs y entra como `visualizador` o `vendedor` en cada uno.

**Solución:**
- `negocio_members` permite varias filas para el mismo `user_id`.
- `mi_negocio_id()` necesita decidir cuál es el "activo". Estrategia:
  1. La app guarda en `auth.users.raw_user_meta_data.active_negocio_id` cuando el usuario selecciona en un dropdown. Ese campo viaja al JWT bajo `auth.jwt() -> 'user_metadata' ->> 'active_negocio_id'`.
  2. **El claim es escribible por el propio usuario** (cualquier cliente con un token válido puede modificar su `user_metadata` vía `supabase.auth.updateUser`). Por eso `mi_negocio_id()` **nunca lo acepta a ciegas**: lo cruza contra `negocio_members` y solo lo respeta si existe una membresía activa del usuario para ese `negocio_id`. Si el claim no pasa la validación, cae al fallback (primera membresía activa, orden estable por `joined_at`).
  3. Si en el futuro se habilita el Custom Access Token Hook (§2.2.1), el claim sube a top-level (`auth.jwt() ->> 'active_negocio_id'`). La validación contra membresía sigue siendo la misma — el hook no puede ser fuente única de confianza tampoco, porque tokens viejos pueden tener claims stale (rol/negocio que ya cambió en la base).
- En el frontend, un selector de negocio en el header. Al cambiar, llama `supabase.auth.updateUser({ data: { active_negocio_id: x } })` y refresca queries (más `refreshSession()` si el hook está habilitado).
- **Precaución:** en queries directos (`select * from clientes`) el filtro RLS sale por `puede_leer(negocio_id)`, que acepta cualquier negocio del cual sea miembro. Para asegurar que la UI muestra solo el negocio activo, los queries del frontend deben filtrar `eq('negocio_id', activeNegocioId)` explícitamente. Esto es UX, no seguridad — la seguridad ya está cubierta.
- **Modelo de amenaza descartado:** "atacante edita su `user_metadata` para apuntar a `negocio_id` de Bruno y leer sus clientes". Bloqueado en `mi_negocio_id()` por la validación contra `negocio_members`. Atacante nunca obtiene `negocio_id` de Bruno como activo a menos que sea miembro real, y si lo es, la operación está autorizada por diseño.

### 4.2 Empleado dado de baja

**Caso:** el owner despide a un vendedor. Debe perder acceso inmediato sin perder historial.

**Solución:**
- Soft delete: `update negocio_members set activo = false, deactivated_at = now() where id = ...`
- Todas las helper functions filtran por `activo = true`, así que el ex-empleado deja de poder leer/escribir al instante (en la próxima consulta, no hace falta invalidar sesión).
- El historial queda intacto: pedidos creados por ese usuario siguen teniendo su `user_id` en `created_by`.
- **Force logout opcional:** llamar `supabase.auth.admin.signOut(user_id)` desde edge function con service_role.

### 4.3 Invitaciones

**Caso:** el owner quiere invitar a un nuevo empleado con un rol específico.

**Flujo:**
1. Owner abre UI de miembros → "Invitar". Llena email + rol.
2. Frontend hace `insert into invitaciones (negocio_id, email, rol, token)` con `token = encode(gen_random_bytes(24), 'hex')`. La policy `invit_insert` valida.
3. Edge function `send-invitation` envía email con link `https://app.solvr/aceptar?token=...`.
4. Invitado hace login (magic link al mismo email).
5. Cliente llama RPC `accept_invitation(p_token)` (security definer):

```sql
create or replace function accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_invit invitaciones;
  v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'no autenticado';
  end if;

  select * into v_invit from invitaciones
   where token = p_token and accepted_at is null and expires_at > now()
   for update;

  if v_invit is null then
    raise exception 'invitación inválida o expirada';
  end if;

  if lower(v_invit.email) <> lower(v_email) then
    raise exception 'esta invitación es para otro email';
  end if;

  insert into negocio_members (negocio_id, user_id, rol, invited_by)
       values (v_invit.negocio_id, auth.uid(), v_invit.rol, v_invit.invited_by)
       on conflict (negocio_id, user_id)
       do update set rol = excluded.rol, activo = true, deactivated_at = null;

  update invitaciones
     set accepted_at = now(), accepted_by = auth.uid()
   where id = v_invit.id;

  return v_invit.negocio_id;
end;
$$;
```

**Garantías:**
- `for update` en el select evita race condition (dos sesiones aceptando la misma invitación).
- El email del invitado debe coincidir con el del JWT.
- Token expira (default 7 días), revocable, single-use.

### 4.4 Registro self-service con trial

**Caso:** un visitante hace signup desde la landing → debe quedar como owner de un negocio nuevo, con suscripción en estado `prueba` por N días.

**Solución:** trigger en `auth.users`.

```sql
create or replace function on_auth_user_created()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_negocio_id uuid;
begin
  -- Si llegó vía invitación (created_at coincide con un accept), no creamos negocio.
  -- Heuristica: si existe una invitación pending para este email, no auto-crear.
  if exists(
    select 1 from invitaciones
     where lower(email) = lower(new.email) and accepted_at is null
  ) then
    return new;
  end if;

  insert into negocios (nombre, owner_id, trial_hasta)
       values ('Mi Negocio', new.id, current_date + interval '14 days')
    returning id into v_negocio_id;

  insert into negocio_members (negocio_id, user_id, rol)
       values (v_negocio_id, new.id, 'owner');

  insert into suscripciones (negocio_id, estado, fecha_inicio, fecha_vencimiento)
       values (v_negocio_id, 'prueba', current_date, current_date + interval '14 days');

  return new;
end;
$$;

create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function on_auth_user_created();
```

**Notas:**
- `security definer` para poder escribir en tablas que el `anon` no puede tocar.
- `set search_path` evita exploits via schema poisoning.
- Si el usuario llega por invitación, no se crea negocio: el flujo de aceptar invitación lo afilia al negocio existente.

### 4.5 `service_role` en edge functions

**Riesgo principal:** el `service_role` ignora RLS. Cualquier edge function que use service_role puede leer/escribir cualquier dato. Si la función acepta `negocio_id` desde el body sin validar, hay escalada de privilegios.

**Patrón obligatorio para edge functions que actúan en nombre del usuario:**

```ts
// supabase/functions/_shared/auth.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function getNegocioFromRequest(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("no auth header");

  // Cliente CON el JWT del request — respeta RLS y identifica al usuario.
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new Error("token inválido");

  const { data: negocioId, error: e2 } = await userClient.rpc("mi_negocio_id");
  if (e2 || !negocioId) throw new Error("sin negocio activo");

  return { user, negocioId, userClient };
}
```

**Reglas absolutas:**
1. **Nunca** aceptar `negocio_id` del body de un request. Siempre derivarlo del JWT con `mi_negocio_id()`.
2. Si la función necesita `service_role`, validar **origen e identidad** antes de tocar datos:
   - Para webhooks externos: verificar firma del servicio que llama (HMAC, etc.).
   - Para acciones administrativas internas: re-verificar membresía y rol del usuario que invoca.
3. Las edge functions que actúan en nombre del usuario deben usar el cliente **con el JWT del usuario**, no `service_role`.
4. Prohibir referencia directa a `SUPABASE_SERVICE_ROLE_KEY` fuera de `supabase/functions/_shared/admin.ts` (regla de lint sugerida en `eslint.config.mjs`).

### 4.5.1 Inventario de edge functions que necesitan `service_role`

Estado actual del repo: **ninguna edge function existe** (`supabase/functions/` no está creada). Toda la comunicación con Supabase pasa por el SDK del cliente. La introducción de las funciones de abajo es parte del plan.

| Edge function | ¿Usa service_role? | Justificación | Mitigaciones específicas |
|---|---|---|---|
| **`mp-webhook`** | ✅ Sí | Mercado Pago llama desde su backend sin JWT del usuario. Necesita actualizar `suscripciones.estado` y `fecha_vencimiento`. Como no hay JWT, no hay `auth.uid()` → RLS bloquea la escritura. | (a) Verificar firma de MP (`x-signature` con secret compartido) antes de cualquier operación. (b) Buscar la suscripción por `mp_preference_id` / `mp_payment_id` recibido — no aceptar `negocio_id` del body. (c) Validar transición de estado (no permitir `vencida → activa` sin pago confirmado en MP). (d) Audit log de cada llamada en tabla `webhook_logs` para investigación post-hoc. |
| **`force-signout`** | ✅ Sí | Cuando un admin cambia el rol de un miembro o lo desactiva, se invoca `supabase.auth.admin.signOut(target_user_id, { scope: 'others' })`. El admin API requiere `service_role`. Sin esto, el usuario afectado sigue operando con su rol viejo hasta el próximo refresh (hasta 1h). | (a) Wrapper que verifica primero que el invocador tiene rol `owner|admin` en el negocio donde está el miembro afectado (vía `getNegocioFromRequest`). (b) Loggear quién forzó el signout y a quién en `audit_log`. |
| **`send-invitation`** | ❌ No (recomendado) | Envío de email con el link de invitación. **No necesita service_role**: el INSERT en `invitaciones` lo hace el cliente con su JWT vía RLS; la edge function solo lee la invitación recién creada (su policy `invit_select` lo permite porque `invited_by = auth.uid()`) y envía el email vía proveedor SMTP (ej. Resend). | Si se decide igual usar `service_role` por simplicidad operativa, aplicar el wrapper `getNegocioFromRequest` y validar `puede_administrar(negocio_id)` antes de cualquier escritura. |
| **`accept-invitation`** | ❌ No | Implementado como RPC `accept_invitation(token)` `security definer` (ver §4.3), no como edge function. El `security definer` permite a un usuario `authenticated` insertar en `negocio_members` aunque normalmente no podría. La función valida que el email del JWT coincide con el de la invitación. | `set search_path = public, pg_catalog` en la función. `for update` en el select de la invitación contra race. |
| **`audit-export`** *(opcional)* | ✅ Sí | Si se decide ofrecer "exportar logs de auditoría del negocio" para owners. Necesitaría leer transversalmente tablas. | Solo accesible si `es_owner(negocio_id)` para el invocador. |

**Decisión:** las únicas dos edge functions con `service_role` que el plan introduce son `mp-webhook` y `force-signout`. Cualquier futura edge function que requiera `service_role` debe agregarse a esta tabla con su justificación antes de mergearse.

---

## 5. Validación de aislamiento entre tenants

### 5.1 Setup compartido por todos los tests

**Quiénes participan en el escenario:**

| Alias | Email | `auth.uid()` (uuid) | Membresía |
|---|---|---|---|
| **Alicia** | `alicia@test.com` | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` | `owner` del **Negocio Alfa** |
| **Bruno** | `bruno@test.com` | `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` | `owner` del **Negocio Beta** |
| **Camila** | `cccccccc-cccc-cccc-cccc-cccccccccccc` | `vendedor` del **Negocio Alfa** |
| **Damián** | `dddddddd-dddd-dddd-dddd-dddddddddddd` | `visualizador` del **Negocio Alfa** |

**SQL de setup** (`scripts/test-rls-setup.sql`):

```sql
begin;

-- 1. Crear usuarios. En tests reales esto lo hace Supabase Auth; en SQL puro:
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alicia@test.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bruno@test.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'camila@test.com'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'damian@test.com');
-- El trigger on_auth_user_created crea: Negocio Alfa (Alicia owner), Negocio Beta (Bruno owner),
-- y para Camila y Damián crea negocios propios (los descartamos a propósito abajo).

-- 2. Borrar negocios autocreados de Camila y Damián para que solo queden con membresía en Alfa.
delete from negocios where owner_id in (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'dddddddd-dddd-dddd-dddd-dddddddddddd'
);

-- 3. Agregar Camila como vendedor y Damián como visualizador al Negocio Alfa.
insert into negocio_members (negocio_id, user_id, rol)
  select id, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'vendedor'
    from negocios where owner_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

insert into negocio_members (negocio_id, user_id, rol)
  select id, 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'visualizador'
    from negocios where owner_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- 4. Alicia (como owner) inserta datos en Alfa.
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

insert into clientes (nombre) values ('Cliente Alfa 1');  -- negocio_id se autocompleta vía trigger
insert into pedidos (fecha, total_final) values (current_date, 1000);

-- 5. Bruno (como owner) inserta datos en Beta.
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
insert into clientes (nombre) values ('Cliente Beta 1');
insert into pedidos (fecha, total_final) values (current_date, 500);

commit;
```

**Helper para impersonar usuarios en cada test:**

```sql
-- Antes de cada bloque de test, fijar el sujeto del JWT.
set local role authenticated;
set local "request.jwt.claim.sub" = '<uuid>';
```

### 5.2 Casos de aislamiento — query y resultado esperado

| # | Quién corre | Query | Resultado esperado | Mide |
|---|---|---|---|---|
| **T1** | Bruno | `select count(*) from clientes;` | `0` | SELECT cross-tenant no expone datos |
| **T2** | Bruno | `select * from clientes where id = '<id-cliente-alfa-1>';` | 0 filas | Lookup directo por id ajeno no expone |
| **T3** | Bruno | `insert into clientes (negocio_id, nombre) values ('<id-negocio-alfa>', 'Hack');` | Error `new row violates row-level security policy` | INSERT cross-tenant bloqueado por `WITH CHECK` |
| **T4** | Bruno | `insert into clientes (nombre) values ('Hack');` (sin `negocio_id`, trigger lo completa con `mi_negocio_id()` de Bruno = Beta) | 1 fila insertada en Beta, no en Alfa | El trigger no permite "robar" tenant — siempre usa el del invocador |
| **T5** | Bruno | `update clientes set nombre = 'Hacked' where negocio_id = '<id-negocio-alfa>';` | `UPDATE 0` (0 filas afectadas, sin error) | UPDATE cross-tenant: RLS filtra antes |
| **T6** | Bruno | `delete from clientes where negocio_id = '<id-negocio-alfa>';` | `DELETE 0` | DELETE cross-tenant: RLS filtra antes |
| **T7** | Bruno | `select * from pedido_items where pedido_id = '<id-pedido-alfa>';` | 0 filas | Tabla hija respeta tenancy via padre |
| **T8** | Alicia | `select count(*) from clientes;` | `1` | Owner ve solo sus propios datos |
| **T9** | Alicia | `select count(*) from clientes where negocio_id = '<id-negocio-beta>';` | `0` | El filtro RLS prevalece sobre WHERE explícito ajeno |

### 5.3 Casos de roles dentro del MISMO negocio

| # | Quién corre | Query | Resultado esperado | Mide |
|---|---|---|---|---|
| **R1** | Camila (vendedor en Alfa) | `select count(*) from clientes;` | `1` | Vendedor SÍ puede leer |
| **R2** | Camila | `insert into clientes (nombre) values ('Nuevo');` | 1 fila insertada | Vendedor SÍ puede insertar |
| **R3** | Camila | `update clientes set nombre = 'Edit' where id = '<id-cliente-alfa-1>';` | `UPDATE 1` | Vendedor SÍ puede editar |
| **R4** | Camila | `delete from clientes where id = '<id-cliente-alfa-1>';` | `DELETE 0` (filtrado por policy `_delete`) | Vendedor NO puede eliminar |
| **R5** | Camila | `insert into productos (nombre, precio) values ('P', 100);` | Error o 0 filas (productos requiere `puede_administrar`) | Vendedor NO puede tocar catálogo |
| **R6** | Camila | `insert into gastos (fecha, descripcion, monto) values (current_date, 'X', 1);` | Error o 0 filas | Vendedor NO puede tocar finanzas |
| **R7** | Damián (visualizador) | `select count(*) from clientes;` | `1` | Visualizador SÍ lee |
| **R8** | Damián | `insert into clientes (nombre) values ('X');` | Error o 0 filas | Visualizador NO escribe |
| **R9** | Damián | `update clientes set nombre = 'X' where id = '<id-cliente-alfa-1>';` | `UPDATE 0` | Visualizador NO actualiza |
| **R10** | Damián | `delete from clientes where id = '<id-cliente-alfa-1>';` | `DELETE 0` | Visualizador NO elimina |

### 5.4 Casos de membership

| # | Quién corre | Setup previo | Query | Resultado esperado | Mide |
|---|---|---|---|---|---|
| **M1** | Camila | Owner Alicia ejecuta: `update negocio_members set activo = false where user_id = '<camila>';` | `select count(*) from clientes;` | `0` | Miembro desactivado pierde acceso inmediatamente sin signout |
| **M2** | Camila | Otro admin intenta: `delete from negocio_members where rol = 'owner' and negocio_id = '<alfa>';` | (corre Alicia o un admin) | `DELETE 0` | Policy `members_delete` no permite eliminar al owner |
| **M3** | Camila | Otro admin intenta: `update negocio_members set rol = 'visualizador' where rol = 'owner' and negocio_id = '<alfa>';` | (corre Alicia o un admin) | Error o 0 filas | `WITH CHECK rol <> 'owner'` impide degradar al owner |
| **M4** | Bruno | Insertar invitación de Alfa siendo dueño de Beta | `insert into invitaciones (negocio_id, email, rol, token, invited_by) values ('<id-alfa>', 'x@y.com', 'vendedor', 't', '<bruno>');` | Error (policy `invit_insert` exige `puede_administrar(negocio_id)`) | No se pueden crear invitaciones para otros negocios |

### 5.5 Casos de invitaciones

| # | Quién corre | Setup previo | Query | Resultado esperado |
|---|---|---|---|---|
| **I1** | Email random Eva (`eva@test.com`) | Alicia generó invitación válida con token `tok123` para Eva | `select accept_invitation('tok123');` | Devuelve `<id-negocio-alfa>` y Eva queda como miembro |
| **I2** | Email random Eva | Token `tok123` ya fue aceptado | `select accept_invitation('tok123');` | Error `invitación inválida o expirada` |
| **I3** | Email random Felipe | Invitación para Eva con token `tok456` | Felipe loguea con `felipe@test.com` y llama `accept_invitation('tok456')` | Error `esta invitación es para otro email` |
| **I4** | Email random Eva | Invitación con `expires_at = now() - 1 hour` | `select accept_invitation('tok-expirado');` | Error `invitación inválida o expirada` |

### 5.5.1 Casos del gate de suscripción

Aplican una vez activas las policies `_v2` (Fase 3) y de manera estricta una vez eliminadas las viejas (Fase 5). Setup específico:

```sql
-- Bajar la suscripción de Alfa a 'vencida' antes de correr cada bloque.
update suscripciones
   set estado = 'vencida', fecha_vencimiento = current_date - 1
 where negocio_id = '<id-negocio-alfa>';
```

| # | Quién corre | Query | Resultado esperado | Mide |
|---|---|---|---|---|
| **S1** | Alicia (owner Alfa, vencida) | `select count(*) from clientes;` | `1` (lectura sigue funcionando) | SELECT NO está gateado por suscripción |
| **S2** | Alicia | `insert into clientes (nombre) values ('Nuevo');` | Error `new row violates row-level security policy` (en escenario solo `_v2`) | INSERT bloqueado por `is_suscripcion_activa` |
| **S3** | Alicia | `update clientes set nombre = 'X' where id = '<id-cliente-alfa-1>';` | `UPDATE 0` o error | UPDATE bloqueado |
| **S4** | Alicia | `delete from clientes where id = '<id-cliente-alfa-1>';` | `DELETE 0` o error | DELETE bloqueado |
| **S5** | Alicia | Re-activar: `update suscripciones set estado='activa', fecha_vencimiento=current_date+30 where ...;` luego `insert into clientes (nombre) values ('Post-renovación');` | 1 fila insertada | Re-activación destrabea escritura en la próxima query |
| **S6** | Alicia | Aún con suscripción vencida: `update negocios set nombre = 'Renombrado' where id = '<id-alfa>';` | `UPDATE 1` | `negocios` está exenta del gate por diseño |
| **S7** | Alicia | Aún con suscripción vencida: `update negocio_members set activo = false where user_id = '<camila>';` | `UPDATE 1` | `negocio_members` está exenta para que el admin pueda recortar el equipo |

> **Atención durante coexistencia Fase 3→5:** los tests S2/S3/S4 ejecutados en producción durante coexistencia van a ver la escritura PASAR (porque la policy vieja `auth.uid()=user_id` no exige suscripción y combina con `OR`). El test debe correrse contra un negocio con _solo policies _v2_ activas — o sea, después de Fase 5 — para que sea estrictamente vinculante. Documentar este matiz al pegarse al PR.

### 5.6 Test runner desde el frontend (humo)

Archivo `scratch/check_rls_isolation.js`:

```js
// Crea dos clientes Supabase con tokens de dos usuarios distintos.
// Verifica que ninguno ve los datos del otro.
import { createClient } from '@supabase/supabase-js';

const cliA = createClient(URL, ANON, { auth: { storageKey: 'a' } });
const cliB = createClient(URL, ANON, { auth: { storageKey: 'b' } });

await cliA.auth.signInWithPassword({ email: 'alicia@test.com', password: '...' });
await cliB.auth.signInWithPassword({ email: 'bruno@test.com',  password: '...' });

const { data: aClientes } = await cliA.from('clientes').select('*');
const { data: bClientes } = await cliB.from('clientes').select('*');

console.assert(aClientes.length > 0 && bClientes.length > 0, 'cada uno debe ver lo suyo');
console.assert(
  aClientes.every(c => !bClientes.find(b => b.id === c.id)),
  '❌ hay overlap entre tenants'
);

// Intentar leer un id específico de A desde B.
const { data: leak } = await cliB.from('clientes').select('*').eq('id', aClientes[0].id);
console.assert(leak.length === 0, '❌ B logró leer cliente de A');
```

### 5.7 Criterios de PASS

Para considerar el aislamiento sano, **todos** estos deben verificarse:

1. ✅ `select` cross-tenant devuelve 0 filas.
2. ✅ `insert` cross-tenant lanza error o falla check.
3. ✅ `update` cross-tenant afecta 0 filas.
4. ✅ `delete` cross-tenant afecta 0 filas.
5. ✅ Vendedor no puede ejecutar `delete` ni siquiera en su propio negocio.
6. ✅ Visualizador no puede ejecutar `insert` ni `update` ni `delete`.
7. ✅ Miembro con `activo = false` se comporta igual que un no-miembro.
8. ✅ El owner de un negocio NO puede ser eliminado de `negocio_members` (incluso por otro admin).
9. ✅ Invitación expirada no se puede aceptar.
10. ✅ Invitación ya aceptada no se puede aceptar de nuevo.

---

## 6. Validaciones espejo en el frontend

> Principio del CLAUDE.md: **toda validación crítica vive en ambas capas**.

### 6.1 Capa de sesión y rol

En `App.jsx`, al loguearse:

```js
const { data: negocioId } = await supabase.rpc('mi_negocio_id');
const { data: rol } = await supabase
  .from('negocio_members')
  .select('rol')
  .eq('negocio_id', negocioId)
  .eq('user_id', session.user.id)
  .single();

setState({ negocioId, rol: rol.rol });
```

### 6.2 Tabla de mirroring por capa

| Validación | Frontend | Backend (RLS / constraint) |
|---|---|---|
| Tab visible para rol | `ALLOWED_TABS[rol]` esconde nav | N/A (es UX) |
| Botón "Eliminar" visible | `if (puedeEliminar(rol))` | Policy `_delete` con `puede_eliminar` |
| `negocio_id` en escrituras | **Nunca enviar desde el cliente.** Insertar sin `negocio_id`, default por trigger | Trigger `before insert` setea `negocio_id := mi_negocio_id()` si viene null; policy `_insert` valida |
| Email de invitación | Regex válido + dominio razonable | Constraint `check (email ~* '^...$')` |
| Rol asignable en invitación | Dropdown solo con roles válidos | `rol rol_negocio` (enum) + policy `_insert` exige `puede_administrar` |
| Total de pedido | Calculado en form | Trigger `before insert/update` recalcula y compara; rechaza si difiere |
| Stock al cerrar pedido | Verificar antes de submit | Trigger que decrementa stock atómicamente; rechaza si negativo |
| Cliente pertenece al negocio | El selector solo muestra clientes propios | Policy `_insert` en `pedidos` con check sobre `clientes.negocio_id = pedidos.negocio_id` |
| Sesión activa | Redirect a login si `!session` | Policies exigen `auth.uid()` |
| Suscripción activa | Banner "Tu prueba vence" + bloquear UI si vencida | Policies `_v2 insert/update/delete` en tablas transaccionales: `and is_suscripcion_activa(negocio_id)` (función definida en §2.4). Solo escritura — la lectura sigue libre para que el cliente pueda renovar viendo sus datos. |

### 6.3 Trigger para auto-completar `negocio_id`

Para reducir riesgo de bugs en el frontend (alguien olvida pasar `negocio_id`):

```sql
create or replace function set_negocio_id_default()
returns trigger language plpgsql as $$
begin
  if new.negocio_id is null then
    new.negocio_id := mi_negocio_id();
  end if;
  return new;
end;
$$;

-- Aplicar a cada tabla de datos:
create trigger clientes_set_negocio before insert on clientes
  for each row execute function set_negocio_id_default();
-- (idem para productos, pedidos, gastos, etc)
```

**Beneficio:** el frontend puede hacer `insert({ nombre: 'X' })` y el backend resuelve el tenant. Elimina una clase entera de bugs.

---

## 7. Fases de implementación

> Cada fase deja la app **funcionando** y se puede deployar de forma aislada. No hay big-bang.

### 7.0 Reglas operacionales que aplican a TODAS las fases

1. **Ninguna fase activa RLS en una tabla sin crear sus policies en la misma transacción.**
   En Postgres, `alter table X enable row level security;` sin policies = tabla **inaccesible para `authenticated`** (deny by default). Cada bloque SQL que prende RLS en una tabla nueva crea sus policies en el mismo `BEGIN; ... COMMIT;`. Para tablas existentes que ya tienen policies, no se toca RLS — solo se agregan policies adicionales.
2. **Cada migración SQL se ejecuta dentro de una transacción explícita** (`BEGIN; ... COMMIT;`). Si algo falla, rollback total. Esto vale incluso para los `alter table` triviales — Postgres permite DDL transaccional.
3. **Backfill antes de constraint.** Cualquier `set not null` o foreign key NOT VALID → VALIDATE se ejecuta DESPUÉS del backfill correspondiente, no antes.
4. **Una fase = un PR = un deploy.** No mezclar fases en el mismo PR. Tiempo mínimo de soak entre fases productivas: 24h para fases que cambian policies, 1 semana para Fase 5 (drop de policies viejas).
5. **Rollback plan documentado** en el cuerpo del PR. Cada fase debe tener un script `rollback_fase_N.sql` que revierte sus cambios.

### 7.0.1 Tabla de garantías por fase

| Fase | ¿Activa RLS en tablas nuevas? | ¿Crea policies en la misma tx? | ¿Toca código del frontend? | ¿Puede romper producción si frontend está atrasado? | Tiempo de soak antes de siguiente fase |
|---|---|---|---|---|---|
| 0 — Auditoría | No (no toca DB) | N/A | No | No | Inmediato |
| 1 — Infra de tenancy | Sí, en `negocios`, `negocio_members`, `invitaciones` | **Sí, mismo BEGIN** | No (app sigue ignorando estas tablas) | No | 24h |
| 2 — `negocio_id` nullable + backfill | No (solo agrega columnas a tablas existentes) | N/A | No | No (columna nullable, queries viejos no la mencionan) | 24h |
| 3 — Mirror policies | No (RLS ya estaba prendido en tablas viejas) | Sí, las policies se agregan junto a las existentes | No | No (las viejas siguen activas; la app no nota nada) | 24h–72h |
| 4 — Migrar `db.js` y `App.jsx` | No | N/A | **Sí** — cambio mayor | Solo si DB no tiene policies de Fase 3 (validar antes de mergear) | 1 semana mínimo |
| 5 — `NOT NULL` + drop policies viejas | No | Drop solo después de validar Fase 4 estable | No | **Sí, si Fase 4 no está deployado** — bloquearía writes del cliente viejo. Verificar adoption del frontend antes. | 24h |
| 6 — UI miembros + invitaciones | No | N/A | Sí (additivo, no rompe lo viejo) | No | Continuo |
| 7 — Limpieza | No | N/A | Sí (rename de columna) | Sí si se hace rename antes que la app — hacerlo después de deploy del frontend con nuevo nombre | N/A (fin) |

**Lectura clave:** las fases peligrosas son 4 y 5. Las demás son additivas o internas. El orden de despliegue Fase 4 → soak → Fase 5 es lo que garantiza no romper. Si tras Fase 4 hay cualquier issue, Fase 5 se posterga; no hay ningún incentivo para correr 5 hasta no estar seguros.

### Fase 0 — Auditoría y baseline

**Objetivo:** dejar el estado actual versionado y reproducible antes de tocar nada.

**Tareas:**
1. Dump completo del schema actual: `pg_dump --schema-only --no-owner > schema_baseline.sql`
2. Recuperar definiciones que están en producción pero no en el repo: `allowed_emails`, `team_members`, funciones `get_my_role`, `is_my_owner_data`. Agregarlas a `supabase_schema.sql`.
3. Snapshot de datos: `pg_dump --data-only --table=clientes --table=pedidos ... > backup_$(date +%F).sql`
4. Listar todas las policies actuales: `select * from pg_policies where schemaname = 'public';` → guardar en `docs/baseline-policies.md`.
5. Setup ambiente de staging (proyecto Supabase aparte): clonar schema y datos sample.

**Criterio de validación:**
- `supabase_schema.sql` refleja exactamente lo que hay en producción.
- Existe un backup verificable.
- Tests existentes de la app pasan en staging.

**Riesgo si se omite:** sin baseline, no se puede rollback en caso de problema.

---

### Fase 1 — Infraestructura de tenancy (additiva)

**Objetivo:** crear `negocios`, `negocio_members`, `invitaciones` y los helper functions. Nada en uso todavía.

**SQL:**

```sql
-- (Las tablas y funciones de §2.3 y §2.4)

create type rol_negocio as enum ('owner', 'admin', 'vendedor', 'visualizador');

create table negocios ( ... );
create table negocio_members ( ... );
create table invitaciones ( ... );

create function mi_negocio_id() ...;
create function es_miembro(uuid) ...;
create function mi_rol_en(uuid) ...;
create function puede_leer(uuid) ...;
create function puede_escribir(uuid) ...;
create function puede_eliminar(uuid) ...;
create function puede_administrar(uuid) ...;
create function es_owner(uuid) ...;
-- NOTA: is_suscripcion_activa() NO se crea acá. Va en Fase 3 junto con las
-- policies _v2 que la consumen (ver §2.4 y §7 Fase 3).

-- RLS en las nuevas tablas según §3.3.
```

**Backfill:**

> **Por qué NO partir solo de `negocio_config`:** esa tabla no es obligatoria; pueden existir owners que usaron la app sin haberla completado (clientes y pedidos cargados, `negocio_config` vacío). Tomar `negocio_config` como fuente única deja a esos owners sin `negocios` y, al pasar a Fase 5 (`NOT NULL`), sus datos quedan invisibles. La fuente correcta es la **unión de `distinct user_id` sobre todas las tablas de datos** — cualquier `user_id` que haya generado una fila merece su tenant.

```sql
begin;

-- 1. Conjunto canónico de owners detectados.
-- Cualquier tabla con user_id de datos cuenta. Si mañana se agrega otra tabla,
-- agregar su user_id acá antes de correr el backfill en producción.
create temporary table _owners_detectados (user_id uuid primary key);

insert into _owners_detectados (user_id)
  select user_id from negocio_config            where user_id is not null union
  select user_id from clientes                  where user_id is not null union
  select user_id from productos                 where user_id is not null union
  select user_id from pedidos                   where user_id is not null union
  select user_id from gastos                    where user_id is not null union
  select user_id from categorias                where user_id is not null union
  select user_id from alertas_config            where user_id is not null union
  select user_id from suscripciones             where user_id is not null union
  select user_id from devoluciones              where user_id is not null union
  select user_id from comunicaciones            where user_id is not null union
  select user_id from productos_precio_historial where user_id is not null union
  select user_id from pedidos_recurrentes       where user_id is not null union
  select user_id from proveedores               where user_id is not null union
  select user_id from ordenes_compra            where user_id is not null;

-- 2. Crear un negocio por owner detectado.
-- Reusamos user_id como id del negocio para facilitar el backfill de Fase 2.
insert into negocios (id, nombre, owner_id)
  select o.user_id,
         coalesce(
           (select nombre from negocio_config nc where nc.user_id = o.user_id),
           'Mi Negocio'
         ),
         o.user_id
    from _owners_detectados o
  on conflict (id) do nothing;

-- 3. Cada owner se vuelve miembro con rol owner.
insert into negocio_members (negocio_id, user_id, rol)
  select n.id, n.owner_id, 'owner'
    from negocios n
  on conflict (negocio_id, user_id) do nothing;

-- 4. Cada allowed_emails con user creado se vuelve member del owner correspondiente.
--    (Solo entran si el owner_user_id existe en negocios — owners sin datos no califican
--    como tenants y por lo tanto no pueden tener miembros).
insert into negocio_members (negocio_id, user_id, rol)
  select ae.owner_user_id,
         u.id,
         (case ae.rol when 'admin' then 'admin'::rol_negocio
                      when 'vendedor' then 'vendedor'::rol_negocio
                      else 'visualizador'::rol_negocio end)
    from allowed_emails ae
    join auth.users u on lower(u.email) = lower(ae.email)
   where ae.is_owner = false
     and exists (select 1 from negocios n where n.id = ae.owner_user_id)
  on conflict (negocio_id, user_id) do nothing;

-- 5. Verificación: TODO user_id con datos debe tener un negocio. Si falla, abortar.
do $$
declare
  v_huerfanos int;
  v_muestra uuid;
begin
  select count(*), min(o.user_id)
    into v_huerfanos, v_muestra
    from _owners_detectados o
   where not exists (select 1 from negocios n where n.id = o.user_id);

  if v_huerfanos > 0 then
    raise exception
      'Backfill incompleto: % owner(s) con datos quedaron sin negocio. Muestra: %',
      v_huerfanos, v_muestra;
  end if;
end $$;

-- 6. Verificación adicional: todo negocio tiene exactamente un miembro owner.
do $$
declare
  v_negocios_sin_owner int;
begin
  select count(*) into v_negocios_sin_owner
    from negocios n
   where not exists (
     select 1 from negocio_members m
      where m.negocio_id = n.id and m.user_id = n.owner_id and m.rol = 'owner' and m.activo
   );

  if v_negocios_sin_owner > 0 then
    raise exception
      'Backfill incompleto: % negocio(s) sin miembro owner activo.', v_negocios_sin_owner;
  end if;
end $$;

drop table _owners_detectados;

commit;
```

**Criterio de validación:**
- El bloque `do $$ ... $$` de paso 5 NO levanta excepción → ningún owner con datos quedó sin negocio.
- El bloque del paso 6 NO levanta excepción → ningún negocio quedó sin owner.
- `select count(*) from negocios` ≥ `select count(distinct user_id) from negocio_config` (puede ser mayor: owners con datos pero sin `negocio_config`).
- Cada `negocio_members` con rol `owner` matchea con `negocios.owner_id`.
- App sigue funcionando (no usa estas tablas todavía).

**Riesgo:** ninguno operativo. Las verificaciones abortan la transacción ante cualquier inconsistencia; al estar todo dentro de `BEGIN; ... COMMIT;` un fallo deja la base en el estado original.

---

### Fase 2 — Agregar `negocio_id` nullable a tablas de datos + backfill

**Objetivo:** que cada fila de datos tenga `negocio_id`, sin cambiar policies todavía.

**SQL (ejemplo en clientes; repetir en todas):**

```sql
alter table clientes add column negocio_id uuid references negocios(id);
create index clientes_negocio_idx on clientes(negocio_id);

-- Backfill: como reusamos user_id como id de negocio, el match es directo.
update clientes set negocio_id = user_id where negocio_id is null;
```

Repetir en: `productos`, `pedidos`, `gastos`, `categorias`, `alertas_config`, `suscripciones`, `negocio_config`, `devoluciones`, `comunicaciones`, `productos_precio_historial`, `pedidos_recurrentes`, `proveedores`, `ordenes_compra`.

Para tablas hijo (`pedido_items`, `devolucion_items`, `ordenes_compra_items`):

```sql
alter table pedido_items add column negocio_id uuid references negocios(id);
update pedido_items pi set negocio_id = p.negocio_id
  from pedidos p where pi.pedido_id = p.id;
create index pedido_items_negocio_idx on pedido_items(negocio_id);
```

**Validación:**
- `select count(*) from clientes where negocio_id is null` → 0.
- Repetir en cada tabla.

---

### Fase 3 — Policies espejo (mirror policies)

**Objetivo:** crear las nuevas policies (que usan `negocio_id`) **en paralelo** a las viejas. Como las viejas siguen activas, la app funciona; las nuevas no rompen nada porque aún no se eliminó nada.

> **Detalle clave:** PostgreSQL combina multiples policies de la misma operación con `OR`. Si tengo policy vieja (`auth.uid() = user_id`) y nueva (`puede_leer(negocio_id)`), un usuario tiene acceso si **cualquiera** de las dos pasa. Esto es exactamente lo que queremos para la transición.

**SQL (ejemplo en clientes):**

```sql
-- Primero: la función que el gate de suscripción necesita (ver §2.4).
-- Se crea acá, no en Fase 1, porque no hay policy que la use hasta este momento.
create or replace function is_suscripcion_activa(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from suscripciones
     where negocio_id = p_negocio_id
       and estado in ('prueba', 'activa')
       and (fecha_vencimiento is null or fecha_vencimiento >= current_date)
  );
$$;

-- Mirror policies (incluyen gate de suscripción en escritura).
create policy clientes_select_v2 on clientes
  for select using (puede_leer(negocio_id));

create policy clientes_insert_v2 on clientes
  for insert with check (
    puede_escribir(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

create policy clientes_update_v2 on clientes
  for update
  using (puede_escribir(negocio_id))
  with check (
    puede_escribir(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );

create policy clientes_delete_v2 on clientes
  for delete using (
    puede_eliminar(negocio_id)
    and is_suscripcion_activa(negocio_id)
  );
```

> **Particularidad de la coexistencia:** las policies viejas (`auth.uid() = user_id`) **no** tienen el gate de suscripción. Mientras ambas coexistan (Fase 3 → 5), PostgreSQL combina con `OR`: una escritura va a pasar si la vieja la acepta, aún si la nueva la rechazaría por suscripción vencida. **Esto es deseable durante la transición** — no queremos que activar Fase 3 bloquee escrituras de clientes que están al día contractualmente pero cuyo schema no migró. El gate empieza a ser estrictamente vinculante recién en Fase 5, cuando se eliminan las policies viejas. Documentar esto en el changelog para evitar sorpresas.

**Validación:**
- Con la suite de §5, comparar comportamiento entre policies viejas y nuevas. Los resultados deben ser idénticos para los datos actuales (porque cada user es su propio negocio).
- Si los resultados difieren en alguna fila, **detener migración** e investigar (probablemente backfill incompleto).

---

### Fase 4 — Migrar app cliente a usar `negocio_id`

**Objetivo:** que el frontend escriba/lea por `negocio_id`, no por `user_id`.

**Cambios en `db.js`:**

```js
// Antes:
const { error } = await supabase.from('clientes')
  .insert({ ...fields, user_id: userId });

// Después: confiar en el trigger set_negocio_id_default + RLS.
const { error } = await supabase.from('clientes')
  .insert({ ...fields });   // negocio_id se completa solo
```

```js
// Antes:
const { data } = await supabase.from('pedidos')
  .select('*').eq('user_id', userId);

// Después:
const { data } = await supabase.from('pedidos')
  .select('*');   // RLS filtra por puede_leer(negocio_id) automáticamente
```

**Cambios en `App.jsx`:**

- Eliminar `setEffectiveUserId(owner_user_id)`. Ya no hace falta: el frontend escribe sin `user_id` ni `negocio_id`, y los triggers + RLS resuelven todo.
- Reemplazar lookup en `allowed_emails` por `select * from negocio_members where user_id = ... and activo`.
- El estado `userRole` se carga desde `mi_rol_en(negocio_id)`.

**Validación:**
- Cada flujo de CRUD probado manualmente en staging.
- Tests E2E (si existen) verdes.
- En producción: deployar con feature flag o canary.

---

### Fase 5 — Hacer `negocio_id` `NOT NULL` y eliminar policies viejas

**Objetivo:** cerrar la transición. Después de Fase 4 estabilizada (mínimo 1 semana en producción sin issues).

**SQL:**

```sql
-- Asegurar que no quedó nada null.
alter table clientes alter column negocio_id set not null;
-- ... idem todas

-- Drop policies viejas.
drop policy clientes_select on clientes;
drop policy clientes_insert on clientes;
drop policy clientes_update on clientes;
drop policy clientes_delete on clientes;
-- ... idem todas

-- Renombrar las _v2 (opcional, estético).
alter policy clientes_select_v2 on clientes rename to clientes_select;
-- ... idem
```

**Validación:**
- Suite de §5 corre con policies nuevas solamente y pasa.
- Smoke test E2E pasa.

**Riesgo:** alto si quedó alguna fila con `negocio_id = null`. El `alter ... set not null` falla — eso es bueno, indica que algo se omitió.

---

### Fase 6 — UI de gestión de miembros + invitaciones

**Objetivo:** reemplazar la UX de "whitelist de emails" en `PerfilPanel.jsx` por gestión real.

**Tareas:**
- Nuevo tab/sección "Miembros".
- Lista de `negocio_members` con dropdowns de rol y switch de activo.
- Formulario "Invitar" → crea `invitaciones` + dispara edge function de email.
- Pantalla `/aceptar?token=...` que llama `rpc('accept_invitation', { p_token })`.

**Validación:**
- E2E: owner invita a usuario nuevo → recibe email → acepta → ve datos del negocio con rol asignado.

---

### Fase 7 — Limpieza y multi-sucursal preparation

**Objetivo:** dejar el esquema limpio.

**Tareas:**
1. Renombrar `user_id` → `created_by` en cada tabla de datos (auditoría: quién creó la fila).
2. Drop tabla `allowed_emails` (datos ya migrados a `negocio_members`).
3. Drop funciones `get_my_role`, `is_my_owner_data` (reemplazadas por `mi_rol_en` / `es_miembro`).
4. Agregar columna `sucursal_id uuid references sucursales(id)` nullable en `pedidos`, `gastos`, `pedido_items`, `ordenes_compra` (preparación, sin tabla `sucursales` aún).
5. Documentar el modelo final en `docs/data-model.md`.

**Validación:**
- Lint del schema con `pgtap` o similar.
- App funciona con campo renombrado (cambio mecánico en `db.js`).

---

## 8. Tabla de riesgos

| # | Riesgo | Impacto | Probabilidad | Mitigación |
|---|---|---|---|---|
| 1 | Migración elimina o corrompe datos | Crítico (clientes perdidos) | Baja con backups | Backup completo antes de cada fase. Ejecutar en staging primero. Cada fase en una transacción cuando sea posible. |
| 2 | Bug en RLS expone datos cross-tenant | Crítico (incidente de privacidad, fin del negocio) | Media en la primera versión | Suite de tests automatizados de §5 corre antes de cada deploy. Code review obligatorio en policies. Rollout canary. |
| 3 | Performance: `mi_negocio_id()` se ejecuta N veces por query | Alto (app lenta) | Alta sin mitigación | Funciones marcadas `stable`. Caché por sentencia. Plan B: claim en JWT (opción B del §2.1) para skipear el lookup. Índices en `negocio_members(user_id) where activo`. |
| 4 | `service_role` usado en edge function bypassa RLS | Crítico (escalada de privilegios) | Media | Patrón `getNegocioFromRequest` obligatorio. Lint regla: prohibir uso directo de `SUPABASE_SERVICE_ROLE_KEY` salvo en archivos `_shared/`. Code review. |
| 5 | App rota durante la migración (frontend con código viejo + backend con policies nuevas) | Alto (downtime) | Media | Mirror policies (Fase 3) permite que ambas versiones coexistan. Vercel preview deployments para validar. Rollout feature-flagged. |
| 6 | Usuario en multi-negocio: bug en selección de "activo" | Medio (ve datos del negocio equivocado) | Baja al inicio (raro) | Inicialmente UNIQUE en `negocio_members(user_id) where activo` para forzar 1 negocio por user. Multi-negocio explícito como feature post-launch. |
| 7 | Token de invitación filtrado por log/email forward | Alto (acceso no autorizado) | Baja | TTL 7 días. Single-use. Token con 192 bits de entropía. Email del invitado debe coincidir con el JWT. Audit log de aceptaciones. |
| 8 | Owner se autoeleva o se autoelimina | Alto | Baja | Policy `members_update` rechaza cambiar al owner. Transferencia de ownership solo vía rpc dedicado con confirmación. |
| 9 | Eliminación accidental de negocio | Crítico | Baja | `negocios.archived_at` (soft delete) en vez de DELETE. Policy `negocios_delete` solo `es_owner`. UI requiere typing del nombre del negocio para confirmar. |
| 10 | `superadmin email` filtrado de variables de entorno | Alto (acceso total) | Media | Mover esa lógica de `VITE_SUPERADMIN_EMAIL` (que va al cliente) a una tabla `superadmins` accesible solo via service_role. Eliminar el env var del frontend. |
| 11 | Trigger `on_auth_user_created` falla → user queda sin negocio | Alto (signup roto) | Baja | Trigger en transacción con el insert de auth.users. Si falla, el signup completo se revierte. Logs de errores en Supabase Dashboard. |
| 12 | Race condition en aceptar invitación (dos sesiones del mismo email) | Bajo (UX raro) | Muy baja | `for update` en el `select` de la invitación. `on conflict (negocio_id, user_id) do update`. |
| 13 | Suscripción vencida no bloquea escrituras | Medio (uso post-pago) | Media | Función `is_suscripcion_activa(negocio_id)` definida en §2.4. Las policies `_v2 insert/update/delete` añaden `and is_suscripcion_activa(negocio_id)` (§3.1, §3.2; matriz §3.4). Definir y wirear en Fase 3 — efectivo de forma estricta cuando se eliminan las policies viejas en Fase 5. Tests dedicados §5.5.1. |
| 14 | Función `security definer` con `search_path` mutable | Crítico (SQL injection vía schema) | Baja | Todas las funciones `security definer` declaran `set search_path = public, pg_catalog`. Code review. |
| 15 | Backfill incorrecto deja datos huérfanos | Alto (datos invisibles) | Baja | Validación post-backfill: `select count(*) where negocio_id is null` debe ser 0 antes de pasar de fase. Tests automatizados. |
| 16 | `planes` queda inaccesible al activar RLS sin policy | Bajo (UI de suscripciones rota) | Media | Crear policy `planes_select` explícita en Fase 1 antes de prender RLS. Tests de smoke. |

---

## 9. Próximos pasos (operacional)

1. Revisar este plan en conjunto. Identificar tablas o casos no contemplados.
2. Aprobar el modelo de tenancy (§2.2).
3. Crear proyecto Supabase de staging clonado de producción.
4. Empezar por **Fase 0** (auditoría). Sin baseline, no hay seguridad de poder rollback.
5. Definir criterio de éxito por fase (ya incluido arriba).
6. Decidir si se hace todo en una semana intensiva o se reparte en sprints.

**Antes de implementar nada:** correr la suite de tests de §5.1 contra producción actual (renombrando user_id→negocio_id manualmente) para confirmar que el aislamiento actual realmente está sano. Si la suite encuentra algo, ese hallazgo cambia las prioridades.

---

## 10. Progreso

> Marcar con `[x]` cuando esté hecho. Cada fase tiene sub-items para no perderse en commits parciales.

### Fase 0 — Auditoría y baseline
- [x] Dump completo del schema productivo → `docs/schema_baseline.sql` (2026-06-10)
- [x] Recuperar y versionar `allowed_emails`, `team_members`, `get_my_role`, `is_my_owner_data` en `supabase_schema.sql` (DDL real de producción ✅)
- [x] Snapshot de datos (backup) verificable → `backups/data_baseline_2026-06-10.json` (row counts: 126 clientes, 12 pedidos, 8 productos…)
- [x] Listado de policies actuales en `docs/baseline-policies.md` — poblado con datos reales de producción (2026-06-10)
- [x] `001_phase0_audit.sql` ejecutado en Supabase SQL Editor — schema `_baseline` creado (2026-06-10)
- [ ] Proyecto Supabase de staging clonado y funcional
- [ ] Tests existentes pasan en staging (diferido — no hay suite automatizada)

### Fase 1 — Infraestructura de tenancy ✅ (2026-06-10)
- [x] Migración SQL con `negocios`, `negocio_members`, `invitaciones` (con índices)
- [x] Funciones helper: `mi_negocio_id`, `es_miembro`, `mi_rol_en`, `puede_leer/escribir/eliminar/administrar`, `es_owner` (NO `is_suscripcion_activa` — se crea en Fase 3)
- [x] Policies de §3.3 en las nuevas tablas (todas en la misma transacción que el `enable rls`)
- [x] Trigger `on_auth_user_created` (signup self-service)
- [x] RPC `accept_invitation`
- [x] Backfill: construir `_owners_detectados` con UNION de `user_id` distinct sobre TODAS las tablas de datos (no solo `negocio_config`)
- [x] Backfill: cada owner detectado → negocio + membership owner
- [x] Backfill: cada `allowed_emails` no-owner cuyo `owner_user_id` ya tiene negocio → membership con rol
- [x] Verificación post-backfill #1: 0 owners detectados sin fila en `negocios` (bloque `do $$ raise exception ...`)
- [x] Verificación post-backfill #2: 0 negocios sin owner activo (bloque `do $$ raise exception ...`)
- [ ] Soak 24h en producción sin issues (iniciado 2026-06-10 — completar mañana antes de Fase 2)

### Fase 2 — `negocio_id` nullable + backfill en tablas de datos
- [ ] Migración: `add column negocio_id uuid references negocios(id)` en cada tabla de datos
- [ ] Índice `(negocio_id)` en cada tabla
- [ ] Backfill desde `user_id`
- [ ] Backfill de tablas hijo (`pedido_items`, `devolucion_items`, `ordenes_compra_items`)
- [ ] Validación: `count(*) where negocio_id is null` = 0 en todas
- [ ] Trigger `set_negocio_id_default` en cada tabla (BEFORE INSERT)

### Fase 3 — Mirror policies
- [ ] Crear función `is_suscripcion_activa(uuid)` (§2.4) — prerequisito de las policies de abajo
- [ ] Policies `_v2` para `clientes` (con gate de suscripción en INSERT/UPDATE/DELETE)
- [ ] Policies `_v2` para `productos` (con gate)
- [ ] Policies `_v2` para `pedidos` y `pedido_items` (con gate, en padre e hija)
- [ ] Policies `_v2` para `gastos` (con gate)
- [ ] Policies `_v2` para `categorias` (con gate)
- [ ] Policies `_v2` para `negocio_config` (con gate)
- [ ] Policies `_v2` para `alertas_config` (con gate)
- [ ] Policies `_v2` para `devoluciones` y `devolucion_items` (con gate; reemplazo de `FOR ALL`)
- [ ] Policies `_v2` para `comunicaciones` (con gate; reemplazo de `FOR ALL`)
- [ ] Policies `_v2` para `productos_precio_historial` (con gate; reemplazo de `FOR ALL`)
- [ ] Policies `_v2` para `pedidos_recurrentes` (con gate; reemplazo de `FOR ALL`)
- [ ] Policies `_v2` para `proveedores` (con gate; reemplazo de `FOR ALL`)
- [ ] Policies `_v2` para `ordenes_compra` y `ordenes_compra_items` (con gate; reemplazo de `FOR ALL`)
- [ ] Policies `_v2` para `suscripciones` (sin gate, exenta)
- [ ] Policy `planes_select` explícita
- [ ] Suite §5 corre y pasa con policies nuevas
- [ ] Test específico: con suscripción `vencida`, lectura funciona pero INSERT/UPDATE/DELETE en tablas transaccionales falla en las _v2 (y todavía pasa por las viejas — comportamiento esperado durante coexistencia)
- [ ] Soak 24–72h

### Fase 4 — Migrar app a `negocio_id`
- [ ] `db.js`: eliminar referencias a `user_id` en filtros, dejar que RLS filtre
- [ ] `db.js`: insertar sin `negocio_id` (trigger lo completa)
- [ ] `App.jsx`: eliminar `setEffectiveUserId`
- [ ] `App.jsx`: cargar rol desde `negocio_members` en vez de `allowed_emails`
- [ ] Reemplazar `getUserId()` por `mi_negocio_id()` donde corresponda
- [ ] Smoke test manual de cada CRUD
- [ ] Deploy a producción con feature flag o canary
- [ ] Monitorear errores 1 semana mínimo

### Fase 5 — `NOT NULL` + drop policies viejas
- [ ] `alter column negocio_id set not null` en cada tabla
- [ ] Drop policies viejas (`_select`, `_insert`, `_update`, `_delete` sin sufijo `_v2`)
- [ ] Rename `_v2` → nombre canónico
- [ ] Suite §5 corre y pasa con solo policies nuevas
- [ ] Tests S1–S7 del gate de suscripción (§5.5.1) corren estrictos y pasan: con suscripción vencida, INSERT/UPDATE/DELETE en tablas transaccionales fallan
- [ ] Smoke E2E

### Fase 6 — UI de gestión de miembros + invitaciones
- [ ] Sección "Miembros" en PerfilPanel
- [ ] Form "Invitar" con dropdown de rol
- [ ] Edge function `send-invitation` (sin service_role)
- [ ] Edge function `force-signout` (con service_role)
- [ ] Pantalla `/aceptar?token=...`
- [ ] E2E: invitar → email → aceptar → ver datos
- [ ] Migrar UX existente de whitelist a la nueva

### Fase 7 — Limpieza
- [ ] Rename `user_id` → `created_by` (primero la app, después el SQL)
- [ ] Drop `allowed_emails`
- [ ] Drop `get_my_role`, `is_my_owner_data`
- [ ] Mover `VITE_SUPERADMIN_EMAIL` a tabla `superadmins` (saca la variable del frontend)
- [ ] Agregar `sucursal_id uuid` nullable en `pedidos`, `gastos`, `pedido_items`, `ordenes_compra`
- [ ] Documentar modelo final en `docs/data-model.md`

### Edge functions (paralelo a Fase 6)
- [ ] `mp-webhook` con verificación de firma de MP
- [ ] `force-signout` con wrapper `getNegocioFromRequest`
- [ ] Lint rule: prohibir `SUPABASE_SERVICE_ROLE_KEY` fuera de `supabase/functions/_shared/`
- [ ] Tabla `webhook_logs` para audit del webhook

### Hardening adicional
- [ ] Constraint `check (rol <> 'owner')` en policy `members_update`/`members_delete`
- [ ] Audit log de cambios de rol y desactivación de miembros
- [ ] Rate limit en `accept_invitation` por IP/email
- [ ] Test de carga: `mi_negocio_id()` con 100 queries concurrentes
- [ ] Decisión: ¿activar Custom Access Token Hook (§2.2.1)? Si sí, agregar fase 8.
