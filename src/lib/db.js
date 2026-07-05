import { supabase } from './supabase.js';
import { uid } from './utils.js';

const LS_KEYS = {
  clientes: 'sg_clientes',
  productos: 'sg_productos',
  pedidos: 'sg_pedidos',
  gastos: 'sg_gastos',
  cobros: 'sg_cobros',
  categorias: 'sg_cats',
};

const DEFAULT_CATS = ['Mercadería', 'Transporte', 'Servicios', 'Otros'];

function lsGet(key, def) {
  try {
    return JSON.parse(localStorage.getItem(LS_KEYS[key])) ?? def;
  } catch {
    return def;
  }
}

// Snapshot síncrono de la caché en localStorage para hidratar la UI al toque
// sin esperar a Supabase. La data fresca llega después y reconcilia.
export function getCachedSnapshot() {
  return {
    clientes:   lsGet('clientes', []),
    productos:  lsGet('productos', []),
    pedidos:    lsGet('pedidos', []),
    gastos:     lsGet('gastos', []),
    cobros:     lsGet('cobros', []),
    categorias: lsGet('categorias', DEFAULT_CATS),
  };
}

// try/catch: si el snapshot supera la quota de localStorage, el cache se
// saltea pero la data fetcheada se devuelve igual.
function lsSet(key, val) {
  try {
    localStorage.setItem(LS_KEYS[key], JSON.stringify(val));
  } catch {}
}

// negocio_id activo, cacheado al loguearse. Se manda explícito en cada INSERT
// para no depender del trigger set_negocio_id_default + mi_negocio_id(), que
// puede devolver null si la membresía recién se creó y el JWT no la refleja.
const NEGOCIO_ID_KEY = 'sg_negocio_id';
export function setCachedNegocioId(id) {
  if (id) localStorage.setItem(NEGOCIO_ID_KEY, id);
}
export function getCachedNegocioId() {
  return localStorage.getItem(NEGOCIO_ID_KEY) || null;
}

export function clearLocalCache() {
  const keys = [
    'sg_clientes', 'sg_productos', 'sg_pedidos', 'sg_gastos', 'sg_cobros',
    'sg_cats', 'sg_devoluciones', 'sg_negocio', 'sg_negocio_id',
    'sg_cuotas_last_run',
  ];
  keys.forEach(k => { try { localStorage.removeItem(k); } catch {} });
}

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function useSupabase() {
  return !!(
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
}

// getSession() lee la sesión de localStorage (sin red); getUser() haría un
// request a /auth/v1/user en cada llamada. Para obtener el id/email del usuario
// (la autorización real la aplica RLS en el backend) la sesión local alcanza.
async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id;
}

async function getUserEmail() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.email;
}

// Traduce errores de Postgres (constraints/RLS) a mensajes claros para el usuario
export function friendlyError(error) {
  if (!error) return error;
  const map = {
    '23514': 'Los datos no pasaron la validación del servidor. Revisá montos y campos obligatorios.',
    '23505': 'Ya existe un registro con esos datos.',
    '23503': 'El registro está vinculado a otros datos y no se puede modificar así.',
    '23502': 'Falta un campo obligatorio.',
    '42501': 'No tenés permisos para realizar esta acción.',
  };
  if (error.code === '42501' || /row-level security/i.test(error.message || '')) {
    return new Error(map['42501']);
  }
  return new Error(map[error.code] || error.message);
}

function requireMontoValido(monto, label = 'monto') {
  const n = Number(monto);
  if (!Number.isFinite(n) || n < 0) throw new Error(`El ${label} debe ser un número mayor o igual a cero`);
  return n;
}

// PostgREST corta toda respuesta en 1000 filas (db-max-rows) aunque no se pida
// límite: al pasar ese volumen la data se truncaba en silencio (pedidos sin
// items, filas viejas desaparecidas). Paginamos con .range() hasta la última
// página. buildQuery debe devolver un builder nuevo por llamada.
const PAGE_SIZE = 1000;
async function fetchAllRows(buildQuery) {
  const all = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    all.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return { data: all, error: null };
  }
}

// ── CLIENTES ─────────────────────────────────────────────

export async function getClientes() {
  if (!useSupabase()) return lsGet('clientes', []);
  const { data, error } = await fetchAllRows(() => supabase
    .from('clientes')
    .select('id, nombre, contacto, email, direccion, tipo_precio, saldo_inicial, foto_url, created_at')
    .order('created_at', { ascending: true })
    .order('id'));
  if (error) return lsGet('clientes', []);
  const mapped = data.map(r => ({
    id: r.id,
    nombre: r.nombre,
    contacto: r.contacto || '',
    email: r.email || '',
    direccion: r.direccion || '',
    tipo_precio: r.tipo_precio || 'minorista',
    saldo_inicial: r.saldo_inicial || 0,
    foto_url: r.foto_url || null,
    created_at: r.created_at || null,
  }));
  lsSet('clientes', mapped);
  return mapped;
}

export async function saveCliente(data) {
  if (!useSupabase()) {
    const arr = lsGet('clientes', []);
    if (data.id) {
      const i = arr.findIndex(x => x.id === data.id);
      if (i >= 0) arr[i] = data;
      else arr.push(data);
    } else {
      arr.push({ ...data, id: uid() });
    }
    lsSet('clientes', arr);
    return data.id ? data : arr[arr.length - 1];
  }
  const userIdCli = await getUserId();
  if (!userIdCli) throw new Error('Not authenticated');
  if (!data.nombre || !String(data.nombre).trim()) throw new Error('El nombre del cliente es obligatorio');
  const fields = {
    nombre: String(data.nombre).trim(),
    contacto: data.contacto || '',
    email: data.email || '',
    direccion: data.direccion || '',
    tipo_precio: data.tipo_precio || 'minorista',
    saldo_inicial: requireMontoValido(data.saldo_inicial || 0, 'saldo inicial'),
    foto_url: data.foto_url || null,
  };
  const negocioIdC = getCachedNegocioId();
  let row;
  if (data.id) {
    const r = await supabase.from('clientes').update(fields).eq('id', data.id).select().single();
    if (r.error) throw friendlyError(r.error);
    row = r.data;
  } else {
    const id = uid();
    fields.id = id;
    fields.user_id = userIdCli;
    if (negocioIdC) fields.negocio_id = negocioIdC;
    const { error } = await supabase.from('clientes').insert(fields);
    if (error) throw friendlyError(error);
    row = { id, ...fields };
  }
  return {
    id: row.id,
    nombre: row.nombre,
    contacto: row.contacto || '',
    email: row.email || '',
    direccion: row.direccion || '',
    tipo_precio: row.tipo_precio || 'minorista',
    saldo_inicial: row.saldo_inicial || 0,
    foto_url: row.foto_url || null,
    created_at: row.created_at || null,
  };
}

