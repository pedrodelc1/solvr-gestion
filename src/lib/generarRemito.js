import html2canvas from 'html2canvas';
import { formatCurrency, formatDate } from './utils.js';

// Genera una imagen del remito a partir de los datos del pedido y cliente
export async function generarRemito({ pedido, cliente, negocio = 'Mi Negocio' }) {
  const total = pedido.totalFinal ?? pedido.totalCalculado;
  const abonado = pedido.montoAbonado || 0;
  const saldo = total - abonado;

  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'top:-9999px', 'left:0',
    'width:420px', 'background:#ffffff', 'color:#000000',
    "font-family:'Space Grotesk',system-ui,sans-serif",
    'padding:32px', 'box-sizing:border-box', 'line-height:1.5',
  ].join(';');

  const itemsHtml = pedido.items.map(item => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #f0f0f0">${item.nombre}</td>
      <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:center">${item.cantidad}</td>
      <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:right">${formatCurrency(item.precioUnitario)}</td>
      <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600">${formatCurrency(item.precioUnitario * item.cantidad)}</td>
    </tr>
  `).join('');

  const medioPagoLabel = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    tarjeta: pedido.cuotas > 1 ? `Tarjeta (${pedido.cuotas} cuotas)` : 'Tarjeta',
  }[pedido.medioPago] || pedido.medioPago;

  el.innerHTML = `
    <div style="border-bottom:3px solid #000;padding-bottom:16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <div style="font-size:26px;font-weight:900;letter-spacing:-0.03em">${negocio}</div>
        <div style="font-size:11px;color:#888;letter-spacing:0.1em;text-transform:uppercase;margin-top:2px">Comprobante de venta</div>
      </div>
      <div style="text-align:right;font-size:12px;color:#666">${formatDate(pedido.fecha)}</div>
    </div>

    <div style="margin-bottom:20px">
      <div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Cliente</div>
      <div style="font-size:18px;font-weight:700">${cliente.nombre}</div>
      ${cliente.contacto ? `<div style="font-size:13px;color:#666;margin-top:2px">${cliente.contacto}</div>` : ''}
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
      <thead>
        <tr style="border-bottom:2px solid #000">
          <th style="text-align:left;padding:6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#666">Descripción</th>
          <th style="text-align:center;padding:6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#666">Cant.</th>
          <th style="text-align:right;padding:6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#666">P.Unit.</th>
          <th style="text-align:right;padding:6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#666">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div style="border-top:2px solid #000;padding-top:16px">
      <div style="display:flex;justify-content:space-between;font-size:20px;font-weight:900;margin-bottom:8px">
        <span>Total</span>
        <span>${formatCurrency(total)}</span>
      </div>
      ${abonado > 0 ? `<div style="display:flex;justify-content:space-between;font-size:14px;color:#16a34a;margin-bottom:4px"><span>Abonado</span><span>- ${formatCurrency(abonado)}</span></div>` : ''}
      ${saldo > 0 ? `<div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:#dc2626;padding-top:6px;border-top:1px solid #eee"><span>Saldo pendiente</span><span>${formatCurrency(saldo)}</span></div>` : ''}
      <div style="margin-top:12px;font-size:12px;color:#888">Medio de pago: ${medioPagoLabel}</div>
      ${pedido.nota ? `<div style="margin-top:6px;font-size:12px;color:#888;font-style:italic">Nota: ${pedido.nota}</div>` : ''}
    </div>

    <div style="margin-top:24px;padding-top:14px;border-top:1px solid #eee;text-align:center;font-size:10px;color:#bbb">
      Generado con Solvr Gestión
    </div>
  `;

  document.body.appendChild(el);
  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    return canvas.toDataURL('image/png');
  } finally {
    document.body.removeChild(el);
  }
}

// Comparte el remito como imagen (Web Share API en móvil, descarga en desktop)
export async function compartirRemito(dataUrl, nombreCliente) {
  const fileName = `remito_${nombreCliente.replace(/\s+/g, '_')}.png`;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `Remito — ${nombreCliente}` });
      return;
    }
  } catch (_) {
    // El usuario canceló o Share no está disponible
  }
  // Fallback: descargar directamente
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  a.click();
}
