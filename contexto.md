# CONTEXTO COMPLETO — Solvr Gestión (2026-06-07)

## Stack
- **React 18 + Vite 5** (sin TypeScript)
- **Framer Motion 11**
- **Supabase** — auth magic link + PostgreSQL con RLS
- **Vercel** — deploy automático desde rama `main`
- Repo: `pedrodelc1/solvr-gestion` en GitHub

---

## Estructura de archivos

```
src/
  App.jsx                         ← root, estado global, routing por tabs
  lib/
    db.js                         ← todo el CRUD con Supabase
    utils.js                      ← formatCurrency, formatDate, saldoCliente, today(), inRange(), getRange()
    supabase.js                   ← cliente Supabase
    animations.js                 ← variants framer (listItem, pageTransition)
  components/
    auth/
      LoginScreen.jsx             ← magic link, sin modo offline
      SplashScreen.jsx
    shared/
      BottomNav.jsx               ← dock 6 tabs + efecto magnification macOS
      Toast.jsx / Modal.jsx / SkeletonLoader.jsx / TrialBanner.jsx
      MedioPill.jsx               ← SVG icons para medio de pago (efectivo/transferencia/tarjeta)
    clientes/
      ClientesList.jsx / ClienteDetail.jsx / ClienteForm.jsx
      CuentaCorriente.jsx / CobrosPanel.jsx / ImportarClientesModal.jsx
    pedidos/
      PedidosList.jsx / PedidoForm.jsx / PedidoDetail.jsx / DevolucionModal.jsx
    gastos/
      GastosList.jsx / GastoForm.jsx / GastosTab.jsx
    stats/
      StatsPanel.jsx              ← stats con charts SVG inline, filtros colapsables
      ChartCategorias.jsx         ← gráfico de gastos por categoría
      StatsTab.jsx
    caja/
      CajaPanel.jsx               ← caja del día con navegación por fecha (← →)
    productos/
      ProductosList.jsx / ProductoForm.jsx / ProductosTab.jsx / ImportarProductosModal.jsx
    perfil/
      PerfilPanel.jsx             ← configuración del negocio, whitelist emails, export CSV
    suscripciones/
      SuscripcionBlocker.jsx
    onboarding/
      OnboardingWizard.jsx        ← solo para owners, primera vez
      TeamWelcomeScreen.jsx       ← para miembros del equipo (no owners)
```

---

## Estado global en App.jsx

```js
// Arrays principales (todos llegan de Supabase)
clientes, productos, pedidos, gastos, categorias, devoluciones, comunicaciones

// Auth
session           // Supabase session
isOwner           // boolean — email del user === email del owner
userRole          // 'owner' | 'admin' | 'vendedor' | 'visualizador'

// UI routing
activeTab         // 'clientes' | 'pedidos' | 'gastos' | 'stats' | 'productos' | 'caja' | 'perfil'
showPedidoForm    // boolean
selectedClienteId // string | null

// Negocio
negocioConfig     // { id, owner_id, nombre, onboarding_done, ... }
suscripcion       // { estado: 'prueba'|'activa'|'vencida', fecha_vencimiento }

// Onboarding
showOnboarding = isOwner && negocioConfig !== null && !negocioConfig.onboarding_done
showTeamWelcome = !isOwner && userRole !== 'owner' && negocioConfig !== null && !teamWelcomeSeen
```

---

## Roles y permisos

```js
const ALLOWED_TABS = {
  owner:        ['clientes', 'pedidos', 'gastos', 'stats', 'productos', 'caja', 'perfil'],
  admin:        ['clientes', 'pedidos', 'gastos', 'stats', 'productos', 'caja', 'perfil'],
  vendedor:     ['clientes', 'pedidos', 'stats', 'productos', 'perfil'],
  visualizador: ['clientes', 'pedidos', 'stats', 'productos', 'perfil'],
};

// isOwner = true → puede ver/tocar TODO
// vendedor → puede crear/editar/cobrar, NO puede eliminar ni gestionar gastos/perfil
// visualizador → solo lectura
```

---

## Tablas Supabase

