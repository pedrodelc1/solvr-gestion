# Baseline de Policies RLS — pre-migración multi-tenant

**Generado:** 2026-06-10
**Fuente:** Supabase SQL Editor — `select tablename, cmd, policyname, qual, with_check from pg_policies where schemaname='public' order by tablename, cmd;`
**Proyecto:** Solvr Gestión — `epiofjmtdegiobwvlhfz`
**Fase:** 0 — Auditoría

---

## Hallazgos críticos

> Estas son las brechas de seguridad identificadas que motivan la migración multi-tenant.

### 1. Policies `FOR ALL` (afectan SELECT + INSERT + UPDATE + DELETE con la misma expresión)

Las tablas marcadas ⚠️ usan `FOR ALL`, lo que significa que un bug en la expresión rompe lectura Y escritura al mismo tiempo, y no se puede aplicar regla distinta para DELETE (que requiere rol más alto) que para INSERT.

| Tabla | Policy name | Expresión `qual` |
|---|---|---|
| `productos_precio_historial` | `precio_historial_all` | `auth.uid() = user_id` |
| `pedidos_recurrentes` | `recurrentes_all` | `auth.uid() = user_id` |
| `alertas_config` | `user_own_alertas` | `auth.uid() = user_id` |
| `devoluciones` | `devoluciones_all` | `auth.uid() = user_id` |
| `comunicaciones` | `comunicaciones_all` | `auth.uid() = user_id` |
| `proveedores` | `proveedores_all` | `auth.uid() = user_id` |
| `ordenes_compra` | `ordenes_compra_all` | `auth.uid() = user_id` |
| `suscripciones` | `owner_manage_suscripciones` | `is_owner = true` (via `allowed_emails`) |

### 2. Brechas de control de roles

- **`gastos`**: tiene `team_read_gastos` (lectura de equipo) pero NO `team_insert/update/delete` — un `vendedor` no puede insertar gastos. Patrón inconsistente.
- **`devoluciones`**: tiene `team_insert_devoluciones` pero sin `team_select/update/delete` — un miembro del equipo puede insertar una devolución pero no verla después.
- **`team_insert_devoluciones`** y **`team_insert_comunicaciones`**: solo chequean `get_my_role()` pero NO `is_my_owner_data()` → un vendedor podría insertar en el negocio incorrecto si manipula el claim.
- **`pedido_items`**: las policies de DELETE/UPDATE/INSERT hacen `SELECT pedidos.user_id ... = auth.uid()` (no soportan team members al escribir). Solo `pedido_items_select` tiene la rama de `allowed_emails` para equipo.
- **`negocio_config`**: no tiene policy de DELETE.

### 3. RLS faltante

- `planes`: **sin RLS habilitado** en el schema versionado. Si `enable row level security` se prende sin policy de SELECT para `authenticated`, la tabla queda inaccesible.
- `alertas_config`: usa `FOR ALL` — misma vulnerabilidad que el grupo 1.

---

## Policies por tabla (datos reales de producción)

### `allowed_emails`

| cmd | policy name | qual (using) | with_check |
|---|---|---|---|
| SELECT | `ae_select` | `auth.uid() IS NOT NULL` | — |
| INSERT | `ae_insert` | — | `auth.uid() = owner_user_id` |
| UPDATE | `ae_update` | `auth.uid() = owner_user_id` OR admin del mismo owner | — |
| DELETE | `ae_delete` | `auth.uid() = owner_user_id` OR admin del mismo owner | — |

---

### `clientes`

| cmd | policy name | qual (using) | with_check |
|---|---|---|---|
| SELECT | `clientes_select` | `auth.uid() = user_id` | — |
| SELECT | `team_read_clientes` | `user_id IN (SELECT owner_user_id FROM allowed_emails WHERE email = auth.email() AND owner_user_id IS NOT NULL)` | — |
| INSERT | `clientes_insert` | — | `auth.uid() = user_id` |
| INSERT | `team_insert_clientes` | — | `get_my_role() IN ('owner','admin','vendedor') AND is_my_owner_data(user_id)` |
| UPDATE | `clientes_update` | `auth.uid() = user_id` | — |
| UPDATE | `team_update_clientes` | `get_my_role() IN ('owner','admin','vendedor') AND is_my_owner_data(user_id)` | — |
| DELETE | `clientes_delete` | `auth.uid() = user_id` | — |
| DELETE | `team_delete_clientes` | `get_my_role() IN ('owner','admin') AND is_my_owner_data(user_id)` | — |

---

### `pedidos`

