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

function lsSet(key, val) {
  localStorage.setItem(LS_KEYS[key], JSON.stringify(val));
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

async function getUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id;
}

async function getUserEmail() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.email;
}

// Traduce errores de Postgres (constraints/RLS) a mensajes claros para el usuario
function friendlyError(error) {
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

// ── CLIENTES ─────────────────────────────────────────────

export async function getClientes() {
  if (!useSupabase()) return lsGet('clientes', []);
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('created_at', { ascending: true });
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
    return arr;
  }
  if (!(await getUserId())) throw new Error('Not authenticated');
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
  if (data.id) {
    const { error } = await supabase.from('clientes').update(fields).eq('id', data.id);
    if (error) throw friendlyError(error);
  } else {
    const { error } = await supabase.from('clientes').insert(fields);
    if (error) throw friendlyError(error);
  }
  return getClientes();
}

export async function deleteCliente(id) {
  if (!useSupabase()) {
    const arr = lsGet('clientes', []).filter(x => x.id !== id);
    lsSet('clientes', arr);
    return arr;
  }
  const { error } = await supabase.from('clientes').delete().eq('id', id);
  if (error) throw error;
  return getClientes();
}

// ── PRODUCTOS ─────────────────────────────────────────────

export async function getProductos() {
  if (!useSupabase()) return lsGet('productos', []);
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .order('nombre', { ascending: true });
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
    return arr;
  }
  if (!(await getUserId())) throw new Error('Not authenticated');
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
    // Guardar historial si cambiaron los precios
    const { data: prev } = await supabase.from('productos').select('precio, costo, precio_mayorista').eq('id', data.id).single();
    if (prev && (prev.precio !== data.precio || prev.costo !== data.costo || prev.precio_mayorista !== (data.precio_mayorista || 0))) {
      await supabase.from('productos_precio_historial').insert({
        producto_id: data.id,
        precio: prev.precio,
        costo: prev.costo,
        precio_mayorista: prev.precio_mayorista || 0,
      });
    }
    const { error } = await supabase.from('productos').update(fields).eq('id', data.id);
    if (error) throw friendlyError(error);
  } else {
    const { error } = await supabase.from('productos').insert(fields);
    if (error) throw friendlyError(error);
  }
  return getProductos();
}

export async function deleteProducto(id) {
  if (!useSupabase()) {
    const arr = lsGet('productos', []).filter(x => x.id !== id);
    lsSet('productos', arr);
    return arr;
  }
  const { error } = await supabase.from('productos').delete().eq('id', id);
  if (error) throw error;
  return getProductos();
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
  const { data, error } = await supabase
    .from('productos')
    .select('stock')
    .eq('id', productoId)
    .single();
  if (error || !data) return;
  const nuevoStock = Math.max(0, (data.stock || 0) + delta);
  await supabase.from('productos').update({ stock: nuevoStock }).eq('id', productoId);
}

// ── PEDIDOS ───────────────────────────────────────────────

