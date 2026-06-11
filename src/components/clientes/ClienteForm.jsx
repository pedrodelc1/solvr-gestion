import { useState, useEffect, useRef } from 'react';
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
  const [fotoUrl, setFotoUrl] = useState('');
  const [hoverFoto, setHoverFoto] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    savingRef.current = false;
    if (existing) {
      setNombre(existing.nombre || '');
      setContacto(existing.contacto || '');
      setEmail(existing.email || '');
      setDireccion(existing.direccion || '');
      setTipoPrecio(existing.tipo_precio || 'minorista');
      setSaldoInicial(existing.saldo_inicial || '');
      setFotoUrl(existing.foto_url || '');
    } else {
      const d = loadDraft();
      setNombre(d?.nombre || '');
      setContacto(d?.contacto || '');
      setEmail(d?.email || '');
      setDireccion(d?.direccion || '');
      setTipoPrecio(d?.tipoPrecio || 'minorista');
      setSaldoInicial(d?.saldoInicial || '');
      setFotoUrl(d?.fotoUrl || '');
    }
    setError('');
  }, [open, existing]);

  function ds() {
    return { nombre, contacto, email, direccion, tipoPrecio, saldoInicial, fotoUrl };
  }

  function handleFotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 120;
        const MAX_HEIGHT = 120;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setFotoUrl(dataUrl);
        if (!existing) {
          saveDraft({ ...ds(), fotoUrl: dataUrl });
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (savingRef.current) return;
    if (!nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('El email no tiene un formato válido');
      return;
    }
    const saldoNum = saldoInicial === '' ? 0 : parseFloat(saldoInicial);
    if (isNaN(saldoNum) || saldoNum < 0) {
      setError('El saldo previo debe ser un número mayor o igual a cero');
      return;
    }
    let contactoLimpio = contacto.replace(/\D/g, '');
    if (contactoLimpio.startsWith('54')) contactoLimpio = contactoLimpio.slice(2);
    if (contactoLimpio.length === 11 && contactoLimpio.startsWith('9')) contactoLimpio = contactoLimpio.slice(1);

    savingRef.current = true;
    setSaving(true);
    try {
      await onSave({
        ...existing,
        nombre: nombre.trim(),
        contacto: contactoLimpio,
        email: email.trim(),
        direccion: direccion.trim(),
        tipo_precio: tipoPrecio,
        saldo_inicial: saldoNum || 0,
        foto_url: fotoUrl || null,
      });
      clearDraft();
    } catch (e) {
      setError(e.message);
      savingRef.current = false;
      setSaving(false);
    }
  }

  function handleClose() {
    clearDraft();
    onClose();
  }

  return (
    <Modal
      open={open}
      title={existing ? 'Editar cliente' : 'Nuevo cliente'}
      onClose={saving ? () => {} : handleClose}
    >
      {open && (
        <>
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Foto del Cliente */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <div 
                style={{ position: 'relative', width: 72, height: 72 }}
                onMouseEnter={() => !saving && setHoverFoto(true)}
                onMouseLeave={() => !saving && setHoverFoto(false)}
              >
                <div
                  onClick={() => !saving && document.getElementById('cliente-foto-upload').click()}
                  style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    background: fotoUrl ? 'none' : 'var(--bg-3)',
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, fontWeight: 700, color: 'var(--ink-3)',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {fotoUrl ? (
                    <img src={fotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Foto cliente" />
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  )}
                  
                  {!saving && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.5)',
                      opacity: hoverFoto ? 1 : 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'opacity 0.2s',
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                    </div>
                  )}
                </div>

                {fotoUrl && hoverFoto && !saving && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFotoUrl('');
                      if (!existing) {
                        saveDraft({ ...ds(), fotoUrl: '' });
                      }
                    }}
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: 'var(--danger)',
                      color: '#fff',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 700,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                      zIndex: 10,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>Foto del Cliente (opcional)</span>
              <input
                type="file"
                id="cliente-foto-upload"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFotoChange}
                disabled={saving}
              />
            </div>

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
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
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
                  disabled={saving}
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
                  disabled={saving}
                >
                  Minorista
                </button>
                <button
                  type="button"
                  className={`filter-chip${tipoPrecio === 'mayorista' ? ' active' : ''}`}
                  style={{ flex: 1, minHeight: 40 }}
                  onClick={() => { setTipoPrecio('mayorista'); if (!existing) saveDraft({ ...ds(), tipoPrecio: 'mayorista' }); }}
                  disabled={saving}
                >
                  Mayorista
                </button>
              </div>
            </div>
            {error && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{error}</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)', paddingTop: 0 }}>
            <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button className="btn btn-secondary btn-full" onClick={handleClose} disabled={saving}>Cancelar</button>
          </div>
        </>
      )}
    </Modal>
  );
}
