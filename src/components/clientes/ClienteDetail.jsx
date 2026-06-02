import { useState } from 'react';
import { formatCurrency, formatDate, saldoCliente } from '../../lib/utils.js';
import { ConfirmModal } from '../shared/Modal.jsx';
import { generarRemito, compartirRemito } from '../../lib/generarRemito.js';
import { CuentaCorriente } from './CuentaCorriente.jsx';
import { DevolucionModal } from '../pedidos/DevolucionModal.jsx';

const SvgCard = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);

const SvgPhone = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

function MedioPill({ medio, cuotas }) {
  if (medio === 'efectivo') return <span className="medio-pill medio-efectivo">💵 Efectivo</span>;
  if (medio === 'transferencia') return <span className="medio-pill medio-transferencia">🏦 Transf.</span>;
  if (medio === 'tarjeta' || medio === 'fiado') {
    const label = cuotas && cuotas > 1 ? `${cuotas} cuotas` : 'Tarjeta';
    return (
      <span className="medio-pill medio-tarjeta" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <SvgCard />{label}
      </span>
    );
  }
  return <span className="medio-pill">{medio}</span>;
}

function TipoComBadge({ tipo }) {
  const map = { recordatorio: 'Recordatorio', presupuesto: 'Presupuesto', otro: 'Otro' };
  return <span className="badge badge-info" style={{ fontSize: 10 }}>{map[tipo] || tipo}</span>;
}

