import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency, formatDate } from '../../lib/utils.js';
import { ConfirmModal, Modal } from '../shared/Modal.jsx';
import { listItem } from '../../lib/animations.js';
import { convertirPresupuesto } from '../../lib/db.js';

const SvgCard = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);

function MedioPill({ medio, cuotas }) {
  if (medio === 'efectivo') {
    return <span className="medio-pill medio-efectivo">💵 Efectivo</span>;
  }
  if (medio === 'transferencia') {
    return <span className="medio-pill medio-transferencia">🏦 Transf.</span>;
  }
  if (medio === 'tarjeta' || medio === 'fiado') {
    const label = cuotas && cuotas > 1 ? `${cuotas} cuotas` : 'Tarjeta';
    return (
      <span className="medio-pill medio-tarjeta" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <SvgCard />
        {label}
      </span>
    );
  }
  return <span className="medio-pill">{medio}</span>;
}

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'no-entregado', label: 'No entregado' },
  { id: 'entregado', label: 'Entregado' },
  { id: 'cobrado', label: 'Cobrados' },
  { id: 'presupuesto', label: 'Presupuestos' },
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transf.' },
  { id: 'tarjeta', label: 'Tarjeta' },
];

const SORTS = [
  { id: 'fecha-desc', label: 'Más nuevo primero', icon: '↓', hint: 'Fecha' },
  { id: 'fecha-asc',  label: 'Más antiguo primero', icon: '↑', hint: 'Fecha' },
  { id: 'precio-desc', label: 'Mayor $', icon: '↓', hint: '$' },
  { id: 'precio-asc',  label: 'Menor $', icon: '↑', hint: '$' },
];

const SORT_LABELS = {
  'fecha-desc':  'Más nuevo primero',
  'fecha-asc':   'Más antiguo primero',
  'precio-desc': 'Mayor precio primero',
  'precio-asc':  'Menor precio primero',
};

