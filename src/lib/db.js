import { supabase } from './supabase.js';
import { uid } from './utils.js';

const LS_KEYS = {
  clientes: 'sg_clientes',
  productos: 'sg_productos',
  pedidos: 'sg_pedidos',
  gastos: 'sg_gastos',
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

// When a team member logs in, App.jsx calls this with the owner's user_id
// so all writes go to the owner's account.
let _effectiveUserId = null;
export function setEffectiveUserId(uid) { _effectiveUserId = uid; }

async function getUserId() {
  if (_effectiveUserId) return _effectiveUserId;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id;
}

async function getUserEmail() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.email;
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
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');
  const fields = {
    nombre: data.nombre,
    contacto: data.contacto || '',
    email: data.email || '',
    direccion: data.direccion || '',
    tipo_precio: data.tipo_precio || 'minorista',
    saldo_inicial: data.saldo_inicial || 0,
  };
  if (data.id) {
    const { error } = await supabase.from('clientes').update(fields).eq('id', data.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('clientes').insert({ ...fields, user_id: userId });
    if (error) throw error;
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
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');
  const fields = {
    nombre: data.nombre,
    marca: data.marca || null,
    precio: data.precio,
    costo: data.costo || 0,
    precio_mayorista: data.precio_mayorista || 0,
    stock: data.stock ?? 0,
    stock_minimo: data.stock_minimo ?? 5,
  };
  if (data.id) {
    // Guardar historial si cambiaron los precios
    const { data: prev } = await supabase.from('productos').select('precio, costo, precio_mayorista').eq('id', data.id).single();
    if (prev && (prev.precio !== data.precio || prev.costo !== data.costo || prev.precio_mayorista !== (data.precio_mayorista || 0))) {
      await supabase.from('productos_precio_historial').insert({
        user_id: userId,
        producto_id: data.id,
        precio: prev.precio,
        costo: prev.costo,
        precio_mayorista: prev.precio_mayorista || 0,
      });
    }
    const { error } = await supabase.from('productos').update(fields).eq('id', data.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('productos').insert({ ...fields, user_id: userId });
    if (error) throw error;
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
  if (!useSupabase()) {
    const arr = lsGet('pedidos', []);
    const pedido = { ...data, id: data.id || uid(), tipo: data.tipo || 'pedido' };
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
  const { data: inserted, error } = await supabase
    .from('pedidos')
    .insert({
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
      descuento_tipo: data.descuentoTipo || null,
      descuento_valor: data.descuentoValor || 0,
      dias_plazo: data.diasPlazo || 0,
      tasa_mora: data.tasaMora || 0,
    })
    .select()
    .single();
  if (error) throw error;
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
    if (eItems) throw eItems;
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
  if ('montoAbonado' in data) update.monto_abonado = data.montoAbonado;
  if ('totalFinal' in data) update.total_final = data.totalFinal;
  if ('totalCalculado' in data) update.total_calculado = data.totalCalculado;
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

  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  const { error } = await supabase.from('pedidos').update(update).eq('id', id).eq('user_id', userId);
  if (error) throw error;

  // Re-sync items: delete old, insert new
  if (data.items) {
    const { error: eDel } = await supabase.from('pedido_items').delete().eq('pedido_id', id);
    if (eDel) throw eDel;
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
      if (eIns) throw eIns;
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
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');
  const { error } = await supabase.from('gastos').insert({
    user_id: userId,
    fecha: data.fecha,
    descripcion: data.descripcion,
    monto: data.monto,
    categoria: data.categoria,
  });
  if (error) throw error;
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

export async function saveCategorias(arr) {
  lsSet('categorias', arr);
  if (!useSupabase()) return arr;
  const userId = await getUserId();
  if (!userId) return arr;
  await supabase.from('categorias').delete().eq('user_id', userId);
  if (arr.length) {
    const rows = arr.map(nombre => ({ user_id: userId, nombre }));
    await supabase.from('categorias').insert(rows);
  }
  return arr;
}

// ── WHITELIST / OWNER ─────────────────────────────────────

export async function isEmailAllowed(email) {
  if (!useSupabase()) return true;
  const superadmin = import.meta.env.VITE_SUPERADMIN_EMAIL;
  if (superadmin && email.toLowerCase().trim() === superadmin.toLowerCase().trim()) return true;
  const { data, error } = await supabase
    .from('allowed_emails')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();
  // If we can't read the table (e.g. unauthenticated + strict RLS), don't block
  if (error) return null;
  return !!data;
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

export async function toggleTrialAcceso(emailId, email, activo) {
  const { error } = await supabase
    .from('allowed_emails')
    .update({ trial_activo: activo })
    .eq('id', emailId);
  if (error) throw error;

  const { data: sus } = await supabase
    .from('suscripciones')
    .select('id')
    .eq('user_email', email.toLowerCase().trim())
    .maybeSingle();

  if (sus) {
    const hoy = new Date();
    const vencimiento = new Date(hoy);
    if (activo) {
      vencimiento.setDate(vencimiento.getDate() + 14);
      await supabase.from('suscripciones').update({
        estado: 'prueba',
        fecha_vencimiento: vencimiento.toISOString().slice(0, 10),
        updated_at: hoy.toISOString(),
      }).eq('id', sus.id);
    } else {
      vencimiento.setFullYear(vencimiento.getFullYear() + 1);
      await supabase.from('suscripciones').update({
        estado: 'activa',
        fecha_vencimiento: vencimiento.toISOString().slice(0, 10),
        updated_at: hoy.toISOString(),
      }).eq('id', sus.id);
    }
  }

  return getAllowedEmails();
}

export async function isOwnerEmail(email) {
  const superadmin = import.meta.env.VITE_SUPERADMIN_EMAIL;
  if (superadmin && email.toLowerCase().trim() === superadmin.toLowerCase().trim()) return true;
  if (!useSupabase()) return false;
  const { data } = await supabase
    .from('allowed_emails')
    .select('is_owner')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();
  return !!data?.is_owner;
}

export async function getUserRole(email) {
  if (!useSupabase() || !email) return 'owner';
  const superadmin = import.meta.env.VITE_SUPERADMIN_EMAIL;
  if (superadmin && email.toLowerCase().trim() === superadmin.toLowerCase().trim()) return 'owner';
  const { data } = await supabase
    .from('allowed_emails')
    .select('is_owner, rol')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();
  if (!data) return null;
  if (data.is_owner) return 'owner';
  return data.rol || 'vendedor';
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
  const userId = await getUserId();
  if (!userId) return;
  await supabase
    .from('alertas_config')
    .upsert({ user_id: userId, dias_sin_cobro: diasSinCobro }, { onConflict: 'user_id' });
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

  const { data: allowed } = await supabase
    .from('allowed_emails')
    .select('trial_activo')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  const esTrial = !allowed || allowed.trial_activo !== false;
  const hoy = new Date();
  const vencimiento = new Date(hoy);
  if (esTrial) {
    vencimiento.setDate(vencimiento.getDate() + 14);
  } else {
    vencimiento.setFullYear(vencimiento.getFullYear() + 1);
  }

  const { data, error } = await supabase
    .from('suscripciones')
    .insert({
      user_id: userId,
      user_email: email,
      estado: esTrial ? 'prueba' : 'activa',
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
  return getSuscripcion();
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

export async function getNegocioConfig() {
  if (!useSupabase()) {
    return JSON.parse(localStorage.getItem('sg_negocio') || 'null') || { nombre: 'Mi Negocio', logo_url: null, onboarding_done: false };
  }
  const { data } = await supabase.from('negocio_config').select('*').maybeSingle();
  return data || { nombre: 'Mi Negocio', logo_url: null, onboarding_done: false };
}

export async function saveNegocioConfig(cfg) {
  if (!useSupabase()) {
    localStorage.setItem('sg_negocio', JSON.stringify(cfg));
    return cfg;
  }
  const userId = await getUserId();
  if (!userId) return cfg;
  const { data } = await supabase
    .from('negocio_config')
    .upsert({ user_id: userId, ...cfg, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single();
  return data || cfg;
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
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');
  const { data: inserted, error } = await supabase
    .from('devoluciones')
    .insert({
      user_id: userId,
      pedido_id: data.pedidoId,
      cliente_id: data.clienteId,
      fecha: data.fecha,
      motivo: data.motivo || null,
      monto_total: data.montoTotal,
    })
    .select()
    .single();
  if (error) throw error;
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
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from('comunicaciones').insert({
    user_id: userId,
    cliente_id: clienteId,
    tipo,
    mensaje,
    fecha: new Date().toISOString(),
  });
}

// ── HISTORIAL DE PRECIOS ──────────────────────────────────

export async function getPrecioHistorial(productoId) {
  if (!useSupabase()) return [];
  const { data, error } = await supabase
    .from('productos_precio_historial')
    .select('*')
    .eq('producto_id', productoId)
    .order('fecha_desde', { ascending: false });
  if (error) return [];
  return data;
}

// ── PEDIDOS RECURRENTES ───────────────────────────────────

export async function getRecurrentes() {
  if (!useSupabase()) return JSON.parse(localStorage.getItem('sg_recurrentes') || '[]');
  const { data, error } = await supabase
    .from('pedidos_recurrentes')
    .select('*')
    .eq('activo', true)
    .order('proximo_vencimiento', { ascending: true });
  if (error) return [];
  return data.map(r => ({
    id: r.id,
    clienteId: r.cliente_id,
    items: r.items || [],
    frecuencia: r.frecuencia,
    proximoVencimiento: r.proximo_vencimiento,
    activo: r.activo,
  }));
}

export async function saveRecurrente(data) {
  if (!useSupabase()) {
    const arr = JSON.parse(localStorage.getItem('sg_recurrentes') || '[]');
    arr.push({ ...data, id: uid() });
    localStorage.setItem('sg_recurrentes', JSON.stringify(arr));
    return getRecurrentes();
  }
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');
  await supabase.from('pedidos_recurrentes').insert({
    user_id: userId,
    cliente_id: data.clienteId,
    items: data.items,
    frecuencia: data.frecuencia,
    proximo_vencimiento: data.proximoVencimiento,
    activo: true,
  });
  return getRecurrentes();
}

export async function toggleRecurrente(id, activo) {
  if (!useSupabase()) return getRecurrentes();
  await supabase.from('pedidos_recurrentes').update({ activo }).eq('id', id);
  return getRecurrentes();
}

export async function deleteRecurrente(id) {
  if (!useSupabase()) {
    const arr = JSON.parse(localStorage.getItem('sg_recurrentes') || '[]').filter(r => r.id !== id);
    localStorage.setItem('sg_recurrentes', JSON.stringify(arr));
    return getRecurrentes();
  }
  await supabase.from('pedidos_recurrentes').delete().eq('id', id);
  return getRecurrentes();
}

export async function actualizarProximoVencimiento(id, frecuencia) {
  const hoy = new Date();
  const dias = frecuencia === 'semanal' ? 7 : frecuencia === 'quincenal' ? 15 : 30;
  hoy.setDate(hoy.getDate() + dias);
  const nuevo = hoy.toISOString().slice(0, 10);
  if (useSupabase()) {
    await supabase.from('pedidos_recurrentes').update({ proximo_vencimiento: nuevo }).eq('id', id);
  }
  return nuevo;
}

// ── PROVEEDORES ───────────────────────────────────────────

export async function getProveedores() {
  if (!useSupabase()) return JSON.parse(localStorage.getItem('sg_proveedores') || '[]');
  const { data, error } = await supabase.from('proveedores').select('*').order('nombre');
  if (error) return [];
  return data;
}

export async function saveProveedor(data) {
  if (!useSupabase()) {
    const arr = JSON.parse(localStorage.getItem('sg_proveedores') || '[]');
    if (data.id) {
      const i = arr.findIndex(p => p.id === data.id);
      if (i >= 0) arr[i] = data; else arr.push(data);
    } else {
      arr.push({ ...data, id: uid() });
    }
    localStorage.setItem('sg_proveedores', JSON.stringify(arr));
    return getProveedores();
  }
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');
  if (data.id) {
    await supabase.from('proveedores').update({ nombre: data.nombre, contacto: data.contacto }).eq('id', data.id);
  } else {
    await supabase.from('proveedores').insert({ user_id: userId, nombre: data.nombre, contacto: data.contacto || null });
  }
  return getProveedores();
}

export async function deleteProveedor(id) {
  if (!useSupabase()) {
    const arr = JSON.parse(localStorage.getItem('sg_proveedores') || '[]').filter(p => p.id !== id);
    localStorage.setItem('sg_proveedores', JSON.stringify(arr));
    return getProveedores();
  }
  await supabase.from('proveedores').delete().eq('id', id);
  return getProveedores();
}

// ── ÓRDENES DE COMPRA ─────────────────────────────────────

export async function getOrdenesCompra() {
  if (!useSupabase()) return JSON.parse(localStorage.getItem('sg_ordenes') || '[]');
  const { data, error } = await supabase
    .from('ordenes_compra')
    .select('*, ordenes_compra_items(*), proveedores(nombre, contacto)')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data.map(r => ({
    id: r.id,
    proveedorId: r.proveedor_id,
    proveedorNombre: r.proveedores?.nombre || 'Sin proveedor',
    proveedorContacto: r.proveedores?.contacto || '',
    fecha: r.fecha,
    estado: r.estado,
    total: r.total,
    items: (r.ordenes_compra_items || []).map(i => ({
      id: i.id,
      productoId: i.producto_id,
      nombre: i.nombre,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
    })),
  }));
}

export async function saveOrdenCompra(data) {
  if (!useSupabase()) return getOrdenesCompra();
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');
  const { data: inserted, error } = await supabase
    .from('ordenes_compra')
    .insert({
      user_id: userId,
      proveedor_id: data.proveedorId || null,
      fecha: data.fecha,
      estado: data.estado || 'borrador',
      total: data.total || 0,
    })
    .select()
    .single();
  if (error) throw error;
  if (data.items?.length) {
    await supabase.from('ordenes_compra_items').insert(
      data.items.map(i => ({
        orden_id: inserted.id,
        producto_id: i.productoId || null,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precioUnitario || 0,
      }))
    );
  }
  return getOrdenesCompra();
}

export async function updateOrdenEstado(id, estado) {
  if (!useSupabase()) return getOrdenesCompra();
  await supabase.from('ordenes_compra').update({ estado }).eq('id', id);
  if (estado === 'recibida') {
    const { data: items } = await supabase.from('ordenes_compra_items').select('*').eq('orden_id', id);
    for (const item of items || []) {
      if (item.producto_id) await ajustarStock(item.producto_id, item.cantidad);
    }
  }
  return getOrdenesCompra();
}

// ── SEED (localStorage only, for first run) ───────────────

export function seedLocalStorageIfEmpty() {
  if (localStorage.getItem('sg_init')) return;
  const y = new Date().getFullYear();
  const m = String(new Date().getMonth() + 1).padStart(2, '0');

  const clientes = [
    { id: 'c1', nombre: 'Ana García', contacto: '1123456789' },
    { id: 'c2', nombre: 'Roberto Sánchez', contacto: '1134567890' },
    { id: 'c3', nombre: 'María López', contacto: '1145678901' },
  ];
  const productos = [
    { id: 'p1', nombre: 'Alfajores x12', precio: 2400, costo: 1600, stock: 20, stock_minimo: 5 },
    { id: 'p2', nombre: 'Galletitas surtidas', precio: 1800, costo: 1100, stock: 15, stock_minimo: 5 },
    { id: 'p3', nombre: 'Chocolates x6', precio: 3200, costo: 2000, stock: 10, stock_minimo: 3 },
    { id: 'p4', nombre: 'Caramelos x50', precio: 900, costo: 500, stock: 30, stock_minimo: 10 },
    { id: 'p5', nombre: 'Chicles x100', precio: 1200, costo: 700, stock: 25, stock_minimo: 8 },
  ];
  const pedidos = [
    {
      id: 'pe1', clienteId: 'c1', fecha: `${y}-${m}-05`, tipo: 'pedido',
      items: [
        { productoId: 'p1', nombre: 'Alfajores x12', cantidad: 2, precioUnitario: 2400, costoUnitario: 1600 },
        { productoId: 'p3', nombre: 'Chocolates x6', cantidad: 1, precioUnitario: 3200, costoUnitario: 2000 },
      ],
      totalCalculado: 8000, totalFinal: 8000, medioPago: 'efectivo', cuotas: 1, cobrado: true, montoAbonado: 8000,
    },
    {
      id: 'pe2', clienteId: 'c2', fecha: `${y}-${m}-10`, tipo: 'pedido',
      items: [{ productoId: 'p2', nombre: 'Galletitas surtidas', cantidad: 3, precioUnitario: 1800, costoUnitario: 1100 }],
      totalCalculado: 5400, totalFinal: 5400, medioPago: 'tarjeta', cuotas: 3, cobrado: false, montoAbonado: 0,
    },
    {
      id: 'pe3', clienteId: 'c1', fecha: `${y}-${m}-15`, tipo: 'presupuesto',
      items: [{ productoId: 'p4', nombre: 'Caramelos x50', cantidad: 5, precioUnitario: 900, costoUnitario: 500 }],
      totalCalculado: 4500, totalFinal: 4200, medioPago: 'efectivo', cuotas: 1, cobrado: false, montoAbonado: 0,
    },
  ];
  const gastos = [
    { id: 'g1', fecha: `${y}-${m}-01`, descripcion: 'Compra mercadería proveedor', monto: 45000, categoria: 'Mercadería' },
    { id: 'g2', fecha: `${y}-${m}-08`, descripcion: 'Nafta semana', monto: 8000, categoria: 'Transporte' },
    { id: 'g3', fecha: `${y}-${m}-12`, descripcion: 'Plan celular', monto: 3500, categoria: 'Servicios' },
  ];

  lsSet('clientes', clientes);
  lsSet('productos', productos);
  lsSet('pedidos', pedidos);
  lsSet('gastos', gastos);
  lsSet('categorias', DEFAULT_CATS);
  localStorage.setItem('sg_init', '1');
}
