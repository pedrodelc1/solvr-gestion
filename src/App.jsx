import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './lib/supabase.js';
import {
  getClientes, saveCliente, deleteCliente,
  getProductos, saveProducto, deleteProducto,
  getPedidos, savePedido, updatePedido, deletePedido,
  getGastos, saveGasto, deleteGasto,
  getCategorias,
  procesarCuotasVencidas,
  isOwnerEmail,
  getUserRole,
  setEffectiveUserId,
  getSuscripcion, crearSuscripcionTrial,
  getAlertasConfig,
  getDevoluciones,
  getNegocioConfig, saveNegocioConfig,
  getComunicaciones,
  marcarPedidoEntregado,
} from './lib/db.js';
import { inRange, saldoCliente } from './lib/utils.js';

import { LoginScreen } from './components/auth/LoginScreen.jsx';
import { SplashScreen } from './components/auth/SplashScreen.jsx';
import { BottomNav } from './components/shared/BottomNav.jsx';
import { ToastContainer } from './components/shared/Toast.jsx';
import { ClienteForm } from './components/clientes/ClienteForm.jsx';
import { ClientesList } from './components/clientes/ClientesList.jsx';
import { ClienteDetail } from './components/clientes/ClienteDetail.jsx';
import { PedidosList } from './components/pedidos/PedidosList.jsx';
import { PedidoForm } from './components/pedidos/PedidoForm.jsx';
import { GastosList } from './components/gastos/GastosList.jsx';
import { GastoForm } from './components/gastos/GastoForm.jsx';
import { StatsPanel } from './components/stats/StatsPanel.jsx';
import { ProductosList } from './components/productos/ProductosList.jsx';
import { ProductoForm } from './components/productos/ProductoForm.jsx';
import { PerfilPanel } from './components/perfil/PerfilPanel.jsx';
import { CajaPanel } from './components/caja/CajaPanel.jsx';
import { SkeletonLoader } from './components/shared/SkeletonLoader.jsx';
import { SuscripcionBlocker } from './components/suscripciones/SuscripcionBlocker.jsx';
import { TrialBanner } from './components/shared/TrialBanner.jsx';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard.jsx';
import { TeamWelcomeScreen } from './components/onboarding/TeamWelcomeScreen.jsx';

let _toastId = 0;