| Tabla | Campos clave |
|-------|-------------|
| `pedidos` | `id, clienteId, items(json[]), totalFinal, cobrado(bool), montoAbonado, medioPago(efectivo/transferencia/tarjeta/fiado), fecha(YYYY-MM-DD), tipo(pedido/presupuesto), nota, entregado` |
| `pedido_items` | `id, pedido_id, nombre, cantidad, precio, precioUnitario, costoUnitario, productoId` |
| `clientes` | `id, nombre, contacto, email, direccion, tipo_precio(minorista/mayorista), saldo_inicial` |
| `gastos` | `id, descripcion, monto, categoria, fecha(YYYY-MM-DD)` |
| `productos` | `id, nombre, precio, costo, descripcion, imagen_url` |
| `negocio_config` | `id, owner_id, nombre, onboarding_done` |
| `team_members` | `id, owner_id, member_email, role` |
| `allowed_emails` | `id, email, owner_user_id, is_owner` |
| `suscripciones` | `id, owner_id, estado, fecha_vencimiento` |
| `devoluciones` | `id, clienteId, monto, fecha, descripcion` |
| `comunicaciones` | `id, clienteId, tipo, mensaje, fecha` |

### CRITICO — Cargar pedidos con items

NUNCA usar JOIN entre `pedidos` y `pedido_items` porque falla con RLS de Supabase.
Siempre hacer DOS queries separadas y mergear en JS:

```js
const { data: pedidosData } = await supabase.from('pedidos').select('*').eq('user_id', userId)
const { data: itemsData } = await supabase.from('pedido_items').select('*').eq('user_id', userId)
// merge:
const pedidos = pedidosData.map(p => ({
  ...p,
  items: itemsData.filter(i => i.pedido_id === p.id)
}))
```

---

## Lógica de negocio crítica

### Saldo del cliente
```js
// utils.js — saldoCliente(cliente, pedidos, devoluciones)
// saldo = suma(totalFinal - montoAbonado) de pedidos NO cobrados (excluye presupuestos)
//       + cliente.saldo_inicial
//       - suma(devoluciones del cliente)
```

### Cobrado vs pago parcial
```js
// p.cobrado === true  → pagado 100%
// p.montoAbonado > 0  → pago parcial (cobrado puede ser false)
// Ambos casos representan dinero recibido

// SIEMPRE calcular el monto recibido así:
const montoCobrado = p => p.cobrado ? p.totalFinal : (p.montoAbonado || 0)

// SIEMPRE filtrar pedidos con algún cobro así:
pedidos.filter(p =>
  p.tipo !== 'presupuesto' &&
  (p.cobrado || (p.montoAbonado || 0) > 0)
)

// En StatsPanel — cobrado incluye pagos parciales:
const cobrado = filteredPedidos.reduce((s, p) =>
  p.cobrado ? s + p.totalFinal : s + (p.montoAbonado || 0), 0)
```

### Miembros del equipo — escritura como owner
```js
// Cuando un team member logea, App.jsx llama:
setEffectiveUserId(entry.owner_user_id)
// db.js → getUserId() devuelve el owner_id en vez del user_id real
// → todos los INSERTs/UPDATEs van a la cuenta del owner
```

---

## Sistema de diseño

### Variables CSS (src/index.css)
```css
--bg: #0a0a0a           /* fondo app */
--bg-2: #111            /* cards */
--bg-3: #1a1a1a         /* inputs, hover states */
--border: #222          /* bordes */
--ink: #f0f0f0          /* texto principal */
--ink-2: #aaa           /* texto secundario */
--ink-3: #666           /* texto terciario/labels */
--primary: #ccff00      /* verde lima — acción principal */
--success: #4ade80      /* verde — cobrado, positivo */
--danger: #f87171       /* rojo — deuda, negativo */
--warning: #fbbf24      /* amarillo — alertas */
--radius-lg: 16px
--space-1: 4px   --space-2: 8px   --space-3: 12px
--space-4: 16px  --space-5: 20px  --space-6: 24px  --space-8: 32px
--text-xs: 11px  --text-sm: 13px  --text-base: 15px
--text-lg: 18px  --text-xl: 22px  --nav-h: 58px
```

### Tipografía
**Space Grotesk** (Google Fonts). Font weights: 400 / 600 / 700 / 800. Tema dark siempre.

