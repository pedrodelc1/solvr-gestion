import { useState } from 'react';
import { Modal } from '../shared/Modal.jsx';

export function ClienteForm({ open, existing, onSave, onClose }) {
  const [nombre, setNombre] = useState(existing?.nombre || '');
  const [contacto, setContacto] = useState(existing?.contacto || '');
  const [tipoPrecio, setTipoPrecio] = useState(existing?.tipo_precio || 'minorista');
  const [error, setError] = useState('');

  function handleOpen() {
    setNombre(existing?.nombre || '');
    setContacto(existing?.contacto || '');
    setTipoPrecio(existing?.tipo_precio || 'minorista');
    setError('');
  }

  function handleSave() {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    onSave({ ...existing, nombre: nombre.trim(), contacto: contacto.trim(), tipo_precio: tipoPrecio });
  }

  return (
    <Modal
      open={open}
      title={existing ? 'Editar cliente' : 'Nuevo cliente'}
      onClose={onClose}
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
                onChange={e => setNombre(e.target.value)}
                autoCorrect="off"
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
                onChange={e => setContacto(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Tipo de precio</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className={`filter-chip${tipoPrecio === 'minorista' ? ' active' : ''}`}
                  style={{ flex: 1, minHeight: 40 }}
                  onClick={() => setTipoPrecio('minorista')}
                >
                  Minorista
                </button>
                <button
                  type="button"
                  className={`filter-chip${tipoPrecio === 'mayorista' ? ' active' : ''}`}
                  style={{ flex: 1, minHeight: 40 }}
                  onClick={() => setTipoPrecio('mayorista')}
                >
                  Mayorista
                </button>
              </div>
            </div>
            {error && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{error}</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)', paddingTop: 0 }}>
            <button className="btn btn-primary btn-full" onClick={handleSave}>Guardar</button>
            <button className="btn btn-secondary btn-full" onClick={onClose}>Cancelar</button>
          </div>
        </>
      )}
    </Modal>
  );
}
