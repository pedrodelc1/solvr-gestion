import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../../lib/utils.js';
import { ConfirmModal } from '../shared/Modal.jsx';

export function ProductosList({ productos, onNew, onEdit, onDelete, toast }) {
  const [confirmDel, setConfirmDel] = useState(null);

  function handleDelete(id) {
    onDelete(id);
    setConfirmDel(null);
    toast('Producto eliminado');
  }

  return (
    <>
      <div className="page-header">
        <h1>Catálogo</h1>
        <button className="btn-icon" onClick={onNew} aria-label="Agregar producto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="list-section">
        {productos.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <p>Sin productos. Tocá + para agregar.</p>
          </div>
        ) : (
          productos.map((p, i) => {
            const margen = p.costo ? p.precio - p.costo : null;
            return (
              <motion.div
                key={p.id}
                className="card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
              >
                <div className="card-row">
                  <span style={{ fontWeight: 600, flex: 1, overflowWrap: 'anywhere' }}>{p.nombre}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span className="card-amount amount-neutral">{formatCurrency(p.precio)}</span>
                    <button
                      className="btn-icon"
                      aria-label="Editar"
                      onClick={() => onEdit(p)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      className="btn-icon danger"
                      aria-label="Eliminar"
                      onClick={() => setConfirmDel(p.id)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
                {p.costo > 0 && (
                  <div className="card-sub">
                    Costo: {formatCurrency(p.costo)} · Ganancia:{' '}
                    <span style={{ color: margen >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {formatCurrency(margen)}
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      <ConfirmModal
        open={!!confirmDel}
        title="Eliminar producto"
        message="¿Eliminar este producto? Esta acción no se puede deshacer."
        onConfirm={() => handleDelete(confirmDel)}
        onCancel={() => setConfirmDel(null)}
      />
    </>
  );
}
