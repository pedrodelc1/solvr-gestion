import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '../../lib/utils.js';
import { ConfirmModal, Modal } from '../shared/Modal.jsx';
import { ajustarStock } from '../../lib/db.js';

function StockBadge({ stock, stockMinimo }) {
  if (stock === 0) {
    return <span className="badge badge-warn">Sin stock</span>;
  }
  if (stock <= stockMinimo) {
    return <span className="badge" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>Stock bajo: {stock}</span>;
  }
  return <span className="badge badge-ok">Stock: {stock}</span>;
}

function AjusteStockModal({ open, producto, onClose, onAjustar }) {
  const [delta, setDelta] = useState('');
  const [tipo, setTipo] = useState('sumar');

  function handleConfirm() {
    const cantidad = parseInt(delta);
    if (isNaN(cantidad) || cantidad <= 0) return;
    onAjustar(producto.id, tipo === 'sumar' ? cantidad : -cantidad);
    setDelta('');
    setTipo('sumar');
    onClose();
  }

  return (
    <Modal open={open} title={`Ajustar stock — ${producto?.nombre}`} onClose={onClose}>
      {open && (
        <>
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                className={`filter-chip${tipo === 'sumar' ? ' active' : ''}`}
                style={{ flex: 1 }}
                onClick={() => setTipo('sumar')}
              >
                + Agregar
              </button>
              <button
                className={`filter-chip${tipo === 'restar' ? ' active' : ''}`}
                style={{ flex: 1 }}
                onClick={() => setTipo('restar')}
              >
                − Descontar
              </button>
            </div>
            <div className="form-group">
              <label>Cantidad</label>
              <input
                type="number"
                placeholder="0"
                min="1"
                step="1"
                value={delta}
                onChange={e => setDelta(e.target.value)}
                autoFocus
              />
            </div>
            {producto && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>
                Stock actual: <strong style={{ color: 'var(--ink)' }}>{producto.stock}</strong>
                {delta && !isNaN(parseInt(delta)) && (
                  <> → <strong style={{ color: tipo === 'sumar' ? 'var(--success)' : 'var(--danger)' }}>
                    {Math.max(0, producto.stock + (tipo === 'sumar' ? parseInt(delta) : -parseInt(delta)))}
                  </strong></>
                )}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)', paddingTop: 0 }}>
            <button className="btn btn-primary btn-full" onClick={handleConfirm} disabled={!delta || parseInt(delta) <= 0}>
              Confirmar ajuste
            </button>
            <button className="btn btn-secondary btn-full" onClick={onClose}>Cancelar</button>
          </div>
        </>
      )}
    </Modal>
  );
}

export function ProductosList({ productos, onNew, onEdit, onDelete, onStockChange, toast }) {
  const [confirmDel, setConfirmDel] = useState(null);
  const [ajusteModal, setAjusteModal] = useState(null);

  function handleDelete(id) {
    onDelete(id);
    setConfirmDel(null);
    toast('Producto eliminado');
  }

  async function handleAjuste(productoId, delta) {
    try {
      await ajustarStock(productoId, delta);
      if (onStockChange) onStockChange();
      toast(delta > 0 ? `+${delta} unidades agregadas` : `${Math.abs(delta)} unidades descontadas`);
    } catch (e) {
      toast(e.message, 'error');
    }
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
            const stockBajo = p.stock <= p.stock_minimo;
            return (
              <motion.div
                key={p.id}
                className="card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                style={stockBajo ? { borderColor: p.stock === 0 ? 'var(--danger)' : 'rgba(239,68,68,0.3)' } : {}}
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <StockBadge stock={p.stock} stockMinimo={p.stock_minimo} />
                    {p.costo > 0 && (
                      <span className="card-sub">
                        Ganancia:{' '}
                        <span style={{ color: margen >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {formatCurrency(margen)}
                        </span>
                      </span>
                    )}
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ minHeight: 32, padding: '0 var(--space-3)', fontSize: 'var(--text-xs)' }}
                    onClick={() => setAjusteModal(p)}
                  >
                    Ajustar stock
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <AjusteStockModal
        open={!!ajusteModal}
        producto={ajusteModal}
        onClose={() => setAjusteModal(null)}
        onAjustar={handleAjuste}
      />

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
