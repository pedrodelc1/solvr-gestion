import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { formatCurrency, formatDate } from '../../lib/utils.js';

// Construye un historial cronológico de débitos y créditos a partir de los pedidos
function buildMovimientos(pedidos) {
  const movs = [];

  const sorted = [...pedidos].sort((a, b) => a.fecha.localeCompare(b.fecha));

  for (const p of sorted) {
    if (p.tipo === 'presupuesto') continue;
    const total = p.totalFinal ?? p.totalCalculado;
    const items = p.items.map(i => `${i.nombre} x${i.cantidad}`).join(', ');

    // Débito: el pedido
    movs.push({
      id: `${p.id}-debit`,
      fecha: p.fecha,
      descripcion: items || 'Pedido',
      monto: total,
      tipo: 'debito',
      pedidoId: p.id,
    });

    // Crédito: si tiene pagos registrados
    const abonado = p.montoAbonado || 0;
    if (abonado > 0) {
      movs.push({
        id: `${p.id}-credit`,
        fecha: p.fecha,
        descripcion: p.cobrado ? 'Pago total' : `Pago parcial`,
        monto: abonado,
        tipo: 'credito',
        pedidoId: p.id,
      });
    }
  }

  // Calcular saldo acumulado
  let saldoAcumulado = 0;
  return movs.map(m => {
    saldoAcumulado += m.tipo === 'debito' ? m.monto : -m.monto;
    return { ...m, saldoAcumulado };
  });
}

export function CuentaCorriente({ cliente, pedidos, onBack }) {
  const contentRef = useRef(null);
  const [exportando, setExportando] = useState(false);

  const clientePedidos = pedidos.filter(p => p.clienteId === cliente.id);
  const movimientos = buildMovimientos(clientePedidos);
  const saldoFinal = movimientos.length > 0 ? movimientos[movimientos.length - 1].saldoAcumulado : 0;

  async function handleExportar() {
    if (!contentRef.current) return;
    setExportando(true);
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        backgroundColor: '#080808',
        useCORS: true,
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const fileName = `cuenta_${cliente.nombre.replace(/\s+/g, '_')}.png`;
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `Cuenta corriente — ${cliente.nombre}` });
          return;
        }
      } catch (_) {}
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      a.click();
    } finally {
      setExportando(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
      <div className="detail-header">
        <button className="btn-icon" onClick={onBack} aria-label="Volver">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2 style={{ flex: 1 }}>Cuenta corriente</h2>
        <button
          className="btn btn-secondary"
          style={{ minHeight: 36, padding: '0 var(--space-3)', fontSize: 'var(--text-sm)', gap: 'var(--space-2)' }}
          onClick={handleExportar}
          disabled={exportando || movimientos.length === 0}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          {exportando ? 'Generando...' : 'Compartir'}
        </button>
      </div>

      <div ref={contentRef} style={{ padding: 'var(--space-4)' }}>
        {/* Cabecera del extracto */}
        <div style={{ marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-1)' }}>
            Extracto de cuenta
          </div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{cliente.nombre}</div>
          {cliente.contacto && (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', marginTop: 2 }}>{cliente.contacto}</div>
          )}
        </div>

        {movimientos.length === 0 ? (
          <div className="empty-state">
            <p>Sin movimientos registrados.</p>
          </div>
        ) : (
          <>
            {/* Encabezado de columnas */}
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px 90px', gap: 'var(--space-2)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fecha</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Descripción</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Monto</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Saldo</span>
            </div>

            {movimientos.map(m => (
              <div
                key={m.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr 90px 90px',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-3) 0',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>{formatDate(m.fecha)}</span>
                <span style={{ fontSize: 'var(--text-sm)', color: m.tipo === 'credito' ? 'var(--success)' : 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.tipo === 'credito' ? '↓ ' : '↑ '}{m.descripcion}
                </span>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: m.tipo === 'credito' ? 'var(--success)' : 'var(--ink)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {m.tipo === 'credito' ? '-' : '+'}{formatCurrency(m.monto)}
                </span>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: m.saldoAcumulado > 0 ? 'var(--danger)' : 'var(--success)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(m.saldoAcumulado)}
                </span>
              </div>
            ))}

            {/* Saldo final */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) 0 var(--space-2)', borderTop: '2px solid var(--border)', marginTop: 'var(--space-2)' }}>
              <span style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>Saldo pendiente</span>
              <span style={{ fontWeight: 800, fontSize: 'var(--text-xl)', color: saldoFinal > 0 ? 'var(--danger)' : 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(saldoFinal)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