### Clases CSS útiles
```css
.page-header        /* header con h1 y acciones (space-between) */
.section-label      /* label de sección: uppercase, text-xs, ink-3 */
.list-section       /* contenedor de lista de cards */
.card               /* tarjeta: bg-2, border, radius-lg, padding space-4 */
.card-row           /* flex row justify-between align-center */
.card-sub           /* texto secundario: text-xs, ink-3 */
.btn-primary        /* botón verde lima (#ccff00) */
.btn-secondary      /* botón outline */
.btn-icon           /* botón circular 36x36 icon-only */
.btn-full           /* width: 100% */
.empty-state        /* estado vacío centrado: SVG 40px + texto ink-3 */
.filter-chip        /* chip de filtro; .active = fondo primary, texto negro */
.form-group         /* label + input vertical */
.form-row           /* dos form-groups en grid 1fr 1fr */
.tab-content        /* contenedor scrollable — VER REGLA CRITICA */
```

---

## REGLA CRITICA DE SCROLL — NUNCA VIOLAR

### El problema
Cuando `.tab-content` tiene `display: flex` y su hijo tiene `flex: 1`, ese hijo recibe una altura fija igual al espacio disponible. El overflow con `visible` no contribuye al `scrollHeight` del padre. El scroll muere silenciosamente sin errores.

### La solución
```css
/* CORRECTO ✅ */
.tab-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: calc(var(--nav-h) + var(--space-4));
  min-height: 0;
  /* SIN display: flex */
}
```

### AnimatePresence también rompe scroll
NO usar `motion.div` con `overflow: hidden` para paneles colapsables.

```jsx
// ✅ Correcto — renderizado condicional simple
{filterOpen && <FilterPanel />}

// ❌ Rompe scroll — AnimatePresence con overflow hidden
<AnimatePresence>
  {filterOpen && (
    <motion.div
      initial={{ height: 0 }}
      animate={{ height: 'auto' }}
      style={{ overflow: 'hidden' }}  // ← esto bloquea el scroll del padre
    >
      <FilterPanel />
    </motion.div>
  )}
</AnimatePresence>
```

### motion.div dentro de tab-content
```jsx
// ✅ Correcto — sin flex:1, sin minHeight:0
<motion.div style={{ display: 'flex', flexDirection: 'column' }}>
  {renderTab()}
</motion.div>

// ❌ Mal — flex:1 da altura fija, content no scroll
<motion.div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
```

---

## Patrones de código

### Guardar en Supabase
```js
// SIEMPRE tirar error, nunca silenciar
const { data, error } = await supabase.from('tabla').upsert(obj).select().single()
if (error) throw new Error(error.message)
return data
```

### Toast
```jsx
// toast se pasa como prop desde App.jsx a todos los panels
toast('Mensaje guardado', 'success')  // 'success' | 'error' | 'info'
```

### Formateo
```js
import { formatCurrency, today, inRange, getRange } from '../../lib/utils.js'
formatCurrency(1234.5)       // "$1.234,50"
today()                      // "2026-06-07"
inRange(fecha, from, to)     // boolean
getRange('3m')               // ["2026-03-07", "2026-06-07"]
getRange('current')          // mes actual
getRange('prev')             // mes anterior
getRange('today')            // hoy
```

### SVG icons — NUNCA emojis
```jsx
// Componente centralizado en src/components/shared/MedioPill.jsx
import { MedioPill, MedioIcon } from '../shared/MedioPill.jsx'
<MedioPill medio="efectivo" />      // pill con SVG + label
<MedioIcon medio="transferencia" /> // solo el SVG

// Medios válidos: 'efectivo' | 'transferencia' | 'tarjeta' | 'fiado'
```

### Charts — sin librería, SVG puro
El componente `BarChart` está implementado dentro de `StatsPanel.jsx`:

```jsx
// Horizontal bar chart — motion.div para la barra animada
function BarChart({ items, colorVar = '--primary' }) {
  const max = Math.max(...items.map(i => i.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {items.map((item, i) => {
        const pct = (item.value / max) * 100
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>{item.label}</span>
              <span>{formatCurrency(item.value)}</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, delay: i * 0.07 }}
                style={{ height: '100%', background: `var(${colorVar})`, borderRadius: 99 }}
              />
            </div>
            {item.sub && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>{item.sub}</div>}
          </div>
        )
      })}
    </div>
  )
}

// Uso:
<BarChart
  items={[{ label: 'Cliente A', value: 15000, sub: '5 pedidos' }]}
  colorVar="--primary"   // o "--success" o "--danger"
/>
```

---

## Arquitectura de navegación