export function PedidosList({ pedidos, clientes, onNew, onUpdate, onDelete, onEdit, onMarcarEntregado, onRefresh, toast }) {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('fecha-desc');
  const [sortOpen, setSortOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pagoModal, setPagoModal] = useState(null);
  const [pagoMonto, setPagoMonto] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const [confirmConvertir, setConfirmConvertir] = useState(null);

  const filtered = [...pedidos]
    .sort((a, b) => {
      if (sort === 'fecha-desc') return (a.fetchOrder ?? 0) - (b.fetchOrder ?? 0);
      if (sort === 'fecha-asc')  return (b.fetchOrder ?? 0) - (a.fetchOrder ?? 0);
      const ta = a.totalFinal ?? a.totalCalculado;
      const tb = b.totalFinal ?? b.totalCalculado;
      return sort === 'precio-desc' ? tb - ta : ta - tb;
    })
    .filter(p => {
      const items = p.items || [];
      const todoEntregado = items.length > 0 && items.every(it => it.entregado);
      if (filter === 'no-entregado')  return p.tipo !== 'presupuesto' && !todoEntregado;
      if (filter === 'entregado')     return p.tipo !== 'presupuesto' && todoEntregado;
      if (filter === 'cobrado')       return p.cobrado;
      if (filter === 'presupuesto')   return p.tipo === 'presupuesto';
      if (filter === 'efectivo')      return p.medioPago === 'efectivo' && p.tipo !== 'presupuesto';
      if (filter === 'transferencia') return p.medioPago === 'transferencia' && p.tipo !== 'presupuesto';
      if (filter === 'tarjeta')       return (p.medioPago === 'tarjeta' || p.medioPago === 'fiado') && p.tipo !== 'presupuesto';
      return true;
    })
    .filter(p => !search || getNombre(p.clienteId).toLowerCase().includes(search.toLowerCase()));

  function getNombre(clienteId) {
    return clientes.find(c => c.id === clienteId)?.nombre || '—';
  }

  function handleToggle(p) {
    if (p.cobrado) {
      onUpdate(p.id, { cobrado: false, montoAbonado: 0 });
      toast('Pedido reabierto');
    } else {
      onUpdate(p.id, { cobrado: true, montoAbonado: p.totalFinal ?? p.totalCalculado });
      toast('Cobrado');
    }
  }

  function handlePagoSave() {
    const monto = parseFloat(pagoMonto);
    if (isNaN(monto) || monto <= 0) { toast('Ingresá un monto válido', 'error'); return; }
    const p = pedidos.find(x => x.id === pagoModal.pedidoId);
    if (!p) return;
    const nuevoAbonado = (p.montoAbonado || 0) + monto;
    const total = p.totalFinal ?? p.totalCalculado;
    onUpdate(p.id, nuevoAbonado >= total
      ? { cobrado: true, montoAbonado: total }
      : { montoAbonado: nuevoAbonado }
    );
    setPagoModal(null);
    setPagoMonto('');
    toast('Pago registrado');
  }

  function handleDelete(id) {
    onDelete(id);
    setConfirmDel(null);
    toast('Pedido eliminado');
  }

  async function handleConvertir(id) {
    try {
      await convertirPresupuesto(id);
      if (onRefresh) onRefresh();
      toast('Presupuesto convertido a pedido');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setConfirmConvertir(null);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Pedidos</h1>
        <button className="btn-icon" onClick={onNew} aria-label="Nuevo pedido">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="filter-bar">
        {FILTERS.map(f => (
          <button
            key={f.id}
            className={`filter-chip${filter === f.id ? ' active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="search-bar" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <div className="search-bar-wrapper" style={{ flex: 1 }}>
          <input
            type="search"
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
        <button
          onClick={() => setSortOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', minHeight: 40, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--ink-2)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/></svg>
          Ordenar
        </button>
      </div>

      <div className="list-section">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="2" />
            </svg>
            <p>Sin pedidos.</p>
          </div>
        ) : (
          filtered.map((p, i) => {
            const total = p.totalFinal ?? p.totalCalculado;
            const abonado = p.montoAbonado || 0;
            const resta = total - abonado;
            const esPresupuesto = p.tipo === 'presupuesto';
            const items = p.items || [];
            const todoEntregado = items.length > 0 && items.every(it => it.entregado);

            const estadoBadge = esPresupuesto
              ? <span className="badge badge-info">Presupuesto</span>
              : todoEntregado
                ? <span className="badge badge-ok">Entregado</span>
                : <span className="badge badge-neutral">No entregado</span>;

            const estadoMonto = esPresupuesto
              ? <span className="card-amount amount-neutral">{formatCurrency(total)}</span>
              : p.cobrado
                ? <span className="card-amount amount-paid">{formatCurrency(total)}</span>
                : <span className="card-amount amount-debt">{formatCurrency(resta > 0 ? resta : total)}</span>;

            return (
              <motion.div
                key={p.id}
                className="card"
                {...listItem(i)}
              >
                <div className="card-row">
                  <span className="card-name" style={{ fontSize: 'var(--text-base)' }}>
                    {getNombre(p.clienteId)}
                  </span>
                  {estadoMonto}
                </div>
                <div className="card-row">
                  <span className="card-sub">{formatDate(p.fecha)}</span>
                  <MedioPill medio={p.medioPago} cuotas={p.cuotas} />
                  {estadoBadge}
                </div>
                <div className="card-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {items.map(it => `${it.nombre} x${it.cantidad}`).join(' · ')}
                </div>
                {p.nota && (
                  <div className="card-sub" style={{ fontStyle: 'italic', color: 'var(--ink-2)' }}>
                    📝 {p.nota}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {esPresupuesto ? (
                    <button className="btn btn-primary" style={{ flex: 1, minHeight: 40, fontSize: 'var(--text-sm)' }} onClick={() => setConfirmConvertir(p.id)}>
                      Convertir a pedido
                    </button>
                  ) : (
                    <>
                      {!p.cobrado && !(p.medioPago === 'tarjeta' && p.cuotas > 1) && (
                        <button className="btn btn-secondary" style={{ flex: 1, minHeight: 40, fontSize: 'var(--text-sm)' }} onClick={() => { setPagoModal({ pedidoId: p.id, resta }); setPagoMonto(''); }}>
                          + Pago parcial
                        </button>
                      )}
                      {!(p.medioPago === 'tarjeta' && p.cuotas > 1 && !p.cobrado) && (
                        <button className={`btn ${p.cobrado ? 'btn-secondary' : 'btn-primary'}`} style={{ flex: 1, minHeight: 40, fontSize: 'var(--text-sm)' }} onClick={() => handleToggle(p)}>
                          {p.cobrado ? 'Reabrir' : 'Cobrar'}
                        </button>
                      )}
                    </>
                  )}
                  {!esPresupuesto && (
                    <button
                      className="btn-icon"
                      aria-label={todoEntregado ? 'Entregado' : 'Marcar entregado'}
                      onClick={() => !todoEntregado && onMarcarEntregado(p.id)}
                      style={{ color: todoEntregado ? 'var(--success)' : 'var(--ink-3)', opacity: todoEntregado ? 1 : 0.7 }}
                      title={todoEntregado ? 'Entregado' : 'Marcar como entregado'}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                  )}
                  <button className="btn-icon" aria-label="Editar pedido" onClick={() => onEdit && onEdit(p)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button className="btn-icon danger" aria-label="Eliminar pedido" onClick={() => setConfirmDel(p.id)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <Modal open={!!pagoModal} title="Registrar pago parcial" onClose={() => setPagoModal(null)}>
        {pagoModal && (
          <>
            <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label htmlFor="mp-monto">Monto a abonar ($)</label>
                <input id="mp-monto" type="number" inputMode="decimal" placeholder="0" min="1" step="0.01" value={pagoMonto} onChange={e => setPagoMonto(e.target.value)} autoFocus />
              </div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>Saldo restante: {formatCurrency(pagoModal.resta)}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)', paddingTop: 0 }}>
              <button className="btn btn-primary btn-full" onClick={handlePagoSave}>Registrar pago</button>
              <button className="btn btn-secondary btn-full" onClick={() => setPagoModal(null)}>Cancelar</button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmModal
        open={!!confirmDel}
        title="Eliminar pedido"
        message="¿Eliminar este pedido? Esta acción no se puede deshacer."
        onConfirm={() => handleDelete(confirmDel)}
        onCancel={() => setConfirmDel(null)}
      />

      <ConfirmModal
        open={!!confirmConvertir}
        title="Convertir a pedido"
        message="¿Convertir este presupuesto en pedido real? Esto descontará stock y afectará el saldo del cliente. La acción es irreversible."
        onConfirm={() => handleConvertir(confirmConvertir)}
        onCancel={() => setConfirmConvertir(null)}
      />

      <Modal open={sortOpen} title="Ordenar por" onClose={() => setSortOpen(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', padding: 'var(--space-2) var(--space-4) var(--space-6)' }}>
          {Object.entries(SORT_LABELS).map(([id, label]) => {
            const active = sort === id;
            return (
              <button
                key={id}
                onClick={() => { setSort(id); setSortOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4) var(--space-2)', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', color: active ? 'var(--primary)' : 'var(--ink)', fontSize: 'var(--text-base)', fontWeight: active ? 700 : 400, textAlign: 'left', width: '100%' }}
              >
                {label}
                {active && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                )}
              </button>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
