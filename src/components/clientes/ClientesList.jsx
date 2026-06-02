import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency, saldoCliente } from '../../lib/utils.js';
import { listItem } from '../../lib/animations.js';
import { CobrosPanel } from './CobrosPanel.jsx';
import { ImportarClientesModal } from './ImportarClientesModal.jsx';

export function ClientesList({ clientes, pedidos, devoluciones, onSelect, onNew, onRefresh, toast }) {
  const [query, setQuery] = useState('');
  const [verCobros, setVerCobros] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);

  const q = query.toLowerCase();
  const filtered = clientes.filter(c =>
    !q || c.nombre.toLowerCase().includes(q) || (c.contacto || '').includes(q)
  );

  const cobrosCount = clientes.filter(c => saldoCliente(c.id, pedidos, devoluciones) > 0).length;

  if (verCobros) {
    return (
      <CobrosPanel
        clientes={clientes}
        pedidos={pedidos}
        devoluciones={devoluciones}
        onBack={() => setVerCobros(false)}
      />
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Clientes</h1>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            className="btn-icon"
            onClick={() => setImportarOpen(true)}
            aria-label="Importar clientes"
            title="Importar desde CSV/Excel"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button className="btn-icon" onClick={onNew} aria-label="Agregar cliente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {cobrosCount > 0 && (
        <button
          className="card"
          style={{
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--danger-bg, rgba(239,68,68,0.1))',
            border: '1px solid var(--danger)',
            marginBottom: 'var(--space-2)',
          }}
          onClick={() => setVerCobros(true)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--danger)' }}>
              Cobros pendientes
            </span>
          </div>
          <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: 999, fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 8px' }}>
            {cobrosCount}
          </span>
        </button>
      )}

      <div className="search-bar">
        <div className="search-bar-wrapper">
          <input
            type="search"
            placeholder="Buscar cliente..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
          />
        </div>
      </div>

      <div className="list-section">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <p>{q ? `Sin resultados para "${q}"` : 'Sin clientes. Tocá + para agregar.'}</p>
          </div>
        ) : (
          filtered.map((c, i) => {
            const saldo = saldoCliente(c.id, pedidos, devoluciones);
            return (
              <motion.div
                key={c.id}
                className="card tappable"
                {...listItem(i)}
                onClick={() => onSelect(c.id)}
                role="button"
                tabIndex={0}
                aria-label={`Ver ${c.nombre}`}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(c.id); }}
              >
                <div className="card-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0, flex: 1 }}>
                    <div className="cliente-avatar">{c.nombre.charAt(0)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span className="card-name">{c.nombre}</span>
                        {c.tipo_precio === 'mayorista' && (
                          <span className="badge" style={{ fontSize: 10, padding: '1px 6px', background: 'var(--accent-2)', color: 'var(--accent)', flexShrink: 0 }}>May.</span>
                        )}
                      </div>
                      {c.contacto && <span className="card-sub">📞 {c.contacto}</span>}
                    </div>
                  </div>
                  {saldo > 0 ? (
                    <span className="card-amount amount-debt" style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>
                      {formatCurrency(saldo)}
                    </span>
                  ) : (
                    <span className="badge badge-ok">Al día</span>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <ImportarClientesModal
        open={importarOpen}
        clientes={clientes}
        onClose={() => setImportarOpen(false)}
        onImportada={onRefresh}
        toast={toast}
      />
    </>
  );
}