```
App.jsx
  └── .app-shell
        ├── TrialBanner (condicional, arriba)
        ├── .tab-content  ← SCROLL CONTAINER
        │     └── AnimatePresence (mode="wait")
        │           └── motion.div (page transition)
        │                 └── renderTab() → componente activo
        ├── BottomNav (fixed bottom)
        ├── ClienteForm (modal, portal)
        ├── GastoForm (modal, portal)
        ├── ProductoForm (modal, portal)
        ├── OnboardingWizard (fullscreen overlay, solo owners primera vez)
        ├── TeamWelcomeScreen (fullscreen overlay, solo team members primera vez)
        └── ToastContainer
```

### Back button (Android/browser)
```js
// Prioridad en onPop:
// 1. Si hay clienteDetail abierto → cerrar detail
// 2. Si hay pedidoForm abierto → cerrar form
// 3. Si tab !== 'clientes' → ir a clientes
// 4. No hacer nada (ya estás en clientes)
```

---

## StatsPanel — estructura

```
StatsPanel
  ├── Header con botón export CSV
  ├── Period selector chips: Hoy / Mes actual / Mes anterior / 3 meses / Todo / Personalizado
  ├── Custom date range inputs (si period === 'custom')
  ├── Filter toggle row + active filter chips (× para quitar)
  ├── FilterPanel (si filterOpen === true) — renderizado condicional SIN AnimatePresence
  │     ├── Búsqueda + chips de clientes
  │     └── Búsqueda + chips de productos
  └── Content cards:
        ├── Hero: Ventas del período + RatioBar + Cobrado/Pendiente split
        ├── Gastos + Ganancia neta (grid 2 cols)
        ├── Saldo pendiente global (o por cliente)
        ├── Cobrado por medio — BarChart
        ├── Top clientes — BarChart
        ├── Cobros pendientes (proyección) — BarChart con --danger
        ├── Rentabilidad por producto — BarChart
        └── Gastos por categoría — ChartCategorias
```

---

## CajaPanel — estructura

```
CajaPanel
  ├── Header "Caja del día"
  ├── Date navigator ← Hoy / Ayer / [fecha] →
  ├── Hero card:
  │     ├── Resultado neto (grande, success/danger)
  │     ├── Cobrado / Gastos (grid 2 cols)
  │     └── Desglose por medio (efectivo/transferencia/tarjeta)
  ├── Lista de cobros del día
  └── Lista de gastos del día
```

Filtro de cobros:
```js
pedidos.filter(p =>
  p.tipo !== 'presupuesto' &&
  (p.cobrado || (p.montoAbonado || 0) > 0) &&
  p.fecha === fecha
)
```

---

## Deploy

```bash
git add -A && git commit -m "descripcion del cambio" && git push origin main
# Vercel detecta el push y deploya automáticamente en ~30 segundos
# No hay ningún comando manual de deploy
```

Vercel config:
- Team: `pedro-p-projects` / `team_fVuBTlZZ4XE9inSkXYs2nR4K`
- Project ID: `prj_6VZ9hxFAbYbGdhk2RWJAH6pwC3KX`

---

## Variables de entorno (.env.local)

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_SUPERADMIN_EMAIL=...  (email que bypasea whitelist)
```

---

## Lo que NO hacer

| ❌ NO | ✅ SÍ |
|-------|-------|
| TypeScript | JavaScript puro (.js / .jsx) |
| Librerías de charts (recharts, chart.js, d3) | SVG inline / motion.div |
| Emojis como íconos (💵🏦💳🎉⚠️) | SVG inline siempre |
| `display: flex` en `.tab-content` | Block container con overflow-y: auto |
| `AnimatePresence` en paneles con altura dinámica | `{condicion && <Panel/>}` |
| JOIN entre `pedidos` y `pedido_items` en Supabase | Dos queries separadas + merge en JS |
| Silenciar errores de Supabase (`if (error) return []`) | `if (error) throw new Error(error.message)` |
| Comentarios que explican QUÉ hace el código | Comentarios solo si el WHY no es obvio |
| Agregar features extra no pedidas | Implementar exactamente lo pedido |
| Instalar nuevas dependencias | Usar lo que ya está instalado |
| Nuevos archivos innecesarios | Editar archivos existentes |

---

## Dependencias instaladas (package.json)

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "framer-motion": "^11",
    "@supabase/supabase-js": "^2"
  },
  "devDependencies": {
    "vite": "^5",
    "@vitejs/plugin-react": "^4"
  }
}
```

Nada más. No hay react-router, no hay redux, no hay tailwind, no hay UI library.