export function ClienteDetail({ cliente, pedidos, devoluciones = [], comunicaciones = [], onBack, onEdit, onDelete, onNuevoPedido, onRefresh, negocio, toast }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [verCuenta, setVerCuenta] = useState(false);
  const [generandoRemito, setGenerandoRemito] = useState(null);
  const [devolucionPedido, setDevolucionPedido] = useState(null);
  const [verComun, setVerComun] = useState(false);

  if (!cliente) return null;

  if (verCuenta) {
    return (
      <CuentaCorriente
        cliente={cliente}
        pedidos={pedidos}
        onBack={() => setVerCuenta(false)}
      />
    );
  }

  const clientePedidos = pedidos
    .filter(p => p.clienteId === cliente.id)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const saldo = saldoCliente(cliente.id, pedidos, devoluciones);

  const clienteDevoluciones = devoluciones.filter(d => d.clienteId === cliente.id);
  const clienteComunicaciones = comunicaciones
    .filter(c => c.clienteId === cliente.id)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  function sendWA() {
    const msg = `${cliente.nombre}, saldo: ${formatCurrency(saldo)}`;
    const num = (cliente.contacto || '').replace(/\D/g, '');
    window.open(
      `https://wa.me/${num ? '54' + num : ''}?text=${encodeURIComponent(msg)}`,
      '_blank'
    );
  }

  async function handleGenerarRemito(pedido) {
    setGenerandoRemito(pedido.id);
    try {
      const dataUrl = await generarRemito({ pedido, cliente, negocio: negocio || 'Mi Negocio' });
      await compartirRemito(dataUrl, cliente.nombre);
    } catch (e) {
      console.error('Error generando remito:', e);
    } finally {
      setGenerandoRemito(null);
    }
  }

  return (
    <>
      <div className="detail-header">
        <button className="btn-icon" onClick={onBack} aria-label="Volver">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2>{cliente.nombre}</h2>
        <button className="btn-icon" onClick={onEdit} aria-label="Editar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button className="btn-icon danger" onClick={() => setConfirmDel(true)} aria-label="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>

      <div className="saldo-box">
        <div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-2)', fontWeight: 500 }}>
            Saldo pendiente
            {cliente.tipo_precio === 'mayorista' && (
              <span className="badge" style={{ marginLeft: 8, fontSize: 10, background: 'var(--accent-2)', color: 'var(--accent)' }}>Mayorista</span>
            )}
          </div>
          {cliente.contacto && (
            <div className="card-sub" style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}><SvgPhone />{cliente.contacto}</div>
          )}
        </div>
        <div className={`saldo-amount ${saldo > 0 ? 'amount-debt' : 'amount-paid'}`}>
          {formatCurrency(saldo)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', padding: '0 var(--space-4) var(--space-4)' }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onNuevoPedido}>
          + Pedido
        </button>
        <button className="btn btn-secondary" style={{ gap: 'var(--space-2)' }} onClick={sendWA}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
          </svg>
          WA
        </button>
        <button className="btn btn-secondary" style={{ gap: 'var(--space-2)' }} onClick={() => setVerCuenta(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Cuenta
        </button>
      </div>

      {clienteDevoluciones.length > 0 && (
        <>
          <div className="section-label">Devoluciones / notas de crédito</div>
          <div className="list-section">
            {clienteDevoluciones.map(d => (
              <div key={d.id} className="card">
                <div className="card-row">
                  <span className="card-sub">{formatDate(d.fecha)}</span>
                  <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: 'var(--text-sm)' }}>
                    −{formatCurrency(d.montoTotal)}
                  </span>
                </div>
                {d.motivo && <div className="card-sub">{d.motivo}</div>}
                <div className="card-sub" style={{ fontSize: 10 }}>
                  {d.items.map(i => `${i.nombre} x${i.cantidad}`).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {clienteComunicaciones.length > 0 && (
        <>
          <div className="section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 'var(--space-4)' }}>
            <span>Comunicaciones</span>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 'var(--text-xs)', padding: '2px 8px' }}
              onClick={() => setVerComun(v => !v)}
            >
              {verComun ? 'Ocultar' : `Ver (${clienteComunicaciones.length})`}
            </button>
          </div>
          {verComun && (
            <div className="list-section">
              {clienteComunicaciones.map(c => (
                <div key={c.id} className="card">
                  <div className="card-row">
                    <TipoComBadge tipo={c.tipo} />
                    <span className="card-sub">{formatDate(c.fecha)}</span>
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-2)', marginTop: 'var(--space-1)', lineHeight: 1.5 }}>
                    {c.mensaje}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="section-label">Historial de pedidos</div>
      <div className="list-section">
        {clientePedidos.length === 0 ? (
          <p style={{ color: 'var(--ink-3)', padding: 'var(--space-4)' }}>Sin pedidos aún.</p>
        ) : (
          clientePedidos.map(p => (
            <div key={p.id} className="card">
              <div className="card-row">
                <span className="card-sub">{formatDate(p.fecha)}</span>
                {p.tipo === 'presupuesto'
                  ? <span className="badge badge-info">Presupuesto</span>
                  : <MedioPill medio={p.medioPago} cuotas={p.cuotas} />
                }
                {p.tipo !== 'presupuesto' && (
                  <span className={`badge ${p.cobrado ? 'badge-ok' : 'badge-warn'}`}>
                    {p.cobrado ? 'Cobrado' : 'Pendiente'}
                  </span>
                )}
              </div>
              <div className="card-row">
                <span className="card-sub" style={{ flex: 1 }}>
                  {p.items.map(i => `${i.nombre} x${i.cantidad}`).join(' · ')}
                </span>
                <span className={`card-amount ${p.tipo === 'presupuesto' ? 'amount-neutral' : (p.cobrado ? 'amount-paid' : 'amount-debt')}`}>
                  {formatCurrency(p.totalFinal)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {p.tipo !== 'presupuesto' && (
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, minHeight: 36, fontSize: 'var(--text-sm)', gap: 'var(--space-2)' }}
                    onClick={() => handleGenerarRemito(p)}
                    disabled={generandoRemito === p.id}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    {generandoRemito === p.id ? 'Generando...' : 'Remito'}
                  </button>
                )}
                {p.cobrado && p.tipo !== 'presupuesto' && (
                  <button
                    className="btn btn-secondary"
                    style={{ minHeight: 36, fontSize: 'var(--text-sm)', gap: 'var(--space-2)' }}
                    onClick={() => setDevolucionPedido(p)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 .49-3.1" />
                    </svg>
                    Devolución
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        open={confirmDel}
        title="Eliminar cliente"
        message="¿Eliminar este cliente? Se perderán todos sus pedidos asociados."
        onConfirm={() => { setConfirmDel(false); onDelete(); }}
        onCancel={() => setConfirmDel(false)}
      />

      <DevolucionModal
        open={!!devolucionPedido}
        pedido={devolucionPedido}
        clienteId={cliente.id}
        onClose={() => setDevolucionPedido(null)}
        onGuardada={onRefresh}
        toast={toast}
      />
    </>
  );
}