export async function getPedidos() {
  if (!useSupabase()) return lsGet('pedidos', []);

  // Fetch pedidos and items in separate queries to avoid RLS join issues
  const [{ data: pedRows, error: pedErr }, { data: itemRows, error: itemErr }] = await Promise.all([
    supabase.from('pedidos').select('*').order('created_at', { ascending: false }),
    supabase.from('pedido_items').select('*'),
  ]);

  if (pedErr) {
    console.error('[getPedidos] pedidos query failed:', pedErr.message);
    return lsGet('pedidos', []);
  }
  if (!pedRows || pedRows.length === 0) {
    console.warn('[getPedidos] pedidos returned empty — possible RLS issue or no data');
    return lsGet('pedidos', []);
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
  if (!(await getUserId())) throw new Error('Not authenticated');
  if (!isUUID(data.clienteId)) {
    throw new Error('Este cliente fue creado sin conexión. Eliminalo y volvé a crearlo para poder guardar pedidos.');
  }
  requireMontoValido(data.totalCalculado, 'total');
  requireMontoValido(data.totalFinal, 'total final');
  requireMontoValido(data.montoAbonado || 0, 'monto abonado');
  if (!data.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) throw new Error('La fecha del pedido no es válida');
  if (!Array.isArray(data.items) || !data.items.length) throw new Error('El pedido necesita al menos un ítem');
  for (const i of data.items) {
    if (!i.nombre || !String(i.nombre).trim()) throw new Error('Todos los ítems necesitan un nombre');
    if (!Number.isFinite(Number(i.cantidad)) || Number(i.cantidad) <= 0) throw new Error('Las cantidades deben ser mayores a cero');
    requireMontoValido(i.precioUnitario, 'precio unitario');
  }

  // Calculate next sequential number for Supabase
  const { data: maxData } = await supabase
    .from('pedidos')
    .select('nro')
    .order('nro', { ascending: false })
    .limit(1);
  const maxNro = maxData && maxData[0] ? (maxData[0].nro || 0) : 0;
  const nextNro = maxNro > 0 ? Math.max(maxNro + 1, numInicial) : numInicial;

  const { data: inserted, error } = await supabase
    .from('pedidos')
    .insert({
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
      descuento_tipo: data.descuentoTipo || null,
      descuento_valor: data.descuentoValor || 0,
      dias_plazo: data.diasPlazo || 0,
      tasa_mora: data.tasaMora || 0,
      nro: data.nro || nextNro,
    })
    .select()
    .single();
  if (error) throw friendlyError(error);
  if (data.items && data.items.length) {
    const items = data.items.map(i => ({
      pedido_id: inserted.id,
      producto_id: i.productoId || null,
      nombre: i.nombre,
      cantidad: i.cantidad,
      precio_unitario: i.precioUnitario,
      costo_unitario: i.costoUnitario || 0,
      entregado: i.entregado || false,
      fecha_entrega: i.fechaEntrega || null,
    }));
    const { error: eItems } = await supabase.from('pedido_items').insert(items);
    if (eItems) throw friendlyError(eItems);
  }
  // Solo descuenta stock en pedidos reales (no presupuestos)
  if (data.tipo !== 'presupuesto' && data.items) {
    for (const item of data.items) {
      if (item.productoId && isUUID(item.productoId)) {
        await ajustarStock(item.productoId, -item.cantidad);
      }
    }
  }
  return getPedidos();
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

  const { error } = await supabase.from('pedidos').update(update).eq('id', id);
  if (error) throw friendlyError(error);

  // Re-sync items: delete old, insert new
  if (data.items) {
    const { error: eDel } = await supabase.from('pedido_items').delete().eq('pedido_id', id);
    if (eDel) throw friendlyError(eDel);
    if (data.items.length > 0) {
      const newItems = data.items.map(i => ({
        pedido_id: id,
        producto_id: i.productoId || null,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precioUnitario,
        costo_unitario: i.costoUnitario || 0,
        entregado: i.entregado || false,
        fecha_entrega: i.fechaEntrega || null,
      }));
      const { error: eIns } = await supabase.from('pedido_items').insert(newItems);
      if (eIns) throw friendlyError(eIns);
    }
  }

  return getPedidos();
}

export async function deletePedido(id) {
  if (!useSupabase()) {
    const arr = lsGet('pedidos', []).filter(x => x.id !== id);
    lsSet('pedidos', arr);
    return arr;
  }
  const { error } = await supabase.from('pedidos').delete().eq('id', id);
  if (error) throw error;
  return getPedidos();
}

export async function marcarPedidoEntregado(pedidoId) {
  const hoy = new Date().toISOString().split('T')[0];
  if (!useSupabase()) {
    const arr = lsGet('pedidos', []);
    const i = arr.findIndex(p => p.id === pedidoId);
    if (i >= 0) arr[i].items = arr[i].items.map(it => ({ ...it, entregado: true, fechaEntrega: it.fechaEntrega || hoy }));
    lsSet('pedidos', arr);
    return arr;
  }
  const { error } = await supabase
    .from('pedido_items')
    .update({ entregado: true, fecha_entrega: hoy })
    .eq('pedido_id', pedidoId)
    .eq('entregado', false);
  if (error) throw error;
  return getPedidos();
}

export async function revertirPedidoEntregado(pedidoId) {
  if (!useSupabase()) {
    const arr = lsGet('pedidos', []);
    const i = arr.findIndex(p => p.id === pedidoId);
    if (i >= 0) arr[i].items = arr[i].items.map(it => ({ ...it, entregado: false, fechaEntrega: null }));
    lsSet('pedidos', arr);
    return arr;
  }
  const { error } = await supabase
    .from('pedido_items')
    .update({ entregado: false, fecha_entrega: null })
    .eq('pedido_id', pedidoId);
  if (error) throw error;
  return getPedidos();
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
    .select('*')
    .eq('pedido_id', pedidoId);
  if (eItems) throw eItems;
  const { error } = await supabase
    .from('pedidos')
    .update({ tipo: 'pedido' })
    .eq('id', pedidoId);
  if (error) throw error;
  for (const item of items || []) {
    if (item.producto_id) await ajustarStock(item.producto_id, -item.cantidad);
  }
  return getPedidos();
}

// ── GASTOS ────────────────────────────────────────────────

export async function getGastos() {
  if (!useSupabase()) return lsGet('gastos', []);
  const { data, error } = await supabase
    .from('gastos')
    .select('*')
    .order('fecha', { ascending: false });
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
  }));
  lsSet('gastos', mapped);
  return mapped;
}