export default function App() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem('sg_splash_done'));
  const [theme, setTheme] = useState(() => localStorage.getItem('sg_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sg_theme', theme);
  }, [theme]);

  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [devoluciones, setDevoluciones] = useState([]);
  const [comunicaciones, setComunicaciones] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Clientes UI
  const [selectedClienteId, setSelectedClienteId] = useState(null);
  const [clienteFormOpen, setClienteFormOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);

  // Pedidos UI
  const [showPedidoForm, setShowPedidoForm] = useState(false);
  const [preClienteId, setPreClienteId] = useState(null);
  const [editingPedido, setEditingPedido] = useState(null);

  // Gastos UI
  const [gastoFormOpen, setGastoFormOpen] = useState(false);

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_ev, sess) => {
      if (sess) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            sess.user = user;
          }
        } catch (err) {
          console.error('Error loading fresh user details:', err);
        }
      }
      setSession(sess ? { ...sess } : null);
      setAuthChecked(true);
    });
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (s) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            s.user = user;
          }
        } catch (err) {
          console.error('Error loading fresh user details:', err);
        }
      }
      setSession(s ? { ...s } : null);
      setAuthChecked(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load data ─────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, pr, pe, g, cats, devs, coms] = await Promise.all([
        getClientes(), getProductos(), getPedidos(), getGastos(), getCategorias(),
        getDevoluciones(), getComunicaciones(),
      ]);
      setClientes(c);
      setProductos(pr);
      setGastos(g);
      setCategorias(cats);
      setDevoluciones(devs);
      setComunicaciones(coms);

      if (c.length > 0 && pe.length === 0) {
        setToasts(t => {
          const id = ++_toastId;
          setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 8000);
          return [...t, { id, msg: 'Pedidos no se pudieron cargar. Revisá las políticas RLS en Supabase.', type: 'error' }];
        });
      }

      const { pedidos: peActualizados, procesados } = await procesarCuotasVencidas(pe);
      setPedidos(peActualizados);
      if (procesados.length) {
        procesados.forEach(proc => {
          const ped = peActualizados.find(p => p.id === proc.id);
          const nombre = c.find(cl => cl.id === ped?.clienteId)?.nombre || 'Cliente';
          setToasts(t => {
            const id = ++_toastId;
            setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 3500);
            return [...t, { id, msg: `💳 Cuota ${proc.cuotasDue}/${proc.cuotas} registrada — ${nombre}`, type: 'success' }];
          });
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authChecked && session) {
      const email = session.user.email;
      const init = async () => {
        // Post-auth whitelist check (works because user is now authenticated)
        const { data: entry, error: entryErr } = await supabase
          .from('allowed_emails')
          .select('id, owner_user_id, is_owner')
          .eq('email', email.toLowerCase().trim())
          .maybeSingle();

        if (entryErr) {
          console.error("Error checking whitelist:", entryErr);
          toast("Error al verificar acceso: " + entryErr.message, "error");
          // If we fail to query the whitelist table, don't boot the user immediately.
          // Let them proceed so they aren't locked out due to transient network/RLS check glitches.
          loadAll();
          return;
        }

        const superadmin = import.meta.env.VITE_SUPERADMIN_EMAIL;
        const isSuperadmin = superadmin && email.toLowerCase().trim() === superadmin.toLowerCase().trim();
        if (!isSuperadmin && !entry) {
          toast("Acceso denegado: El correo " + email + " no está autorizado en el equipo.", "error");
          await supabase.auth.signOut();
          return;
        }
        // For team members: use owner's user_id for all writes
        if (entry?.owner_user_id && !entry.is_owner) {
          setEffectiveUserId(entry.owner_user_id);
        }
        loadAll();
        isOwnerEmail(email).then(setIsOwner);
        getUserRole(email).then(r => setUserRole(r || 'vendedor'));
        getSuscripcion().then(async sus => {
          if (!sus) {
            const nueva = await crearSuscripcionTrial();
            setSuscripcion(nueva);
          } else {
            setSuscripcion(sus);
          }
        });
        getAlertasConfig().then(cfg => setDiasSinCobro(cfg.dias_sin_cobro));
        getNegocioConfig().then(setNegocioConfig);
      };
      init();
    } else if (authChecked && !session) {
      setEffectiveUserId(null);
    }
  }, [authChecked, session, loadAll]);

  // ── Realtime Database Sync ────────────────────────────────
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
        },
        (payload) => {
          // Background refresh when a change is detected on the DB
          loadAll();
        }
      )
      .subscribe();

    return () => {
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
    return clientes.filter(c => {
      const clientePedidos = pedidos.filter(p => p.clienteId === c.id && !p.cobrado && p.tipo !== 'presupuesto');
      if (!clientePedidos.length) return false;
      if (saldoCliente(c, pedidos, devoluciones) <= 0) return false;
      const oldest = clientePedidos.reduce((min, p) => p.fecha < min ? p.fecha : min, clientePedidos[0].fecha);
      const daysDiff = Math.round((new Date() - new Date(oldest)) / (1000 * 60 * 60 * 24));
      return daysDiff >= diasSinCobro;
    }).length;
  }, [clientes, pedidos, devoluciones, diasSinCobro]);

  // ── Handlers ──────────────────────────────────────────────

  async function handleSaveCliente(data) {
    try {
      const arr = await saveCliente(data);
      setClientes(arr);
      setClienteFormOpen(false);
      setEditingCliente(null);
      toast(data.id ? 'Cliente actualizado' : 'Cliente agregado');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleDeleteCliente(id) {
    try {
      const arr = await deleteCliente(id);
      setClientes(arr);
      setSelectedClienteId(null);
      toast('Cliente eliminado');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleSavePedido(data) {
    try {
      let arr;
      if (data.id && pedidos.find(p => p.id === data.id)) {
        arr = await updatePedido(data.id, data);
      } else {
        arr = await savePedido(data);
      }
      setPedidos(arr);
      setShowPedidoForm(false);
      setPreClienteId(null);
      setEditingPedido(null);
      toast(data.id ? 'Pedido actualizado' : 'Pedido guardado');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleUpdatePedido(id, data) {
    try {
      const arr = await updatePedido(id, data);
      setPedidos(arr);
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleDeletePedido(id) {
    try {
      const arr = await deletePedido(id);
      setPedidos(arr);
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleMarcarEntregado(id) {
    try {
      const arr = await marcarPedidoEntregado(id);
      setPedidos(arr);
      toast('Marcado como entregado');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleProductoCreado(newProd) {
    try {
      const arr = await saveProducto({ nombre: newProd.nombre, precio: newProd.precio, costo: newProd.costo || 0 });
      setProductos(arr);
    } catch (_) {}
  }

  async function handleSaveGasto(data) {
    try {
      const arr = await saveGasto(data);
      setGastos(arr);
      setGastoFormOpen(false);
      toast('Gasto registrado');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleDeleteGasto(id) {
    try {
      const arr = await deleteGasto(id);
      setGastos(arr);
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleSaveProducto(data) {
    try {
      const arr = await saveProducto(data);
      setProductos(arr);
      setProductoFormOpen(false);
      setEditingProducto(null);
      toast(data.id ? 'Producto actualizado' : 'Producto agregado');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleDeleteProducto(id) {
    try {
      const arr = await deleteProducto(id);
      setProductos(arr);
    } catch (e) { toast(e.message, 'error'); }
  }

  function handleExportCSV(from, to) {
    const filtPedidos = pedidos.filter(p => inRange(p.fecha, from, to));
    const filtGastos  = gastos.filter(g => inRange(g.fecha, from, to));
    const cn = id => clientes.find(c => c.id === id)?.nombre || '';

    let csv = 'VENTAS\r\nFecha,Cliente,Items,Total,Medio de pago,Cobrado\r\n';
    filtPedidos.forEach(p => {
      csv += `"${p.fecha}","${cn(p.clienteId)}","${p.items.map(i => `${i.nombre} x${i.cantidad}`).join('; ')}","${p.totalFinal}","${p.medioPago}","${p.cobrado ? 'Sí' : 'No'}"\r\n`;
    });
    csv += '\r\nGASTOS\r\nFecha,Descripción,Monto,Categoría\r\n';
    filtGastos.forEach(g => {
      csv += `"${g.fecha}","${g.descripcion}","${g.monto}","${g.categoria}"\r\n`;
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

  // ── Render ────────────────────────────────────────────────

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
        <LoginScreen />
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
              comunicaciones={comunicaciones}
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
            negocioConfig={negocioConfig}
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
            onUpdate={handleUpdatePedido}
            onDelete={handleDeletePedido}
            onEdit={p => { setEditingPedido(p); setShowPedidoForm(true); }}
            onMarcarEntregado={handleMarcarEntregado}
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
            onNew={() => setGastoFormOpen(true)}
            onDelete={handleDeleteGasto}
            toast={toast}
          />
        );

      case 'stats':
        return (
          <StatsPanel
            key="stats-panel"
            pedidos={pedidos}
            gastos={gastos}
            clientes={clientes}
            productos={productos}
            devoluciones={devoluciones}
            categorias={categorias}
            onExportCSV={handleExportCSV}
          />
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
          />
        );

      case 'perfil':
        return (
          <PerfilPanel
            key="perfil-panel"
            session={session}
            isOwner={isOwner}
            userRole={userRole}
            clientes={clientes}
            pedidos={pedidos}
            gastos={gastos}
            suscripcion={suscripcion}
            negocioConfig={negocioConfig}
            onNegocioSave={async (cfg) => { const saved = await saveNegocioConfig(cfg); setNegocioConfig(saved); }}
            toast={toast}
            theme={theme}
            onThemeChange={setTheme}
          />
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

      <div className="tab-content">
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
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} alertCount={alertCount} allowedTabs={ALLOWED_TABS[userRole] || ALLOWED_TABS.owner} />

      <ClienteForm
        open={clienteFormOpen}
        existing={editingCliente}
        onSave={handleSaveCliente}
        onClose={() => { setClienteFormOpen(false); setEditingCliente(null); }}
      />

      <GastoForm
        open={gastoFormOpen}
        categorias={categorias}
        onSave={handleSaveGasto}
        onClose={() => setGastoFormOpen(false)}
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
          }}
          toast={toast}
        />
      )}

      {showTeamWelcome && (
        <TeamWelcomeScreen
          userRole={userRole}
          negocioConfig={negocioConfig}
          onDismiss={() => {
            sessionStorage.setItem('sg_team_welcome', '1');
            setTeamWelcomeSeen(true);
          }}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