| cmd | policy name | qual (using) | with_check |
|---|---|---|---|
| SELECT | `pedidos_select` | `auth.uid() = user_id` OR `user_id IN (allowed_emails WHERE is_owner = false)` | — |
| SELECT | `team_read_pedidos` | `user_id IN (SELECT owner_user_id FROM allowed_emails WHERE email = auth.email() AND owner_user_id IS NOT NULL)` | — |
| INSERT | `pedidos_insert` | — | `auth.uid() = user_id` |
| INSERT | `team_insert_pedidos` | — | `get_my_role() IN ('owner','admin','vendedor') AND is_my_owner_data(user_id)` |
| UPDATE | `pedidos_update` | `auth.uid() = user_id` | — |
| UPDATE | `team_update_pedidos` | `get_my_role() IN ('owner','admin','vendedor') AND is_my_owner_data(user_id)` | — |
| DELETE | `pedidos_delete` | `auth.uid() = user_id` | — |
| DELETE | `team_delete_pedidos` | `get_my_role() IN ('owner','admin') AND is_my_owner_data(user_id)` | — |

---

### `pedido_items`

| cmd | policy name | qual (using) | with_check |
|---|---|---|---|
| SELECT | `pedido_items_select` | `EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_id AND (p.user_id = auth.uid() OR p.user_id IN (allowed_emails WHERE is_owner=false)))` | — |
| INSERT | `pedido_items_insert` | — | `(SELECT pedidos.user_id WHERE id = pedido_id) = auth.uid()` |
| UPDATE | `pedido_items_update` | `(SELECT pedidos.user_id WHERE id = pedido_id) = auth.uid()` | — |
| DELETE | `pedido_items_delete` | `(SELECT pedidos.user_id WHERE id = pedido_id) = auth.uid()` | — |

> ⚠️ INSERT/UPDATE/DELETE de `pedido_items` no soportan team members. Solo el owner puede escribir items.

---

### `productos`

| cmd | policy name | qual (using) | with_check |
|---|---|---|---|
| SELECT | `productos_select` | `auth.uid() = user_id` | — |
| SELECT | `team_read_productos` | `user_id IN (SELECT owner_user_id FROM allowed_emails WHERE email = auth.email() AND owner_user_id IS NOT NULL)` | — |
| INSERT | `productos_insert` | — | `auth.uid() = user_id` |
| INSERT | `team_insert_productos` | — | `get_my_role() IN ('owner','admin') AND is_my_owner_data(user_id)` |
| UPDATE | `productos_update` | `auth.uid() = user_id` | — |
| UPDATE | `team_update_productos` | `get_my_role() IN ('owner','admin') AND is_my_owner_data(user_id)` | — |
| DELETE | `productos_delete` | `auth.uid() = user_id` | — |
| DELETE | `team_delete_productos` | `get_my_role() IN ('owner','admin') AND is_my_owner_data(user_id)` | — |

---

### `gastos`

| cmd | policy name | qual (using) | with_check |
|---|---|---|---|
| SELECT | `gastos_select` | `auth.uid() = user_id` OR `user_id IN (allowed_emails WHERE is_owner = false)` | — |
| SELECT | `team_read_gastos` | `user_id IN (SELECT owner_user_id FROM allowed_emails WHERE email = auth.email() AND owner_user_id IS NOT NULL)` | — |
| INSERT | `gastos_insert` | — | `auth.uid() = user_id` |
| UPDATE | `gastos_update` | `auth.uid() = user_id` | — |
| DELETE | `gastos_delete` | `auth.uid() = user_id` | — |

> ⚠️ No hay `team_insert/update/delete_gastos`. Un vendedor no puede crear ni editar gastos.

---

### `categorias`

| cmd | policy name | qual | with_check |
|---|---|---|---|
| SELECT | `categorias_select` | `auth.uid() = user_id` | — |
| INSERT | `categorias_insert` | — | `auth.uid() = user_id` |
| UPDATE | `categorias_update` | `auth.uid() = user_id` | — |
| DELETE | `categorias_delete` | `auth.uid() = user_id` | — |

> Sin policies de team. Equipo no puede acceder a categorías.

---

### `negocio_config`

| cmd | policy name | qual | with_check |
|---|---|---|---|
| SELECT | `negocio_config_select` | `auth.uid() = user_id` | — |
| SELECT | `team_read_negocio_config` | `is_my_owner_data(user_id)` | — |
| INSERT | `negocio_config_insert` | — | `auth.uid() = user_id` |
| UPDATE | `negocio_config_update` | `auth.uid() = user_id` | — |

