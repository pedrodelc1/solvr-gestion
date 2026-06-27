import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, formatDate, today } from '../../lib/utils.js';
import { ConfirmModal } from '../shared/Modal.jsx';

export function GastosList({ gastos, categorias, onSave, onDelete, toast }) {
  const [filter, setFilter] = useState('all');
  const [confirmDel, setConfirmDel] = useState(null);
  const [open, setOpen] = useState(false);

  // Form state inline — sin modal ni await: el padre hace optimistic update.
  const [desc, setDesc] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(today());
  const [cat, setCat] = useState(categorias[0] || 'Otros');
  const [err, setErr] = useState('');
  const descRef = useRef(null);

  useEffect(() => {
    if (open) {
      setDesc(''); setMonto(''); setFecha(today()); setCat(categorias[0] || 'Otros'); setErr('');
      setTimeout(() => descRef.current?.focus(), 30);
    }
  }, [open]);

  const filtered = [...gastos]
    .filter(g => filter === 'all' || g.categoria === filter)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  function handleSubmit() {
    if (!desc.trim() || !fecha || isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) {
      setErr('Completá todos los campos');
      return;
    }
    onSave({ descripcion: desc.trim(), monto: parseFloat(monto), fecha, categoria: cat });
    setOpen(false);
  }

  function handleDelete(id) {
    onDelete(id);
    setConfirmDel(null);
    toast('Gasto eliminado');
  }

  return (
    <>
      <div className="page-header">
        <h1>Gastos</h1>
        <button className="btn-icon" onClick={() => setOpen(o => !o)} aria-label="Agregar gasto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: open ? 'rotate(45deg)' : 'none', transition: 'transform 120ms' }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="inline-form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <input
                ref={descRef}
                type="text"
                placeholder="Descripción (ej: nafta)"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                autoCorrect="off"
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <input
                  type="number"
                  placeholder="Monto ($)"
                  min="0"
                  value={monto}
                  onChange={e => setMonto(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
              </div>
              <select value={cat} onChange={e => setCat(e.target.value)}>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {err && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)', margin: 0 }}>{err}</p>}
              <button className="btn btn-primary btn-full" onClick={handleSubmit}>Guardar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.015, duration: 0.1 }}
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
