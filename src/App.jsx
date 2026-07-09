import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './lib/supabase.js';
import {
  getClientes, saveCliente, deleteCliente,
  getProductos, saveProducto, deleteProducto,
  getPedidos, savePedido, updatePedido, deletePedido,
  getGastos, saveGasto, deleteGasto,
  getCobros, saveCobro, deleteCobro,
  getCategorias,
  debeAvisarCuotasHoy,
  getSuscripcion, crearSuscripcionTrial,
  getAlertasConfig,
  emailHasPassword,
  getDevoluciones,
  getNegocioConfig, saveNegocioConfig,
  marcarPedidoEntregado,
  revertirPedidoEntregado,
  getCachedSnapshot,
  setCachedNegocioId,
  clearLocalCache,
} from './lib/db.js';
import { inRange, saldoCliente, today, cuotasVencidas, formatCurrency } from './lib/utils.js';

import { LoginScreen } from './components/auth/LoginScreen.jsx';
import { ForcePasswordReset } from './components/auth/ForcePasswordReset.jsx';
import { LandingScreen } from './components/auth/LandingScreen.jsx';
import { SplashScreen } from './components/auth/SplashScreen.jsx';
import { BottomNav } from './components/shared/BottomNav.jsx';
import { ToastContainer } from './components/shared/Toast.jsx';
import { ClienteForm } from './components/clientes/ClienteForm.jsx';
import { ClientesList } from './components/clientes/ClientesList.jsx';
import { ClienteDetail } from './components/clientes/ClienteDetail.jsx';
import { PedidosList } from './components/pedidos/PedidosList.jsx';
import { PedidoForm } from './components/pedidos/PedidoForm.jsx';
import { GastosList } from './components/gastos/GastosList.jsx';
import { ProductosList } from './components/productos/ProductosList.jsx';
import { ProductoForm } from './components/productos/ProductoForm.jsx';
import { CajaPanel } from './components/caja/CajaPanel.jsx';
import { CobroForm } from './components/caja/CobroForm.jsx';
import { SkeletonLoader } from './components/shared/SkeletonLoader.jsx';
import { SuscripcionBlocker } from './components/suscripciones/SuscripcionBlocker.jsx';
import { TrialBanner } from './components/shared/TrialBanner.jsx';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard.jsx';
import { TeamWelcomeScreen } from './components/onboarding/TeamWelcomeScreen.jsx';

// Lazy-loaded: solo cargan cuando el usuario abre el tab/feature. Reducen el
// JS inicial sin afectar la experiencia, porque cada uno trae >500 líneas.
const StatsPanel    = lazy(() => import('./components/stats/StatsPanel.jsx').then(m => ({ default: m.StatsPanel })));
const PerfilPanel   = lazy(() => import('./components/perfil/PerfilPanel.jsx').then(m => ({ default: m.PerfilPanel })));
const AsistenteChat = lazy(() => import('./components/asistente/AsistenteChat.jsx').then(m => ({ default: m.AsistenteChat })));

let _toastId = 0;

// Recuerda la posición de scroll de cada vista (tab/lista) y la restaura al
// volver, dentro de una ventana de tiempo. Así, si pasás de Clientes a Pedidos
// y volvés, no te tira arriba: quedás donde estabas.
const SCROLL_MEMORY_MS = 90000;
function ScrollKeeper({ scrollKey, containerRef, memRef, children }) {
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (el) {
      const saved = memRef.current[scrollKey];
      el.scrollTop = saved && Date.now() - saved.ts < SCROLL_MEMORY_MS ? saved.top : 0;
    }
    return () => {
      const e = containerRef.current;
      if (e) memRef.current[scrollKey] = { top: e.scrollTop, ts: Date.now() };
    };
  }, [scrollKey]);
  return children;
}

