import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, getRange, inRange, saldoCliente } from '../../lib/utils.js';
import { ChartCategorias } from './ChartCategorias.jsx';

function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(target);
  useEffect(() => {
    if (target === prevTarget.current) return;
    prevTarget.current = target;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setValue(0 + (target - 0) * e);
      if (p < 1) requestAnimationFrame(tick);
      else setValue(target);
    }
    requestAnimationFrame(tick);
  }, [target, duration]);
  useEffect(() => {
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setValue(target * e);
      if (p < 1) requestAnimationFrame(tick);
      else setValue(target);
    }
    requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

// Horizontal bar chart — pure SVG/CSS
function BarChart({ items, colorVar = '--primary' }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {items.map((item, i) => {
        const pct = (item.value / max) * 100;
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 'var(--space-3)' }}>{item.label}</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>{formatCurrency(item.value)}</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: '100%', background: `var(${colorVar})`, borderRadius: 99 }}
              />
            </div>
            {item.sub && (
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>{item.sub}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Progress ring for cobrado ratio
function RatioBar({ ratio }) {
  const pct = Math.min(Math.max(ratio, 0), 1) * 100;
  return (
    <div>
      <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: '100%', background: 'var(--success)', borderRadius: 99 }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>{pct.toFixed(1)}% cobrado</span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500 }}>{(100 - pct).toFixed(1)}% pendiente</span>
      </div>
    </div>
  );
}

