import { useState, useRef, useEffect } from 'react';
import { Modal } from '../shared/Modal.jsx';
import { today } from '../../lib/utils.js';

function ClienteSearchSelect({ clientes, value, onChange, disabled }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const blurTimer = useRef(null);

  const selected = clientes.find(c => c.id === value) || null;
  const ordenados = [...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const q = query.trim().toLowerCase();
  const filtrados = q
    ? ordenados.filter(c => c.nombre.toLowerCase().includes(q) || (c.contacto || '').includes(q))
    : ordenados;

  function pick(id) {
    onChange(id);
    setOpen(false);
    setQuery('');
  }

  // Cliente seleccionado: chip con opción de cambiar
  if (selected) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        minHeight: 48, padding: '0 8px 0 14px',
        background: 'var(--bg-3)', border: `1px solid var(--lime-border)`,
        borderRadius: 10,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: 'var(--lime-bg)', border: `1px solid var(--lime-border)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, color: 'var(--lime)',
        }}>
          {selected.nombre.charAt(0).toUpperCase()}
        </div>
        <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected.nombre}
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={() => { onChange(''); setQuery(''); setOpen(true); }}
            style={{
              flexShrink: 0, height: 32, padding: '0 12px', borderRadius: 8,
              background: 'none', border: '1px solid var(--border)',
              color: 'var(--ink-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Cambiar
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        placeholder="Buscar cliente por nombre o teléfono..."
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
        autoComplete="off"
        autoCorrect="off"
        disabled={disabled}
      />
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 20,
          background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12,
          maxHeight: 260, overflowY: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
        }}>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); clearTimeout(blurTimer.current); pick(''); }}
            style={{
              width: '100%', textAlign: 'left', padding: '11px 14px',
              background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
              color: 'var(--ink-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Sin cliente (mostrador / suelto)
          </button>
          {filtrados.length === 0 ? (
            <div style={{ padding: '14px', fontSize: 13, color: 'var(--ink-3)' }}>Sin resultados</div>
          ) : (
            filtrados.map(c => (
              <button
                key={c.id}
                type="button"
                onMouseDown={e => { e.preventDefault(); clearTimeout(blurTimer.current); pick(c.id); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px',
                  background: 'none', border: 'none',
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--bg-3)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, color: 'var(--ink-2)',
                }}>
                  {c.nombre.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</div>
                  {c.contacto && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{c.contacto}</div>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function CobroForm({ open, clientes = [], preClienteId = null, metodos, onSave, onClose }) {
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
      setClienteId(preClienteId || '');
    }
  }, [open, metodos, preClienteId]);

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
              <label>Cliente</label>
              <ClienteSearchSelect
                clientes={clientes}
                value={clienteId}
                onChange={setClienteId}
                disabled={saving}
              />
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
