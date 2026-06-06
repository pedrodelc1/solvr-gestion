import { useState, useEffect } from 'react';
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

const opt = <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 'var(--text-xs)' }}> (opcional)</span>;

export function ClienteForm({ open, existing, onSave, onClose }) {
  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [email, setEmail] = useState('');
  const [direccion, setDireccion] = useState('');
  const [tipoPrecio, setTipoPrecio] = useState('minorista');
  const [saldoInicial, setSaldoInicial] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setNombre(existing.nombre || '');
      setContacto(existing.contacto || '');
      setEmail(existing.email || '');
      setDireccion(existing.direccion || '');
      setTipoPrecio(existing.tipo_precio || 'minorista');
      setSaldoInicial(existing.saldo_inicial || '');
    } else {
      const d = loadDraft();
      setNombre(d?.nombre || '');
      setContacto(d?.contacto || '');
      setEmail(d?.email || '');
      setDireccion(d?.direccion || '');
      setTipoPrecio(d?.tipoPrecio || 'minorista');
      setSaldoInicial(d?.saldoInicial || '');
    }
    setError('');
  }, [open, existing]);

  function ds() {
    return { nombre, contacto, email, direccion, tipoPrecio, saldoInicial };
  }

  function handleSave() {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    let contactoLimpio = contacto.replace(/\D/g, '');
    if (contactoLimpio.startsWith('54')) contactoLimpio = contactoLimpio.slice(2);
    if (contactoLimpio.length === 11 && contactoLimpio.startsWith('9')) contactoLimpio = contactoLimpio.slice(1);

    clearDraft();
    onSave({
      ...existing,
      nombre: nombre.trim(),
      contacto: contactoLimpio,
      email: email.trim(),
      direccion: direccion.trim(),
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
                onChange={e => { setNombre(e.target.value); if (!existing) saveDraft({ ...ds(), nombre: e.target.value }); }}
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="words"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="fc-contacto">Teléfono {opt}</label>
              <input
                id="fc-contacto"
                type="tel"
                placeholder="sin +54 9 ni guiones"
                value={contacto}
                onChange={e => { setContacto(e.target.value); if (!existing) saveDraft({ ...ds(), contacto: e.target.value }); }}
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label htmlFor="fc-email">Email {opt}</label>
              <input
                id="fc-email"
                type="email"
                placeholder="cliente@email.com"
                value={email}
                onChange={e => { setEmail(e.target.value); if (!existing) saveDraft({ ...ds(), email: e.target.value }); }}
                autoComplete="off"
                autoCapitalize="none"
              />
            </div>
            <div className="form-group">
              <label htmlFor="fc-direccion">Dirección {opt}</label>
              <input
                id="fc-direccion"
                type="text"
                placeholder="Calle 123, ciudad"
                value={direccion}
                onChange={e => { setDireccion(e.target.value); if (!existing) saveDraft({ ...ds(), direccion: e.target.value }); }}
                autoComplete="off"
                autoCorrect="off"
              />
            </div>
            {!existing && (
              <div className="form-group">
                <label htmlFor="fc-saldo">Saldo previo {opt}</label>
                <input
                  id="fc-saldo"
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  min="0"
                  value={saldoInicial}
                  onChange={e => { setSaldoInicial(e.target.value); if (!existing) saveDraft({ ...ds(), saldoInicial: e.target.value }); }}
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
                  onClick={() => { setTipoPrecio('minorista'); if (!existing) saveDraft({ ...ds(), tipoPrecio: 'minorista' }); }}
                >
                  Minorista
                </button>
                <button
                  type="button"
                  className={`filter-chip${tipoPrecio === 'mayorista' ? ' active' : ''}`}
                  style={{ flex: 1, minHeight: 40 }}
                  onClick={() => { setTipoPrecio('mayorista'); if (!existing) saveDraft({ ...ds(), tipoPrecio: 'mayorista' }); }}
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