// Animated number
function Num({ value, color = 'var(--ink)', size = 'var(--text-2xl)', weight = 800 }) {
  const v = useCountUp(value);
  return <span style={{ fontSize: size, fontWeight: weight, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{formatCurrency(v)}</span>;
}

// Filter panel
function FilterPanel({ clientes, productos, statCliente, setStatCliente, statProducto, setStatProducto, clienteSearch, setClienteSearch, productoSearch, setProductoSearch, visibleClientes, visibleProductos }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
      style={{ overflow: 'hidden', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}
    >
      <div style={{ padding: 'var(--space-3) var(--space-4) var(--space-4)' }}>
        {/* Clientes */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 'var(--space-2)' }}>Cliente</div>
          <div style={{ position: 'relative', marginBottom: 'var(--space-2)' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="search" placeholder="Buscar..." value={clienteSearch} onChange={e => setClienteSearch(e.target.value)}
              style={{ width: '100%', minHeight: 32, paddingLeft: 30, paddingRight: 10, fontSize: 'var(--text-sm)', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-full)', color: 'var(--ink)', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button className={`filter-chip${statCliente === 'all' ? ' active' : ''}`} onClick={() => setStatCliente('all')}>Todos</button>
            {visibleClientes.map(c => (
              <button key={c.id} className={`filter-chip${statCliente === c.id ? ' active' : ''}`} onClick={() => setStatCliente(c.id)}>{c.nombre}</button>
            ))}
          </div>
        </div>
        {/* Productos */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 'var(--space-2)' }}>Producto</div>
          <div style={{ position: 'relative', marginBottom: 'var(--space-2)' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="search" placeholder="Buscar..." value={productoSearch} onChange={e => setProductoSearch(e.target.value)}
              style={{ width: '100%', minHeight: 32, paddingLeft: 30, paddingRight: 10, fontSize: 'var(--text-sm)', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-full)', color: 'var(--ink)', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button className={`filter-chip${statProducto === 'all' ? ' active' : ''}`} onClick={() => setStatProducto('all')}>Todos</button>
            {visibleProductos.map(p => (
              <button key={p.id} className={`filter-chip${statProducto === p.id ? ' active' : ''}`} onClick={() => setStatProducto(p.id)}>{p.nombre}</button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function StatsPanel({ pedidos, gastos, clientes, productos, devoluciones = [], categorias, onExportCSV }) {
  const [period, setPeriod] = useState('3m');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [appliedCustom, setAppliedCustom] = useState({ from: '', to: '' });
  const [statCliente, setStatCliente] = useState('all');
  const [statProducto, setStatProducto] = useState('all');
  const [clienteSearch, setClienteSearch] = useState('');
  const [productoSearch, setProductoSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const PERIODS = [
    { id: 'today', label: 'Hoy' },
    { id: 'current', label: 'Mes actual' },
    { id: 'prev', label: 'Mes anterior' },
    { id: '3m', label: '3 meses' },
    { id: 'all', label: 'Todo' },
    { id: 'custom', label: 'Personalizado' },
  ];

  let from, to;
  if (period === 'custom') { from = appliedCustom.from; to = appliedCustom.to; }
  else if (period === 'all') { from = '2000-01-01'; to = '2099-12-31'; }
  else { const r = getRange(period); if (r) [from, to] = r; }

  const noRange = !from || !to;

  const filteredPedidos = noRange ? [] : pedidos.filter(p =>
    inRange(p.fecha, from, to) && (statCliente === 'all' || p.clienteId === statCliente)
  );
  const filteredGastos = noRange ? [] : gastos.filter(g => inRange(g.fecha, from, to));

  const byProd = statProducto !== 'all';

  function itemsAmt(p, onlyCobrado = false, medio = null) {
    if (onlyCobrado && !p.cobrado) return 0;
    if (medio && p.medioPago !== medio) return 0;
    const its = byProd ? p.items.filter(i => i.productoId === statProducto) : p.items;
    return its.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0);
  }

  const ventas = byProd
    ? filteredPedidos.reduce((s, p) => s + itemsAmt(p), 0)
    : filteredPedidos.reduce((s, p) => s + p.totalFinal, 0);

  const cobrado = byProd
    ? filteredPedidos.reduce((s, p) => s + itemsAmt(p, true), 0)
    : filteredPedidos.reduce((s, p) => p.cobrado ? s + p.totalFinal : s + (p.montoAbonado || 0), 0);

  const totalGastos = filteredGastos.reduce((s, g) => s + g.monto, 0);

  const gananciaVentas = filteredPedidos
    .filter(p => p.cobrado || (p.montoAbonado || 0) > 0)
    .reduce((s, p) => {
      const its = byProd ? p.items.filter(i => i.productoId === statProducto) : p.items;
      const pagado = p.cobrado ? p.totalFinal : (p.montoAbonado || 0);
      const ratio = p.totalFinal > 0 ? pagado / p.totalFinal : 0;
      return s + its.reduce((si, item) => {
        const costo = item.costoUnitario ?? (productos.find(pr => pr.id === item.productoId)?.costo || 0);
        return si + (item.precioUnitario - costo) * item.cantidad * ratio;
      }, 0);
    }, 0);

  const gananciaNeta = gananciaVentas - totalGastos;

  const efectivo = byProd
    ? filteredPedidos.reduce((s, p) => s + itemsAmt(p, true, 'efectivo'), 0)
    : filteredPedidos.filter(p => p.medioPago === 'efectivo').reduce((s, p) => p.cobrado ? s + p.totalFinal : s + (p.montoAbonado || 0), 0);
  const transf = byProd
    ? filteredPedidos.reduce((s, p) => s + itemsAmt(p, true, 'transferencia'), 0)
    : filteredPedidos.filter(p => p.medioPago === 'transferencia').reduce((s, p) => p.cobrado ? s + p.totalFinal : s + (p.montoAbonado || 0), 0);
  const tarjeta = byProd
    ? filteredPedidos.filter(p => p.medioPago === 'tarjeta' || p.medioPago === 'fiado').reduce((s, p) => s + itemsAmt(p, false), 0)
    : filteredPedidos.filter(p => !p.cobrado && (p.medioPago === 'tarjeta' || p.medioPago === 'fiado')).reduce((s, p) => s + p.totalFinal, 0);

  const saldoGlobal = statCliente === 'all'
    ? clientes.reduce((s, c) => s + saldoCliente(c, pedidos, devoluciones), 0)
    : saldoCliente(statCliente, pedidos, devoluciones);

  // Top clientes por ventas en el período
  const topClientes = useMemo(() => {
    if (byProd || statCliente !== 'all') return [];
    const map = {};
    filteredPedidos.forEach(p => {
      if (!map[p.clienteId]) map[p.clienteId] = { id: p.clienteId, label: clientes.find(c => c.id === p.clienteId)?.nombre || '—', value: 0 };
      map[p.clienteId].value += p.totalFinal;
    });
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [filteredPedidos, clientes, byProd, statCliente]);

  // Proyección de cobros pendientes
  const proyeccion = useMemo(() => {
    const pendientes = pedidos.filter(p => !p.cobrado && p.tipo !== 'presupuesto');
    const hoy = new Date();
    const grupos = {};
    pendientes.forEach(p => {
      const d = new Date(p.fecha + 'T00:00:00');
      const diff = Math.ceil((d - hoy) / (1000 * 60 * 60 * 24));
      const key = diff <= 0 ? 'Vencido' : diff <= 7 ? 'Esta semana' : diff <= 14 ? 'Próx. semana' : 'Más adelante';
      if (!grupos[key]) grupos[key] = 0;
      grupos[key] += p.totalFinal;
    });
    return ['Vencido', 'Esta semana', 'Próx. semana', 'Más adelante']
      .filter(k => grupos[k])
      .map(k => ({ label: k, value: grupos[k] }));
  }, [pedidos]);

  // Rentabilidad por producto
  const rentabilidad = useMemo(() => {
    const map = {};
    filteredPedidos.filter(p => p.cobrado).forEach(p => {
      p.items.forEach(item => {
        const id = item.productoId || item.nombre;
        if (!map[id]) map[id] = { nombre: item.nombre, ingresos: 0, costo: 0, unidades: 0 };
        const costo = item.costoUnitario ?? (productos.find(pr => pr.id === item.productoId)?.costo || 0);
        map[id].ingresos += item.precioUnitario * item.cantidad;
        map[id].costo += costo * item.cantidad;
        map[id].unidades += item.cantidad;
      });
    });
    return Object.values(map)
      .map(r => ({ ...r, ganancia: r.ingresos - r.costo, margen: r.ingresos > 0 ? ((r.ingresos - r.costo) / r.ingresos) * 100 : 0 }))
      .sort((a, b) => b.ganancia - a.ganancia)
      .slice(0, 6);
  }, [filteredPedidos, productos]);

  const catData = categorias
    .map(cat => ({ cat, total: filteredGastos.filter(g => g.categoria === cat).reduce((s, g) => s + g.monto, 0) }))
    .filter(x => x.total > 0).sort((a, b) => b.total - a.total);

  const q = clienteSearch.toLowerCase();
  const visibleClientes = clientes.filter(c => !q || c.nombre.toLowerCase().includes(q));
  const qp = productoSearch.toLowerCase();
  const visibleProductos = productos.filter(p => !qp || p.nombre.toLowerCase().includes(qp));

  function handleApplyRange() {
    if (!customFrom || !customTo || customFrom > customTo) return;
    setAppliedCustom({ from: customFrom, to: customTo });
  }

  function handleExport() {
    if (!from || !to) return;
    setDownloading(true);
    setTimeout(() => setDownloading(false), 1200);
    onExportCSV(from, to);
  }

  const hasActiveFilter = statCliente !== 'all' || statProducto !== 'all';
  const clienteLabel = statCliente !== 'all' ? clientes.find(c => c.id === statCliente)?.nombre : null;
  const productoLabel = statProducto !== 'all' ? productos.find(p => p.id === statProducto)?.nombre : null;

  const mediosBars = [
    { label: 'Efectivo', value: efectivo },
    { label: 'Transferencia', value: transf },
    { label: 'Tarjeta (pend.)', value: tarjeta },
  ].filter(m => m.value > 0);

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <h1>Estadísticas</h1>
        <motion.button className="btn-icon" onClick={handleExport} aria-label="Exportar CSV"
          whileTap={{ scale: 0.9 }}
          animate={downloading ? { borderColor: 'var(--primary)' } : { borderColor: 'var(--border)' }}
          style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', transition: 'border-color 0.3s' }}>
          <motion.svg viewBox="0 0 24 24" fill="none" stroke={downloading ? 'var(--primary)' : 'currentColor'} strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </motion.svg>
        </motion.button>
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', borderBottom: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
        {PERIODS.map(p => (
          <button key={p.id} className={`filter-chip${period === p.id ? ' active' : ''}`} style={{ flexShrink: 0 }} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom range */}
      {period === 'custom' && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border)' }}>
          <div className="form-row" style={{ marginBottom: 'var(--space-2)' }}>
            <div className="form-group"><label>Desde</label><input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} /></div>
            <div className="form-group"><label>Hasta</label><input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} /></div>
          </div>
          <button className="btn btn-secondary btn-full" onClick={handleApplyRange}>Aplicar</button>
        </div>
      )}

      {/* Filter toggle row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', borderBottom: filterOpen ? 'none' : '1px solid var(--border)', flexShrink: 0 }}>
        <button
          onClick={() => setFilterOpen(v => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: filterOpen || hasActiveFilter ? 'var(--bg-3)' : 'transparent',
            border: `1px solid ${filterOpen || hasActiveFilter ? 'var(--border)' : 'transparent'}`,
            borderRadius: 'var(--radius-full)', padding: '5px 12px',
            fontSize: 'var(--text-xs)', fontWeight: 600, color: hasActiveFilter ? 'var(--ink)' : 'var(--ink-3)',
            cursor: 'pointer', flexShrink: 0, minHeight: 32,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
            <line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          Filtrar
          {hasActiveFilter && <span style={{ background: 'var(--primary)', color: '#080808', borderRadius: 99, width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>{(statCliente !== 'all' ? 1 : 0) + (statProducto !== 'all' ? 1 : 0)}</span>}
        </button>

        {/* Active filter chips */}
        {clienteLabel && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--accent-2)', color: 'var(--accent)', borderRadius: 'var(--radius-full)', padding: '4px 10px', fontSize: 'var(--text-xs)', fontWeight: 600, flexShrink: 0 }}>
            {clienteLabel}
            <button onClick={() => setStatCliente('all')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex', lineHeight: 1 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </span>
        )}
        {productoLabel && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg-3)', color: 'var(--ink-2)', borderRadius: 'var(--radius-full)', padding: '4px 10px', fontSize: 'var(--text-xs)', fontWeight: 600, flexShrink: 0 }}>
            {productoLabel}
            <button onClick={() => setStatProducto('all')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex', lineHeight: 1 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </span>
        )}
      </div>

      {/* Filter panel */}
      <AnimatePresence>
        {filterOpen && (
          <FilterPanel
            clientes={clientes} productos={productos}
            statCliente={statCliente} setStatCliente={setStatCliente}
            statProducto={statProducto} setStatProducto={setStatProducto}
            clienteSearch={clienteSearch} setClienteSearch={setClienteSearch}
            productoSearch={productoSearch} setProductoSearch={setProductoSearch}
            visibleClientes={visibleClientes} visibleProductos={visibleProductos}
          />
        )}
      </AnimatePresence>

      {/* Content */}
      {noRange && period === 'custom' ? (
        <div className="empty-state"><p>Seleccioná el rango de fechas y tocá Aplicar.</p></div>
      ) : filteredPedidos.length === 0 && filteredGastos.length === 0 && !noRange && statCliente === 'all' ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <p>Sin datos para este período.</p>
          <button className="btn btn-secondary" style={{ marginTop: 'var(--space-3)' }} onClick={() => setPeriod('all')}>Ver todo el historial</button>
        </div>
      ) : (
        <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

          {/* Hero card — Ventas + Cobrado ratio */}
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-5) var(--space-5) var(--space-4)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-2)' }}>
                Ventas del período
              </div>
              <Num value={ventas} size="clamp(28px,8vw,38px)" />
              {ventas > 0 && (
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <RatioBar ratio={ventas > 0 ? cobrado / ventas : 0} />
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid var(--border)' }}>
              <div style={{ padding: 'var(--space-4) var(--space-5)', borderRight: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 'var(--space-1)' }}>Cobrado</div>
                <Num value={cobrado} color="var(--success)" size="var(--text-xl)" />
              </div>
              <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 'var(--space-1)' }}>Pendiente</div>
                <Num value={Math.max(0, ventas - cobrado)} color="var(--danger)" size="var(--text-xl)" />
              </div>
            </div>
          </div>

          {/* Row 2 — Gastos + Ganancia */}
          {!byProd && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 'var(--space-2)' }}>Gastos</div>
                <Num value={totalGastos} color={totalGastos > 0 ? 'var(--danger)' : 'var(--ink-3)'} size="var(--text-lg)" />
              </div>
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 'var(--space-2)' }}>Ganancia neta</div>
                <Num value={gananciaNeta} color={gananciaNeta >= 0 ? 'var(--success)' : 'var(--danger)'} size="var(--text-lg)" />
              </div>
            </div>
          )}

          {/* Saldo pendiente */}
          {!byProd && (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4) var(--space-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {statCliente === 'all' ? 'Saldo pendiente global' : `Saldo · ${clienteLabel}`}
              </div>
              <Num value={saldoGlobal} color="var(--danger)" size="var(--text-xl)" />
            </div>
          )}

          {/* Cobrado por medio — barchart */}
          {mediosBars.length > 0 && (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4) var(--space-5)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-4)' }}>Cobrado por medio</div>
              <BarChart items={mediosBars} />
            </div>
          )}

          {/* Top clientes — barchart */}
          {topClientes.length > 1 && (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4) var(--space-5)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-4)' }}>Top clientes</div>
              <BarChart items={topClientes} />
            </div>
          )}

          {/* Proyección cobros */}
          {!byProd && proyeccion.length > 0 && (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4) var(--space-5)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-4)' }}>Cobros pendientes</div>
              <BarChart items={proyeccion} colorVar="--danger" />
            </div>
          )}

          {/* Rentabilidad por producto */}
          {!byProd && rentabilidad.length > 0 && (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4) var(--space-5)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-4)' }}>Rentabilidad por producto</div>
              <BarChart
                items={rentabilidad.map(r => ({
                  label: r.nombre,
                  value: r.ganancia,
                  sub: `${r.unidades} uds · ${r.margen.toFixed(1)}% margen`,
                }))}
                colorVar={rentabilidad[0]?.ganancia >= 0 ? '--success' : '--danger'}
              />
            </div>
          )}

          {/* Gastos por categoría */}
          {!byProd && catData.length > 0 && (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4) var(--space-5)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-3)' }}>Gastos por categoría</div>
              <ChartCategorias data={catData} />
            </div>
          )}

        </div>
      )}
    </>
  );
}
