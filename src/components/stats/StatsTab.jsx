import { useState } from 'react';
import { formatCurrency, getRange, inRange } from '../../lib/utils.js';

const PERIODS = [
  { id: 'today', label: 'Hoy' },
  { id: 'current', label: 'Este mes' },
  { id: 'prev', label: 'Mes anterior' },
  { id: '3m', label: '3 meses' },
];

function StatCard({ label, value, cls = 'stat-neutral', full = false }) {
  return (
    <div className={`stat-card${full ? ' full' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${cls}`}>{value}</div>
    </div>
  );
}

export function StatsTab({ pedidos, gastos, clientes, productos }) {
  const [period, setPeriod] = useState('current');
  const range = getRange(period);

  const pedidosRange = range
    ? pedidos.filter(p => inRange(p.fecha, range[0], range[1]))
    : pedidos;

  const gastosRange = range
    ? gastos.filter(g => inRange(g.fecha, range[0], range[1]))
    : gastos;

  // Ingresos: solo pedidos cobrados
  const ingresosBrutos = pedidosRange
    .filter(p => p.cobrado)
    .reduce((s, p) => s + (p.totalFinal ?? p.totalCalculado), 0);

  // Ingreso total (cobrado + pendiente)
  const ingresoTotal = pedidosRange.reduce((s, p) => s + (p.totalFinal ?? p.totalCalculado), 0);

  // Pendiente de cobro
  const pendiente = ingresoTotal - ingresosBrutos;

  // Costo de ventas
  const costoVentas = pedidosRange
    .filter(p => p.cobrado)
    .reduce((s, p) => s + p.items.reduce((si, i) => si + (i.costoUnitario || 0) * i.cantidad, 0), 0);

  const ganancia = ingresosBrutos - costoVentas;
  const totalGastos = gastosRange.reduce((s, g) => s + g.monto, 0);
  const resultado = ganancia - totalGastos;
  const margenPct = ingresosBrutos > 0 ? Math.round((ganancia / ingresosBrutos) * 100) : 0;

  // Top productos (por cantidad vendida en pedidos cobrados)
  const prodVentas = {};
  pedidosRange.filter(p => p.cobrado).forEach(p => {
    p.items.forEach(i => {
      const key = i.nombre;
      if (!prodVentas[key]) prodVentas[key] = { nombre: i.nombre, cantidad: 0, monto: 0 };
      prodVentas[key].cantidad += i.cantidad;
      prodVentas[key].monto += i.precioUnitario * i.cantidad;
    });
  });
  const topProds = Object.values(prodVentas)
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5);

  // Deudores top
  const deudores = clientes
    .map(c => {
      const deuda = pedidos
        .filter(p => p.clienteId === c.id && !p.cobrado)
        .reduce((s, p) => s + (p.totalFinal ?? p.totalCalculado) - (p.montoAbonado || 0), 0);
      return { nombre: c.nombre, deuda };
    })
    .filter(d => d.deuda > 0)
    .sort((a, b) => b.deuda - a.deuda)
    .slice(0, 5);

  // Gastos por categoría
  const catGastos = {};
  gastosRange.forEach(g => {
    catGastos[g.categoria] = (catGastos[g.categoria] || 0) + g.monto;
  });
  const catArr = Object.entries(catGastos).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="page-header">
        <h1>Resumen</h1>
      </div>

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

      <div className="stat-grid">
        <StatCard
          label="Cobrado"
          value={formatCurrency(ingresosBrutos)}
          cls={ingresosBrutos > 0 ? 'stat-positive' : 'stat-neutral'}
        />
        <StatCard
          label="Pendiente de cobro"
          value={formatCurrency(pendiente)}
          cls={pendiente > 0 ? 'stat-negative' : 'stat-neutral'}
        />
        <StatCard
          label="Ganancia bruta"
          value={`${formatCurrency(ganancia)} (${margenPct}%)`}
          cls={ganancia >= 0 ? 'stat-positive' : 'stat-negative'}
        />
        <StatCard
          label="Gastos"
          value={formatCurrency(totalGastos)}
          cls={totalGastos > 0 ? 'stat-negative' : 'stat-neutral'}
        />
        <StatCard
          label="Resultado neto"
          value={formatCurrency(resultado)}
          cls={resultado >= 0 ? 'stat-positive' : 'stat-negative'}
          full
        />
      </div>

      {topProds.length > 0 && (
        <>
          <div className="section-label">Productos más vendidos</div>
          <div style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {topProds.map((p, i) => (
              <div key={i} className="card-row" style={{ padding: 0 }}>
                <span className="card-sub" style={{ flex: 1 }}>
                  <span style={{ color: 'var(--color-ink-3)', marginRight: 'var(--space-2)' }}>#{i + 1}</span>
                  {p.nombre}
                  <span style={{ color: 'var(--color-ink-3)', marginLeft: 'var(--space-2)' }}>×{p.cantidad}</span>
                </span>
                <span className="card-amount amount-paid" style={{ fontSize: 'var(--text-sm)' }}>
                  {formatCurrency(p.monto)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {deudores.length > 0 && (
        <>
          <div className="section-label">Deudores</div>
          <div style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {deudores.map((d, i) => (
              <div key={i} className="card-row" style={{ padding: 0 }}>
                <span className="card-sub" style={{ flex: 1 }}>{d.nombre}</span>
                <span className="card-amount amount-debt" style={{ fontSize: 'var(--text-sm)' }}>
                  {formatCurrency(d.deuda)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {catArr.length > 0 && (
        <>
          <div className="section-label">Gastos por categoría</div>
          <div style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingBottom: 'var(--space-6)' }}>
            {catArr.map(([cat, monto], i) => (
              <div key={i} className="card-row" style={{ padding: 0 }}>
                <span className="card-sub" style={{ flex: 1 }}>{cat}</span>
                <span className="card-amount amount-debt" style={{ fontSize: 'var(--text-sm)' }}>
                  {formatCurrency(monto)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {pedidosRange.length === 0 && gastosRange.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <p>Sin datos para este período.</p>
        </div>
      )}
    </>
  );
}
