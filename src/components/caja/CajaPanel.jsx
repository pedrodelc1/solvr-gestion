import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency, formatDate, today } from '../../lib/utils.js';
import { listItem } from '../../lib/animations.js';

function SvgChevron({ dir = 'left' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {dir === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
    </svg>
  );
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

export function CajaPanel({ pedidos, gastos, clientes }) {
  const [fecha, setFecha] = useState(today());

  const clienteNombre = id => clientes.find(c => c.id === id)?.nombre || '—';

  const cobrosDelDia = useMemo(() =>
    pedidos.filter(p =>
      p.tipo !== 'presupuesto' &&
      p.cobrado &&
      p.fecha === fecha
    ), [pedidos, fecha]);

  const gastosDelDia = useMemo(() =>
    gastos.filter(g => g.fecha === fecha),
    [gastos, fecha]
  );

  const totalEfectivo = cobrosDelDia.filter(p => p.medioPago === 'efectivo').reduce((s, p) => s + p.totalFinal, 0);
  const totalTransferencia = cobrosDelDia.filter(p => p.medioPago === 'transferencia').reduce((s, p) => s + p.totalFinal, 0);
  const totalTarjeta = cobrosDelDia.filter(p => p.medioPago === 'tarjeta' || p.medioPago === 'fiado').reduce((s, p) => s + p.totalFinal, 0);
  const totalCobros = cobrosDelDia.reduce((s, p) => s + p.totalFinal, 0);
  const totalGastos = gastosDelDia.reduce((s, g) => s + g.monto, 0);
  const neto = totalCobros - totalGastos;

  return (
    <>
      <div className="page-header">
        <h1>Caja del día</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '0 var(--space-4) var(--space-4)' }}>
        <button className="btn-icon" onClick={() => setFecha(f => addDays(f, -1))} aria-label="Día anterior">
          <SvgChevron dir="left" />
        </button>
        <input
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          style={{ flex: 1, minHeight: 40, textAlign: 'center', fontSize: 'var(--text-sm)', fontWeight: 600 }}
        />
        <button className="btn-icon" onClick={() => setFecha(f => addDays(f, 1))} aria-label="Día siguiente" disabled={fecha >= today()}>
          <SvgChevron dir="right" />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', padding: '0 var(--space-4) var(--space-4)' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', fontWeight: 500, marginBottom: 4 }}>Cobrado</div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(totalCobros)}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', fontWeight: 500, marginBottom: 4 }}>Gastos</div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--danger)' }}>{formatCurrency(totalGastos)}</div>
        </div>
      </div>

      <div className="card" style={{ margin: '0 var(--space-4) var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4)' }}>
        <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Resultado neto</span>
        <span style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: neto >= 0 ? 'var(--success)' : 'var(--danger)' }}>
          {formatCurrency(neto)}
        </span>
      </div>

      {totalCobros > 0 && (
        <div className="card" style={{ margin: '0 var(--space-4) var(--space-4)', display: 'flex', gap: 'var(--space-4)' }}>
          {totalEfectivo > 0 && (
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>Efectivo</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{formatCurrency(totalEfectivo)}</div>
            </div>
          )}
          {totalTransferencia > 0 && (
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>Transferencia</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{formatCurrency(totalTransferencia)}</div>
            </div>
          )}
          {totalTarjeta > 0 && (
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>Tarjeta</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{formatCurrency(totalTarjeta)}</div>
            </div>
          )}
        </div>
      )}

      {cobrosDelDia.length > 0 && (
        <>
          <div className="section-label">Cobros del día ({cobrosDelDia.length})</div>
          <div className="list-section">
            {cobrosDelDia.map((p, i) => (
              <motion.div key={p.id} className="card" {...listItem(i)}>
                <div className="card-row">
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{clienteNombre(p.clienteId)}</span>
                  <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: 'var(--text-sm)' }}>{formatCurrency(p.totalFinal)}</span>
                </div>
                <div className="card-row">
                  <span className="card-sub">{p.items.map(i => `${i.nombre} x${i.cantidad}`).join(' · ')}</span>
                  <span className="badge" style={{ fontSize: 10 }}>
                    {p.medioPago === 'efectivo' ? '💵' : p.medioPago === 'transferencia' ? '🏦' : '💳'} {p.medioPago}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {gastosDelDia.length > 0 && (
        <>
          <div className="section-label">Gastos del día ({gastosDelDia.length})</div>
          <div className="list-section">
            {gastosDelDia.map((g, i) => (
              <motion.div key={g.id} className="card" {...listItem(i)}>
                <div className="card-row">
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{g.descripcion || 'Sin descripción'}</span>
                  <span style={{ fontWeight: 800, color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>−{formatCurrency(g.monto)}</span>
                </div>
                {g.categoria && <span className="card-sub">{g.categoria}</span>}
              </motion.div>
            ))}
          </div>
        </>
      )}

      {cobrosDelDia.length === 0 && gastosDelDia.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          <p>Sin movimientos para este día.</p>
        </div>
      )}
    </>
  );
}
