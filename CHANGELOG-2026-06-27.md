# Cambios del 27/06/2026

Resumen de lo trabajado en la sesión.

## 1. Performance — registro de pedidos más rápido

**Problema:** guardar un pedido tardaba demasiado.

**Cambios** (`src/lib/db.js`, `src/App.jsx`):

- UUID generado en cliente (`crypto.randomUUID()`) para evitar el round-trip de `.select().single()`.
- INSERT de pedido en paralelo con el INSERT de items.
- **Optimistic UI**: el pedido aparece en la lista al instante; si el backend falla, rollback automático con toast de error.
- El form se cierra inmediatamente, no espera al backend.

## 2. Stats reactivas a cobros sueltos

**Problema:** las estadísticas solo se actualizaban al crear pedidos, no al registrar cobros sueltos (saldos pendientes).

**Cambios** (`src/components/stats/StatsPanel.jsx`, `src/App.jsx`):

- Se pasa `cobros` al `StatsPanel`.
- Se incluyen en `filteredCobros`, `cobradoSueltos`, distribución de medios de pago y en `gananciaNeta`.
- `gananciaNeta = gananciaVentas + cobradoSueltos - totalGastos`.

## 3. Gráfico comparativo cuando el filtro es "Hoy"

**Problema:** al filtrar por "Hoy", el gráfico de barras quedaba vacío.

**Cambios** (`src/components/stats/StatsPanel.jsx`):

- Cuando `from === to` (filtro de un solo día), el gráfico se arma con **4 bloques horarios**: `00-06 hs`, `06-12 hs`, `12-18 hs`, `18-24 hs`.
- Cada bucket suma ventas y gastos por hora (usa `createdAt` con fallback a las 12 hs).

## 4. Equipo en árbol jerárquico

**Cambios** (`src/components/perfil/PerfilPanel.jsx`):

- Toggle entre vista de **árbol** y **lista**.
- Árbol: dueño como root, agrupado por roles (Admins, Vendedores, Visualizadores) con conectores CSS.

## 5. Badge "Software Owner" para superadmin

**Problema:** Pedro aparecía como "Admin" igual que cualquier cliente.

**Cambios** (`src/components/perfil/PerfilPanel.jsx`):

- Componente `SoftwareOwnerBadge` con gradiente lime → violet e ícono de estrella.
- Helper `isSuperEmail(email)` usa `VITE_SUPERADMIN_EMAIL`.
- Reemplazado en las 3 ubicaciones donde aparecía el badge de Admin (header del perfil, panel de suscripciones y whitelist).

## 6. Login + contraseña con doble verificación

### Backend — nueva migration `019_email_has_password.sql`

RPC `email_has_password(p_email text) returns boolean`:

- `security definer` para acceder a `auth.users` desde el front.
- Devuelve `true` solo si `encrypted_password is not null`.
- Si el email no existe en `auth.users` (nunca entró), devuelve `false`.

### Frontend — `LoginScreen.jsx`

- Mantiene los dos modos: **magic link** (default) y **contraseña**.
- Gate de whitelist (`isEmailAllowed`) sigue antes de cualquier intento.
- Modo contraseña queda solo para usuarios que **ya crearon clave en Perfil**.
- Si alguien sin clave intenta el modo contraseña, Supabase tira "Credenciales incorrectas" (no hace falta cubrir más — un usuario nuevo no va a tipear una clave random).

### Frontend — `PerfilPanel.jsx`

Nueva sección en Cuenta:

- Carga `hasPassword` al montar.
- Si **no tiene clave** → muestra **"Crear contraseña"** (solo pide nueva + confirmar).
- Si **ya tiene** → muestra **"Cambiar contraseña"** (verifica la actual con `signInWithPassword` antes del update).
- Update final con `supabase.auth.updateUser({ password })`.

## 7. Stats grid del Perfil — cleanup

**Problema:** el grid mostraba Clientes / Pendientes / Por cobrar / Gastos. Gastos no encajaba en ese contexto.

**Cambios** (`src/components/perfil/PerfilPanel.jsx`):

- Sacado el item de **Gastos**.
- Grid de `1fr 1fr` → `repeat(3, 1fr)` para alinear los 3 restantes.

**Aclaración sobre "Pendientes":** son los pedidos sin cobrar (excluyendo presupuestos). `pedidos.filter(p => !p.cobrado && p.tipo !== 'presupuesto').length`.

## Commits del día

```
fd8220c Quitar fallback automático a magic link en modo contraseña
679da76 Login con doble verificación + crear contraseña en Perfil
51d72fa Optimistic pedidos, stats con cobros sueltos, gráfico por hora en Hoy
```

Todos deployados a Vercel desde `main`.
