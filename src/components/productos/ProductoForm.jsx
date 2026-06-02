import { useState, useEffect } from 'react';
import { Modal } from '../shared/Modal.jsx';

export function ProductoForm({ open, existing, onSave, onClose }) {
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setNombre(existing?.nombre || '');
      setPrecio(existing?.precio != null ? String(existing.precio) : '');
      setCosto(existing?.costo != null ? String(existing.costo) : '');
      setError('');
    }
  }, [open, existing]);

  function handleSave() {
    if (!nombre.trim() || isNaN(parseFloat(precio)) || parseFloat(precio) < 0) {
      setError('Completá todos los campos');
      return;
    }
    onSave({
      ...existing,
      nombre: nombre.trim(),
      precio: parseFloat(precio),
      costo: parseFloat(costo) || 0,
    });
  }

  return (
    <Modal
      open={open}
      title={existing ? 'Editar producto' : 'Nuevo producto'}
      onClose={onClose}
    >
      {open && (
        <>
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label htmlFor="pp-nombre">Nombre</label>
              <input
                id="pp-nombre"
                type="text"
                placeholder="Nombre del producto"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                autoCorrect="off"
                autoFocus
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="pp-precio">Precio de venta ($)</label>
                <input
                  id="pp-precio"
                  type="number"
                  placeholder="0"
                  min="0"
                  value={precio}
                  onChange={e => setPrecio(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="pp-costo">Costo unitario ($)</label>
                <input
                  id="pp-costo"
                  type="number"
                  placeholder="0"
                  min="0"
                  value={costo}
                  onChange={e => setCosto(e.target.value)}
                />
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