export async function saveGasto(data) {
  if (!useSupabase()) {
    const arr = lsGet('gastos', []);
    arr.push({ ...data, id: uid() });
    lsSet('gastos', arr);
    return arr;
  }
  if (!(await getUserId())) throw new Error('Not authenticated');
  if (!data.descripcion || !String(data.descripcion).trim()) throw new Error('La descripción del gasto es obligatoria');
  if (!data.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) throw new Error('La fecha del gasto no es válida');
  const monto = Number(data.monto);
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('El monto debe ser mayor a cero');
  const { error } = await supabase.from('gastos').insert({
    fecha: data.fecha,
    descripcion: String(data.descripcion).trim(),
    monto,
    categoria: data.categoria,
  });
  if (error) throw friendlyError(error);
  return getGastos();
}

export async function deleteGasto(id) {
  if (!useSupabase()) {
    const arr = lsGet('gastos', []).filter(x => x.id !== id);
    lsSet('gastos', arr);
    return arr;
  }
  const { error } = await supabase.from('gastos').delete().eq('id', id);
  if (error) throw error;
  return getGastos();
}

// ── COBROS SUELTOS ────────────────────────────────────────

function validarCobro(data) {
  const monto = Number(data.monto);
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('El monto debe ser un número mayor a cero');
  if (!data.descripcion || !String(data.descripcion).trim()) throw new Error('La descripción es obligatoria');
  if (String(data.descripcion).trim().length > 300) throw new Error('La descripción no puede superar los 300 caracteres');
  if (!data.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) throw new Error('La fecha no es válida');
  if (!data.metodo || !String(data.metodo).trim()) throw new Error('Elegí un método de cobro');
  return {
    fecha: data.fecha,
    monto,
    descripcion: String(data.descripcion).trim(),
    metodo: String(data.metodo).trim().toLowerCase(),
  };
}

export async function getCobros() {
  if (!useSupabase()) return lsGet('cobros', []);
  const { data, error } = await supabase
    .from('cobros')
    .select('*')
    .order('fecha', { ascending: false });
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
  }));
  lsSet('cobros', mapped);
  return mapped;
}

export async function saveCobro(data) {
  const fields = validarCobro(data);
  if (!useSupabase()) {
    const arr = lsGet('cobros', []);
    arr.unshift({ ...fields, id: uid() });
    lsSet('cobros', arr);
    return arr;
  }
  if (!(await getUserId())) throw new Error('Not authenticated');
  const { error } = await supabase.from('cobros').insert(fields);
  if (error) throw friendlyError(error);
  return getCobros();
}

