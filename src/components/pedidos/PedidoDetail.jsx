import { useState } from 'react';
import { formatCurrency, formatDate, saldoPedido } from '../../lib/utils.js';
import { ConfirmModal } from '../shared/Modal.jsx';
import { MedioPill } from '../shared/MedioPill.jsx';

export function PedidoDetail({ pedido, clientes, onBack, onUpdatePedido, onDeletePedido }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [abonoInput, setAbonoInput] = useState('');
  const [saving, setSaving] = useState(false);

  if (!pedido) return null;
  const cliente = clientes.find(c => c.id === pedido.clienteId);
  const saldo = saldoPedido(pedido);

  async function marcarCobrado() {
    setSaving(true);
    await onUpdatePedido(pedido.id, { cobrado: true, montoAbonado: pedido.totalFinal });
    setSaving(false);
  }

  async function registrarAbono() {
    const monto = Number(abonoInput);
    if (!monto || monto <= 0) return;
    const nuevoAbonado = (pedido.montoAbonado || 0) + monto;
    const cobradoAhora = nuevoAbonado >= pedido.totalFinal;
    setSaving(true);
    await onUpdatePedido(pedido.id, {
      montoAbonado: Math.min(nuevoAbonado, pedido.totalFinal),
      cobrado: cobradoAhora,
    });
    setAbonoInput('');
    setSaving(false);
  }

  async function handleDelete() {
    await onDeletePedido(pedido.id);
    setConfirmDel(false);
    onBack();
  }

  return (
    <>
      <div className="detail-header">
        <button className="btn-icon" onClick={onBack} aria-label="Volver">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2>Pedido del {formatDate(pedido.fecha)}</h2>
        <button className="btn-icon danger" onClick={() => setConfirmDel(true)} aria-label="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>

      <div className="saldo-box">
        <div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}>
            {cliente?.nombre}
          </div>
          <div className="card-row" style={{ marginTop: 4, gap: 'var(--space-2)' }}>
            <MedioPill medio={pedido.medioPago} cuotas={pedido.cuotas} />
            <span className={`badge ${pedido.cobrado ? 'badge-ok' : 'badge-warn'}`}>
              {pedido.cobrado ? 'Cobrado' : 'Pendiente'}
            </span>
          </div>
        </div>
        <div>
          <div className={`saldo-amount ${saldo > 0 ? 'amount-debt' : 'amount-paid'}`}>
            {formatCurrency(saldo)}
          </div>
          {saldo > 0 && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)', textAlign: 'right' }}>
              de {formatCurrency(pedido.totalFinal)}
            </div>
          )}
        </div>
      </div>

      <div className="section-label">Items</div>
      <div className="list-section" style={{ paddingTop: 'var(--space-3)' }}>
        {pedido.items.map((item, i) => (
          <div key={item.id || i} className="card-row" style={{ padding: '0 var(--space-4)' }}>
            <span className="card-sub" style={{ flex: 1 }}>{item.nombre} × {item.cantidad}</span>
            <span className="card-amount amount-neutral" style={{ fontSize: 'var(--text-base)' }}>
              {formatCurrency(item.precioUnitario * item.cantidad)}
            </span>
          </div>
        ))}
        {(Number(pedido.totalFinal) !== Number(pedido.totalCalculado)) && (
          <div className="card-row" style={{ padding: '0 var(--space-4)', marginTop: 'var(--space-2)' }}>
            <span className="card-sub" style={{ flex: 1 }}>Descuento</span>
            <span className="card-amount amount-debt">
              -{formatCurrency(pedido.totalCalculado - pedido.totalFinal)}
            </span>
          </div>
        )}
        <div className="card-row" style={{
          padding: 'var(--space-3) var(--space-4)',
          borderTop: '1px solid var(--color-border)',
          marginTop: 'var(--space-2)',
        }}>
          <span style={{ fontWeight: 700 }}>Total</span>
          <span className="card-amount amount-neutral">{formatCurrency(pedido.totalFinal)}</span>
        </div>
      </div>

      {!pedido.cobrado && (
        <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <button className="btn btn-primary btn-full" onClick={marcarCobrado} disabled={saving}>
            Marcar como cobrado
          </button>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input
              type="number"
              min="1"
              placeholder="Monto abono parcial"
              value={abonoInput}
              onChange={e => setAbonoInput(e.target.value)}
              inputMode="numeric"
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-secondary"
              onClick={registrarAbono}
              disabled={saving || !abonoInput}
            >
              Registrar
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmDel}
        title="Eliminar pedido"
        message="¿Eliminar este pedido? Esta acción no se puede deshacer."
        onConfirm={handleDelete}
        onCancel={() => setConfirmDel(false)}
      />
    </>
  );
}