> ⚠️ Sin policy de DELETE.

---

### `alertas_config`

| cmd | policy name | qual | with_check |
|---|---|---|---|
| ALL | `user_own_alertas` | `auth.uid() = user_id` | — |

> ⚠️ `FOR ALL` — ver hallazgo #1.

---

### `devoluciones`

| cmd | policy name | qual | with_check |
|---|---|---|---|
| ALL | `devoluciones_all` | `auth.uid() = user_id` | — |
| INSERT | `team_insert_devoluciones` | — | `get_my_role() IN ('owner','admin','vendedor')` |

> ⚠️ `FOR ALL` para owner. `team_insert` no verifica `is_my_owner_data` ni soporta SELECT/UPDATE/DELETE de equipo.

---

### `devolucion_items`

| cmd | policy name | qual | with_check |
|---|---|---|---|
| SELECT | `devolucion_items_select` | `EXISTS (SELECT 1 FROM devoluciones WHERE id = devolucion_id AND user_id = auth.uid())` | — |
| INSERT | `devolucion_items_insert` | — | idem |
| DELETE | `devolucion_items_delete` | idem | — |

---

### `comunicaciones`

| cmd | policy name | qual | with_check |
|---|---|---|---|
| ALL | `comunicaciones_all` | `auth.uid() = user_id` | — |
| INSERT | `team_insert_comunicaciones` | — | `get_my_role() IN ('owner','admin','vendedor')` |

> ⚠️ `FOR ALL` para owner. Sin `is_my_owner_data` en team insert.

---

### `productos_precio_historial`

| cmd | policy name | qual | with_check |
|---|---|---|---|
| ALL | `precio_historial_all` | `auth.uid() = user_id` | — |

> ⚠️ `FOR ALL`.

---

### `pedidos_recurrentes`

| cmd | policy name | qual | with_check |
|---|---|---|---|
| ALL | `recurrentes_all` | `auth.uid() = user_id` | — |

> ⚠️ `FOR ALL`.

---

### `suscripciones`

| cmd | policy name | qual | with_check |
|---|---|---|---|
| SELECT | `user_own_suscripcion` | `auth.uid() = user_id` | — |
| SELECT | `owner_see_all_suscripciones` | `auth.uid() = user_id` OR `is_owner = true` (via jwt email) | — |
| INSERT | `user_insert_suscripcion` | — | `auth.uid() = user_id` |
| ALL | `owner_manage_suscripciones` | `is_owner = true` (via `allowed_emails`) | — |

> ⚠️ `owner_manage_suscripciones` es `FOR ALL`.

---

### `proveedores`

| cmd | policy name | qual | with_check |
|---|---|---|---|
| ALL | `proveedores_all` | `auth.uid() = user_id` | — |

> ⚠️ `FOR ALL`. Sin policies de team.

---

### `ordenes_compra`

| cmd | policy name | qual | with_check |
|---|---|---|---|
| ALL | `ordenes_compra_all` | `auth.uid() = user_id` | — |

> ⚠️ `FOR ALL`. Sin policies de team.

---

### `ordenes_compra_items`

| cmd | policy name | qual | with_check |
|---|---|---|---|
| SELECT | `oc_items_select` | `EXISTS (SELECT 1 FROM ordenes_compra oc WHERE oc.id = orden_id AND oc.user_id = auth.uid())` | — |
| INSERT | `oc_items_insert` | — | idem |
| DELETE | `oc_items_delete` | idem | — |

---

## Criterios de PASS Fase 0

- [x] `001_phase0_audit.sql` disponible en `supabase/migrations/`
- [x] `docs/baseline-policies.md` poblado con datos reales de producción
- [x] `allowed_emails`, `team_members`, `get_my_role`, `is_my_owner_data` agregados a `supabase_schema.sql`
- [x] `backups/` directorio y `scripts/fase0_dump.sh` preparados
- [ ] `001_phase0_audit.sql` ejecutado en Supabase SQL Editor (schema `_baseline` creado)
- [ ] `docs/schema_baseline.sql` generado vía `scripts/fase0_dump.sh`
- [ ] `backups/data_baseline_YYYY-MM-DD.sql` generado vía `scripts/fase0_dump.sh`
- [x] `is_my_owner_data` en `supabase_schema.sql` reemplazado con DDL real (2026-06-10)
- [x] `get_my_role` en `supabase_schema.sql` reemplazado con DDL real (2026-06-10)
- [ ] `team_members` confirmada/descartada contra `_baseline.team_members_snapshot`
- [ ] Proyecto Supabase de staging clonado y funcional
