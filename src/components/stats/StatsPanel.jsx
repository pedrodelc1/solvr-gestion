import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, getRange, inRange, saldoCliente } from '../../lib/utils.js';
import { ChartCategorias } from './ChartCategorias.jsx';

// Counter animation hook
function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(target);

  useEffect(() => {
    if (target === prevTarget.current) return;
    prevTarget.current = target;
    const start = performance.now();
    const from = 0;

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (target - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
      else setValue(target);
    }

    requestAnimationFrame(tick);
  }, [target, duration]);

  // on first mount animate from 0
  useEffect(() => {
    const start = performance.now();
    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
      else setValue(target);
    }
    requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return value;
}

function AnimatedStatCard({ label, value, className, full }) {
  const animated = useCountUp(value);
  return (
    <div className={`stat-card${full ? ' full' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${className}`}>{formatCurrency(animated)}</div>
    </div>
  );
}

export function StatsPanel({ pedidos, gastos, clientes, productos, devoluciones = [], categorias, onExportCSV }) {
  const [period, setPeriod] = useState('3m');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [appliedCustom, setAppliedCustom] = useState({ from: '', to: '' });
  const [statCliente, setStatCliente] = useState('all');
  const [statProducto, setStatProducto] = useState('all');
  const [searchVisible, setSearchVisible] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');

  const PERIODS = [
    { id: 'today', label: 'Hoy' },
    { id: 'current', label: 'Mes actual' },
    { id: 'prev', label: 'Mes anterior' },
    { id: '3m', label: '3 meses' },
    { id: 'all', label: 'Todo' },
    { id: 'custom', label: 'Personalizado' },
  ];

  let from, to;
  if (period === 'custom') {
    from = appliedCustom.from;
    to = appliedCustom.to;
  } else if (period === 'all') {
    from = '2000-01-01';
    to = '2099-12-31';
  } else {
    const range = getRange(period);
    if (range) { [from, to] = range; }
  }

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
    : filteredPedidos.filter(p => p.cobrado).reduce((s, p) => s + p.totalFinal, 0);

  const totalGastos = filteredGastos.reduce((s, g) => s + g.monto, 0);

  const gananciaVentas = filteredPedidos
    .filter(p => p.cobrado)
    .reduce((s, p) => {
      const its = byProd ? p.items.filter(i => i.productoId === statProducto) : p.items;
      return s + its.reduce((si, item) => {
        const costo = item.costoUnitario ?? (productos.find(pr => pr.id === item.productoId)?.costo || 0);
        return si + (item.precioUnitario - costo) * item.cantidad;
      }, 0);
    }, 0);

  const gananciaNeta = gananciaVentas - totalGastos;

  const efectivo = byProd
    ? filteredPedidos.reduce((s, p) => s + itemsAmt(p, true, 'efectivo'), 0)
    : filteredPedidos.filter(p => p.cobrado && p.medioPago === 'efectivo').reduce((s, p) => s + p.totalFinal, 0);
  const transf = byProd
    ? filteredPedidos.reduce((s, p) => s + itemsAmt(p, true, 'transferencia'), 0)
    : filteredPedidos.filter(p => p.cobrado && p.medioPago === 'transferencia').reduce((s, p) => s + p.totalFinal, 0);

  // tarjeta: cobrado + fiado (legacy data)
  const tarjeta = byProd
    ? filteredPedidos.filter(p => p.medioPago === 'tarjeta' || p.medioPago === 'fiado').reduce((s, p) => s + itemsAmt(p, false), 0)
    : filteredPedidos.filter(p => !p.cobrado && (p.medioPago === 'tarjeta' || p.medioPago === 'fiado')).reduce((s, p) => s + p.totalFinal, 0);

  const saldoGlobal = statCliente === 'all'
    ? clientes.reduce((s, c) => s + saldoCliente(c, pedidos, devoluciones), 0)
    : saldoCliente(statCliente, pedidos, devoluciones);

  // F4.2 — Proyección de cobros: pendientes agrupados por semana
  const proyeccion = useMemo(() => {
    const pendientes = pedidos.filter(p => !p.cobrado && p.tipo !== 'presupuesto');
    const hoy = new Date();
    const grupos = {};
    pendientes.forEach(p => {
      const d = new Date(p.fecha + 'T00:00:00');
      const diff = Math.ceil((d - hoy) / (1000 * 60 * 60 * 24));
      const key = diff <= 0 ? 'Vencido' : diff <= 7 ? 'Esta semana' : diff <= 14 ? 'Próxima semana' : 'Más de 15 días';
      if (!grupos[key]) grupos[key] = 0;
      grupos[key] += p.totalFinal;
    });
    const order = ['Vencido', 'Esta semana', 'Próxima semana', 'Más de 15 días'];
    return order.filter(k => grupos[k]).map(k => ({ label: k, monto: grupos[k] }));
  }, [pedidos]);

  // F4.3 — Rentabilidad por producto
  const rentabilidad = useMemo(() => {
    const map = {};
    filteredPedidos.filter(p => p.cobrado).forEach(p => {
      p.items.forEach(item => {
        const prodId = item.productoId || item.nombre;
        if (!map[prodId]) map[prodId] = { nombre: item.nombre, ingresos: 0, costo: 0, unidades: 0 };
        const costo = item.costoUnitario ?? (productos.find(pr => pr.id === item.productoId)?.costo || 0);
        map[prodId].ingresos += item.precioUnitario * item.cantidad;
        map[prodId].costo += costo * item.cantidad;
        map[prodId].unidades += item.cantidad;
      });
    });
    return Object.values(map)
      .map(r => ({ ...r, ganancia: r.ingresos - r.costo, margen: r.ingresos > 0 ? ((r.ingresos - r.costo) / r.ingresos) * 100 : 0 }))
      .sort((a, b) => b.ganancia - a.ganancia);
  }, [filteredPedidos, productos]);

  const catData = categorias
    .map(cat => ({ cat, total: filteredGastos.filter(g => g.categoria === cat).reduce((s, g) => s + g.monto, 0) }))
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total);

  const q = clienteSearch.toLowerCase();
  const visibleClientes = clientes.filter(c => !q || c.nombre.toLowerCase().includes(q));

  function handleApplyRange() {
    if (!customFrom || !customTo) return;
    if (customFrom > customTo) return;
    setAppliedCustom({ from: customFrom, to: customTo });
  }

  const [downloading, setDownloading] = useState(false);

  function handleExport() {
    if (!from || !to) return;
    setDownloading(true);
    setTimeout(() => setDownloading(false), 1200);
    onExportCSV(from, to);
  }

  return (
    <>
      <div className="page-header">
        <h1>Estadísticas</h1>
        <motion.button
          className="btn-icon"
          onClick={handleExport}
          aria-label="Exportar CSV"
          whileHover={{ scale: 1.1, boxShadow: '0 0 12px #ccff0066' }}
          whileTap={{ scale: 0.9 }}
          animate={downloading ? { borderColor: '#ccff00' } : { borderColor: 'var(--border)' }}
          style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', transition: 'border-color 0.3s' }}
        >
          <AnimatePresence mode="wait">
            {downloading ? (
              <motion.svg
                key="downloading"
                viewBox="0 0 24 24" fill="none" stroke="#ccff00" strokeWidth="2"
                initial={{ y: -4, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 4, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </motion.svg>
            ) : (
              <motion.svg
                key="idle"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                initial={{ y: -4, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 4, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Period bar */}
      <div className="period-bar">
        {PERIODS.map(p => (
          <button
            key={p.id}
            className={`filter-chip${period === p.id ? ' active' : ''}`}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom range */}
      {period === 'custom' && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border)' }}>
          <div className="form-row" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="form-group">
              <label>Desde</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Hasta</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-secondary btn-full" onClick={handleApplyRange}>Aplicar</button>
        </div>
      )}

      {/* Client filter */}
      <div className="filter-bar">
        <button
          className="btn-icon"
          style={{
            flexShrink: 0,
            minHeight: 32,
            minWidth: 32,
            padding: 4,
            color: searchVisible ? 'var(--ink)' : 'var(--ink-2)',
          }}
          onClick={() => { setSearchVisible(v => !v); if (searchVisible) setClienteSearch(''); }}
          aria-label="Buscar cliente"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
        {searchVisible && (
          <div className="search-bar-wrapper" style={{ flex: 1, minWidth: 100, maxWidth: 180 }}>
            <input
              type="search"
              placeholder="Buscar cliente..."
              value={clienteSearch}
              onChange={e => setClienteSearch(e.target.value)}
              autoFocus
              style={{ minHeight: 32, fontSize: 'var(--text-sm)', padding: 'var(--space-1) var(--space-3)' }}
            />
          </div>
        )}
        <button
          className={`filter-chip${statCliente === 'all' ? ' active' : ''}`}
          onClick={() => setStatCliente('all')}
        >
          Todos
        </button>
        {visibleClientes.map(c => (
          <button
            key={c.id}
            className={`filter-chip${statCliente === c.id ? ' active' : ''}`}
            onClick={() => setStatCliente(c.id)}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      {/* Product filter */}
      <div className="filter-bar">
        <button
          className={`filter-chip${statProducto === 'all' ? ' active' : ''}`}
          onClick={() => setStatProducto('all')}
        >
          Todos
        </button>
        {productos.map(p => (
          <button
            key={p.id}
            className={`filter-chip${statProducto === p.id ? ' active' : ''}`}
            onClick={() => setStatProducto(p.id)}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      {noRange && period === 'custom' ? (
        <div className="empty-state">
          <p>Seleccioná el rango de fechas y tocá Aplicar.</p>
        </div>
      ) : filteredPedidos.length === 0 && filteredGastos.length === 0 && !noRange && statCliente === 'all' ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <p>Sin datos para este período.</p>
          <button className="btn btn-secondary" style={{ marginTop: 'var(--space-3)' }} onClick={() => setPeriod('all')}>
            Ver todo el historial
          </button>
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <AnimatedStatCard label="Ventas período" value={ventas} className="stat-neutral" />
            <AnimatedStatCard label="Cobrado" value={cobrado} className="stat-positive" />
            {!byProd && (
              <AnimatedStatCard label="Gastos" value={totalGastos} className="stat-negative" />
            )}
            <AnimatedStatCard
              label="Ganancia s/ ventas"
              value={gananciaVentas}
              className={gananciaVentas >= 0 ? 'stat-positive' : 'stat-negative'}
            />
            {!byProd && (
              <>
                <AnimatedStatCard
                  label="Ganancia neta (ventas − gastos)"
                  value={gananciaNeta}
                  className={gananciaNeta >= 0 ? 'stat-positive' : 'stat-negative'}
                  full
                />
                <AnimatedStatCard
                  label={statCliente === 'all' ? 'Saldo pendiente global' : 'Saldo pendiente del cliente'}
                  value={saldoGlobal}
                  className="stat-negative"
                  full
                />
              </>
            )}
          </div>

          <div className="section-label">Cobrado por medio de pago</div>
          <div className="stat-grid">
            <AnimatedStatCard label="Efectivo" value={efectivo} className="stat-positive" />
            <AnimatedStatCard label="Transferencia" value={transf} className="stat-positive" />
            <AnimatedStatCard label="Tarjeta (pendiente)" value={tarjeta} className="stat-negative" full />
          </div>

          {!byProd && catData.length > 0 && (
            <>
              <div className="section-label">Gastos por categoría</div>
              <ChartCategorias data={catData} />
            </>
          )}

          {!byProd && proyeccion.length > 0 && (
            <>
              <div className="section-label">Proyección de cobros pendientes</div>
              <div className="list-section">
                {proyeccion.map(g => (
                  <div key={g.label} className="card">
                    <div className="card-row">
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{g.label}</span>
                      <span style={{ fontWeight: 800, color: g.label === 'Vencido' ? 'var(--danger)' : 'var(--ink)', fontSize: 'var(--text-sm)' }}>
                        {formatCurrency(g.monto)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!byProd && rentabilidad.length > 0 && (
            <>
              <div className="section-label">Rentabilidad por producto</div>
              <div className="list-section">
                {rentabilidad.map(r => (
                  <div key={r.nombre} className="card">
                    <div className="card-row">
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</span>
                      <span style={{ fontWeight: 800, fontSize: 'var(--text-sm)', color: r.ganancia >= 0 ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }}>
                        {formatCurrency(r.ganancia)}
                      </span>
                    </div>
                    <div className="card-row">
                      <span className="card-sub">{r.unidades} uds · {formatCurrency(r.ingresos)} ingresos</span>
                      <span className="card-sub">{r.margen.toFixed(1)}% margen</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