// Import masivo: un solo INSERT con array (en chunks) en vez de un request por
// fila. Las filas inválidas se saltean, igual que hacía el try/catch por fila.
const BULK_CHUNK = 500;

export async function saveClientesBulk(rows) {
  const validas = [];
  for (const r of rows || []) {
    if (!r.nombre || !String(r.nombre).trim()) continue;
    const saldo = Number(r.saldo_inicial || 0);
    validas.push({
      nombre: String(r.nombre).trim(),
      contacto: r.contacto || '',
      email: r.email || '',
      direccion: r.direccion || '',
      tipo_precio: r.tipo_precio === 'mayorista' ? 'mayorista' : 'minorista',
      saldo_inicial: Number.isFinite(saldo) && saldo >= 0 ? saldo : 0,
      foto_url: null,
    });
  }
  if (!useSupabase()) {
    const arr = lsGet('clientes', []);
    validas.forEach(v => arr.push({ ...v, id: uid() }));
    lsSet('clientes', arr);
    return validas.length;
  }
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');
  const negocioId = getCachedNegocioId();
  let importados = 0;
  for (let i = 0; i < validas.length; i += BULK_CHUNK) {
    const chunk = validas.slice(i, i + BULK_CHUNK).map(v => ({
      ...v,
      id: uid(),
      user_id: userId,
      ...(negocioId ? { negocio_id: negocioId } : {}),
    }));
    const { error } = await supabase.from('clientes').insert(chunk);
    if (!error) importados += chunk.length;
  }
  return importados;
}

export async function deleteCliente(id) {
  if (!useSupabase()) {
    const arr = lsGet('clientes', []).filter(x => x.id !== id);
    lsSet('clientes', arr);
    return id;
  }
  const negocioIdCli = getCachedNegocioId();
  let q = supabase.from('clientes').delete().eq('id', id);
  if (negocioIdCli) q = q.eq('negocio_id', negocioIdCli);
  const { data, error } = await q.select('id');
  if (error) throw friendlyError(error);
  if (!data || data.length === 0) {
    throw new Error('No se pudo eliminar el cliente: no tenés permiso o ya no existe.');
  }
  return id;
}

// ── PRODUCTOS ─────────────────────────────────────────────

export async function getProductos() {
  if (!useSupabase()) return lsGet('productos', []);
  const { data, error } = await fetchAllRows(() => supabase
    .from('productos')
    .select('id, nombre, marca, precio, costo, precio_mayorista, stock, stock_minimo')
    .order('nombre', { ascending: true })
    .order('id'));
  if (error) {
    console.error('[getProductos]', error);
    return lsGet('productos', []);
  }
  const mapped = data.map(r => ({
    id: r.id,
    nombre: r.nombre,
    marca: r.marca || null,
    precio: r.precio,
    costo: r.costo || 0,
    precio_mayorista: r.precio_mayorista || 0,
    stock: r.stock ?? 0,
    stock_minimo: r.stock_minimo ?? 5,
  }));
  lsSet('productos', mapped);
  return mapped;
}

export async function saveProducto(data) {
  if (!useSupabase()) {
    const arr = lsGet('productos', []);
    if (data.id) {
      const i = arr.findIndex(x => x.id === data.id);
      if (i >= 0) arr[i] = data;
      else arr.push(data);
    } else {
      arr.push({ ...data, id: uid() });
    }
    lsSet('productos', arr);
    return data.id ? data : arr[arr.length - 1];
  }
  const userIdProd = await getUserId();
  if (!userIdProd) throw new Error('Not authenticated');
  if (!data.nombre || !String(data.nombre).trim()) throw new Error('El nombre del producto es obligatorio');
  const fields = {
    nombre: String(data.nombre).trim(),
    marca: data.marca || null,
    precio: requireMontoValido(data.precio, 'precio'),
    costo: requireMontoValido(data.costo || 0, 'costo'),
    precio_mayorista: requireMontoValido(data.precio_mayorista || 0, 'precio mayorista'),
    stock: requireMontoValido(data.stock ?? 0, 'stock'),
    stock_minimo: requireMontoValido(data.stock_minimo ?? 5, 'stock mínimo'),
  };
  if (data.id) {
    // El historial se inserta en paralelo solo si cambiaron los precios
    const { data: prev } = await supabase.from('productos').select('precio, costo, precio_mayorista').eq('id', data.id).single();
    const tasks = [supabase.from('productos').update(fields).eq('id', data.id).select().single()];
    if (prev && (prev.precio !== data.precio || prev.costo !== data.costo || prev.precio_mayorista !== (data.precio_mayorista || 0))) {
      tasks.push(supabase.from('productos_precio_historial').insert({
        producto_id: data.id,
        precio: prev.precio,
        costo: prev.costo,
        precio_mayorista: prev.precio_mayorista || 0,
      }));
    }
    const [{ data: row, error }] = await Promise.all(tasks);
    if (error) throw friendlyError(error);
    return mapProducto(row);
  }
  const negocioIdP = getCachedNegocioId();
  const id = uid();
  fields.id = id;
  fields.user_id = userIdProd;
  if (negocioIdP) fields.negocio_id = negocioIdP;
  const { error } = await supabase.from('productos').insert(fields);
  if (error) throw friendlyError(error);
  return mapProducto({ id, ...fields });
}

function mapProducto(r) {
  return {
    id: r.id,
    nombre: r.nombre,
    marca: r.marca || null,
    precio: r.precio,
    costo: r.costo || 0,
    precio_mayorista: r.precio_mayorista || 0,
    stock: r.stock ?? 0,
    stock_minimo: r.stock_minimo ?? 5,
  };
}

export async function saveProductosBulk(rows) {
  const num = v => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const validas = [];
  for (const r of rows || []) {
    if (!r.nombre || !String(r.nombre).trim()) continue;
    validas.push({
      nombre: String(r.nombre).trim(),
      marca: r.marca || null,
      precio: num(r.precio),
      costo: num(r.costo),
      precio_mayorista: num(r.precio_mayorista),
      stock: num(r.stock),
      stock_minimo: num(r.stock_minimo ?? 5),
    });
  }
  if (!useSupabase()) {
    const arr = lsGet('productos', []);
    validas.forEach(v => arr.push({ ...v, id: uid() }));
    lsSet('productos', arr);
    return validas.length;
  }
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');
  const negocioId = getCachedNegocioId();
  let importados = 0;
  for (let i = 0; i < validas.length; i += BULK_CHUNK) {
    const chunk = validas.slice(i, i + BULK_CHUNK).map(v => ({
      ...v,
      id: uid(),
      user_id: userId,
      ...(negocioId ? { negocio_id: negocioId } : {}),
    }));
    const { error } = await supabase.from('productos').insert(chunk);
    if (!error) importados += chunk.length;
  }
  return importados;
}

