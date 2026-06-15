import { useState, useRef, useEffect } from 'react';
import { Modal } from '../shared/Modal.jsx';
import { today } from '../../lib/utils.js';

export function CobroForm({ open, clientes = [], metodos, onSave, onClose }) {
  const [clienteId, setClienteId] = useState('');
  const [desc, setDesc] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(today());
  const [metodo, setMetodo] = useState(metodos[0] || 'efectivo');
  const [error, setError] = useState('');

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setSaving(false);
      savingRef.current = false;
      setMetodo(metodos[0] || 'efectivo');
    }
  }, [open, metodos]);

  const clientesOrdenados = [...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const clienteNombre = clientes.find(c => c.id === clienteId)?.nombre || '';

  function validar(finalDesc) {
    const m = parseFloat(monto);
    if (!finalDesc.trim()) return 'Ingresá un concepto o elegí un cliente';
    if (finalDesc.trim().length > 300) return 'El concepto es demasiado largo (máx. 300)';
    if (isNaN(m) || m <= 0) return 'Ingresá un monto mayor a cero';
    if (!fecha) return 'Elegí una fecha';
    if (fecha > today()) return 'La fecha no puede ser futura';
    if (!metodo.trim()) return 'Elegí un método de cobro';
    return null;
  }

  async function handleSave() {
    if (savingRef.current) return;
    const finalDesc = desc.trim() || (clienteId ? `Cobro de saldo — ${clienteNombre}` : '');
    const err = validar(finalDesc);
    if (err) { setError(err); return; }
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave({ descripcion: finalDesc, monto: parseFloat(monto), fecha, metodo, clienteId: clienteId || null });
      setClienteId('');
      setDesc('');
      setMonto('');
      setFecha(today());
      setError('');
    } catch (e) {
      setError(e.message);
      savingRef.current = false;
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setError('');
    onClose();
  }

  return (
    <Modal open={open} title="Registrar cobro" onClose={saving ? () => {} : handleClose}>
      {open && (
        <>
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-2)', lineHeight: 1.4, margin: 0 }}>
              Registrá un pago que recibís. Si es de un cliente (ej. saldo pendiente o importado), elegilo y se descontará de lo que te debe.
            </p>

            <div className="form-group">
              <label htmlFor="fc-cliente">Cliente</label>
              <select
                id="fc-cliente"
                value={clienteId}
                onChange={e => setClienteId(e.target.value)}
                disabled={saving}
              >
                <option value="">Sin cliente (mostrador / suelto)</option>
                {clientesOrdenados.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="fc-desc">Concepto {clienteId ? '(opcional)' : ''}</label>
              <input
                id="fc-desc"
                type="text"
                placeholder={clienteId ? 'Pago de saldo pendiente' : 'Ej: seña, venta de mostrador...'}
                value={desc}
                onChange={e => setDesc(e.target.value)}
                maxLength={300}
                autoCorrect="off"
                disabled={saving}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fc-monto">Monto ($)</label>
                <input
                  id="fc-monto"
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  min="0"
                  step="0.01"
                  value={monto}
                  onChange={e => setMonto(e.target.value)}
                  disabled={saving}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="fc-fecha">Fecha</label>
                <input
                  id="fc-fecha"
                  type="date"
                  value={fecha}
                  max={today()}
                  onChange={e => setFecha(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Método de cobro</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {metodos.map(m => (
                  <button
                    key={m}
                    type="button"
                    className={`filter-chip${metodo === m ? ' active' : ''}`}
                    style={{ flex: 1, minHeight: 40, whiteSpace: 'nowrap' }}
                    onClick={() => setMetodo(m)}
                    disabled={saving}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>{error}</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)', paddingTop: 0 }}>
            <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Registrar cobro'}
            </button>
            <button className="btn btn-secondary btn-full" onClick={handleClose} disabled={saving}>Cancelar</button>
          </div>
        </>
      )}
    </Modal>
  );
}
