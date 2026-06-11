# Solvr Gestión — Contexto de sesión

## Stack
- React 18 + Vite 5 (sin TypeScript)
- Framer Motion 11
- Supabase (auth + DB en producción)
- Vercel (deploy automático desde GitHub `main`)

## Proyecto
App de gestión de pedidos/clientes para negocios pequeños. Pedro la está construyendo para vender como SaaS.

## Vercel
- Team: `pedro-p-projects` / `team_fVuBTlZZ4XE9inSkXYs2nR4K`
- Project ID: `prj_6VZ9hxFAbYbGdhk2RWJAH6pwC3KX`
- Repo: `pedrodelc1/solvr-gestion` (GitHub, rama `main`)
- Cada push a `main` deploya automáticamente

## Estado actual (2026-06-11)

### Features implementadas y deployadas
- Skeleton loader animado al cargar datos
- Editar pedidos existentes
- Campo `nota` en pedidos (migration ya aplicada en producción)
- Buscador por cliente en lista de pedidos
- Confirm modal al eliminar cliente
- PWA manifest (`public/manifest.json`)
- Títulos dinámicos por tab (`document.title`)
- Dock con efecto magnification estilo Apple macOS (hover)
- Modo offline eliminado — la app siempre requiere login con email
- Cobros sueltos (ingresos sin pedido) en tab Caja — migration 009 aplicada
- Doble validación: formularios React + validaciones en db.js + CHECK constraints (migration 010 aplicada)
- Variables CSS `--primary`, `--accent-2`, `--warning`, `--surface` definidas en index.css (antes se usaban sin estar definidas)
- "En mora" en lista de clientes usa la config `dias_sin_cobro` (antes 30 hardcodeado)

### Dock (BottomNav)
- Archivo: `src/components/shared/BottomNav.jsx`
- Efecto hover: `getDockScale` con distancia (dist 0 → 1.45x, dist 1 → 1.18x, dist 2 → 1.06x)
- `originY: 1` para que crezcan hacia arriba
- `overflow: visible` en `.bottom-nav` para que sobresalgan
- `--nav-h: 58px` (más bajo que el original de 66px)

### Migrations
Todas aplicadas en producción (001–011) y el registro remoto está sincronizado — `npx supabase db push` funciona directo para futuras migrations.

### Superadmin
- Tabla `superadmins` en DB (email de Pedro) + `es_superadmin()` — el gate real está en el backend
- RPCs security definer: `admin_whitelist()`, `admin_suscripciones()`, `admin_update_suscripcion()`, `admin_renovar_suscripcion()`
- El Panel de Suscripciones (Perfil) lista suscripciones + whitelist global de accesos agrupada por negocio
- `VITE_SUPERADMIN_EMAIL` (Vercel) sigue como fallback del gate de UI, pero ya no es necesario

## Estructura principal
```
src/
  App.jsx                  — root, maneja estado global y routing por tab
  lib/
    db.js                  — CRUD sobre Supabase + validaciones + friendlyError
    utils.js               — formatCurrency, formatDate, saldoCliente, calcularMora
    supabase.js            — cliente Supabase
    generarRemito.js / presupuestoPDF.js — PDFs
    animations.js
  components/
    auth/
      LoginScreen.jsx      — login con magic link o contraseña
      SplashScreen.jsx
    shared/
      BottomNav.jsx        — dock con tabs + magnification
      Modal.jsx / Toast.jsx / SkeletonLoader.jsx / MedioPill.jsx / TrialBanner.jsx
    clientes/
      ClientesList.jsx / ClienteDetail.jsx / ClienteForm.jsx
      CuentaCorriente.jsx  — extracto de cuenta exportable
      CobrosPanel.jsx      — saldos pendientes + recordatorio WhatsApp
      ImportarClientesModal.jsx
    pedidos/
      PedidosList.jsx      — filtros, búsqueda, pago parcial, entregas, remitos
      PedidoForm.jsx       — crear/editar, presupuestos, descuento, plazo, mora
      DevolucionModal.jsx
    gastos/
      GastosList.jsx / GastoForm.jsx
    caja/
      CajaPanel.jsx        — caja del día: cobros, cobros sueltos, gastos, neto
      CobroForm.jsx        — registrar cobro suelto (sin pedido)
    stats/
      StatsPanel.jsx / ChartCategorias.jsx
    productos/
      ProductosList.jsx / ProductoForm.jsx / ImportarProductosModal.jsx
    suscripciones/
      SuscripcionBlocker.jsx
    onboarding/
      OnboardingWizard.jsx / TeamWelcomeScreen.jsx
    perfil/
      PerfilPanel.jsx      — config negocio, equipo/roles, suscripciones, tema
```

## Principio de doble verificación (Frontend + Backend)

Toda validación crítica debe existir en AMBAS capas. Nunca confíes solo en una.

### Reglas:

1. **Formularios:** Valida en el componente React (formato, campos requeridos) Y también en las RLS policies de Supabase.
2. **Permisos/roles:** No ocultes solo en el UI. Verifica el rol también en el backend antes de ejecutar cualquier query sensible.
3. **Operaciones de escritura:** Antes de hacer INSERT/UPDATE/DELETE, valida los datos en el frontend Y aplica constraints o checks en Supabase.
4. **Cálculos de negocio** (precios, totales, descuentos): No calcules solo en el frontend. El backend debe recalcular y confirmar antes de guardar.
5. **Al crear cualquier feature nueva:** Pregúntate explícitamente "¿qué pasa si alguien bypassea el frontend?" y cubre ese caso en el backend.

### Roles implementados:
- **owner / admin**: acceso total a los 7 tabs
- **vendedor**: clientes, pedidos, stats, catálogo — puede crear/editar/cobrar, no puede eliminar ni gestionar productos/gastos/perfil
- **visualizador**: solo lectura — ve datos pero no puede crear, editar, eliminar, cobrar, enviar mensajes ni hacer pedidos

### Arquitectura de roles (Supabase):
- `get_my_role()`: función SQL que devuelve el rol del usuario actual
- `is_my_owner_data(user_id)`: función SQL que verifica si la fila pertenece al owner del miembro
- Policies: `team_insert/update/delete_*` en clientes, pedidos, productos con check de rol

## Preferencias de Pedro
- Responder siempre en español
- Commits y deploys con cada cambio importante
- No comentarios innecesarios en el código
- Diseño dark, tipografía Space Grotesk
