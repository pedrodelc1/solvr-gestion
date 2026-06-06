export function formatCurrency(n) {
  return '$ ' + Number(n || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(s) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
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
  return crypto.randomUUID();
}

export function saldoCliente(clienteOrId, pedidos, devoluciones = []) {
  const clienteId = typeof clienteOrId === 'object' ? clienteOrId.id : clienteOrId;
  const saldoInicial = typeof clienteOrId === 'object' ? (clienteOrId.saldo_inicial || 0) : 0;
  const deuda = pedidos
    .filter(p => p.clienteId === clienteId && !p.cobrado && p.tipo !== 'presupuesto')
    .reduce((s, p) => s + (p.totalFinal ?? p.totalCalculado) - (p.montoAbonado || 0), 0);
  const creditos = devoluciones
    .filter(d => d.clienteId === clienteId)
    .reduce((s, d) => s + d.montoTotal, 0);
  return Math.max(0, deuda + saldoInicial - creditos);
}

export function saldoPedido(pedido) {
  return (pedido.totalFinal ?? pedido.totalCalculado) - (pedido.montoAbonado || 0);
}
