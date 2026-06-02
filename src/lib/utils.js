export function formatCurrency(n) {
  return '$ ' + Number(n || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function getRange(period) {
  const n = new Date();
  const y = n.getFullYear();
  const mo = n.getMonth();
  if (period === 'today') {
    const t = today();
    return [t, t];
  }
  if (period === 'current') {
    return [
      new Date(y, mo, 1).toISOString().slice(0, 10),
      new Date(y, mo + 1, 0).toISOString().slice(0, 10),
    ];
  }
  if (period === 'prev') {
    return [
      new Date(y, mo - 1, 1).toISOString().slice(0, 10),
      new Date(y, mo, 0).toISOString().slice(0, 10),
    ];
  }
  if (period === '3m') {
    return [
      new Date(y, mo - 2, 1).toISOString().slice(0, 10),
      new Date(y, mo + 1, 0).toISOString().slice(0, 10),
    ];
  }
  return null;
}

export function inRange(d, a, b) {
  return d >= a && d <= b;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function saldoCliente(clienteId, pedidos) {
  return pedidos
    .filter(p => p.clienteId === clienteId && !p.cobrado)
    .reduce((s, p) => s + (p.totalFinal ?? p.totalCalculado) - (p.montoAbonado || 0), 0);
}

export function saldoPedido(pedido) {
  return (pedido.totalFinal ?? pedido.totalCalculado) - (pedido.montoAbonado || 0);
}