export async function deleteProducto(id) {
  if (!useSupabase()) {
    const arr = lsGet('productos', []).filter(x => x.id !== id);
    lsSet('productos', arr);
    return id;
  }
  const negocioIdProd = getCachedNegocioId();
  let q = supabase.from('productos').delete().eq('id', id);
  if (negocioIdProd) q = q.eq('negocio_id', negocioIdProd);
  const { data, error } = await q.select('id');
  if (error) throw friendlyError(error);
  if (!data || data.length === 0) {
    throw new Error('No se pudo eliminar el producto: no tenés permiso o ya no existe.');
  }
  return id;
}

// Ajusta el stock de un producto (delta negativo = descuento, nunca queda negativo)
export async function ajustarStock(productoId, delta) {
  if (!useSupabase()) {
    const arr = lsGet('productos', []);
    const i = arr.findIndex(p => p.id === productoId);
    if (i >= 0) {
      arr[i].stock = Math.max(0, (arr[i].stock || 0) + delta);
      lsSet('productos', arr);
    }
    return;
  }
  // Ajuste atómico en una sola ida (antes: SELECT + UPDATE)
  await supabase.rpc('ajustar_stock', { p_producto_id: productoId, p_delta: delta });
}

// ── PEDIDOS ───────────────────────────────────────────────

export async function getPedidos() {
  if (!useSupabase()) return lsGet('pedidos', []);

  // Fetch pedidos and items in separate queries to avoid RLS join issues
  const [{ data: pedRows, error: pedErr }, { data: itemRows, error: itemErr }] = await Promise.all([
    fetchAllRows(() => supabase
      .from('pedidos')
      .select('id, nro, cliente_id, fecha, total_calculado, total_final, medio_pago, cuotas, cobrado, monto_abonado, nota, created_at, dias_plazo, tasa_mora, tipo, confirmado, descuento_tipo, descuento_valor')
      .order('created_at', { ascending: false })
      .order('id')),
    fetchAllRows(() => supabase
      .from('pedido_items')
      .select('id, pedido_id, producto_id, nombre, cantidad, precio_unitario, costo_unitario, entregado, fecha_entrega')
      .order('pedido_id')
      .order('id')),
  ]);

  if (pedErr) {
    // Error real (red/RLS): caemos a la última caché conocida para no romper UI.
    console.error('[getPedidos] pedidos query failed:', pedErr.message);
    return lsGet('pedidos', []);
  }
  if (!pedRows) {
    return lsGet('pedidos', []);
  }
  if (pedRows.length === 0) {
    // La query funcionó y no hay pedidos: confiar en la DB y sincronizar la
    // caché. Antes devolvía la caché vieja y "resucitaba" pedidos borrados.
    lsSet('pedidos', []);
    return [];
  }

  // Build items map (ignore if items query failed due to RLS)
  const itemsByPedido = {};
  if (!itemErr && itemRows) {
    itemRows.forEach(i => {
      if (!itemsByPedido[i.pedido_id]) itemsByPedido[i.pedido_id] = [];
      itemsByPedido[i.pedido_id].push(i);
    });
  }

  const mapped = pedRows.map((r, idx) => ({
    id: r.id,
    fetchOrder: idx,
    nro: r.nro,
    clienteId: r.cliente_id,
    fecha: r.fecha,
    totalCalculado: r.total_calculado,
    totalFinal: r.total_final,
    medioPago: r.medio_pago === 'fiado' ? 'tarjeta' : r.medio_pago,
    cuotas: r.cuotas || 1,
    cobrado: r.cobrado,
    montoAbonado: r.monto_abonado || 0,
    nota: r.nota || null,
    createdAt: r.created_at || r.fecha,
    diasPlazo: r.dias_plazo || 0,
    tasaMora: r.tasa_mora || 0,
    tipo: r.tipo || 'pedido',
    confirmado: r.confirmado ?? true,
    descuentoTipo: r.descuento_tipo || null,
    descuentoValor: r.descuento_valor || 0,
    items: (itemsByPedido[r.id] || []).map(i => ({
      id: i.id,
      productoId: i.producto_id,
      nombre: i.nombre,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
      costoUnitario: i.costo_unitario || 0,
      entregado: i.entregado || false,
      fechaEntrega: i.fecha_entrega || null,
    })),
  }));
  lsSet('pedidos', mapped);
  return mapped;
}