export async function deleteCobro(id) {
  if (!useSupabase()) {
    const arr = lsGet('cobros', []).filter(x => x.id !== id);
    lsSet('cobros', arr);
    return arr;
  }
  const { error } = await supabase.from('cobros').delete().eq('id', id);
  if (error) throw error;
  return getCobros();
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

export async function isEmailAllowed(email) {
  if (!useSupabase()) return true;
  const superadmin = import.meta.env.VITE_SUPERADMIN_EMAIL;
  if (superadmin && email.toLowerCase().trim() === superadmin.toLowerCase().trim()) return true;

  const { data, error } = await supabase.rpc('check_email_allowed', { p_email: email.trim() });
  if (error) return null;
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
  const ownerUserId = await getUserId();
  const { error } = await supabase
    .from('allowed_emails')
    .insert({ email: email.toLowerCase().trim(), rol, owner_user_id: ownerUserId });
  if (error) throw error;
  return getAllowedEmails();
}

export async function updateMemberRol(id, rol) {
  const { error } = await supabase
    .from('allowed_emails')
    .update({ rol })
    .eq('id', id);
  if (error) throw error;
  return getAllowedEmails();
}

export async function removeAllowedEmail(id) {
  const { error } = await supabase.from('allowed_emails').delete().eq('id', id);
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
  const userId = await getUserId();
  const email = await getUserEmail();
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

// Solo owner — lista todas las suscripciones
export async function getSuscripciones() {
  if (!useSupabase()) return [];
  const { data, error } = await supabase
    .from('suscripciones')
    .select('*, planes(*)')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data;
}

// Solo owner — actualiza estado de una suscripción
export async function updateSuscripcion(id, changes) {
  const { error } = await supabase
    .from('suscripciones')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  return getSuscripciones();
}

// Extiende la suscripción actual 30 días más
export async function renovarSuscripcion(suscripcionId) {
  const { data: sus } = await supabase
    .from('suscripciones')
    .select('fecha_vencimiento')
    .eq('id', suscripcionId)
    .single();
  if (!sus) throw new Error('Suscripción no encontrada');
  // Extiende desde hoy si ya venció, desde el vencimiento si todavía no
  const base = new Date(sus.fecha_vencimiento);
  const hoy = new Date();
  const desde = base > hoy ? base : hoy;
  const nuevoVencimiento = new Date(desde);
  nuevoVencimiento.setDate(nuevoVencimiento.getDate() + 30);
  const { error } = await supabase
    .from('suscripciones')
    .update({
      estado: 'activa',
      fecha_vencimiento: nuevoVencimiento.toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq('id', suscripcionId);
  if (error) throw error;
  return getSuscripciones();
}

// ── CUOTAS AUTOMÁTICAS ────────────────────────────────────

export async function procesarCuotasVencidas(pedidos) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const procesados = [];
  const actualizados = pedidos.map(p => {
    if (p.cuotas <= 1 || p.cobrado) return p;

    const fechaPedido = new Date(p.fecha);
    fechaPedido.setHours(0, 0, 0, 0);
    const diasDesde = Math.floor((hoy - fechaPedido) / (1000 * 60 * 60 * 24));

    const montoPorCuota = Math.round((p.totalFinal / p.cuotas) * 100) / 100;
    const cuotasDue = Math.min(p.cuotas, Math.floor(diasDesde / 30) + 1);
    const montoDue  = Math.round(cuotasDue * montoPorCuota * 100) / 100;

    if (montoDue > (p.montoAbonado || 0) + 0.01) {
      const cobrado = cuotasDue >= p.cuotas;
      procesados.push({ id: p.id, cuotasDue, cuotas: p.cuotas, montoPorCuota, cobrado });
      return { ...p, montoAbonado: montoDue, cobrado };
    }
    return p;
  });

  if (!procesados.length) return { pedidos, procesados: [] };

  if (!useSupabase()) {
    lsSet('pedidos', actualizados);
  } else {
    await Promise.all(procesados.map(proc => {
      const upd = actualizados.find(p => p.id === proc.id);
      return supabase.from('pedidos').update({
        monto_abonado: upd.montoAbonado,
        cobrado: upd.cobrado,
      }).eq('id', proc.id);
    }));
    lsSet('pedidos', actualizados);
  }

  return { pedidos: actualizados, procesados };
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
  const { data, error } = await supabase
    .from('devoluciones')
    .select('*, devolucion_items(*)')
    .order('fecha', { ascending: false });
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
    for (const item of data.items) {
      if (item.productoId && isUUID(item.productoId)) {
        await ajustarStock(item.productoId, item.cantidad);
      }
    }
  }
  return getDevoluciones();
}

// ── COMUNICACIONES ────────────────────────────────────────

export async function getComunicaciones(clienteId) {
  if (!useSupabase()) return [];
  let query = supabase.from('comunicaciones').select('*').order('fecha', { ascending: false });
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

