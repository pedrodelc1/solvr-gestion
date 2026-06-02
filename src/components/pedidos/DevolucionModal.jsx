import { useState } from 'react';
import { Modal } from '../shared/Modal.jsx';
import { formatCurrency, today } from '../../lib/utils.js';
import { saveDevolucion } from '../../lib/db.js';

export function DevolucionModal({ open, pedido, clienteId, onClose, onGuardada, toast }) {
  const [fecha, setFecha] = useState(today());
  const [motivo, setMotivo] = useState('');
  const [cantidades, setCantidades] = useState({});
  const [saving, setSaving] = useState(false);

  if (!pedido) return null;

  function setCant(itemIdx, val) {
    setCantidades(prev => ({ ...prev, [itemIdx]: Math.min(pedido.items[itemIdx].cantidad, Math.max(0, parseInt(val) || 0)) }));
  }

  const itemsDevolucion = pedido.items
    .map((item, i) => ({ ...item, cantDev: cantidades[i] || 0 }))
    .filter(item => item.cantDev > 0);

  const montoTotal = itemsDevolucion.reduce((s, i) => s + i.precioUnitario * i.cantDev, 0);

  async function handleGuardar() {
    if (!itemsDevolucion.length) { toast('Seleccioná al menos un ítem', 'error'); return; }
    setSaving(true);
    try {
      await saveDevolucion({
        pedidoId: pedido.id,
        clienteId,
        fecha,
        motivo: motivo.trim() || null,
        montoTotal,
        items: itemsDevolucion.map(i => ({
          productoId: i.productoId || null,
          nombre: i.nombre,
          cantidad: i.cantDev,
          precioUnitario: i.precioUnitario,
        })),
      });
      toast('Devolución registrada');
      setCantidades({});
      setMotivo('');
      onGuardada?.();
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Registrar devolución" onClose={onClose}>
      {open && (
        <>
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label>Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>

            <div>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--ink-2)', display: 'block', marginBottom: 'var(--space-2)' }}>
                Ítems a devolver
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {pedido.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ flex: 1, fontSize: 'var(--text-sm)' }}>{item.nombre}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', flexShrink: 0 }}>máx. {item.cantidad}</span>
                    <input
                      type="number"
                      min="0"
                      max={item.cantidad}
                      step="1"
                      value={cantidades[i] || ''}
                      onChange={e => setCant(i, e.target.value)}
                      style={{ width: 64, minHeight: 36, textAlign: 'center', fontSize: 'var(--text-sm)' }}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            {montoTotal > 0 && (
              <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: 'var(--text-sm)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-3)' }}>Nota de crédito</span>
                <span style={{ fontWeight: 700, color: 'var(--success)' }}>−{formatCurrency(montoTotal)}</span>
              </div>
            )}

            <div className="form-group">
              <label>Motivo <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(opcional)</span></label>
              <input type="text" placeholder="Ej: producto defectuoso" value={motivo} onChange={e => setMotivo(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)', paddingTop: 0 }}>
            <button className="btn btn-primary btn-full" onClick={handleGuardar} disabled={saving || !itemsDevolucion.length}>
              {saving ? 'Guardando...' : 'Registrar devolución'}
            </button>
            <button className="btn btn-secondary btn-full" onClick={onClose}>Cancelar</button>
          </div>
        </>
      )}
    </Modal>
  );
}