export async function savePedido(data) {
  const localNegocio = JSON.parse(localStorage.getItem('sg_negocio') || '{}');
  const numInicial = parseInt(localNegocio.num_inicial) || 1;

  if (!useSupabase()) {
    const arr = lsGet('pedidos', []);
    const maxNro = arr.reduce((max, p) => Math.max(max, p.nro || 0), 0);
    const nextNro = maxNro > 0 ? Math.max(maxNro + 1, numInicial) : numInicial;
    const pedido = { ...data, id: data.id || uid(), nro: data.nro || nextNro, tipo: data.tipo || 'pedido' };
    arr.push(pedido);
    lsSet('pedidos', arr);
    // Descontar stock si es pedido real
    if (pedido.tipo !== 'presupuesto' && pedido.items) {
      for (const item of pedido.items) {
        if (item.productoId) await ajustarStock(item.productoId, -item.cantidad);
      }
    }
    return arr;
  }
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');
  if (!isUUID(data.clienteId)) {
    throw new Error('Este cliente fue creado sin conexión. Eliminalo y volvé a crearlo para poder guardar pedidos.');
  }
  requireMontoValido(data.totalCalculado, 'total');
  requireMontoValido(data.totalFinal, 'total final');
  requireMontoValido(data.montoAbonado || 0, 'monto abonado');
  if (Number(data.totalFinal) > Number(data.totalCalculado) + 0.01) {
    throw new Error('El total final no puede ser mayor al subtotal');
  }
  if (Number(data.montoAbonado || 0) > Number(data.totalFinal) + 0.01) {
    throw new Error('El monto abonado no puede ser mayor al total');
  }
  if (data.descuentoTipo === 'porcentaje' && Number(data.descuentoValor || 0) > 100) {
    throw new Error('El descuento no puede superar el 100%');
  }
  if (data.descuentoTipo === 'monto_fijo' && Number(data.descuentoValor || 0) > Number(data.totalCalculado) + 0.01) {
    throw new Error('El descuento no puede ser mayor al subtotal');
  }
  if (!data.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) throw new Error('La fecha del pedido no es válida');
  if (!Array.isArray(data.items) || !data.items.length) throw new Error('El pedido necesita al menos un ítem');
  for (const i of data.items) {
    if (!i.nombre || !String(i.nombre).trim()) throw new Error('Todos los ítems necesitan un nombre');
    if (!Number.isFinite(Number(i.cantidad)) || Number(i.cantidad) <= 0) throw new Error('Las cantidades deben ser mayores a cero');
    requireMontoValido(i.precioUnitario, 'precio unitario');
  }

  // Número secuencial: si el caller ya lo calculó en memoria, evitamos el query.
  let nextNro = data.nro;
  if (!nextNro) {
    const { data: maxData } = await supabase
      .from('pedidos')
      .select('nro')
      .order('nro', { ascending: false })
      .limit(1);
    const maxNro = maxData && maxData[0] ? (maxData[0].nro || 0) : 0;
    nextNro = maxNro > 0 ? Math.max(maxNro + 1, numInicial) : numInicial;
  }

  const negocioIdPed = getCachedNegocioId();
  // Id client-side: ahorra el .select().single() de vuelta (mismo patrón que
  // gastos/cobros).
  const pedidoId = (data.id && isUUID(data.id)) ? data.id : (crypto?.randomUUID?.() || uid());
  const insertRow = (nro) => supabase
    .from('pedidos')
    .insert({
      id: pedidoId,
      ...(negocioIdPed ? { negocio_id: negocioIdPed } : {}),
      user_id: userId,
      cliente_id: data.clienteId,
      fecha: data.fecha,
      total_calculado: data.totalCalculado,
      total_final: data.totalFinal,
      medio_pago: data.medioPago,
      cuotas: data.cuotas || 1,
      cobrado: data.cobrado || false,
      monto_abonado: data.montoAbonado || 0,
      nota: data.nota || null,
      tipo: data.tipo || 'pedido',
      confirmado: data.confirmado ?? true,
      descuento_tipo: data.descuentoTipo || null,
      descuento_valor: data.descuentoValor || 0,
      dias_plazo: data.diasPlazo || 0,
      tasa_mora: data.tasaMora || 0,
      nro,
    });

  // El pedido va primero (los items dependen del FK). Si otro dispositivo usó
  // el mismo nro, el índice único (migration 024) responde 23505: recalculamos
  // desde la DB y reintentamos.
  let { error: ePed } = await insertRow(nextNro);
  let intentos = 0;
  while (ePed && ePed.code === '23505' && intentos < 3) {
    const { data: maxData } = await supabase
      .from('pedidos')
      .select('nro')
      .order('nro', { ascending: false })
      .limit(1);
    nextNro = Math.max(((maxData && maxData[0] && maxData[0].nro) || 0) + 1, numInicial);
    ({ error: ePed } = await insertRow(nextNro));
    intentos++;
  }
  if (ePed) throw friendlyError(ePed);

  const tareas = [];
  if (data.items && data.items.length) {
    const items = data.items.map(i => ({
      pedido_id: pedidoId,
      producto_id: i.productoId || null,
      nombre: i.nombre,
      cantidad: i.cantidad,
      precio_unitario: i.precioUnitario,
      costo_unitario: i.costoUnitario || 0,
      entregado: i.entregado || false,
      fecha_entrega: i.fechaEntrega || null,
    }));
    tareas.push(
      supabase.from('pedido_items').insert(items).then(({ error: eItems }) => {
        if (eItems) throw friendlyError(eItems);
      })
    );
  }
  if (data.tipo !== 'presupuesto' && data.items) {
    const deltaPorProducto = new Map();
    for (const item of data.items) {
      if (item.productoId && isUUID(item.productoId)) {
        deltaPorProducto.set(item.productoId, (deltaPorProducto.get(item.productoId) || 0) - item.cantidad);
      }
    }
    for (const [pid, delta] of deltaPorProducto) tareas.push(ajustarStock(pid, delta));
  }
  await Promise.all(tareas);

  return {
    id: pedidoId,
    fetchOrder: -1,
    clienteId: data.clienteId,
    fecha: data.fecha,
    totalCalculado: data.totalCalculado,
    totalFinal: data.totalFinal,
    medioPago: data.medioPago,
    cuotas: data.cuotas || 1,
    cobrado: data.cobrado || false,
    montoAbonado: data.montoAbonado || 0,
    nota: data.nota || null,
    createdAt: data.fecha,
    diasPlazo: data.diasPlazo || 0,
    tasaMora: data.tasaMora || 0,
    tipo: data.tipo || 'pedido',
    confirmado: data.confirmado ?? true,
    descuentoTipo: data.descuentoTipo || null,
    descuentoValor: data.descuentoValor || 0,
    nro: nextNro,
    items: (data.items || []).map(i => ({
      id: uid(),
      productoId: i.productoId || null,
      nombre: i.nombre,
      cantidad: i.cantidad,
      precioUnitario: i.precioUnitario,
      costoUnitario: i.costoUnitario || 0,
      entregado: i.entregado || false,
      fechaEntrega: i.fechaEntrega || null,
    })),
  };
}

