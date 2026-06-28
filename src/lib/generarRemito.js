import { formatCurrency, formatDate } from './utils.js';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export async function generarRemito({ pedido, cliente, negocio = 'Mi Negocio', logoUrl = null, isEntregado = false }) {
  const localNegocio = JSON.parse(localStorage.getItem('sg_negocio') || '{}');
  const negocioNombre = localNegocio.nombre || negocio || 'Mi Negocio';
  const telefono = localNegocio.telefono || '';
  const direccion = localNegocio.direccion || '';
  const email = localNegocio.email || '';
  const cuit = localNegocio.cuit || '';
  const notaPdf = localNegocio.nota_pdf || '';

  const total = pedido.totalFinal ?? pedido.totalCalculado;
  const abonado = pedido.montoAbonado || 0;
  const saldo = total - abonado;
  const descMonto = pedido.descuentoTipo === 'porcentaje'
    ? (pedido.totalCalculado * (pedido.descuentoValor || 0) / 100)
    : (pedido.descuentoValor || 0);

  const medioPagoLabel = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    tarjeta: pedido.cuotas > 1 ? `Tarjeta (${pedido.cuotas} cuotas)` : 'Tarjeta',
  }[pedido.medioPago] || pedido.medioPago;

  const itemsHtml = pedido.items.map(item => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #f0f0f0">${esc(item.nombre)}</td>
      <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:center">${esc(item.cantidad)}</td>
      <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:right">${formatCurrency(item.precioUnitario)}</td>
      <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600">${formatCurrency(item.precioUnitario * item.cantidad)}</td>
    </tr>
  `).join('');

  const logoHtml = logoUrl
    ? `<img src="${esc(logoUrl)}" style="height:40px;object-fit:contain;" />`
    : `<span style="font-size:24px;font-weight:900;letter-spacing:-0.03em">${esc(negocioNombre)}</span>`;

  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'top:-9999px', 'left:0',
    'width:560px', 'background:#ffffff', 'color:#000000',
    "font-family:'Segoe UI',system-ui,sans-serif",
    'padding:40px', 'box-sizing:border-box', 'line-height:1.5',
  ].join(';');

  el.innerHTML = `
    <div style="border-bottom:3px solid #000;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        ${logoHtml}
        <div style="font-size:11px;color:#888;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px">Comprobante de venta ${pedido.nro ? `N° ${pedido.nro}` : ''}</div>
        <div style="font-size:11px;color:#555;margin-top:4px;line-height:1.4">
          ${cuit ? `<div>CUIT: ${esc(cuit)}</div>` : ''}
          ${telefono ? `<div>Tel: ${esc(telefono)}</div>` : ''}
          ${direccion ? `<div>Dir: ${esc(direccion)}</div>` : ''}
          ${email ? `<div>Email: ${esc(email)}</div>` : ''}
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:13px;color:#555;padding-bottom:6px">${formatDate(pedido.fecha)}</div>
        ${isEntregado ? `<div style="display:inline-block;background:#16a34a;color:#fff;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding:5px 12px;border-radius:6px">✓ Entregado y pagado</div>` : ''}
      </div>
    </div>

    <div style="margin-bottom:24px;padding:14px;background:#f7f7f7;border-radius:6px">
      <div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Cliente</div>
      <div style="font-size:20px;font-weight:700">${esc(cliente.nombre)}</div>
      ${cliente.contacto ? `<div style="font-size:13px;color:#666;margin-top:2px">${esc(cliente.contacto)}</div>` : ''}
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
      <thead>
        <tr style="border-bottom:2px solid #000">
          <th style="text-align:left;padding:6px 4px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#666">Descripción</th>
          <th style="text-align:center;padding:6px 4px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#666">Cant.</th>
          <th style="text-align:right;padding:6px 4px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#666">P.Unit.</th>
          <th style="text-align:right;padding:6px 4px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#666">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div style="border-top:2px solid #000;padding-top:16px">
      ${descMonto > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:14px;color:#555;margin-bottom:4px"><span>Subtotal</span><span>${formatCurrency(pedido.totalCalculado)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:14px;color:#c00;margin-bottom:8px">
          <span>Descuento${pedido.descuentoTipo === 'porcentaje' ? ` (${pedido.descuentoValor}%)` : ''}</span>
          <span>−${formatCurrency(descMonto)}</span>
        </div>
      ` : ''}
      <div style="display:flex;justify-content:space-between;font-size:22px;font-weight:900;margin-bottom:8px">
        <span>Total</span><span>${formatCurrency(total)}</span>
      </div>
      ${abonado > 0 ? `<div style="display:flex;justify-content:space-between;font-size:14px;color:#16a34a;margin-bottom:4px"><span>Abonado</span><span>− ${formatCurrency(abonado)}</span></div>` : ''}
      ${saldo > 0 ? `<div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:#dc2626;padding-top:6px;border-top:1px solid #eee"><span>Saldo pendiente</span><span>${formatCurrency(saldo)}</span></div>` : ''}
      <div style="margin-top:12px;font-size:12px;color:#888">Medio de pago: ${medioPagoLabel}</div>
      ${pedido.nota ? `<div style="margin-top:6px;font-size:12px;color:#888;font-style:italic">Nota: ${esc(pedido.nota)}</div>` : ''}
      ${notaPdf ? `<div style="margin-top:16px;padding:10px;background:#f9f9f9;border:1px dashed #ddd;border-radius:4px;font-size:11px;color:#444;line-height:1.4">${esc(notaPdf).replace(/\n/g, '<br/>')}</div>` : ''}
    </div>

    <div style="margin-top:28px;padding-top:14px;border-top:1px solid #eee;text-align:center;font-size:10px;color:#bbb">
      Generado con Solvnt Gestión
    </div>
  `;

  document.body.appendChild(el);
  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const imgData = canvas.toDataURL('image/png');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const ratio = canvas.width / canvas.height;
    const pdfHeight = pdfWidth / ratio;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, pdf.internal.pageSize.getHeight()));
    return pdf;
  } finally {
    document.body.removeChild(el);
  }
}

export async function compartirRemito(pdf, nombreCliente) {
  const blob = pdf.output('blob');
  const fileName = `remito_${nombreCliente.replace(/\s+/g, '_')}.pdf`;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile && navigator.share) {
    const file = new File([blob], fileName, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
        // otro error → fallback a descarga
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function abrirWhatsApp(contacto, mensaje) {
  const num = (contacto || '').replace(/\D/g, '');
  window.open(`https://wa.me/${num ? '54' + num : ''}?text=${encodeURIComponent(mensaje)}`, '_blank');
}
