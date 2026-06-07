import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency, saldoCliente } from '../../lib/utils.js';
import { listItem } from '../../lib/animations.js';
import { CobrosPanel } from './CobrosPanel.jsx';
import { ImportarClientesModal } from './ImportarClientesModal.jsx';

export function ClientesList({ clientes, pedidos, devoluciones, onSelect, onNew, onRefresh, toast, userRole = 'owner' }) {
  const canWrite = ['owner', 'admin', 'vendedor'].includes(userRole);
  const [query, setQuery] = useState('');
  const [verCobros, setVerCobros] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);

  const q = query.toLowerCase();
  const filtered = clientes.filter(c =>
    !q || c.nombre.toLowerCase().includes(q) || (c.contacto || '').includes(q)
  );

  const cobrosCount = clientes.filter(c => saldoCliente(c, pedidos, devoluciones) > 0).length;

  if (verCobros) {
    return (
      <CobrosPanel
        clientes={clientes}
        pedidos={pedidos}
        devoluciones={devoluciones}
        onBack={() => setVerCobros(false)}
        userRole={userRole}
      />
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Clientes</h1>
        {canWrite && (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              className="btn-icon"
              onClick={() => setImportarOpen(true)}
              aria-label="Importar clientes"
              title="Importar desde CSV/Excel"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </button>
            <button className="btn-icon" onClick={onNew} aria-label="Agregar cliente">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {cobrosCount > 0 && (
        <button
          className="card"
          style={{
            width: 'fit-content',
            margin: 'var(--space-1) auto var(--space-3)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            padding: '8px 14px',
            background: 'var(--danger-bg, rgba(239,68,68,0.08))',
            borderColor: 'rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius-full)',
          }}
          onClick={() => setVerCobros(true)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--danger)', letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
            Cobros pendientes
          </span>
          <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: 999, fontSize: '10px', fontWeight: 700, padding: '1px 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
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
            const saldo = saldoCliente(c, pedidos, devoluciones);
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
                      {c.contacto && (
                        <span className="card-sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                          </svg>
                          {c.contacto}
                        </span>
                      )}
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