export async function updatePedido(id, data) {
  if (!useSupabase()) {
    const arr = lsGet('pedidos', []);
    const i = arr.findIndex(x => x.id === id);
    if (i >= 0) arr[i] = { ...arr[i], ...data };
    lsSet('pedidos', arr);
    return arr;
  }

  const update = {};
  if ('cobrado' in data) update.cobrado = data.cobrado;
  if ('montoAbonado' in data) update.monto_abonado = requireMontoValido(data.montoAbonado, 'monto abonado');
  if ('totalFinal' in data) update.total_final = requireMontoValido(data.totalFinal, 'total final');
  if ('totalCalculado' in data) update.total_calculado = requireMontoValido(data.totalCalculado, 'total');
  if ('medioPago' in data) update.medio_pago = data.medioPago;
  if ('cuotas' in data) update.cuotas = data.cuotas;
  if ('nota' in data) update.nota = data.nota;
  if ('tipo' in data) update.tipo = data.tipo;
  if ('clienteId' in data) update.cliente_id = data.clienteId;
  if ('fecha' in data) update.fecha = data.fecha;
  if ('descuentoTipo' in data) update.descuento_tipo = data.descuentoTipo;
  if ('descuentoValor' in data) update.descuento_valor = data.descuentoValor;
  if ('diasPlazo' in data) update.dias_plazo = data.diasPlazo;
  if ('tasaMora' in data) update.tasa_mora = data.tasaMora;
  if ('confirmado' in data) update.confirmado = data.confirmado;

  // Si cambian los items, el stock debe reflejar la diferencia: devolvemos el
  // stock de los items viejos y descontamos el de los nuevos (neto por producto).
  let stockDeltas = null;
  if (data.items) {
    const [{ data: oldItems }, { data: pedRow }] = await Promise.all([
      supabase.from('pedido_items').select('producto_id, cantidad').eq('pedido_id', id),
      supabase.from('pedidos').select('tipo').eq('id', id).maybeSingle(),
    ]);
    const tipoPrevio = pedRow?.tipo || 'pedido';
    const tipoFinal = 'tipo' in data ? (data.tipo || 'pedido') : tipoPrevio;
    const deltas = new Map();
    if (tipoPrevio !== 'presupuesto') {
      for (const it of oldItems || []) {
        if (it.producto_id) deltas.set(it.producto_id, (deltas.get(it.producto_id) || 0) + Number(it.cantidad));
      }
    }
    if (tipoFinal !== 'presupuesto') {
      for (const it of data.items) {
        if (it.productoId && isUUID(it.productoId)) {
          deltas.set(it.productoId, (deltas.get(it.productoId) || 0) - Number(it.cantidad));
        }
      }
    }
    stockDeltas = deltas;
  }

  // El UPDATE del pedido y el reemplazo de items van en paralelo. El reemplazo
  // es una RPC transaccional (migration 024): si algo falla, el pedido no
  // queda sin items como pasaba con el DELETE + INSERT en requests separados.
  const itemsPayload = data.items
    ? data.items.map(i => ({
        producto_id: (i.productoId && isUUID(i.productoId)) ? i.productoId : null,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precioUnitario,
        costo_unitario: i.costoUnitario || 0,
        entregado: i.entregado || false,
        fecha_entrega: i.fechaEntrega || null,
      }))
    : null;
  const tasks = [supabase.from('pedidos').update(update).eq('id', id)];
  if (itemsPayload) {
    tasks.push(supabase.rpc('reemplazar_pedido_items', { p_pedido_id: id, p_items: itemsPayload }));
  }
  const [updRes, rpcRes] = await Promise.all(tasks);
  if (updRes.error) throw friendlyError(updRes.error);
  if (rpcRes?.error) {
    // Fallback si la migration 024 todavía no está aplicada en este entorno.
    if (/could not find the function/i.test(rpcRes.error.message || '')) {
      const del = await supabase.from('pedido_items').delete().eq('pedido_id', id);
      if (del.error) throw friendlyError(del.error);
      if (itemsPayload.length) {
        const ins = await supabase.from('pedido_items').insert(itemsPayload.map(i => ({ ...i, pedido_id: id })));
        if (ins.error) throw friendlyError(ins.error);
      }
    } else {
      throw friendlyError(rpcRes.error);
    }
  }

  if (stockDeltas) {
    await Promise.all(
      [...stockDeltas].filter(([, d]) => d !== 0).map(([pid, d]) => ajustarStock(pid, d))
    );
  }

  // Devolver el pedido actualizado en memoria (sin re-fetch completo)
  return { id, ...data };
}

export async function deletePedido(id) {
  if (!useSupabase()) {
    const arr = lsGet('pedidos', []).filter(x => x.id !== id);
    lsSet('pedidos', arr);
    return id;
  }
  // Antes de borrar, capturamos tipo e items para devolver el stock que el
  // pedido había descontado (eliminar = la venta nunca ocurrió).
  const [{ data: pedRow }, { data: items }] = await Promise.all([
    supabase.from('pedidos').select('tipo').eq('id', id).maybeSingle(),
    supabase.from('pedido_items').select('producto_id, cantidad').eq('pedido_id', id),
  ]);
  // .select() para verificar que realmente se borró una fila. Si RLS bloquea,
  // PostgREST no tira error pero borra 0 filas — eso causaría un "fantasma".
  const negocioIdDel = getCachedNegocioId();
  let q = supabase.from('pedidos').delete().eq('id', id);
  if (negocioIdDel) q = q.eq('negocio_id', negocioIdDel);
  const { data, error } = await q.select('id');
  if (error) throw friendlyError(error);
  if (!data || data.length === 0) {
    throw new Error('No se pudo eliminar el pedido: no tenés permiso o ya no existe.');
  }
  if (pedRow && pedRow.tipo !== 'presupuesto') {
    const deltas = new Map();
    for (const it of items || []) {
      if (it.producto_id) deltas.set(it.producto_id, (deltas.get(it.producto_id) || 0) + Number(it.cantidad));
    }
    await Promise.all([...deltas].map(([pid, d]) => ajustarStock(pid, d)));
  }
  return id;
}

export async function marcarPedidoEntregado(pedidoId) {
  const hoy = new Date().toISOString().split('T')[0];
  if (!useSupabase()) {
    const arr = lsGet('pedidos', []);
    const i = arr.findIndex(p => p.id === pedidoId);
    if (i >= 0) {
      arr[i].items = arr[i].items.map(it => ({ ...it, entregado: true, fechaEntrega: it.fechaEntrega || hoy }));
      arr[i].confirmado = true;
    }
    lsSet('pedidos', arr);
    return { id: pedidoId, fechaEntrega: hoy };
  }
  // Items + pedido en paralelo (ambos solo dependen del pedidoId)
  const [{ error: eItems }, { error: ePedido }] = await Promise.all([
    supabase.from('pedido_items').update({ entregado: true, fecha_entrega: hoy }).eq('pedido_id', pedidoId).eq('entregado', false),
    supabase.from('pedidos').update({ confirmado: true }).eq('id', pedidoId),
  ]);
  if (eItems) throw eItems;
  if (ePedido) throw ePedido;
  return { id: pedidoId, fechaEntrega: hoy };
}

export async function revertirPedidoEntregado(pedidoId) {
  if (!useSupabase()) {
    const arr = lsGet('pedidos', []);
    const i = arr.findIndex(p => p.id === pedidoId);
    if (i >= 0) arr[i].items = arr[i].items.map(it => ({ ...it, entregado: false, fechaEntrega: null }));
    lsSet('pedidos', arr);
    return pedidoId;
  }
  const { error } = await supabase
    .from('pedido_items')
    .update({ entregado: false, fecha_entrega: null })
    .eq('pedido_id', pedidoId);
  if (error) throw error;
  return pedidoId;
}


// Convierte un presupuesto en pedido real — irreversible, descuenta stock
export async function convertirPresupuesto(pedidoId) {
  if (!useSupabase()) {
    const arr = lsGet('pedidos', []);
    const i = arr.findIndex(p => p.id === pedidoId);
    if (i >= 0 && arr[i].tipo === 'presupuesto') {
      for (const item of arr[i].items || []) {
        if (item.productoId) await ajustarStock(item.productoId, -item.cantidad);
      }
      arr[i].tipo = 'pedido';
      lsSet('pedidos', arr);
    }
    return arr;
  }
  const { data: items, error: eItems } = await supabase
    .from('pedido_items')
    .select('producto_id, cantidad')
    .eq('pedido_id', pedidoId);
  if (eItems) throw eItems;
  const { error } = await supabase
    .from('pedidos')
    .update({ tipo: 'pedido' })
    .eq('id', pedidoId);
  if (error) throw error;
  // Deltas agrupados por producto y en paralelo (mismo patrón que savePedido)
  const deltas = new Map();
  for (const item of items || []) {
    if (item.producto_id) deltas.set(item.producto_id, (deltas.get(item.producto_id) || 0) - Number(item.cantidad));
  }
  await Promise.all([...deltas].map(([pid, d]) => ajustarStock(pid, d)));
  return getPedidos();
}

