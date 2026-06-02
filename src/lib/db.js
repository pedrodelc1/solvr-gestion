/**
 * DB layer — tries Supabase first, falls back to localStorage.
 * All functions are async and return plain objects (no Supabase-specific shape).
 */
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

// ── helpers ──────────────────────────────────────────────

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

// ── CLIENTES ─────────────────────────────────────────────

export async function getClientes() {
  if (!useSupabase()) return lsGet('clientes', []);
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) return lsGet('clientes', []);
  const mapped = data.map(r => ({ id: r.id, nombre: r.nombre, contacto: r.contacto || '' }));
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
  if (data.id) {
    const { error } = await supabase
      .from('clientes')
      .update({ nombre: data.nombre, contacto: data.contacto })
      .eq('id', data.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('clientes')
      .insert({ nombre: data.nombre, contacto: data.contacto || '', user_id: userId });
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
    .order('created_at', { ascending: true });
  if (error) return lsGet('productos', []);
  const mapped = data.map(r => ({ id: r.id, nombre: r.nombre, precio: r.precio, costo: r.costo || 0 }));
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
  if (data.id) {
    const { error } = await supabase
      .from('productos')
      .update({ nombre: data.nombre, precio: data.precio, costo: data.costo || 0 })
      .eq('id', data.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('productos')
      .insert({ nombre: data.nombre, precio: data.precio, costo: data.costo || 0, user_id: userId });
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

// ── PEDIDOS ───────────────────────────────────────────────

export async function getPedidos() {
  if (!useSupabase()) return lsGet('pedidos', []);
  const { data, error } = await supabase
    .from('pedidos')
    .select('*, pedido_items(*)')
    .order('fecha', { ascending: false });
  if (error) return lsGet('pedidos', []);
  const mapped = data.map(r => ({
    id: r.id,
    clienteId: r.cliente_id,
    fecha: r.fecha,
    totalCalculado: r.total_calculado,
    totalFinal: r.total_final,
    medioPago: r.medio_pago === 'fiado' ? 'tarjeta' : r.medio_pago,
    cuotas: r.cuotas || 1,
    cobrado: r.cobrado,
    montoAbonado: r.monto_abonado || 0,
    items: (r.pedido_items || []).map(i => ({
      id: i.id,
      productoId: i.producto_id,
      nombre: i.nombre,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
      costoUnitario: i.costo_unitario || 0,
    })),
  }));
  lsSet('pedidos', mapped);
  return mapped;
}

export async function savePedido(data) {
  if (!useSupabase()) {
    const arr = lsGet('pedidos', []);
    const pedido = { ...data, id: data.id || uid() };
    arr.push(pedido);
    lsSet('pedidos', arr);
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
    }));
    const { error: eItems } = await supabase.from('pedido_items').insert(items);
    if (eItems) throw eItems;
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
  if ('medioPago' in data) update.medio_pago = data.medioPago;
  const { error } = await supabase.from('pedidos').update(update).eq('id', id);
  if (error) throw error;
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

// ── GASTOS ────────────────────────────────────────────────

export async function getGastos() {
  if (!useSupabase()) return lsGet('gastos', []);
  const { data, error } = await supabase
    .from('gastos')
    .select('*')
    .order('fecha', { ascending: false });
  if (error) return lsGet('gastos', []);
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

// ── WHITELIST ─────────────────────────────────────────────

export async function isEmailAllowed(email) {
  if (!useSupabase()) return true;
  const { data, error } = await supabase
    .from('allowed_emails')
    .select('email')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function getAllowedEmails() {
  if (!useSupabase()) return [];
  const { data, error } = await supabase
    .from('allowed_emails')
    .select('id, email, created_at')
    .order('created_at', { ascending: true });
  if (error) return [];
  return data;
}

export async function addAllowedEmail(email) {
  const { error } = await supabase
    .from('allowed_emails')
    .insert({ email: email.toLowerCase().trim() });
  if (error) throw error;
  return getAllowedEmails();
}

export async function removeAllowedEmail(id) {
  const { error } = await supabase.from('allowed_emails').delete().eq('id', id);
  if (error) throw error;
  return getAllowedEmails();
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
    { id: 'p1', nombre: 'Alfajores x12', precio: 2400, costo: 1600 },
    { id: 'p2', nombre: 'Galletitas surtidas', precio: 1800, costo: 1100 },
    { id: 'p3', nombre: 'Chocolates x6', precio: 3200, costo: 2000 },
    { id: 'p4', nombre: 'Caramelos x50', precio: 900, costo: 500 },
    { id: 'p5', nombre: 'Chicles x100', precio: 1200, costo: 700 },
  ];
  const pedidos = [
    {
      id: 'pe1', clienteId: 'c1', fecha: `${y}-${m}-05`,
      items: [
        { productoId: 'p1', nombre: 'Alfajores x12', cantidad: 2, precioUnitario: 2400, costoUnitario: 1600 },
        { productoId: 'p3', nombre: 'Chocolates x6', cantidad: 1, precioUnitario: 3200, costoUnitario: 2000 },
      ],
      totalCalculado: 8000, totalFinal: 8000, medioPago: 'efectivo', cuotas: 1, cobrado: true, montoAbonado: 8000,
    },
    {
      id: 'pe2', clienteId: 'c2', fecha: `${y}-${m}-10`,
      items: [{ productoId: 'p2', nombre: 'Galletitas surtidas', cantidad: 3, precioUnitario: 1800, costoUnitario: 1100 }],
      totalCalculado: 5400, totalFinal: 5400, medioPago: 'tarjeta', cuotas: 3, cobrado: false, montoAbonado: 0,
    },
    {
      id: 'pe3', clienteId: 'c1', fecha: `${y}-${m}-15`,
      items: [{ productoId: 'p4', nombre: 'Caramelos x50', cantidad: 5, precioUnitario: 900, costoUnitario: 500 }],
      totalCalculado: 4500, totalFinal: 4200, medioPago: 'transferencia', cuotas: 1, cobrado: false, montoAbonado: 0,
    },
    {
      id: 'pe4', clienteId: 'c3', fecha: `${y}-${m}-18`,
      items: [
        { productoId: 'p5', nombre: 'Chicles x100', cantidad: 2, precioUnitario: 1200, costoUnitario: 700 },
        { productoId: 'p1', nombre: 'Alfajores x12', cantidad: 1, precioUnitario: 2400, costoUnitario: 1600 },
      ],
      totalCalculado: 4800, totalFinal: 4800, medioPago: 'tarjeta', cuotas: 1, cobrado: false, montoAbonado: 0,
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
