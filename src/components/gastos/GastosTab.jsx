import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency, formatDate, today } from '../../lib/utils.js';
import { Modal, ConfirmModal } from '../shared/Modal.jsx';

function GastoForm({ categorias, onSave, onCancel }) {
  const [fecha, setFecha] = useState(today());
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState(categorias[0] || '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!descripcion.trim() || !monto) return;
    setSaving(true);
    await onSave({ fecha, descripcion: descripcion.trim(), monto: Number(monto), categoria });
    setSaving(false);
  }

  return (
    <form className="form-wrap" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Descripción</label>
        <input
          type="text"
          placeholder="Ej: Compra mercadería"
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Monto ($)</label>
          <input
            type="number"
            min="1"
            placeholder="0"
            value={monto}
            onChange={e => setMonto(e.target.value)}
            inputMode="numeric"
            required
          />
        </div>
        <div className="form-group">
          <label>Categoría</label>
          <select value={categoria} onChange={e => setCategoria(e.target.value)}>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Fecha</label>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <button type="submit" className="btn btn-primary btn-full" disabled={saving || !descripcion.trim() || !monto}>
          {saving ? 'Guardando...' : 'Registrar gasto'}
        </button>
        <button type="button" className="btn btn-secondary btn-full" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function CatsForm({ categorias, onSave, onCancel }) {
  const [cats, setCats] = useState([...categorias]);
  const [newCat, setNewCat] = useState('');
  const [saving, setSaving] = useState(false);

  function add() {
    const t = newCat.trim();
    if (!t || cats.includes(t)) return;
    setCats(arr => [...arr, t]);
    setNewCat('');
  }

  function remove(c) { setCats(arr => arr.filter(x => x !== c)); }

  async function handleSave() {
    setSaving(true);
    await onSave(cats);
    setSaving(false);
    onCancel();
  }

  return (
    <div className="form-wrap">
      <div className="form-group">
        <label>Nueva categoría</label>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input
            type="text"
            placeholder="Nombre"
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          />
          <button type="button" className="btn btn-secondary" onClick={add}>Agregar</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {cats.map(c => (
          <div key={c} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
            background: 'var(--color-bg-3)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-full)', padding: '4px var(--space-3)',
            fontSize: 'var(--text-sm)',
          }}>
            {c}
            <button
              type="button"
              onClick={() => remove(c)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', lineHeight: 1 }}
            >×</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar categorías'}
        </button>
        <button className="btn btn-secondary btn-full" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

export function GastosTab({ gastos, categorias, onSaveGasto, onDeleteGasto, onSaveCategorias }) {
  const [newOpen, setNewOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [filtrocat, setFiltrocat] = useState('todos');

  const filtered = filtrocat === 'todos'
    ? gastos
    : gastos.filter(g => g.categoria === filtrocat);

  const total = filtered.reduce((s, g) => s + g.monto, 0);

  return (
    <>
      <div className="page-header">
        <h1>Gastos</h1>
        <button className="btn-icon" onClick={() => setCatsOpen(true)} aria-label="Categorías">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>
        <button className="btn-icon" onClick={() => setNewOpen(true)} aria-label="Nuevo gasto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="filter-bar">
        <button
          className={`filter-chip${filtrocat === 'todos' ? ' active' : ''}`}
          onClick={() => setFiltrocat('todos')}
        >
          Todos
        </button>
        {categorias.map(c => (
          <button
            key={c}
            className={`filter-chip${filtrocat === c ? ' active' : ''}`}
            onClick={() => setFiltrocat(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--color-bg-2)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', fontWeight: 500 }}>
          Total {filtrocat !== 'todos' ? filtrocat : ''}
        </span>
        <span className="card-amount amount-debt">{formatCurrency(total)}</span>
      </div>

      <div className="list-section">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="4" width="22" height="16" rx="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            <p>Sin gastos registrados.</p>
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
                <span className="card-name" style={{ fontSize: 'var(--text-base)' }}>{g.descripcion}</span>
                <span className="card-amount amount-debt">{formatCurrency(g.monto)}</span>
              </div>
              <div className="card-row">
                <span className="card-sub">{formatDate(g.fecha)}</span>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span className="badge badge-neutral">{g.categoria}</span>
                  <button
                    className="btn-icon danger"
                    onClick={() => setConfirmId(g.id)}
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
          ))
        )}
      </div>

      <Modal open={newOpen} title="Nuevo gasto" onClose={() => setNewOpen(false)}>
        {newOpen && (
          <GastoForm
            categorias={categorias}
            onSave={async (data) => {
              await onSaveGasto(data);
              setNewOpen(false);
            }}
            onCancel={() => setNewOpen(false)}
          />
        )}
      </Modal>

      <Modal open={catsOpen} title="Categorías" onClose={() => setCatsOpen(false)}>
        {catsOpen && (
          <CatsForm
            categorias={categorias}
            onSave={onSaveCategorias}
            onCancel={() => setCatsOpen(false)}
          />
        )}
      </Modal>

      <ConfirmModal
        open={!!confirmId}
        title="Eliminar gasto"
        message="¿Eliminar este gasto?"
        onConfirm={async () => {
          await onDeleteGasto(confirmId);
          setConfirmId(null);
        }}
        onCancel={() => setConfirmId(null)}
      />
    </>
  );
}
