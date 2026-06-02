import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency, saldoCliente } from '../../lib/utils.js';
import { listItem } from '../../lib/animations.js';

export function ClientesList({ clientes, pedidos, onSelect, onNew }) {
  const [query, setQuery] = useState('');

  const q = query.toLowerCase();
  const filtered = clientes.filter(c =>
    !q || c.nombre.toLowerCase().includes(q) || (c.contacto || '').includes(q)
  );

  return (
    <>
      <div className="page-header">
        <h1>Clientes</h1>
        <button className="btn-icon" onClick={onNew} aria-label="Agregar cliente">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
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
            const saldo = saldoCliente(c.id, pedidos);
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
                    <span className="card-name">{c.nombre}</span>
                  </div>
                  {saldo > 0 ? (
                    <span className="card-amount amount-debt" style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>
                      {formatCurrency(saldo)}
                    </span>
                  ) : (
                    <span className="badge badge-ok">Al día</span>
                  )}
                </div>
                {c.contacto && <span className="card-sub">📞 {c.contacto}</span>}
              </motion.div>
            );
          })
        )}
      </div>
    </>
  );
}
