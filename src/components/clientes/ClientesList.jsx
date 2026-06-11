import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency, saldoCliente } from '../../lib/utils.js';
import { CobrosPanel } from './CobrosPanel.jsx';
import { ImportarClientesModal } from './ImportarClientesModal.jsx';

const ESTADOS = {
  ok:    { label: 'Al día',  color: '#4ade80', bg: 'rgba(74,222,128,0.07)',   border: 'rgba(74,222,128,0.2)'  },
  deuda: { label: 'Debe',    color: '#fbbf24', bg: 'rgba(251,191,36,0.07)',   border: 'rgba(251,191,36,0.25)' },
  mora:  { label: 'En mora', color: '#f87171', bg: 'rgba(248,113,113,0.07)',  border: 'rgba(248,113,113,0.3)' },
};

function getEstado(cliente, pedidos, devoluciones, diasMora) {
  const saldo = saldoCliente(cliente, pedidos, devoluciones);
  if (saldo <= 0) return { ...ESTADOS.ok, saldo };

  const hoy = new Date();
  const pedidosCliente = pedidos.filter(
    p => p.clienteId === cliente.id && !p.cobrado && p.tipo !== 'presupuesto'
  );
  const tieneVencida = pedidosCliente.some(p => {
    const dias = Math.floor((hoy - new Date(p.fecha)) / (1000 * 60 * 60 * 24));
    return dias > diasMora;
  });

  return tieneVencida
    ? { ...ESTADOS.mora, saldo }
    : { ...ESTADOS.deuda, saldo };
}

export function ClientesList({ clientes, pedidos, devoluciones, negocioConfig, diasMora = 30, onSelect, onNew, onRefresh, toast, userRole = 'owner' }) {
  const canWrite = ['owner', 'admin', 'vendedor'].includes(userRole);
  const [query, setQuery]           = useState('');
  const [verCobros, setVerCobros]   = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);

  const q = query.toLowerCase();

  // Enrich clients with status
  const clientesConEstado = clientes.map(c => ({ ...c, estado: getEstado(c, pedidos, devoluciones, diasMora) }));
  const deudores    = clientesConEstado.filter(c => c.estado.saldo > 0);
  const enMora      = deudores.filter(c => c.estado.label === 'En mora').length;
  const totalDeuda  = deudores.reduce((s, c) => s + c.estado.saldo, 0);

  const filtered = clientesConEstado.filter(c =>
    !q || c.nombre.toLowerCase().includes(q) || (c.contacto || '').includes(q)
  );

  if (verCobros) {
    return (
      <CobrosPanel
        clientes={clientes}
        pedidos={pedidos}
        devoluciones={devoluciones}
        negocioConfig={negocioConfig}
        onBack={() => setVerCobros(false)}
        userRole={userRole}
      />
    );
  }

  return (
    <>
      {/* ── Header ── */}
      <div className="page-header">
        <h1>Clientes</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {canWrite && (
            <button
              className="btn-icon"
              onClick={onNew}
              aria-label="Agregar nuevo cliente"
              title="Agregar nuevo cliente"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          )}
          {canWrite && (
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
          )}
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Banner cobros pendientes ── */}
        {deudores.length > 0 && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setVerCobros(true)}
            style={{
              width: '100%', padding: '10px 14px',
              borderRadius: 12,
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10,
              textAlign: 'left',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(248,113,113,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
                {deudores.length === 1 ? '1 cliente te debe' : `${deudores.length} clientes te deben`}
                {enMora > 0 && (
                  <span style={{
                    marginLeft: 6,
                    fontSize: 9, fontWeight: 700,
                    background: 'rgba(248,113,113,0.15)', color: '#f87171',
                    padding: '1px 6px', borderRadius: 999,
                  }}>
                    {enMora} en mora
                  </span>
                )}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#f87171' }}>
                {formatCurrency(totalDeuda)}
              </div>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </motion.button>
        )}

        {/* ── Buscador ── */}
        <div className="search-bar">
          <div className="search-bar-wrapper">
            <input
              type="search"
              placeholder="Buscar por nombre o teléfono..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
            />
          </div>
        </div>

        {/* ── Contador ── */}
        {clientes.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 2 }}>
            {filtered.length === clientes.length
              ? `${clientes.length} cliente${clientes.length !== 1 ? 's' : ''}`
              : `${filtered.length} de ${clientes.length}`}
          </div>
        )}
      </div>

      {/* ── Lista ── */}
      <div style={{ padding: '4px 16px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
            <p>{q ? `Sin resultados para "${q}"` : 'Todavía no tenés clientes.'}</p>
            {!q && canWrite && (
              <button className="btn btn-primary" onClick={onNew} style={{ marginTop: 12 }}>
                Agregar el primero
              </button>
            )}
          </div>
        ) : (
          filtered.map((c, i) => {
            const { estado } = c;
            const inicial = c.nombre.trim().charAt(0).toUpperCase();

            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.035, duration: 0.2 }}
                onClick={() => onSelect(c.id)}
                role="button"
                tabIndex={0}
                aria-label={`Ver ${c.nombre}`}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(c.id); }}
                style={{
                  borderRadius: 18,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-2)',
                  padding: '14px 14px 14px 18px',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 14,
                  position: 'relative', overflow: 'hidden',
                  transition: 'transform 100ms',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                  background: 'var(--bg-3)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 800, color: 'var(--ink-2)',
                  overflow: 'hidden',
                }}>
                  {c.foto_url
                    ? <img src={c.foto_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={c.nombre} />
                    : inicial}
                </div>

                {/* Datos */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{
                      fontSize: 15, fontWeight: 700, color: 'var(--ink)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {c.nombre}
                    </span>
                    {c.tipo_precio === 'mayorista' && (
                      <span style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 999, flexShrink: 0,
                        background: 'var(--accent-2)', color: 'var(--accent)', fontWeight: 700,
                      }}>
                        MAY.
                      </span>
                    )}
                  </div>
                  {c.contacto ? (
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                      {c.contacto}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>Sin teléfono</div>
                  )}
                </div>

                {/* Estado + monto */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
                  {estado.saldo > 0 ? (
                    <span style={{ fontSize: 16, fontWeight: 800, color: estado.color, lineHeight: 1 }}>
                      {formatCurrency(estado.saldo)}
                    </span>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: estado.color,
                    background: `${estado.color}18`,
                    padding: '2px 8px', borderRadius: 999,
                    letterSpacing: '0.03em',
                  }}>
                    {estado.label}
                  </span>
                </div>

                {/* Flecha */}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
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
