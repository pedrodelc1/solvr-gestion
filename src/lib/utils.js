export function formatCurrency(n) {
  let symbol = '$';
  try {
    const negocio = JSON.parse(localStorage.getItem('sg_negocio') || 'null');
    if (negocio && negocio.moneda) symbol = negocio.moneda;
  } catch (_) {}

  return symbol + '\u00A0' + Number(n || 0).toLocaleString('es-AR', {
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

// Parsea 'YYYY-MM-DD' como medianoche LOCAL. new Date('YYYY-MM-DD') interpreta
// UTC, que en UTC-3 cae a las 21:00 del día anterior y corre vencimientos.
export function parseFechaLocal(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function calcularMora(pedido) {
  if (!pedido.diasPlazo || pedido.diasPlazo <= 0) return 0;
  if (!pedido.tasaMora || pedido.tasaMora <= 0) return 0;
  if (pedido.cobrado) return 0;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const venc = parseFechaLocal(pedido.fecha);
  venc.setDate(venc.getDate() + pedido.diasPlazo);
  const diasMora = Math.round((hoy - venc) / (1000 * 60 * 60 * 24));
  if (diasMora <= 0) return 0;
  const total = pedido.totalFinal ?? pedido.totalCalculado;
  return Math.round(total * (pedido.tasaMora / 100 / 30) * diasMora * 100) / 100;
}

export function fechaVencimiento(pedido) {
  if (!pedido.diasPlazo) return null;
  const d = parseFechaLocal(pedido.fecha);
  d.setDate(d.getDate() + pedido.diasPlazo);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function saldoCliente(clienteOrId, pedidos, devoluciones = [], cobros = []) {
  const clienteId = typeof clienteOrId === 'object' ? clienteOrId.id : clienteOrId;
  const saldoInicial = typeof clienteOrId === 'object' ? (clienteOrId.saldo_inicial || 0) : 0;
  const deuda = pedidos
    .filter(p => p.clienteId === clienteId && !p.cobrado && p.tipo !== 'presupuesto' && p.confirmado !== false)
    .reduce((s, p) => s + (p.totalFinal ?? p.totalCalculado) - (p.montoAbonado || 0) + calcularMora(p), 0);
  const creditos = devoluciones
    .filter(d => d.clienteId === clienteId)
    .reduce((s, d) => s + d.montoTotal, 0);
  // Cobros sueltos asociados al cliente: pagos de saldo pendiente (ej. importado)
  // que reducen lo que debe, igual que un crédito.
  const cobrosCliente = cobros
    .filter(c => c.clienteId === clienteId)
    .reduce((s, c) => s + (c.monto || 0), 0);
  return Math.max(0, deuda + saldoInicial - creditos - cobrosCliente);
}

// Cuotas mensuales vencidas de un pedido en cuotas no cobrado. El calendario es
// una cuota cada 30 días desde la fecha del pedido (la 1ª al momento de la venta).
// Devuelve null si no hay nada vencido pendiente de cobro.
export function cuotasVencidas(pedido) {
  if (!pedido || pedido.cobrado || !(pedido.cuotas > 1) || pedido.tipo === 'presupuesto') return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const inicio = parseFechaLocal(pedido.fecha);
  const diasDesde = Math.round((hoy - inicio) / 86400000);
  if (diasDesde < 0) return null;
  const total = pedido.totalFinal ?? pedido.totalCalculado;
  const montoPorCuota = Math.round((total / pedido.cuotas) * 100) / 100;
  const cuotasDue = Math.min(pedido.cuotas, Math.floor(diasDesde / 30) + 1);
  const montoDue = Math.min(total, Math.round(cuotasDue * montoPorCuota * 100) / 100);
  const pendiente = Math.round((montoDue - (pedido.montoAbonado || 0)) * 100) / 100;
  if (pendiente <= 0.01) return null;
  return { cuotasDue, cuotas: pedido.cuotas, montoPorCuota, montoDue, pendiente };
}

export function saldoPedido(pedido) {
  return (pedido.totalFinal ?? pedido.totalCalculado) - (pedido.montoAbonado || 0) + calcularMora(pedido);
}
