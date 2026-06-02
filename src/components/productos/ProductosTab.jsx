import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../../lib/utils.js';
import { Modal, ConfirmModal } from '../shared/Modal.jsx';

function ProductoForm({ producto, onSave, onCancel }) {
  const [nombre, setNombre] = useState(producto?.nombre || '');
  const [precio, setPrecio] = useState(producto?.precio ? String(producto.precio) : '');
  const [costo, setCosto] = useState(producto?.costo ? String(producto.costo) : '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nombre.trim() || !precio) return;
    setSaving(true);
    await onSave({
      ...producto,
      nombre: nombre.trim(),
      precio: Number(precio),
      costo: Number(costo) || 0,
    });
    setSaving(false);
    onCancel();
  }

  const margen = precio && costo
    ? Math.round(((Number(precio) - Number(costo)) / Number(precio)) * 100)
    : null;

  return (
    <form className="form-wrap" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Nombre del producto *</label>
        <input
          type="text"
          placeholder="Ej: Alfajores x12"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Precio de venta ($) *</label>
          <input
            type="number"
            min="0"
            placeholder="0"
            value={precio}
            onChange={e => setPrecio(e.target.value)}
            inputMode="numeric"
            required
          />
        </div>
        <div className="form-group">
          <label>Costo ($)</label>
          <input
            type="number"
            min="0"
            placeholder="0"
            value={costo}
            onChange={e => setCosto(e.target.value)}
            inputMode="numeric"
          />
        </div>
      </div>
      {margen !== null && (
        <div className="card" style={{ padding: 'var(--space-3) var(--space-4)', gap: 'var(--space-1)' }}>
          <div className="card-row">
            <span className="card-sub">Ganancia bruta</span>
            <span className={`card-amount ${margen >= 0 ? 'amount-paid' : 'amount-debt'}`}>
              {formatCurrency(Number(precio) - Number(costo))} ({margen}%)
            </span>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <button type="submit" className="btn btn-primary btn-full" disabled={saving || !nombre.trim() || !precio}>
          {saving ? 'Guardando...' : producto?.id ? 'Guardar cambios' : 'Agregar producto'}
        </button>
        <button type="button" className="btn btn-secondary btn-full" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function ProductosTab({ productos, onSave, onDelete }) {
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const q = query.toLowerCase();
  const filtered = productos.filter(p =>
    !q || p.nombre.toLowerCase().includes(q)
  );

  function handleNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function handleEdit(p) {
    setEditing(p);
    setFormOpen(true);
  }

  return (
    <>
      <div className="page-header">
        <h1>Catálogo</h1>
        <button className="btn-icon" onClick={handleNew} aria-label="Agregar producto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="search-bar">
        <input
          type="search"
          placeholder="Buscar producto..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="list-section">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <p>{q ? `Sin resultados para "${q}"` : 'Sin productos. Tocá + para agregar.'}</p>
          </div>
        ) : (
          filtered.map((p, i) => {
            const margen = p.costo && p.precio
              ? Math.round(((p.precio - p.costo) / p.precio) * 100)
              : null;
            return (
              <motion.div
                key={p.id}
                className="card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
              >
                <div className="card-row">
                  <span className="card-name" style={{ fontSize: 'var(--text-base)' }}>{p.nombre}</span>
                  <span className="card-amount amount-neutral">{formatCurrency(p.precio)}</span>
                </div>
                <div className="card-row">
                  <span className="card-sub">
                    Costo: {formatCurrency(p.costo || 0)}
                    {margen !== null && (
                      <span style={{ marginLeft: 'var(--space-2)' }}>
                        · Margen{' '}
                        <span style={{ color: margen >= 30 ? 'var(--color-success)' : 'var(--danger)' }}>
                          {margen}%
                        </span>
                      </span>
                    )}
                  </span>
                  <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                    <button
                      className="btn-icon"
                      onClick={() => handleEdit(p)}
                      aria-label="Editar"
                      style={{ minHeight: 32, minWidth: 32 }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      className="btn-icon danger"
                      onClick={() => setConfirmId(p.id)}
                      aria-label="Eliminar"
                      style={{ minHeight: 32, minWidth: 32 }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <Modal
        open={formOpen}
        title={editing ? 'Editar producto' : 'Nuevo producto'}
        onClose={() => setFormOpen(false)}
      >
        {formOpen && (
          <ProductoForm
            producto={editing}
            onSave={onSave}
            onCancel={() => setFormOpen(false)}
          />
        )}
      </Modal>

      <ConfirmModal
        open={!!confirmId}
        title="Eliminar producto"
        message="¿Eliminar este producto? Los pedidos existentes no se modifican."
        onConfirm={async () => {
          await onDelete(confirmId);
          setConfirmId(null);
        }}
        onCancel={() => setConfirmId(null)}
      />
    </>
  );
}