export default function App() {
  // ── Auth & Verification States ────────────────────────────
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem('sg_splash_done'));
  const [theme, setTheme] = useState(() => localStorage.getItem('sg_theme') || 'dark');
  const [authView, setAuthView] = useState('landing'); // 'landing' | 'login'

  // Token verification intercepts (to prevent email client prefetch consuming links)
  const [verifyTokenHash, setVerifyTokenHash] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token_hash') || null;
  });
  const [verifyType, setVerifyType] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('type') || 'magiclink';
  });
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [verifyOtpError, setVerifyOtpError] = useState('');

  const isOtpLogin = useMemo(() => {
    if (!session?.access_token) return false;
    try {
      const payload = JSON.parse(atob(session.access_token.split('.')[1]));
      const amr = payload.amr;
      if (Array.isArray(amr)) {
        return amr.some(x => x.method === 'otp' || x.method === 'magiclink' || x.method === 'recovery' || x === 'otp' || x === 'magiclink' || x === 'recovery');
      }
      return false;
    } catch (e) {
      return false;
    }
  }, [session]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sg_theme', theme);
  }, [theme]);

  // Hidratar desde localStorage en el primer render. Si hay caché, no mostramos
  // skeleton: la UI aparece al toque con datos viejos y se reconcilia cuando
  // llega la respuesta de Supabase.
  const cached = useMemo(() => getCachedSnapshot(), []);
  const hasCache = cached.clientes.length > 0 || cached.pedidos.length > 0;
  const [clientes, setClientes] = useState(cached.clientes);
  const [productos, setProductos] = useState(cached.productos);
  const [pedidos, setPedidos] = useState(cached.pedidos);
  const [gastos, setGastos] = useState(cached.gastos);
  const [cobros, setCobros] = useState(cached.cobros);
  const [categorias, setCategorias] = useState(cached.categorias);
  const [devoluciones, setDevoluciones] = useState([]);
  const [loading, setLoading] = useState(!hasCache);
  const loadedOnceRef = useRef(hasCache);
  // Evita carreras: cada loadAll lleva un nº de secuencia; si llega una carga
  // más nueva, las respuestas viejas se descartan (no pisan el estado fresco).
  const loadSeqRef = useRef(0);
  // Debounce de los refreshes por realtime: una ráfaga de cambios (ej. el
  // cascade de un delete) colapsa en una sola recarga, ya con todo commiteado.
  const reloadTimerRef = useRef(null);
  // Cuándo fue la última mutación local. Si llega un evento realtime dentro
  // de los siguientes ~2s, lo ignoramos: la UI ya está actualizada localmente
  // y un loadAll() ahora solo agregaría latencia y parpadeo.
  const lastLocalMutationRef = useRef(0);
  const markLocalMutation = useCallback(() => { lastLocalMutationRef.current = Date.now(); }, []);
  // Guard de mutaciones: claim_team_access crea la membership que mi_negocio_id()
  // necesita para llenar negocio_id en los INSERT. Si el usuario abre un form
  // antes de que el claim resuelva (caso típico con caché hidratada), el
  // trigger inserta NULL y Postgres tira 23502. Las mutaciones esperan acá.
  const claimReadyRef = useRef(Promise.resolve());
  // Scroll del contenedor de tabs + memoria de posiciones por vista.
  const scrollRef = useRef(null);
  const scrollMem = useRef({});

  const ALLOWED_TABS = {
    owner:        ['clientes', 'pedidos', 'gastos', 'stats', 'productos', 'caja', 'perfil'],
    admin:        ['clientes', 'pedidos', 'gastos', 'stats', 'productos', 'caja', 'perfil'],
    vendedor:     ['clientes', 'pedidos', 'stats', 'productos', 'perfil'],
    visualizador: ['clientes', 'pedidos', 'stats', 'productos', 'perfil'],
  };

  const [isOwner, setIsOwner] = useState(false);
  const [userRole, setUserRole] = useState('owner');
  const [teamWelcomeSeen, setTeamWelcomeSeen] = useState(() => !!sessionStorage.getItem('sg_team_welcome'));
  const [suscripcion, setSuscripcion] = useState(null);
  const [diasSinCobro, setDiasSinCobro] = useState(7);
  const [negocioConfig, setNegocioConfig] = useState(null);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('sg_tab') || 'clientes');
  const [toasts, setToasts] = useState([]);
  const [loginMethod, setLoginMethod] = useState('otp');
  const [autoExpandPassword, setAutoExpandPassword] = useState(false);
  const [forcePasswordChange, setForcePasswordChange] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('flow') === 'recovery' || params.get('type') === 'recovery') {
      sessionStorage.setItem('sg_force_pw_change', '1');
      return true;
    }
    return sessionStorage.getItem('sg_force_pw_change') === '1';
  });

  // Clientes UI
  const [selectedClienteId, setSelectedClienteId] = useState(null);
  const [clienteFormOpen, setClienteFormOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);

  // Pedidos UI
  const [showPedidoForm, setShowPedidoForm] = useState(false);
  const [preClienteId, setPreClienteId] = useState(null);
  const [editingPedido, setEditingPedido] = useState(null);

  // Gastos UI

  // Caja UI
  const [cobroFormOpen, setCobroFormOpen] = useState(false);
  const [cobroPreClienteId, setCobroPreClienteId] = useState(null);

  // Productos UI
  const [productoFormOpen, setProductoFormOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState(null);

  // ── Dynamic title ─────────────────────────────────────────
  const TAB_TITLES = {
    clientes: 'Clientes — Solvnt',
    pedidos: 'Pedidos — Solvnt',
    gastos: 'Gastos — Solvnt',
    stats: 'Estadísticas — Solvnt',
    productos: 'Catálogo — Solvnt',
    caja: 'Caja — Solvnt',
    perfil: 'Perfil — Solvnt',
  };
  useEffect(() => {
    document.title = TAB_TITLES[activeTab] || 'Solvnt Gestión';
  }, [activeTab]);

  // Redirect to clientes if current tab is not allowed for this role
  useEffect(() => {
    const allowed = ALLOWED_TABS[userRole] || ALLOWED_TABS.owner;
    if (!allowed.includes(activeTab)) {
      setActiveTab('clientes');
      localStorage.setItem('sg_tab', 'clientes');
    }
  }, [userRole]);

  // ── Back button (Android / browser) ───────────────────────
  useEffect(() => {
    if (!session) return;
    history.pushState({ solvnt: true }, '');
    function onPop() {
      history.pushState({ solvnt: true }, '');
      if (selectedClienteId) { setSelectedClienteId(null); return; }
      if (showPedidoForm) { setShowPedidoForm(false); return; }
      if (activeTab !== 'clientes') { setActiveTab('clientes'); localStorage.setItem('sg_tab', 'clientes'); return; }
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [session, selectedClienteId, showPedidoForm, activeTab]);

  // ── Auth ──────────────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, sess) => {
      setSession(sess);
      setAuthChecked(true);

      if (sess) {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            setSession(prev => prev && prev.user.id === user.id ? { ...prev, user } : prev);
          }
        }).catch(err => console.error('Error loading fresh user details:', err));
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load data ─────────────────────────────────────────────
  // El skeleton solo se muestra en la carga inicial; los refreshes en
  // background (realtime) no desmontan la vista ni resetean estado local
  const loadAll = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    if (!loadedOnceRef.current) setLoading(true);
    try {
      // Primera tanda: lo crítico para pintar la UI (clientes + pedidos).
      // El resto se trae en paralelo pero no bloquea el render inicial.
      // Comunicaciones se eliminó del bootstrap: solo se necesitan en
      // ClienteDetail, donde se cargan lazy con clienteId filtrado.
      const [c, pr, pe, g, cob, cats, devs] = await Promise.all([
        getClientes(), getProductos(), getPedidos(), getGastos(), getCobros(), getCategorias(),
        getDevoluciones(),
      ]);
      if (seq !== loadSeqRef.current) return;
      setClientes(c);
      setProductos(pr);
      setGastos(g);
      setCobros(cob);
      setCategorias(cats);
      setDevoluciones(devs);

      if (c.length > 0 && pe.length === 0) {
        setToasts(t => {
          const id = ++_toastId;
          setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 8000);
          return [...t, { id, msg: 'Pedidos no se pudieron cargar. Revisá las políticas RLS en Supabase.', type: 'error' }];
        });
      }

      setPedidos(pe);
      // Cuotas vencidas: solo avisamos (una vez por día). El cobro se registra
      // a mano desde el pedido — antes se marcaban cobradas solas e inflaban caja.
      const vencidas = pe.map(p => cuotasVencidas(p)).filter(Boolean);
      if (vencidas.length && debeAvisarCuotasHoy()) {
        const totalPend = vencidas.reduce((s, v) => s + v.pendiente, 0);
        setToasts(t => {
          const id = ++_toastId;
          setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 8000);
          return [...t, { id, msg: `${vencidas.length} pedido${vencidas.length !== 1 ? 's' : ''} con cuotas vencidas sin cobrar — ${formatCurrency(totalPend)}`, type: 'error' }];
        });
      }
    } finally {
      loadedOnceRef.current = true;
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) {
      sessionStorage.removeItem('sg_pw_reset_done');
      sessionStorage.removeItem('sg_force_pw_change');
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      if (sessionStorage.getItem('sg_force_pw_change') === '1') {
        if (sessionStorage.getItem('sg_pw_reset_done') !== '1') {
          setForcePasswordChange(true);
        }
      }
    }
  }, [session]);

  useEffect(() => {
    if (authChecked && session) {
      // Check if they entered via recovery flow
      const params = new URLSearchParams(window.location.search);
      const isRecovery = params.get('flow') === 'recovery' || params.get('type') === 'recovery';
      if (isRecovery) {
        sessionStorage.setItem('sg_force_pw_change', '1');
        setForcePasswordChange(true);
        // Clear param from URL
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }

      const init = async () => {
        // Disparar TODO en paralelo: claim de acceso + carga de datos +
        // suscripción + config. RLS protege cada query, así que aunque el
        // claim falle al final, no se filtra nada. Antes esto era secuencial
        // (claim → member → loadAll → resto) y agregaba 1-2s al login.
        const claimP = supabase.rpc('claim_team_access');
        claimReadyRef.current = claimP;
        const dataP = loadAll();
        const susP = getSuscripcion();
        const alertasP = getAlertasConfig();
        const negocioP = getNegocioConfig();

        const { data: negocioId, error: claimError } = await claimP;
        if (claimError) console.error('[claim_team_access] error:', claimError);
        if (negocioId) setCachedNegocioId(negocioId);
        if (!negocioId) {
          toast("Acceso denegado: este email no está autorizado. Contactá al administrador.", "error");
          clearLocalCache();
          await supabase.auth.signOut();
          return;
        }

        const { data: member } = await supabase
          .from('negocio_members')
          .select('rol')
          .eq('negocio_id', negocioId)
          .eq('user_id', session.user.id)
          .eq('activo', true)
          .maybeSingle();

        if (!member) {
          toast("Acceso denegado: no sos miembro activo de ningún negocio.", "error");
          clearLocalCache();
          await supabase.auth.signOut();
          return;
        }

        setUserRole(member.rol);
        setIsOwner(member.rol === 'owner');

        // Las promesas que arrancamos arriba ya están en vuelo; solo conectamos resultados.
        susP.then(async sus => {
          if (!sus) {
            const nueva = await crearSuscripcionTrial();
            setSuscripcion(nueva);
          } else {
            setSuscripcion(sus);
          }
        });
        alertasP.then(cfg => setDiasSinCobro(cfg.dias_sin_cobro));
        negocioP.then(setNegocioConfig);
        await dataP;
      };
      init();
    }
  }, [authChecked, session, loadAll]);

  // ── Realtime Database Sync ────────────────────────────────
  // Solo escuchamos las tablas que afectan la UI principal. Eventos de
  // suscripciones, allowed_emails, comunicaciones, etc. no disparan reload.
  // Además, si la mutación es nuestra (acabamos de hacerla local), ignoramos
  // el eco del realtime: la UI ya está al día y un loadAll() solo agrega lag.
  const RT_TABLES = ['clientes', 'productos', 'pedidos', 'pedido_items', 'gastos', 'cobros', 'devoluciones'];
  useEffect(() => {
    if (!session) return;
    const channel = supabase.channel('schema-db-changes');
    RT_TABLES.forEach(table => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        // Skip si veníamos de mutar local hace menos de 2.5s
        if (Date.now() - lastLocalMutationRef.current < 2500) return;
        if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = setTimeout(() => { loadAll(); }, 800);
      });
    });
    channel.subscribe();
    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [session, loadAll]);

  // ── Toast ─────────────────────────────────────────────────
  const toast = useCallback((msg, type = 'success') => {
    const id = ++_toastId;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);

  const alertCount = useMemo(() => {
    // Indexar pedidos/devs/cobros por clienteId una sola vez (O(n+m+k))
    // en vez de filtrar todo dentro del loop de clientes (O(c·(n+m+k))).
    const pedidosByCliente = new Map();
    for (const p of pedidos) {
      if (!pedidosByCliente.has(p.clienteId)) pedidosByCliente.set(p.clienteId, []);
      pedidosByCliente.get(p.clienteId).push(p);
    }
    const now = Date.now();
    const dayMs = 86400000;
    let count = 0;
    for (const c of clientes) {
      const arr = pedidosByCliente.get(c.id);
      if (!arr) continue;
      let oldest = null;
      let hasOpen = false;
      for (const p of arr) {
        if (p.cobrado || p.tipo === 'presupuesto') continue;
        hasOpen = true;
        if (oldest === null || p.fecha < oldest) oldest = p.fecha;
      }
      if (!hasOpen) continue;
      if (saldoCliente(c, arr, devoluciones, cobros) <= 0) continue;
      if (Math.round((now - new Date(oldest).getTime()) / dayMs) >= diasSinCobro) count++;
    }
    return count;
  }, [clientes, pedidos, devoluciones, cobros, diasSinCobro]);

  // ── Handlers ──────────────────────────────────────────────

  // Todas las mutaciones aplican update optimista en memoria en vez de
  // re-descargar la tabla entera. `markLocalMutation()` también silencia el
  // eco del realtime durante ~2.5s para evitar un loadAll() redundante.

  async function handleSaveCliente(data) {
    await claimReadyRef.current;
    if (data.id) {
      // Update: optimistic merge local + UPDATE en background.
      const prevSnapshot = clientes;
      markLocalMutation();
      setClientes(prev => prev.map(c => c.id === data.id ? { ...c, ...data } : c));
      setClienteFormOpen(false);
      setEditingCliente(null);
      toast('Cliente actualizado');
      saveCliente(data)
        .then(saved => setClientes(prev => prev.map(c => c.id === data.id ? { ...c, ...saved } : c)))
        .catch(e => { setClientes(prevSnapshot); toast(e.message, 'error'); });
      return;
    }
    const tempId = 'tmp-' + Date.now();
    const optimistic = { id: tempId, ...data };
    markLocalMutation();
    setClientes(prev => [...prev, optimistic]);
    setClienteFormOpen(false);
    setEditingCliente(null);
    toast('Cliente agregado');
    saveCliente(data)
      .then(saved => setClientes(prev => prev.map(c => c.id === tempId ? saved : c)))
      .catch(e => {
        setClientes(prev => prev.filter(c => c.id !== tempId));
        toast(e.message, 'error');
      });
  }

  async function handleDeleteCliente(id) {
    try {
      await deleteCliente(id);
      markLocalMutation();
      setClientes(prev => prev.filter(c => c.id !== id));
      setSelectedClienteId(null);
      toast('Cliente eliminado');
    } catch (e) { toast(e.message, 'error'); }
  }

  // Los ítems manuales van al catálogo: si ya existe un producto con el mismo
  // nombre en el negocio se reutiliza, si no se crea (stock 0). Si el rol no
  // puede crear productos (vendedor), el trigger de la DB lo cataloga igual.
  async function catalogarItemsManuales(items) {
    if (!Array.isArray(items)) return items;
    const porNombre = new Map(productos.map(p => [p.nombre.trim().toLowerCase(), p]));
    const creados = [];
    const result = [];
    for (const item of items) {
      if (item.productoId || !item.nombre?.trim()) { result.push(item); continue; }
      const key = item.nombre.trim().toLowerCase();
      let prod = porNombre.get(key);
      if (!prod) {
        try {
          prod = await saveProducto({ nombre: item.nombre.trim(), precio: item.precioUnitario, costo: item.costoUnitario || 0, stock: 0, stock_minimo: 0 });
          porNombre.set(key, prod);
          creados.push(prod);
        } catch (_) {}
      }
      result.push(prod ? { ...item, productoId: prod.id } : item);
    }
    if (creados.length) {
      markLocalMutation();
      setProductos(prev => [...prev, ...creados]);
    }
    return result;
  }

  async function handleSavePedido(data) {
    await claimReadyRef.current;
    const isEdit = data.id && pedidos.find(p => p.id === data.id);
    if (isEdit) {
      const prevSnapshot = pedidos;
      markLocalMutation();
      setPedidos(prev => prev.map(p => p.id === data.id ? { ...p, ...data } : p));
      setShowPedidoForm(false);
      setPreClienteId(null);
      setEditingPedido(null);
      toast('Pedido actualizado');
      catalogarItemsManuales(data.items)
        .then(items => updatePedido(data.id, { ...data, items }))
        .then(updated => setPedidos(prev => prev.map(p => p.id === data.id ? { ...p, ...updated } : p)))
        .catch(e => { setPedidos(prevSnapshot); toast(e.message, 'error'); });
      return;
    }
    const numInicial = parseInt(negocioConfig?.num_inicial) || 1;
    const maxNro = pedidos.reduce((m, p) => Math.max(m, p.nro || 0), 0);
    const nro = maxNro > 0 ? Math.max(maxNro + 1, numInicial) : numInicial;
    // Id definitivo generado acá: la fila optimista y la de la DB comparten id,
    // así la reconciliación es exacta y el pedido ya es operable (cobrar,
    // editar) antes de que termine el INSERT.
    const newId = crypto?.randomUUID?.() || `tmp-${Date.now()}`;
    const optimistic = { ...data, id: newId, nro, fetchOrder: -1, createdAt: data.fecha };
    markLocalMutation();
    setPedidos(prev => [optimistic, ...prev]);
    setShowPedidoForm(false);
    setPreClienteId(null);
    setEditingPedido(null);
    toast('Pedido guardado');
    catalogarItemsManuales(data.items)
      .then(items => savePedido({ ...data, items, id: newId, nro }))
      .then(nuevo => setPedidos(prev => prev.map(p => p.id === newId ? nuevo : p)))
      .catch(e => {
        setPedidos(prev => prev.filter(p => p.id !== newId));
        toast(e.message, 'error');
      });
  }

  async function handleUpdatePedido(id, data) {
    try {
      const updated = await updatePedido(id, data);
      markLocalMutation();
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleDeletePedido(id) {
    try {
      await deletePedido(id);
      markLocalMutation();
      setPedidos(prev => prev.filter(p => p.id !== id));
    } catch (e) { toast(e.message, 'error'); throw e; }
  }

  async function handleMarcarEntregado(id) {
    try {
      const res = await marcarPedidoEntregado(id);
      markLocalMutation();
      setPedidos(prev => prev.map(p => p.id === id
        ? { ...p, confirmado: true, items: (p.items || []).map(it => ({ ...it, entregado: true, fechaEntrega: it.fechaEntrega || res.fechaEntrega })) }
        : p));
      toast('Marcado como entregado');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleRevertirEntregado(id) {
    try {
      await revertirPedidoEntregado(id);
      markLocalMutation();
      setPedidos(prev => prev.map(p => p.id === id
        ? { ...p, items: (p.items || []).map(it => ({ ...it, entregado: false, fechaEntrega: null })) }
        : p));
      toast('Entrega revertida');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleProductoCreado(newProd) {
    try {
      await claimReadyRef.current;
      const saved = await saveProducto({ nombre: newProd.nombre, precio: newProd.precio, costo: newProd.costo || 0 });
      markLocalMutation();
      setProductos(prev => [...prev, saved]);
    } catch (_) {}
  }

  async function handleSaveGasto(data) {
    await claimReadyRef.current;
    // Optimistic: la UI responde al toque y el INSERT viaja en background.
    // Si falla, revertimos la fila optimista y mostramos el error.
    const tempId = 'tmp-' + Date.now();
    const optimistic = { id: tempId, ...data };
    markLocalMutation();
    setGastos(prev => [optimistic, ...prev]);
    toast('Gasto registrado');
    saveGasto(data)
      .then(saved => setGastos(prev => prev.map(g => g.id === tempId ? saved : g)))
      .catch(e => {
        setGastos(prev => prev.filter(g => g.id !== tempId));
        toast(e.message, 'error');
      });
  }

  async function handleDeleteGasto(id) {
    try {
      await deleteGasto(id);
      markLocalMutation();
      setGastos(prev => prev.filter(g => g.id !== id));
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleSaveCobro(data) {
    await claimReadyRef.current;
    const tempId = 'tmp-' + Date.now();
    const optimistic = { id: tempId, ...data };
    markLocalMutation();
    setCobros(prev => [optimistic, ...prev]);
    setCobroFormOpen(false);
    toast('Cobro registrado');
    saveCobro(data)
      .then(saved => setCobros(prev => prev.map(c => c.id === tempId ? saved : c)))
      .catch(e => {
        setCobros(prev => prev.filter(c => c.id !== tempId));
        toast(e.message, 'error');
      });
  }

  async function handleDeleteCobro(id) {
    try {
      await deleteCobro(id);
      markLocalMutation();
      setCobros(prev => prev.filter(c => c.id !== id));
      toast('Cobro eliminado');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleSaveProducto(data) {
    await claimReadyRef.current;
    if (data.id) {
      const prevSnapshot = productos;
      markLocalMutation();
      setProductos(prev => prev.map(p => p.id === data.id ? { ...p, ...data } : p));
      setProductoFormOpen(false);
      setEditingProducto(null);
      toast('Producto actualizado');
      saveProducto(data)
        .then(saved => setProductos(prev => prev.map(p => p.id === data.id ? { ...p, ...saved } : p)))
        .catch(e => { setProductos(prevSnapshot); toast(e.message, 'error'); });
      return;
    }
    const tempId = 'tmp-' + Date.now();
    const optimistic = { id: tempId, ...data };
    markLocalMutation();
    setProductos(prev => [...prev, optimistic]);
    setProductoFormOpen(false);
    setEditingProducto(null);
    toast('Producto agregado');
    saveProducto(data)
      .then(saved => setProductos(prev => prev.map(p => p.id === tempId ? saved : p)))
      .catch(e => {
        setProductos(prev => prev.filter(p => p.id !== tempId));
        toast(e.message, 'error');
      });
  }

  async function handleDeleteProducto(id) {
    try {
      await deleteProducto(id);
      markLocalMutation();
      setProductos(prev => prev.filter(p => p.id !== id));
    } catch (e) { toast(e.message, 'error'); }
  }

  function handleExportCSV(from, to) {
    const filtPedidos = pedidos.filter(p => inRange(p.fecha, from, to));
    const filtGastos  = gastos.filter(g => inRange(g.fecha, from, to));
    const cn = id => clientes.find(c => c.id === id)?.nombre || '';

    // Escapa comillas y neutraliza inyección de fórmulas (=, +, -, @) al abrir
    // el CSV en Excel/Sheets con datos cargados por el usuario.
    const cell = v => {
      let s = String(v ?? '');
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };

    let csv = 'VENTAS\r\nFecha,Cliente,Items,Total,Medio de pago,Cobrado\r\n';
    filtPedidos.forEach(p => {
      csv += [cell(p.fecha), cell(cn(p.clienteId)), cell(p.items.map(i => `${i.nombre} x${i.cantidad}`).join('; ')), cell(p.totalFinal), cell(p.medioPago), cell(p.cobrado ? 'Sí' : 'No')].join(',') + '\r\n';
    });
    csv += '\r\nGASTOS\r\nFecha,Descripción,Monto,Categoría\r\n';
    filtGastos.forEach(g => {
      csv += [cell(g.fecha), cell(g.descripcion), cell(g.monto), cell(g.categoria)].join(',') + '\r\n';
    });

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `solvr_${from}_al_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('CSV descargado');
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    localStorage.setItem('sg_tab', tab);
    setSelectedClienteId(null);
    setShowPedidoForm(false);
    setPreClienteId(null);
    setEditingPedido(null);
  }

  function handleSplashDone() {
    sessionStorage.setItem('sg_splash_done', '1');
    setShowSplash(false);
  }

  const checkAndRedirectToPassword = useCallback(async () => {
    if (session?.user?.email) {
      try {
        const hasPw = await emailHasPassword(session.user.email);
        if (!hasPw) {
          setActiveTab('perfil');
          localStorage.setItem('sg_tab', 'perfil');
          setAutoExpandPassword(true);
        }
      } catch (err) {
        console.error('Error checking password status:', err);
      }
    }
  }, [session]);

  // ── Render ────────────────────────────────────────────────

  if (verifyTokenHash) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)', background: '#080808', color: '#fff' }}>
        <div style={{ width: '100%', maxWidth: 380, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center' }}>
          <div style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', textAlign: 'center' }}>Solvnt.</div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, textAlign: 'center', color: '#fff', margin: 0 }}>Confirmar inicio de sesión</h2>
          <p style={{ color: 'var(--ink-2)', fontSize: 'var(--text-sm)', lineHeight: 1.5, textAlign: 'center', margin: 0 }}>
            Para ingresar de forma segura a tu cuenta, haz clic en el botón de abajo:
          </p>
          {verifyOtpError && (
            <p style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)', margin: 0, textAlign: 'center' }}>{verifyOtpError}</p>
          )}
          <button
            className="btn btn-primary btn-full"
            disabled={verifyingOtp}
            onClick={async () => {
              setVerifyingOtp(true);
              setVerifyOtpError('');
              try {
                const params = new URLSearchParams(window.location.search);
                const isRecovery = params.get('flow') === 'recovery' || verifyType === 'recovery';

                const { error } = await supabase.auth.verifyOtp({
                  token_hash: verifyTokenHash,
                  type: verifyType,
                });
                if (error) throw error;

                if (isRecovery) {
                  sessionStorage.setItem('sg_force_pw_change', '1');
                  setForcePasswordChange(true);
                }

                // Success! Clear URL params
                window.history.replaceState({}, document.title, window.location.pathname);
                setVerifyTokenHash(null);
              } catch (err) {
                setVerifyOtpError(err.message === 'Token has expired' ? 'El enlace de inicio de sesión ha expirado o es inválido' : err.message);
              } finally {
                setVerifyingOtp(false);
              }
            }}
            style={{ minHeight: 48, fontSize: 'var(--text-base)', fontWeight: 700, width: '100%', background: '#ffffff', color: '#000000', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
          >
            {verifyingOtp ? 'Ingresando...' : 'Confirmar e Ingresar'}
          </button>
          <button
            className="login-back-btn"
            onClick={() => {
              window.history.replaceState({}, document.title, window.location.pathname);
              setVerifyTokenHash(null);
            }}
            disabled={verifyingOtp}
            style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 'var(--text-sm)', cursor: verifyingOtp ? 'not-allowed' : 'pointer', textDecoration: 'underline', padding: 0, opacity: verifyingOtp ? 0.5 : 1 }}
          >
            Cancelar y volver al login
          </button>
        </div>
      </div>
    );
  }

  if (showSplash) {
    return <SplashScreen onDone={handleSplashDone} />;
  }

  if (!authChecked) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', color: 'var(--color-ink-3)' }}>
        Cargando...
      </div>
    );
  }

  if (!session) {
    return (
      <>
        {authView === 'landing' ? (
          <LandingScreen onLogin={(method) => { setLoginMethod(method); setAuthView('login'); }} />
        ) : (
          <LoginScreen initialMethod={loginMethod} isFirstTime={loginMethod === 'otp'} onBack={() => setAuthView('landing')} />
        )}
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  if (forcePasswordChange) {
    return (
      <>
        <ForcePasswordReset
          onComplete={() => {
            sessionStorage.removeItem('sg_force_pw_change');
            sessionStorage.setItem('sg_pw_reset_done', '1');
            setForcePasswordChange(false);
          }}
          toast={toast}
        />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  if (loading) {
    return <SkeletonLoader />;
  }

  const bloqueada = suscripcion && (suscripcion.estado === 'vencida' || suscripcion.estado === 'bloqueada') && !isOwner;
  if (bloqueada) {
    return <SuscripcionBlocker suscripcion={suscripcion} onRenovada={() => setSuscripcion(s => ({ ...s, estado: 'activa' }))} />;
  }

  const showOnboarding = isOwner && negocioConfig !== null && !negocioConfig.onboarding_done;
  const showTeamWelcome = !isOwner && userRole !== 'owner' && negocioConfig !== null && !teamWelcomeSeen;

  const selectedCliente = clientes.find(c => c.id === selectedClienteId) || null;
  const negocioNombre = negocioConfig?.nombre || 'Mi Negocio';

  const tabVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit:    { opacity: 0, x: -20 },
  };

  function renderTab() {
    switch (activeTab) {
      case 'clientes':
        if (selectedClienteId) {
          return (
            <ClienteDetail
              key="cliente-detail"
              cliente={selectedCliente}
              pedidos={pedidos}
              devoluciones={devoluciones}
              cobros={cobros}
              negocio={negocioNombre}
              negocioConfig={negocioConfig}
              onBack={() => setSelectedClienteId(null)}
              onEdit={() => { setEditingCliente(selectedCliente); setClienteFormOpen(true); }}
              onDelete={() => handleDeleteCliente(selectedClienteId)}
              onNuevoPedido={() => {
                setPreClienteId(selectedClienteId);
                setSelectedClienteId(null);
                setActiveTab('pedidos');
                setTimeout(() => setShowPedidoForm(true), 60);
              }}
              onRegistrarCobro={() => { setCobroPreClienteId(selectedClienteId); setCobroFormOpen(true); }}
              onRefresh={loadAll}
              toast={toast}
              userRole={userRole}
            />
          );
        }
        return (
          <ClientesList
            key="clientes-list"
            clientes={clientes}
            pedidos={pedidos}
            devoluciones={devoluciones}
            cobros={cobros}
            negocioConfig={negocioConfig}
            diasMora={diasSinCobro}
            onSelect={id => setSelectedClienteId(id)}
            onNew={() => { setEditingCliente(null); setClienteFormOpen(true); }}
            onRefresh={loadAll}
            toast={toast}
            userRole={userRole}
          />
        );

      case 'pedidos':
        if (showPedidoForm) {
          return (
            <PedidoForm
              key="pedido-form"
              clientes={clientes}
              productos={productos}
              preClienteId={preClienteId}
              existing={editingPedido}
              onSave={handleSavePedido}
              onBack={() => { setShowPedidoForm(false); setPreClienteId(null); setEditingPedido(null); }}
              onProductoCreated={handleProductoCreado}
              toast={toast}
            />
          );
        }
        return (
          <PedidosList
            key="pedidos-list"
            pedidos={pedidos}
            clientes={clientes}
            onNew={() => { setPreClienteId(null); setEditingPedido(null); setShowPedidoForm(true); }}
            onRegistrarCobro={() => { setCobroPreClienteId(null); setCobroFormOpen(true); }}
            onUpdate={handleUpdatePedido}
            onDelete={handleDeletePedido}
            onEdit={p => { setEditingPedido(p); setShowPedidoForm(true); }}
            onDuplicate={p => {
              // Copia sin id: el form lo trata como pedido nuevo con los mismos
              // items del original, fecha de hoy y sin cobros ni entregas.
              setEditingPedido({
                ...p,
                id: null,
                nro: null,
                fecha: today(),
                cobrado: false,
                montoAbonado: 0,
                confirmado: true,
                items: (p.items || []).map(it => ({ ...it, id: undefined, entregado: false, fechaEntrega: null })),
              });
              setShowPedidoForm(true);
            }}
            onMarcarEntregado={handleMarcarEntregado}
            onRevertirEntregado={handleRevertirEntregado}
            onRefresh={loadAll}
            toast={toast}
            userRole={userRole}
          />
        );

      case 'gastos':
        return (
          <GastosList
            key="gastos-list"
            gastos={gastos}
            categorias={categorias}
            onSave={handleSaveGasto}
            onDelete={handleDeleteGasto}
            toast={toast}
          />
        );

      case 'stats':
        return (
          <Suspense fallback={<SkeletonLoader />}>
            <StatsPanel
              key="stats-panel"
              pedidos={pedidos}
              gastos={gastos}
              clientes={clientes}
              productos={productos}
              devoluciones={devoluciones}
              cobros={cobros}
              categorias={categorias}
              onExportCSV={handleExportCSV}
            />
          </Suspense>
        );

      case 'productos':
        return (
          <ProductosList
            key="productos-list"
            productos={productos}
            onNew={() => { setEditingProducto(null); setProductoFormOpen(true); }}
            onEdit={p => { setEditingProducto(p); setProductoFormOpen(true); }}
            onDelete={handleDeleteProducto}
            onStockChange={loadAll}
            toast={toast}
            userRole={userRole}
          />
        );

      case 'caja':
        return (
          <CajaPanel
            key="caja-panel"
            pedidos={pedidos}
            gastos={gastos}
            clientes={clientes}
            cobrosSueltos={cobros}
            onDeleteCobro={handleDeleteCobro}
          />
        );

      case 'perfil':
        return (
          <Suspense fallback={<SkeletonLoader />}>
            <PerfilPanel
              key="perfil-panel"
              session={session}
              isOwner={isOwner}
              userRole={userRole}
              clientes={clientes}
              pedidos={pedidos}
              gastos={gastos}
              devoluciones={devoluciones}
              cobros={cobros}
              suscripcion={suscripcion}
              negocioConfig={negocioConfig}
              onNegocioSave={async (cfg) => { const saved = await saveNegocioConfig(cfg); setNegocioConfig(saved); }}
              toast={toast}
              theme={theme}
              onThemeChange={setTheme}
              autoExpandPassword={autoExpandPassword}
              onResetAutoExpand={() => setAutoExpandPassword(false)}
            />
          </Suspense>
        );

      default:
        return null;
    }
  }

  const diasTrial = suscripcion?.estado === 'prueba'
    ? Math.round((new Date(suscripcion.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="app-shell">
      {suscripcion?.estado === 'prueba' && diasTrial !== null && diasTrial >= 0 && (
        <TrialBanner dias={diasTrial} onUpgrade={() => setActiveTab('perfil')} />
      )}

      <div className="tab-content" ref={scrollRef}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + (showPedidoForm ? '-form' : '') + (selectedClienteId ? '-detail' : '')}
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            <ScrollKeeper
              scrollKey={activeTab + (showPedidoForm ? '-form' : '') + (selectedClienteId ? '-detail' : '')}
              containerRef={scrollRef}
              memRef={scrollMem}
            >
              {renderTab()}
            </ScrollKeeper>
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} alertCount={alertCount} allowedTabs={ALLOWED_TABS[userRole] || ALLOWED_TABS.owner} />

      <Suspense fallback={null}>
        <AsistenteChat />
      </Suspense>

      <ClienteForm
        open={clienteFormOpen}
        existing={editingCliente}
        onSave={handleSaveCliente}
        onClose={() => { setClienteFormOpen(false); setEditingCliente(null); }}
      />

      <CobroForm
        open={cobroFormOpen}
        clientes={clientes}
        pedidos={pedidos}
        devoluciones={devoluciones}
        cobros={cobros}
        preClienteId={cobroPreClienteId}
        metodos={(negocioConfig?.metodos_pago || 'Efectivo, Transferencia, Tarjeta').split(',').map(m => m.trim().toLowerCase()).filter(Boolean)}
        onSave={handleSaveCobro}
        onClose={() => { setCobroFormOpen(false); setCobroPreClienteId(null); }}
      />

      <ProductoForm
        open={productoFormOpen}
        existing={editingProducto}
        onSave={handleSaveProducto}
        onClose={() => { setProductoFormOpen(false); setEditingProducto(null); }}
      />

      {showOnboarding && (
        <OnboardingWizard
          session={session}
          clientes={clientes}
          productos={productos}
          onComplete={async () => {
            const cfg = await getNegocioConfig();
            setNegocioConfig(cfg);
            await loadAll();
            await checkAndRedirectToPassword();
          }}
          toast={toast}
        />
      )}

      {showTeamWelcome && (
        <TeamWelcomeScreen
          userRole={userRole}
          negocioConfig={negocioConfig}
          onDismiss={async () => {
            sessionStorage.setItem('sg_team_welcome', '1');
            setTeamWelcomeSeen(true);
            await checkAndRedirectToPassword();
          }}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
