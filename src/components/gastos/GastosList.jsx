import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency, formatDate } from '../../lib/utils.js';
import { ConfirmModal } from '../shared/Modal.jsx';

export function GastosList({ gastos, categorias, onNew, onDelete, toast }) {
  const [filter, setFilter] = useState('all');
  const [confirmDel, setConfirmDel] = useState(null);

  const filtered = [...gastos]
    .filter(g => filter === 'all' || g.categoria === filter)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  function handleDelete(id) {
    onDelete(id);
    setConfirmDel(null);
    toast('Gasto eliminado');
  }

  return (
    <>
      <div className="page-header">
        <h1>Gastos</h1>
        <button className="btn-icon" onClick={onNew} aria-label="Agregar gasto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="filter-bar">
        <button
          className={`filter-chip${filter === 'all' ? ' active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Todos
        </button>
        {categorias.map(cat => (
          <button
            key={cat}
            className={`filter-chip${filter === cat ? ' active' : ''}`}
            onClick={() => setFilter(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="list-section">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="4" width="22" height="16" rx="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            <p>Sin gastos en esta categoría.</p>
          </div>
        ) : (
          filtered.map((g, i) => (
            <motion.div
              key={g.id}
              className="card"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
            >
              <div className="card-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{g.descripcion}</div>
                  <div className="card-sub" style={{ marginTop: 2 }}>
                    {formatDate(g.fecha)} · <span className="badge badge-neutral">{g.categoria}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span className="card-amount amount-debt">{formatCurrency(g.monto)}</span>
                  <button
                    className="btn-icon danger"
                    aria-label="Eliminar"
                    onClick={() => setConfirmDel(g.id)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <ConfirmModal
        open={!!confirmDel}
        title="Eliminar gasto"
        message="¿Eliminar este gasto? Esta acción no se puede deshacer."
        onConfirm={() => handleDelete(confirmDel)}
        onCancel={() => setConfirmDel(null)}
      />
    </>
  );
}
