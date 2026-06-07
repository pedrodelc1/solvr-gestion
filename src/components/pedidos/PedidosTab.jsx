import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency, formatDate, saldoPedido } from '../../lib/utils.js';
import { PedidoForm } from './PedidoForm.jsx';
import { PedidoDetail } from './PedidoDetail.jsx';
import { MedioPill } from '../shared/MedioPill.jsx';

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'cobrados', label: 'Cobrados' },
  { id: 'tarjeta', label: 'Tarjeta' },
];

import { MedioPill } from '../shared/MedioPill.jsx';

export function PedidosTab({
  pedidos, clientes, productos,
  onSavePedido, onUpdatePedido, onDeletePedido, onSaveProducto, toast,
}) {
  const [filtro, setFiltro] = useState('todos');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'nuevo' | 'detail'
  const [selectedId, setSelectedId] = useState(null);

  const pedido = pedidos.find(p => p.id === selectedId) || null;

  const filtered = pedidos.filter(p => {
    if (filtro === 'pendientes' && p.cobrado) return false;
    if (filtro === 'cobrados' && !p.cobrado) return false;
    if (filtro === 'tarjeta' && p.medioPago !== 'tarjeta' && p.medioPago !== 'fiado') return false;
    if (query) {
      const c = clientes.find(x => x.id === p.clienteId);
      const q = query.toLowerCase();
      if (!c?.nombre.toLowerCase().includes(q) && !p.fecha.includes(q)) return false;
    }
    return true;
  });

  if (view === 'nuevo') {
    return (
      <PedidoForm
        clientes={clientes}
        productos={productos}
        onSave={async (data) => {
          await onSavePedido(data);
          setView('list');
        }}
        onBack={() => setView('list')}
        onProductoCreated={onSaveProducto}
        toast={toast}
      />
    );
  }

  if (view === 'detail' && pedido) {
    return (
      <PedidoDetail
        pedido={pedido}
        clientes={clientes}
        onBack={() => { setSelectedId(null); setView('list'); }}
        onUpdatePedido={onUpdatePedido}
        onDeletePedido={async (id) => {
          await onDeletePedido(id);
          setSelectedId(null);
          setView('list');
        }}
      />
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Pedidos</h1>
        <button className="btn-icon" onClick={() => setView('nuevo')} aria-label="Nuevo pedido">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="search-bar">
        <input
          type="search"
          placeholder="Buscar cliente o fecha..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="filter-bar">
        {FILTROS.map(f => (
          <button
            key={f.id}
            className={`filter-chip${filtro === f.id ? ' active' : ''}`}
            onClick={() => setFiltro(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="list-section">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="2" />
            </svg>
            <p>Sin pedidos{query ? ` para "${query}"` : ''}.</p>
          </div>
        ) : (
          filtered.map((p, i) => {
            const c = clientes.find(x => x.id === p.clienteId);
            const saldo = saldoPedido(p);
            return (
              <motion.div
                key={p.id}
                className="card tappable"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                onClick={() => { setSelectedId(p.id); setView('detail'); }}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setSelectedId(p.id); setView('detail'); } }}
              >
                <div className="card-row">
                  <span className="card-name">{c?.nombre || 'Cliente'}</span>
                  <span className={`card-amount ${p.cobrado ? 'amount-paid' : saldo > 0 ? 'amount-debt' : 'amount-neutral'}`}>
                    {formatCurrency(p.totalFinal)}
                  </span>
                </div>
                <div className="card-row">
                  <span className="card-sub">{formatDate(p.fecha)}</span>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <MedioPill medio={p.medioPago} cuotas={p.cuotas} />
                    <span className={`badge ${p.cobrado ? 'badge-ok' : 'badge-warn'}`}>
                      {p.cobrado ? 'Cobrado' : 'Pendiente'}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </>
  );
}
