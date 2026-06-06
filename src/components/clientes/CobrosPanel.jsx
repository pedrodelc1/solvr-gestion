import { motion } from 'framer-motion';
import { formatCurrency, formatDate, saldoCliente } from '../../lib/utils.js';
import { registrarComunicacion } from '../../lib/db.js';
import { listItem } from '../../lib/animations.js';

export function CobrosPanel({ clientes, pedidos, devoluciones, onBack }) {

  const conSaldo = clientes
    .map(c => {
      const saldo = saldoCliente(c, pedidos, devoluciones);
      const ultimoPedido = pedidos
        .filter(p => p.clienteId === c.id && !p.cobrado && p.tipo !== 'presupuesto')
        .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
      return { ...c, saldo, ultimoPedido };
    })
    .filter(c => c.saldo > 0)
    .sort((a, b) => b.saldo - a.saldo);

  function handleEnviar(cliente) {
    const num = (cliente.contacto || '').replace(/\D/g, '');
    const fechaUlt = cliente.ultimoPedido ? formatDate(cliente.ultimoPedido.fecha) : 'reciente';
    const msg = `Hola ${cliente.nombre}, te paso a recordar que tenés un pago pendiente de ${formatCurrency(cliente.saldo)} correspondiente al pedido del ${fechaUlt}. Quedamos esperando tu pago, gracias!`;

    const url = `https://wa.me/${num ? '54' + num : ''}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');

    registrarComunicacion(cliente.id, 'recordatorio', msg).catch(() => {});
  }

  return (
    <>
      <div className="detail-header">
        <button className="btn-icon" onClick={onBack} aria-label="Volver">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2>Cobros pendientes</h2>
      </div>

      {conSaldo.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
          <p>No hay saldos pendientes. ¡Todo cobrado!</p>
        </div>
      ) : (
        <div className="list-section">
          {conSaldo.map((c, i) => (
            <motion.div key={c.id} className="card" {...listItem(i)}>
              <div className="card-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
                  <div className="cliente-avatar">{c.nombre.charAt(0)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="card-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</div>
                    {c.ultimoPedido && (
                      <div className="card-sub">Último pedido: {formatDate(c.ultimoPedido.fecha)}</div>
                    )}
                  </div>
                </div>
                <span className="card-amount amount-debt" style={{ fontSize: 'var(--text-lg)', fontWeight: 800, flexShrink: 0 }}>
                  {formatCurrency(c.saldo)}
                </span>
              </div>
              {c.contacto && (
                <button
                  className="btn btn-secondary"
                  style={{ minHeight: 40, fontSize: 'var(--text-sm)', gap: 'var(--space-2)' }}
                  onClick={() => handleEnviar(c)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                  </svg>
                  Enviar recordatorio
                </button>
              )}
              {!c.contacto && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>Sin teléfono registrado.</p>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
}
