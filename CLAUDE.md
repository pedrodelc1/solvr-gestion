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

## Estado actual (2026-06-02)

### Features implementadas y deployadas
- Skeleton loader animado al cargar datos
- Editar pedidos existentes
- Campo `nota` en pedidos (requiere migration SQL en Supabase — ver abajo)
- Buscador por cliente en lista de pedidos
- Confirm modal al eliminar cliente
- PWA manifest (`public/manifest.json`)
- Títulos dinámicos por tab (`document.title`)
- Dock con efecto magnification estilo Apple macOS (hover)
- Modo offline eliminado — la app siempre requiere login con email

### Dock (BottomNav)
- Archivo: `src/components/shared/BottomNav.jsx`
- Efecto hover: `getDockScale` con distancia (dist 0 → 1.45x, dist 1 → 1.18x, dist 2 → 1.06x)
- `originY: 1` para que crezcan hacia arriba
- `overflow: visible` en `.bottom-nav` para que sobresalgan
- `--nav-h: 58px` (más bajo que el original de 66px)

### Pending — acción manual requerida
```sql
-- Correr en Supabase SQL Editor (producción):
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nota text;
```

## Estructura principal
```
src/
  App.jsx                  — root, maneja estado global y routing por tab
  lib/
    db.js                  — CRUD sobre Supabase (y localStorage fallback removido)
    utils.js               — formatCurrency, formatDate, saldoCliente
    supabase.js            — cliente Supabase
  components/
    auth/
      LoginScreen.jsx      — login con magic link (sin modo offline)
      SplashScreen.jsx
    shared/
      BottomNav.jsx        — dock con 6 tabs + magnification
      Modal.jsx
      Toast.jsx
      SkeletonLoader.jsx
    clientes/
      ClientesList.jsx
      ClienteDetail.jsx
      ClienteForm.jsx
    pedidos/
      PedidosList.jsx      — lista con filtros, búsqueda, pago parcial
      PedidoForm.jsx       — crear/editar pedido, campo nota
    gastos/
      GastosList.jsx
      GastoForm.jsx
    stats/
      StatsPanel.jsx
    productos/
      ProductosList.jsx
      ProductoForm.jsx
    perfil/
      PerfilPanel.jsx      — sesión, whitelist de emails, export CSV
```

## Preferencias de Pedro
- Responder siempre en español
- Commits y deploys con cada cambio importante
- No comentarios innecesarios en el código
- Diseño dark, tipografía Space Grotesk
