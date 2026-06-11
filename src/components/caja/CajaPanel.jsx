import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency, today } from '../../lib/utils.js';
import { listItem } from '../../lib/animations.js';
import { ConfirmModal } from '../shared/Modal.jsx';

function SvgChevron({ dir = 'left' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {dir === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
    </svg>
  );
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function formatFecha(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const t = today();
  if (dateStr === t) return 'Hoy';
  const ayer = addDays(t, -1);
  if (dateStr === ayer) return 'Ayer';
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const MEDIO_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', fiado: 'Tarjeta' };

export function CajaPanel({ pedidos, gastos, clientes, cobrosSueltos = [], onNuevoCobro, onDeleteCobro }) {
  const [fecha, setFecha] = useState(today());
  const [confirmDelCobro, setConfirmDelCobro] = useState(null);

  const clienteNombre = id => clientes.find(c => c.id === id)?.nombre || '—';

  const cobrosDelDia = useMemo(() =>
    pedidos.filter(p =>
      p.tipo !== 'presupuesto' &&
      (p.cobrado || (p.montoAbonado || 0) > 0) &&
      p.fecha === fecha
    ), [pedidos, fecha]);

  const sueltosDelDia = useMemo(() =>
    cobrosSueltos.filter(c => c.fecha === fecha),
    [cobrosSueltos, fecha]
  );

  const gastosDelDia = useMemo(() =>
    gastos.filter(g => g.fecha === fecha),
    [gastos, fecha]
  );

  const montoCobrado = p => p.cobrado ? p.totalFinal : (p.montoAbonado || 0);
  const medioKey = m => (m === 'fiado' ? 'tarjeta' : (m || 'efectivo'));

  const totalEfectivo = cobrosDelDia.filter(p => medioKey(p.medioPago) === 'efectivo').reduce((s, p) => s + montoCobrado(p), 0)
    + sueltosDelDia.filter(c => medioKey(c.metodo) === 'efectivo').reduce((s, c) => s + c.monto, 0);
  const totalTransferencia = cobrosDelDia.filter(p => medioKey(p.medioPago) === 'transferencia').reduce((s, p) => s + montoCobrado(p), 0)
    + sueltosDelDia.filter(c => medioKey(c.metodo) === 'transferencia').reduce((s, c) => s + c.monto, 0);
  const totalTarjeta = cobrosDelDia.filter(p => medioKey(p.medioPago) === 'tarjeta').reduce((s, p) => s + montoCobrado(p), 0)
    + sueltosDelDia.filter(c => medioKey(c.metodo) === 'tarjeta').reduce((s, c) => s + c.monto, 0);
  const totalCobros = cobrosDelDia.reduce((s, p) => s + montoCobrado(p), 0)
    + sueltosDelDia.reduce((s, c) => s + c.monto, 0);
  const totalGastos = gastosDelDia.reduce((s, g) => s + g.monto, 0);
  const neto = totalCobros - totalGastos;

  const totalOtros = totalCobros - totalEfectivo - totalTransferencia - totalTarjeta;
  const medios = [
    { label: 'Efectivo', value: totalEfectivo },
    { label: 'Transferencia', value: totalTransferencia },
    { label: 'Tarjeta', value: totalTarjeta },
    { label: 'Otros', value: totalOtros },
  ].filter(m => m.value > 0);

  return (
    <>
      <div className="page-header">
        <h1>Caja del día</h1>
        {onNuevoCobro && (
          <button className="btn-icon" onClick={onNuevoCobro} aria-label="Registrar cobro suelto" title="Registrar cobro suelto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
      </div>

      {/* Date navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '0 var(--space-4) var(--space-5)' }}>
        <button className="btn-icon" onClick={() => setFecha(f => addDays(f, -1))} aria-label="Día anterior" style={{ flexShrink: 0 }}>
          <SvgChevron dir="left" />
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--ink)' }}>{formatFecha(fecha)}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', marginTop: 2 }}>
            {new Date(fecha + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', timeZone: 'UTC' })}
          </div>
        </div>
        <button className="btn-icon" onClick={() => setFecha(f => addDays(f, 1))} aria-label="Día siguiente" disabled={fecha >= today()} style={{ flexShrink: 0 }}>
          <SvgChevron dir="right" />
        </button>
      </div>

      {/* Summary hero card */}
      <div style={{ margin: '0 var(--space-4) var(--space-4)' }}>
        <div style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          {/* Neto principal */}
          <div style={{ padding: 'var(--space-5) var(--space-5) var(--space-4)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-2)' }}>
              Resultado neto
            </div>
            <div style={{
              fontSize: 'clamp(28px, 8vw, 40px)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: neto >= 0 ? 'var(--success)' : 'var(--danger)',
              lineHeight: 1,
            }}>
              {formatCurrency(neto)}
            </div>
          </div>

          {/* Cobrado / Gastos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ padding: 'var(--space-4) var(--space-5)', borderRight: '1px solid var(--border)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-1)' }}>Cobrado</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--success)', letterSpacing: '-0.02em' }}>{formatCurrency(totalCobros)}</div>
            </div>
            <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-1)' }}>Gastos</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: totalGastos > 0 ? 'var(--danger)' : 'var(--ink-3)', letterSpacing: '-0.02em' }}>{formatCurrency(totalGastos)}</div>
            </div>
          </div>

          {/* Desglose por medio */}
          {medios.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', display: 'flex' }}>
              {medios.map((m, i) => (
                <div key={m.label} style={{
                  flex: 1,
                  padding: 'var(--space-3) var(--space-4)',
                  borderRight: i < medios.length - 1 ? '1px solid var(--border)' : 'none',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{m.label}</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>{formatCurrency(m.value)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cobros list */}
      {cobrosDelDia.length > 0 && (
        <>
          <div className="section-label">Cobros ({cobrosDelDia.length})</div>
          <div className="list-section">
            {cobrosDelDia.map((p, i) => (
              <motion.div key={p.id} className="card" {...listItem(i)}>
                <div className="card-row">
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{clienteNombre(p.clienteId)}</span>
                    {!p.cobrado && (
                      <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: 'var(--ink-3)', background: 'var(--bg-3)', borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>parcial</span>
                    )}
                  </div>
                  <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: 'var(--text-base)', letterSpacing: '-0.01em' }}>{formatCurrency(montoCobrado(p))}</span>
                </div>
                <div className="card-row" style={{ marginTop: 'var(--space-1)' }}>
                  <span className="card-sub" style={{ flex: 1 }}>{p.items.map(it => `${it.nombre} x${it.cantidad}`).join(' · ')}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>{MEDIO_LABEL[p.medioPago] || p.medioPago}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Cobros sueltos list */}
      {sueltosDelDia.length > 0 && (
        <>
          <div className="section-label">Cobros sueltos ({sueltosDelDia.length})</div>
          <div className="list-section">
            {sueltosDelDia.map((c, i) => (
              <motion.div key={c.id} className="card" {...listItem(i)}>
                <div className="card-row">
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{c.descripcion}</span>
                  <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: 'var(--text-base)', letterSpacing: '-0.01em' }}>{formatCurrency(c.monto)}</span>
                </div>
                <div className="card-row" style={{ marginTop: 'var(--space-1)' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>
                    {MEDIO_LABEL[c.metodo] || (c.metodo ? c.metodo.charAt(0).toUpperCase() + c.metodo.slice(1) : '')}
                  </span>
                  {onDeleteCobro && (
                    <button
                      className="btn-icon danger"
                      aria-label="Eliminar cobro"
                      onClick={() => setConfirmDelCobro(c.id)}
                      style={{ width: 28, height: 28, minHeight: 28 }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Gastos list */}
      {gastosDelDia.length > 0 && (
        <>
          <div className="section-label">Gastos ({gastosDelDia.length})</div>
          <div className="list-section">
            {gastosDelDia.map((g, i) => (
              <motion.div key={g.id} className="card" {...listItem(i)}>
                <div className="card-row">
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{g.descripcion || 'Sin descripción'}</span>
                  <span style={{ fontWeight: 800, color: 'var(--danger)', fontSize: 'var(--text-sm)', letterSpacing: '-0.01em' }}>−{formatCurrency(g.monto)}</span>
                </div>
                {g.categoria && <span className="card-sub">{g.categoria}</span>}
              </motion.div>
            ))}
          </div>
        </>
      )}

      {cobrosDelDia.length === 0 && sueltosDelDia.length === 0 && gastosDelDia.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          <p>Sin movimientos para este día.</p>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelCobro}
        title="Eliminar cobro"
        message="¿Eliminar este cobro suelto? Esta acción no se puede deshacer."
        onConfirm={() => { onDeleteCobro(confirmDelCobro); setConfirmDelCobro(null); }}
        onCancel={() => setConfirmDelCobro(null)}
      />
    </>
  );
}
