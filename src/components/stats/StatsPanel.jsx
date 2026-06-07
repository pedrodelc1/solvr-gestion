import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency, getRange, inRange } from '../../lib/utils.js';

function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(target);
  useEffect(() => {
    if (target === prevTarget.current) return;
    prevTarget.current = target;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3); // cubic ease out
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

// Minimalist horizontal bar chart
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
                transition={{ duration: 0.6, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
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

// Large currency formatter for chart axis labels (e.g. $15k, $1.2M)
function formatLargeCurrency(val) {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${val}`;
}

// Custom SVG Donut Chart
function DonutChart({ items }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return null;

  let accumulatedPercent = 0;
  const radius = 35;
  const strokeWidth = 10;
  const circ = 2 * Math.PI * radius;

  const colors = [
    'var(--primary)',
    'var(--success)',
    'var(--warning)',
    'var(--danger)',
    '#9c27b0',
    '#00bcd4'
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', padding: 'var(--space-2) 0' }}>
      <svg viewBox="0 0 100 100" style={{ width: 110, height: 110, flexShrink: 0, overflow: 'visible' }}>
        <g transform="rotate(-90 50 50)">
          {items.map((item, idx) => {
            const pct = item.value / total;
            const strokeLength = circ * pct;
            const strokeOffset = circ - (circ * accumulatedPercent);
            accumulatedPercent += pct;
            
            return (
              <circle
                key={idx}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={colors[idx % colors.length]}
                strokeWidth={strokeWidth}
                strokeDasharray={`${strokeLength} ${circ}`}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            );
          })}
        </g>
        <text x="50" y="47" textAnchor="middle" fill="var(--ink-3)" fontSize="6" fontWeight="700" letterSpacing="0.05em">TOTAL</text>
        <text x="50" y="58" textAnchor="middle" fill="var(--ink)" fontSize="8.5" fontWeight="900">{formatLargeCurrency(total)}</text>
      </svg>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flex: 1 }}>
        {items.map((item, idx) => {
          const pct = (item.value / total) * 100;
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '2px', background: colors[idx % colors.length] }} />
                <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{item.label}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{pct.toFixed(0)}%</span>
                <span style={{ fontSize: 9, color: 'var(--ink-3)' }}>{formatCurrency(item.value)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Custom SVG Grouped Vertical Bar Chart (Revenues vs Expenses)
function GroupedBarChart({ data }) {
  if (!data || data.length === 0) return null;

  const width = 500;
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 25;

  const maxVal = Math.max(
    ...data.map(d => Math.max(d.revenue, d.expenses)),
    1000 // default minimum scale
  );

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const numGroups = data.length;
  const groupWidth = chartWidth / numGroups;
  const barWidth = Math.max(groupWidth * 0.25, 6); // width of each individual bar
  const barGap = 3; // gap between revenue and expense bar

  return (
    <div style={{ position: 'relative', width: '100%', padding: 'var(--space-1) 0' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        {/* Horizontal grid lines and Y-axis labels */}
        {[0, 0.5, 1].map((ratio, idx) => {
          const y = paddingTop + chartHeight * ratio;
          const val = maxVal - (maxVal * ratio);
          return (
            <g key={idx}>
              <line 
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.25"
              />
              <text x={0} y={y + 3} fill="var(--ink-3)" fontSize="8" fontWeight="600">
                {formatLargeCurrency(val)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const groupX = paddingLeft + (i * groupWidth);
          const centerX = groupX + (groupWidth / 2);

          const revHeight = (d.revenue / maxVal) * chartHeight;
          const expHeight = (d.expenses / maxVal) * chartHeight;

          const revY = paddingTop + chartHeight - revHeight;
          const expY = paddingTop + chartHeight - expHeight;

          return (
            <g key={i}>
              {/* Revenue Bar (Green) */}
              {d.revenue > 0 && (
                <rect
                  x={centerX - barWidth - (barGap / 2)}
                  y={revY}
                  width={barWidth}
                  height={revHeight}
                  fill="var(--success)"
                  rx="2"
                />
              )}

              {/* Expenses Bar (Red) */}
              {d.expenses > 0 && (
                <rect
                  x={centerX + (barGap / 2)}
                  y={expY}
                  width={barWidth}
                  height={expHeight}
                  fill="var(--danger)"
                  rx="2"
                />
              )}

              {/* Group Label */}
              <text
                x={centerX}
                y={height - 5}
                fill="var(--ink-2)"
                fontSize="9"
                fontWeight="600"
                textAnchor="middle"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Animated number
function Num({ value, color = 'var(--ink)', size = 'var(--text-2xl)', weight = 800 }) {
  const v = useCountUp(value);
  return <span style={{ fontSize: size, fontWeight: weight, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{formatCurrency(v)}</span>;
}

export function StatsPanel({ pedidos, gastos, clientes, productos, onExportCSV }) {
  const [period, setPeriod] = useState('current');
  const [downloading, setDownloading] = useState(false);

  const PERIODS = [
    { id: 'today', label: 'Hoy' },
    { id: 'current', label: 'Este mes' },
    { id: 'prev', label: 'Mes anterior' },
    { id: '3m', label: '3 meses' },
    { id: 'all', label: 'Todo' },
  ];

  let from, to;
  if (period === 'all') { from = '2000-01-01'; to = '2099-12-31'; }
  else { const r = getRange(period); if (r) [from, to] = r; }

  const noRange = !from || !to;

  const filteredPedidos = noRange ? [] : pedidos.filter(p => inRange(p.fecha, from, to) && p.tipo !== 'presupuesto');
  const filteredGastos = noRange ? [] : gastos.filter(g => inRange(g.fecha, from, to));

  // Ventas totales (Facturación)
  const ventas = filteredPedidos.reduce((s, p) => s + p.totalFinal, 0);

  // Cobrado
  const cobrado = filteredPedidos.reduce((s, p) => p.cobrado ? s + p.totalFinal : s + (p.montoAbonado || 0), 0);

  // Gastos
  const totalGastos = filteredGastos.reduce((s, g) => s + g.monto, 0);

  // Ganancia neta (Ganancia sobre lo cobrado - Gastos totales)
  const gananciaVentas = filteredPedidos
    .filter(p => p.cobrado || (p.montoAbonado || 0) > 0)
    .reduce((s, p) => {
      const pagado = p.cobrado ? p.totalFinal : (p.montoAbonado || 0);
      const ratio = p.totalFinal > 0 ? pagado / p.totalFinal : 0;
      return s + p.items.reduce((si, item) => {
        const costo = item.costoUnitario ?? (productos.find(pr => pr.id === item.productoId)?.costo || 0);
        return si + (item.precioUnitario - costo) * item.cantidad * ratio;
      }, 0);
    }, 0);

  const gananciaNeta = gananciaVentas - totalGastos;

  // BI KPIs
  const ticketPromedio = filteredPedidos.length > 0 ? (ventas / filteredPedidos.length) : 0;

  const costoTotalVendido = filteredPedidos.reduce((s, p) => {
    return s + p.items.reduce((si, item) => {
      const costo = item.costoUnitario ?? (productos.find(pr => pr.id === item.productoId)?.costo || 0);
      return si + (costo * item.cantidad);
    }, 0);
  }, 0);
  const margenPorcentaje = ventas > 0 ? ((ventas - costoTotalVendido) / ventas) * 100 : 0;

  // Medios de pago (Breakdown de cobros)
  const mediosBars = useMemo(() => {
    const map = {};
    filteredPedidos.forEach(p => {
      const pagado = p.cobrado ? p.totalFinal : (p.montoAbonado || 0);
      if (pagado <= 0) return;
      const medio = p.medioPago || 'efectivo';
      const label = medio.charAt(0).toUpperCase() + medio.slice(1);
      if (!map[label]) map[label] = 0;
      map[label] += pagado;
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredPedidos]);

  // Top clientes por volumen de ventas
  const topClientes = useMemo(() => {
    const map = {};
    filteredPedidos.forEach(p => {
      if (!map[p.clienteId]) map[p.clienteId] = { id: p.clienteId, label: clientes.find(c => c.id === p.clienteId)?.nombre || '—', value: 0 };
      map[p.clienteId].value += p.totalFinal;
    });
    return Object.values(map)
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  }, [filteredPedidos, clientes]);

  // Clientes con mayores saldos pendientes de cobro (BI para cobranza)
  const deudores = useMemo(() => {
    const map = {};
    pedidos.filter(p => !p.cobrado && p.tipo !== 'presupuesto').forEach(p => {
      const deud = p.totalFinal - (p.montoAbonado || 0);
      if (deud <= 0) return;
      if (!map[p.clienteId]) {
        map[p.clienteId] = {
          label: clientes.find(c => c.id === p.clienteId)?.nombre || '—',
          value: 0
        };
      }
      map[p.clienteId].value += deud;
    });
    return Object.values(map)
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  }, [pedidos, clientes]);

  // Rentabilidad por producto vendida en el periodo
  const rentabilidad = useMemo(() => {
    const map = {};
    filteredPedidos.forEach(p => {
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
      .map(r => {
        const gan = r.ingresos - r.costo;
        const marg = r.ingresos > 0 ? (gan / r.ingresos) * 100 : 0;
        return {
          label: r.nombre,
          value: gan,
          sub: `${r.unidades} uds · Margen: ${marg.toFixed(0)}%`
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  }, [filteredPedidos, productos]);

  // Gastos por categoría
  const catData = useMemo(() => {
    const map = {};
    filteredGastos.forEach(g => {
      if (!map[g.categoria]) map[g.categoria] = 0;
      map[g.categoria] += g.monto;
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  }, [filteredGastos]);

  // Grouped comparative data (Revenues vs Expenses)
  const comparisonData = useMemo(() => {
    if (!from || !to) return [];

    const groups = {};
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diffTime = Math.abs(toDate - fromDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 35) {
      // Group by Week (divide range into 4 equal segments)
      const step = Math.ceil(diffDays / 4);
      for (let i = 0; i < 4; i++) {
        const start = new Date(fromDate);
        start.setDate(fromDate.getDate() + (i * step));
        const end = new Date(fromDate);
        end.setDate(fromDate.getDate() + ((i + 1) * step) - 1);
        if (end > toDate) end.setDate(toDate.getDate());

        const label = `Sem ${i + 1}`;
        groups[label] = { label, revenue: 0, expenses: 0, sortKey: i };

        filteredPedidos.forEach(p => {
          const d = new Date(p.fecha + 'T00:00:00');
          if (d >= start && d <= end) {
            groups[label].revenue += p.totalFinal;
          }
        });
        filteredGastos.forEach(g => {
          const d = new Date(g.fecha + 'T00:00:00');
          if (d >= start && d <= end) {
            groups[label].expenses += g.monto;
          }
        });
      }
    } else {
      // Group by Month
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      
      filteredPedidos.forEach(p => {
        const d = new Date(p.fecha + 'T00:00:00');
        const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
        if (!groups[label]) groups[label] = { label, revenue: 0, expenses: 0, sortKey: d.getFullYear() * 12 + d.getMonth() };
        groups[label].revenue += p.totalFinal;
      });
      
      filteredGastos.forEach(g => {
        const d = new Date(g.fecha + 'T00:00:00');
        const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
        if (!groups[label]) groups[label] = { label, revenue: 0, expenses: 0, sortKey: d.getFullYear() * 12 + d.getMonth() };
        groups[label].expenses += g.monto;
      });
    }

    return Object.values(groups).sort((a, b) => a.sortKey - b.sortKey);
  }, [filteredPedidos, filteredGastos, from, to]);

  function handleExport() {
    if (!from || !to) return;
    setDownloading(true);
    setTimeout(() => setDownloading(false), 1200);
    onExportCSV(from, to);
  }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <h1>Resumen de Negocio</h1>
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
      <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
        {PERIODS.map(p => (
          <button key={p.id} className={`filter-chip${period === p.id ? ' active' : ''}`} style={{ flexShrink: 0 }} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {filteredPedidos.length === 0 && filteredGastos.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <p>Sin movimientos en este período.</p>
        </div>
      ) : (
        <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          
          {/* BIG HERO: Ganancia Neta */}
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5) var(--space-4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 'var(--space-1)' }}>Ganancia Neta</div>
            <Num value={gananciaNeta} color={gananciaNeta >= 0 ? 'var(--success)' : 'var(--danger)'} size="clamp(32px, 8vw, 42px)" weight={900} />
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>
              Cobrado menos Gastos del período
            </div>
          </div>

          {/* Ingresos / Gastos / Pendiente grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Facturado Total</div>
              <Num value={ventas} color="var(--ink)" size="var(--text-xl)" />
            </div>
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Gastos Totales</div>
              <Num value={totalGastos} color="var(--danger)" size="var(--text-xl)" />
            </div>

            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Cobrado Real</div>
              <Num value={cobrado} color="var(--success)" size="var(--text-xl)" />
            </div>
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Pendiente Cobro</div>
              <Num value={Math.max(0, ventas - cobrado)} color="var(--warning)" size="var(--text-xl)" />
            </div>
          </div>

          {/* Comparativa: Ingresos vs Gastos (GroupedBarChart) */}
          {comparisonData.length > 0 && (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-3)' }}>Comparativa: Ingresos vs Gastos</div>
              <GroupedBarChart data={comparisonData} />
            </div>
          )}

          {/* Medios de Pago Donut Breakdown */}
          {mediosBars.length > 0 && (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-4)' }}>Distribución de Cobros (Medios)</div>
              <DonutChart items={mediosBars} />
            </div>
          )}

          {/* BI KPIs GRID: Ticket Promedio, Margen Promedio, Pedidos Totales */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-2)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Ventas</div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--ink)' }}>{filteredPedidos.length}</div>
            </div>
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-2)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Ticket Prom.</div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--ink)' }}>{formatCurrency(ticketPromedio)}</div>
            </div>
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-2)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Margen Prom.</div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--success)' }}>{margenPorcentaje.toFixed(0)}%</div>
            </div>
          </div>

          {/* Top clientes */}
          {topClientes.length > 0 && (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-4)' }}>Clientes (Mayor Facturación)</div>
              <BarChart items={topClientes} colorVar="--primary" />
            </div>
          )}

          {/* Clientes Deudores (Collections/Debts list) */}
          {deudores.length > 0 && (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-4)' }}>Principales Saldos Pendientes</div>
              <BarChart items={deudores} colorVar="--warning" />
            </div>
          )}

          {/* Rentabilidad por Producto */}
          {rentabilidad.length > 0 && (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-4)' }}>Productos con Mayor Ganancia</div>
              <BarChart items={rentabilidad} colorVar="--success" />
            </div>
          )}

          {/* Gastos por categoría */}
          {catData.length > 0 && (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-4)' }}>Distribución de Gastos</div>
              <BarChart items={catData} colorVar="--danger" />
            </div>
          )}

        </div>
      )}
    </>
  );
}
