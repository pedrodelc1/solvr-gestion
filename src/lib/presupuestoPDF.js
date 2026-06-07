import { jsPDF } from 'jspdf';
import { formatCurrency, formatDate } from './utils.js';

let _sharing = false;

export async function compartirPresupuestoPDF(pedido, clienteNombre) {
  if (_sharing) return;
  _sharing = true;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 18;
  const col = W - margin * 2;
  let y = 0;

  // ── Header band ──────────────────────────────────────────────────────────
  doc.setFillColor(12, 12, 12);
  doc.rect(0, 0, W, 28, 'F');

  // Logo icon: white rounded square with "S." inside
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, 6, 14, 14, 2.5, 2.5, 'F');
  doc.setTextColor(12, 12, 12);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('S.', margin + 7, 15.5, { align: 'center' });

  // Brand name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Solvnt.', margin + 17, 15.5);

  doc.setTextColor(160, 160, 160);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('PRESUPUESTO', W - margin, 17, { align: 'right' });

  y = 40;

  // ── Meta ─────────────────────────────────────────────────────────────────
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.text('CLIENTE', margin, y);
  doc.text('FECHA', W - margin, y, { align: 'right' });

  y += 5;
  doc.setTextColor(10, 10, 10);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(clienteNombre, margin, y);
  doc.setFontSize(11);
  doc.text(formatDate(pedido.fecha), W - margin, y, { align: 'right' });

  y += 10;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, W - margin, y);
  y += 8;

  // ── Items header ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('PRODUCTO / SERVICIO', margin, y);
  doc.text('CANT.', 140, y, { align: 'right' });
  doc.text('PRECIO', 164, y, { align: 'right' });
  doc.text('SUBTOTAL', W - margin, y, { align: 'right' });

  y += 3;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, W - margin, y);
  y += 6;

  // ── Items ─────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);

  const items = pedido.items || [];
  for (const it of items) {
    const subtotal = it.precioUnitario * it.cantidad;
    doc.text(it.nombre, margin, y);
    doc.text(String(it.cantidad), 140, y, { align: 'right' });
    doc.text(formatCurrency(it.precioUnitario), 164, y, { align: 'right' });
    doc.text(formatCurrency(subtotal), W - margin, y, { align: 'right' });
    y += 7;

    if (y > 260) {
      doc.addPage();
      y = 20;
    }
  }

  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, W - margin, y);
  y += 8;

  // ── Descuento si aplica ───────────────────────────────────────────────────
  const total = pedido.totalFinal ?? pedido.totalCalculado;
  const base = pedido.totalCalculado;
  if (pedido.descuentoValor && pedido.descuentoValor > 0) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    const label = pedido.descuentoTipo === 'porcentaje'
      ? `Descuento (${pedido.descuentoValor}%)`
      : 'Descuento';
    doc.text(label, W - margin - 60, y, { align: 'left' });
    doc.setTextColor(180, 40, 40);
    doc.text(`−${formatCurrency(base - total)}`, W - margin, y, { align: 'right' });
    y += 7;
  }

  // ── Total ─────────────────────────────────────────────────────────────────
  doc.setFillColor(12, 12, 12);
  doc.rect(margin, y - 4, col, 12, 'F');

  doc.setTextColor(180, 180, 180);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('TOTAL', margin + 4, y + 3);

  doc.setTextColor(204, 255, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(total), W - margin - 4, y + 4, { align: 'right' });

  y += 18;

  // ── Nota ─────────────────────────────────────────────────────────────────
  if (pedido.nota) {
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    const lines = doc.splitTextToSize(`Nota: ${pedido.nota}`, col);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 4;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Este presupuesto no implica reserva ni compromiso de entrega.', W / 2, 285, { align: 'center' });

  // ── Share ─────────────────────────────────────────────────────────────────
  const nombreArchivo = `presupuesto-${clienteNombre.replace(/\s+/g, '-').toLowerCase()}.pdf`;
  const blob = doc.output('blob');
  const file = new File([blob], nombreArchivo, { type: 'application/pdf' });

  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
      });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo;
      a.click();
      URL.revokeObjectURL(url);
    }
  } finally {
    _sharing = false;
  }
}