// ── GASTOS ────────────────────────────────────────────────

export async function getGastos() {
  if (!useSupabase()) return lsGet('gastos', []);
  const { data, error } = await fetchAllRows(() => supabase
    .from('gastos')
    .select('id, fecha, descripcion, monto, categoria, created_at')
    .order('fecha', { ascending: false })
    .order('id'));
  if (error) {
    console.error('[getGastos] failed:', error.message);
    return lsGet('gastos', []);
  }
  const mapped = data.map(r => ({
    id: r.id,
    fecha: r.fecha,
    descripcion: r.descripcion,
    monto: r.monto,
    categoria: r.categoria,
    createdAt: r.created_at || null,
  }));
  lsSet('gastos', mapped);
  return mapped;
}

export async function saveGasto(data) {
  if (!useSupabase()) {
    const arr = lsGet('gastos', []);
    const nuevo = { ...data, id: uid() };
    arr.push(nuevo);
    lsSet('gastos', arr);
    return nuevo;
  }
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');
  if (!data.descripcion || !String(data.descripcion).trim()) throw new Error('La descripción del gasto es obligatoria');
  if (!data.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) throw new Error('La fecha del gasto no es válida');
  const monto = Number(data.monto);
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('El monto debe ser mayor a cero');
  const negocioId = getCachedNegocioId();
  // Generamos id en el cliente para evitar el .select() de vuelta (un round-trip
  // menos). El INSERT viaja con Prefer: return=minimal — Supabase responde con
  // 201 y nada en el body. Más rápido en redes con latencia alta.
  const id = (crypto?.randomUUID?.() || uid());
  const payload = {
    id,
    user_id: userId,
    fecha: data.fecha,
    descripcion: String(data.descripcion).trim(),
    monto,
    categoria: data.categoria,
  };
  if (negocioId) payload.negocio_id = negocioId;
  const { error } = await supabase.from('gastos').insert(payload);
  if (error) throw friendlyError(error);
  return { id, fecha: data.fecha, descripcion: payload.descripcion, monto, categoria: data.categoria };
}

export async function deleteGasto(id) {
  if (!useSupabase()) {
    const arr = lsGet('gastos', []).filter(x => x.id !== id);
    lsSet('gastos', arr);
    return id;
  }
  const negocioIdG = getCachedNegocioId();
  let q = supabase.from('gastos').delete().eq('id', id);
  if (negocioIdG) q = q.eq('negocio_id', negocioIdG);
  const { data, error } = await q.select('id');
  if (error) throw friendlyError(error);
  if (!data || data.length === 0) {
    throw new Error('No se pudo eliminar el gasto: no tenés permiso o ya no existe.');
  }
  return id;
}

// ── COBROS SUELTOS ────────────────────────────────────────

function validarCobro(data) {
  const monto = Number(data.monto);
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('El monto debe ser un número mayor a cero');
  if (!data.descripcion || !String(data.descripcion).trim()) throw new Error('La descripción es obligatoria');
  if (String(data.descripcion).trim().length > 300) throw new Error('La descripción no puede superar los 300 caracteres');
  if (!data.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) throw new Error('La fecha no es válida');
  if (!data.metodo || !String(data.metodo).trim()) throw new Error('Elegí un método de cobro');
  const clienteId = data.clienteId || null;
  if (clienteId && !isUUID(clienteId)) throw new Error('El cliente seleccionado no es válido');
  return {
    fecha: data.fecha,
    monto,
    descripcion: String(data.descripcion).trim(),
    metodo: String(data.metodo).trim().toLowerCase(),
    cliente_id: clienteId,
  };
}

export async function getCobros() {
  if (!useSupabase()) return lsGet('cobros', []);
  const { data, error } = await fetchAllRows(() => supabase
    .from('cobros')
    .select('id, fecha, monto, descripcion, metodo, cliente_id')
    .order('fecha', { ascending: false })
    .order('id'));
  if (error) {
    console.error('[getCobros] failed:', error.message);
    return lsGet('cobros', []);
  }
  const mapped = data.map(r => ({
    id: r.id,
    fecha: r.fecha,
    monto: r.monto,
    descripcion: r.descripcion,
    metodo: r.metodo,
    clienteId: r.cliente_id || null,
  }));
  lsSet('cobros', mapped);
  return mapped;
}

export async function saveCobro(data) {
  const fields = validarCobro(data);
  if (!useSupabase()) {
    const arr = lsGet('cobros', []);
    const nuevo = { ...fields, id: uid() };
    arr.unshift(nuevo);
    lsSet('cobros', arr);
    return nuevo;
  }
  if (!(await getUserId())) throw new Error('Not authenticated');
  const negocioIdCo = getCachedNegocioId();
  if (negocioIdCo) fields.negocio_id = negocioIdCo;
  const id = uid();
  fields.id = id;
  const { error } = await supabase.from('cobros').insert(fields);
  if (error) throw friendlyError(error);
  return { id, fecha: fields.fecha, monto: fields.monto, descripcion: fields.descripcion, metodo: fields.metodo, clienteId: fields.cliente_id || null };
}

export async function deleteCobro(id) {
  if (!useSupabase()) {
    const arr = lsGet('cobros', []).filter(x => x.id !== id);
    lsSet('cobros', arr);
    return id;
  }
  const negocioIdDelCo = getCachedNegocioId();
  let q = supabase.from('cobros').delete().eq('id', id);
  if (negocioIdDelCo) q = q.eq('negocio_id', negocioIdDelCo);
  const { data, error } = await q.select('id');
  if (error) throw friendlyError(error);
  if (!data || data.length === 0) {
    throw new Error('No se pudo eliminar el cobro: no tenés permiso o ya no existe.');
  }
  return id;
}

// ── CATEGORIAS ────────────────────────────────────────────

export async function getCategorias() {
  if (!useSupabase()) return lsGet('categorias', DEFAULT_CATS);
  const { data, error } = await supabase
    .from('categorias')
    .select('nombre')
    .order('nombre');
  if (error || !data.length) return lsGet('categorias', DEFAULT_CATS);
  const mapped = data.map(r => r.nombre);
  lsSet('categorias', mapped);
  return mapped;
}

// ── WHITELIST / OWNER ─────────────────────────────────────

export async function emailHasPassword(email) {
  if (!useSupabase()) return true;
  const v = String(email || '').trim();
  if (!v) return false;
  const { data, error } = await supabase.rpc('email_has_password', { p_email: v });
  if (error) return null;
  return data === true;
}

