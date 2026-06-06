import { useState } from 'react';
import { Modal } from '../shared/Modal.jsx';

const DRAFT_KEY = 'draft_nuevo_cliente';

function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; }
}
function saveDraft(data) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch {}
}
function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

export function ClienteForm({ open, existing, onSave, onClose }) {
  const draft = !existing ? loadDraft() : null;

  const [nombre, setNombre] = useState(existing?.nombre || draft?.nombre || '');
  const [contacto, setContacto] = useState(existing?.contacto || draft?.contacto || '');
  const [tipoPrecio, setTipoPrecio] = useState(existing?.tipo_precio || draft?.tipoPrecio || 'minorista');
  const [saldoInicial, setSaldoInicial] = useState(existing?.saldo_inicial || draft?.saldoInicial || '');
  const [error, setError] = useState('');

  function handleOpen() {
    if (existing) {
      setNombre(existing.nombre || '');
      setContacto(existing.contacto || '');
      setTipoPrecio(existing.tipo_precio || 'minorista');
      setSaldoInicial(existing.saldo_inicial || '');
    } else {
      const d = loadDraft();
      setNombre(d?.nombre || '');
      setContacto(d?.contacto || '');
      setTipoPrecio(d?.tipoPrecio || 'minorista');
      setSaldoInicial(d?.saldoInicial || '');
    }
    setError('');
  }

  function handleNombre(val) {
    setNombre(val);
    if (!existing) saveDraft({ nombre: val, contacto, tipoPrecio, saldoInicial });
  }

  function handleContacto(val) {
    setContacto(val);
    if (!existing) saveDraft({ nombre, contacto: val, tipoPrecio, saldoInicial });
  }

  function handleTipoPrecio(val) {
    setTipoPrecio(val);
    if (!existing) saveDraft({ nombre, contacto, tipoPrecio: val, saldoInicial });
  }

  function handleSaldoInicial(val) {
    setSaldoInicial(val);
    if (!existing) saveDraft({ nombre, contacto, tipoPrecio, saldoInicial: val });
  }

  function handleSave() {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    clearDraft();
    onSave({
      ...existing,
      nombre: nombre.trim(),
      contacto: contacto.trim(),
      tipo_precio: tipoPrecio,
      saldo_inicial: parseFloat(saldoInicial) || 0,
    });
  }

  function handleClose() {
    clearDraft();
    onClose();
  }

  return (
    <Modal
      open={open}
      title={existing ? 'Editar cliente' : 'Nuevo cliente'}
      onClose={handleClose}
    >
      {open && (
        <>
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label htmlFor="fc-nombre">Nombre</label>
              <input
                id="fc-nombre"
                type="text"
                placeholder="Nombre completo"
                value={nombre}
                onChange={e => handleNombre(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="words"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="fc-contacto">Teléfono (sin +54)</label>
              <input
                id="fc-contacto"
                type="tel"
                placeholder="1123456789"
                value={contacto}
                onChange={e => handleContacto(e.target.value)}
                autoComplete="off"
              />
            </div>
            {!existing && (
              <div className="form-group">
                <label htmlFor="fc-saldo">Saldo previo (deuda anterior)</label>
                <input
                  id="fc-saldo"
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  min="0"
                  value={saldoInicial}
                  onChange={e => handleSaldoInicial(e.target.value)}
                  autoComplete="off"
                />
              </div>
            )}
            <div className="form-group">
              <label>Tipo de precio</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className={`filter-chip${tipoPrecio === 'minorista' ? ' active' : ''}`}
                  style={{ flex: 1, minHeight: 40 }}
                  onClick={() => handleTipoPrecio('minorista')}
                >
                  Minorista
                </button>
                <button
                  type="button"
                  className={`filter-chip${tipoPrecio === 'mayorista' ? ' active' : ''}`}
                  style={{ flex: 1, minHeight: 40 }}
                  onClick={() => handleTipoPrecio('mayorista')}
                >
                  Mayorista
                </button>
              </div>
            </div>
            {error && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{error}</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)', paddingTop: 0 }}>
            <button className="btn btn-primary btn-full" onClick={handleSave}>Guardar</button>
            <button className="btn btn-secondary btn-full" onClick={handleClose}>Cancelar</button>
          </div>
        </>
      )}
    </Modal>
  );
}