export async function updateUserPassword(newPassword) {
  // Validación cliente: el mínimo de longitud lo refuerza Supabase Auth
  // (default 6 chars)
  const pw = String(newPassword || '');
  if (pw.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
  if (pw.length > 72) throw new Error('La contraseña no puede superar 72 caracteres');
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) throw new Error(error.message || 'No se pudo actualizar la contraseña');
  return true;
}

export async function isEmailAllowed(email) {
  if (!useSupabase()) return true;
  const superadmin = import.meta.env.VITE_SUPERADMIN_EMAIL;
  if (superadmin && email.toLowerCase().trim() === superadmin.toLowerCase().trim()) return true;

  const { data, error } = await supabase.rpc('check_email_allowed', { p_email: email.trim() });
  if (error) return null;
  return data === true;
}

export async function checkPrimerAcceso(email) {
  if (!useSupabase()) return true;
  const v = String(email || '').trim();
  if (!v) return false;
  const { data, error } = await supabase.rpc('check_primer_acceso', { p_email: v });
  if (error) {
    if (error.message.includes('Could not find the function')) {
      const allowed = await isEmailAllowed(v);
      if (allowed === false) {
        throw new Error('Este email no tiene acceso. Contactá al administrador.');
      }
      const hasPw = await emailHasPassword(v);
      if (hasPw === true) {
        throw new Error('Este email ya está registrado con una contraseña. Iniciá sesión con tu contraseña.');
      }
      return true;
    }
    throw new Error(error.message || 'Error al verificar el acceso inicial');
  }
  return data === true;
}

export async function getAllowedEmails() {
  if (!useSupabase()) return [];
  const { data, error } = await supabase
    .from('allowed_emails')
    .select('id, email, is_owner, rol, trial_activo, owner_user_id, created_at')
    .order('created_at', { ascending: true });
  if (error) return [];
  return data;
}

export async function addAllowedEmail(email, rol = 'vendedor') {
  const { error } = await supabase.rpc('add_member_email', { p_email: email, p_rol: rol });
  if (error) throw error;
  return getAllowedEmails();
}

export async function updateMemberRol(id, rol) {
  const { error } = await supabase.rpc('update_member_rol', { p_member_id: id, p_nuevo_rol: rol });
  if (error) throw error;
  return getAllowedEmails();
}

export async function removeAllowedEmail(id) {
  const { error } = await supabase.rpc('remove_member_email', { p_member_id: id });
  if (error) throw error;
  return getAllowedEmails();
}

// ── ALERTAS ───────────────────────────────────────────────

export async function getAlertasConfig() {
  if (!useSupabase()) return { dias_sin_cobro: 7 };
  const { data } = await supabase
    .from('alertas_config')
    .select('*')
    .maybeSingle();
  return data || { dias_sin_cobro: 7 };
}

export async function saveAlertasConfig(diasSinCobro) {
  if (!useSupabase()) return;
  const { data: negocioId } = await supabase.rpc('mi_negocio_id');
  if (!negocioId) return;
  const { data: existing } = await supabase
    .from('alertas_config')
    .select('id')
    .eq('negocio_id', negocioId)
    .maybeSingle();
  if (existing) {
    await supabase.from('alertas_config').update({ dias_sin_cobro: diasSinCobro }).eq('id', existing.id);
  } else {
    const userId = await getUserId();
    await supabase.from('alertas_config').insert({ user_id: userId, dias_sin_cobro: diasSinCobro });
  }
}

// ── SUSCRIPCIONES ─────────────────────────────────────────

// Límite de usuarios (asientos) del negocio actual.
// { limite: number|null (null = ilimitado), usados: number, plan: string|null }
export async function getMiPlanAsientos() {
  if (!useSupabase()) return { limite: null, usados: 0, plan: null };
  const { data, error } = await supabase.rpc('mi_plan_asientos');
  if (error || !data) return { limite: null, usados: 0, plan: null };
  return data;
}

export async function getSuscripcion() {
  if (!useSupabase()) return null;
  const { data } = await supabase
    .from('suscripciones')
    .select('*, planes(*)')
    .maybeSingle();
  return data;
}

export async function crearSuscripcionTrial() {
  if (!useSupabase()) return null;
  const { data: sessData } = await supabase.auth.getSession();
  const userId = sessData?.session?.user?.id;
  const email = sessData?.session?.user?.email;
  if (!userId) return null;

  const hoy = new Date();
  const vencimiento = new Date(hoy);
  vencimiento.setDate(vencimiento.getDate() + 14);

  const { data, error } = await supabase
    .from('suscripciones')
    .insert({
      user_id: userId,
      user_email: email,
      estado: 'prueba',
      fecha_inicio: hoy.toISOString().slice(0, 10),
      fecha_vencimiento: vencimiento.toISOString().slice(0, 10),
    })
    .select()
    .single();
  if (error) return null;
  return data;
}

// ── PANEL SUPERADMIN ──────────────────────────────────────
// Todas estas funciones pasan por RPCs security definer gateadas
// con es_superadmin() en el backend — el frontend no decide nada.

export async function esSuperadmin() {
  if (!useSupabase()) return false;
  const { data, error } = await supabase.rpc('es_superadmin');
  if (error) return false;
  return data === true;
}

// Lista todas las suscripciones del sistema (solo superadmin)
export async function getSuscripciones() {
  if (!useSupabase()) return [];
  const { data, error } = await supabase.rpc('admin_suscripciones');
  if (error) return [];
  return data || [];
}

// Whitelist global: todos los emails con acceso, su rol y negocio (solo superadmin)
export async function getAdminWhitelist() {
  if (!useSupabase()) return [];
  const { data, error } = await supabase.rpc('admin_whitelist');
  if (error) return [];
  return data || [];
}

// Actualiza estado de una suscripción (solo superadmin)
export async function updateSuscripcion(id, changes) {
  const { error } = await supabase.rpc('admin_update_suscripcion', {
    p_id: id,
    p_estado: changes.estado,
  });
  if (error) throw friendlyError(error);
  return getSuscripciones();
}

// Extiende la suscripción 30 días (solo superadmin)
export async function renovarSuscripcion(suscripcionId) {
  const { error } = await supabase.rpc('admin_renovar_suscripcion', { p_id: suscripcionId });
  if (error) throw friendlyError(error);
  return getSuscripciones();
}

// Lista los planes activos (solo superadmin)
export async function getAdminPlanes() {
  if (!useSupabase()) return [];
  const { data, error } = await supabase.rpc('admin_planes');
  if (error) return [];
  return data || [];
}

// Asigna (o quita, con planId null) un plan a una suscripción (solo superadmin)
export async function adminSetPlan(suscripcionId, planId) {
  const { error } = await supabase.rpc('admin_set_plan', { p_suscripcion_id: suscripcionId, p_plan_id: planId || null });
  if (error) throw friendlyError(error);
  return getSuscripciones();
}

// Autoriza un email como dueño de un negocio nuevo (solo superadmin).
// Devuelve la whitelist actualizada.
export async function adminGrantOwner(email) {
  const clean = String(email || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error('Ingresá un email válido');
  const { data, error } = await supabase.rpc('admin_grant_owner', { p_email: clean });
  if (error) throw friendlyError(error);
  return data || [];
}

// Quita un email de la whitelist y desactiva sus membresías (solo superadmin).
// Devuelve la whitelist actualizada.
export async function adminRevokeAccess(email) {
  const clean = String(email || '').toLowerCase().trim();
  const { data, error } = await supabase.rpc('admin_revoke_access', { p_email: clean });
  if (error) throw friendlyError(error);
  return data || [];
}

// ── CUOTAS VENCIDAS ───────────────────────────────────────
// Antes las cuotas vencidas se marcaban como COBRADAS automáticamente, lo que
// inflaba caja y estadísticas sin que hubiera un pago real. Ahora solo se
// detectan: la UI avisa y el cobro se registra a mano (Cobrar / Pago parcial).

// Aviso una vez por día (el cálculo es determinístico por fecha).
export function debeAvisarCuotasHoy() {
  const hoyStr = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem('sg_cuotas_last_run') === hoyStr) return false;
  localStorage.setItem('sg_cuotas_last_run', hoyStr);
  return true;
}

// ── NEGOCIO CONFIG ────────────────────────────────────────

const DEFAULT_NEGOCIO_CONFIG = {
  nombre: 'Mi Negocio',
  logo_url: null,
  moneda: '$',
  telefono: '',
  direccion: '',
  email: '',
  cuit: '',
  nota_pdf: '',
  num_inicial: 1,
  metodos_pago: 'Efectivo, Transferencia, Tarjeta',
  recordatorio_plantilla: '',
  onboarding_done: false
};

export async function getNegocioConfig() {
  if (!useSupabase()) {
    return JSON.parse(localStorage.getItem('sg_negocio') || 'null') || DEFAULT_NEGOCIO_CONFIG;
  }
  const { data } = await supabase.from('negocio_config').select('*').maybeSingle();
  if (data) localStorage.setItem('sg_negocio', JSON.stringify(data));
  return data || DEFAULT_NEGOCIO_CONFIG;
}

export async function saveNegocioConfig(cfg) {
  if (!useSupabase()) {
    localStorage.setItem('sg_negocio', JSON.stringify(cfg));
    return cfg;
  }
  const { data: negocioId } = await supabase.rpc('mi_negocio_id');
  if (!negocioId) return cfg;
  const { data: existing } = await supabase
    .from('negocio_config')
    .select('id')
    .eq('negocio_id', negocioId)
    .maybeSingle();
  let result, error;
  if (existing) {
    ({ data: result, error } = await supabase
      .from('negocio_config')
      .update({ ...cfg, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single());
  } else {
    const userId = await getUserId();
    ({ data: result, error } = await supabase
      .from('negocio_config')
      .insert({ user_id: userId, ...cfg, updated_at: new Date().toISOString() })
      .select()
      .single());
  }
  if (error) throw new Error(error.message);
  localStorage.setItem('sg_negocio', JSON.stringify(result || cfg));
  return result || cfg;
}

// ── DEVOLUCIONES ──────────────────────────────────────────

export async function getDevoluciones() {
  if (!useSupabase()) return JSON.parse(localStorage.getItem('sg_devoluciones') || '[]');
  const { data, error } = await fetchAllRows(() => supabase
    .from('devoluciones')
    .select('id, pedido_id, cliente_id, fecha, motivo, monto_total, devolucion_items(id, producto_id, nombre, cantidad, precio_unitario)')
    .order('fecha', { ascending: false })
    .order('id'));
  if (error) return [];
  return data.map(r => ({
    id: r.id,
    pedidoId: r.pedido_id,
    clienteId: r.cliente_id,
    fecha: r.fecha,
    motivo: r.motivo || '',
    montoTotal: r.monto_total,
    items: (r.devolucion_items || []).map(i => ({
      id: i.id,
      productoId: i.producto_id,
      nombre: i.nombre,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
    })),
  }));
}

export async function saveDevolucion(data) {
  if (!useSupabase()) {
    const arr = JSON.parse(localStorage.getItem('sg_devoluciones') || '[]');
    arr.unshift({ ...data, id: uid() });
    localStorage.setItem('sg_devoluciones', JSON.stringify(arr));
    return getDevoluciones();
  }
  if (!(await getUserId())) throw new Error('Not authenticated');
  requireMontoValido(data.montoTotal, 'monto de la devolución');
  if (!data.items?.length) throw new Error('La devolución necesita al menos un ítem');
  const { data: inserted, error } = await supabase
    .from('devoluciones')
    .insert({
      pedido_id: data.pedidoId,
      cliente_id: data.clienteId,
      fecha: data.fecha,
      motivo: data.motivo || null,
      monto_total: data.montoTotal,
    })
    .select()
    .single();
  if (error) throw friendlyError(error);
  if (data.items?.length) {
    await supabase.from('devolucion_items').insert(
      data.items.map(i => ({
        devolucion_id: inserted.id,
        producto_id: i.productoId || null,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precioUnitario,
      }))
    );
    // Deltas agrupados por producto y en paralelo (mismo patrón que savePedido)
    const deltas = new Map();
    for (const item of data.items) {
      if (item.productoId && isUUID(item.productoId)) {
        deltas.set(item.productoId, (deltas.get(item.productoId) || 0) + Number(item.cantidad));
      }
    }
    await Promise.all([...deltas].map(([pid, d]) => ajustarStock(pid, d)));
  }
  return getDevoluciones();
}

// ── COMUNICACIONES ────────────────────────────────────────

export async function getComunicaciones(clienteId) {
  if (!useSupabase()) return [];
  let query = supabase.from('comunicaciones').select('id, cliente_id, tipo, mensaje, fecha').order('fecha', { ascending: false });
  if (clienteId) query = query.eq('cliente_id', clienteId);
  const { data, error } = await query;
  if (error) return [];
  return data.map(r => ({ id: r.id, clienteId: r.cliente_id, tipo: r.tipo, mensaje: r.mensaje, fecha: r.fecha }));
}

export async function registrarComunicacion(clienteId, tipo, mensaje) {
  if (!useSupabase()) return;
  if (!(await getUserId())) return;
  await supabase.from('comunicaciones').insert({
    cliente_id: clienteId,
    tipo,
    mensaje,
    fecha: new Date().toISOString(),
  });
}

