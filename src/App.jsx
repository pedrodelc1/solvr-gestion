import { useState, useEffect, useCallback } from 'react';
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
} from './lib/db.js';
import { inRange } from './lib/utils.js';

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
import { SkeletonLoader } from './components/shared/SkeletonLoader.jsx';

let _toastId = 0;

export default function App() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem('sg_splash_done'));

  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isOwner, setIsOwner] = useState(false);
  const [activeTab, setActiveTab] = useState('clientes');
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
    clientes: 'Clientes — Solvr',
    pedidos: 'Pedidos — Solvr',
    gastos: 'Gastos — Solvr',
    stats: 'Estadísticas — Solvr',
    productos: 'Catálogo — Solvr',
    perfil: 'Perfil — Solvr',
  };
  useEffect(() => {
    document.title = TAB_TITLES[activeTab] || 'Solvr Gestión';
  }, [activeTab]);

  // ── Auth ──────────────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, sess) => {
      setSession(sess);
      setAuthChecked(true);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthChecked(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load data ─────────────────────────────────────────────
  const cuotasCheckedRef = { current: false };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, pr, pe, g, cats] = await Promise.all([
        getClientes(), getProductos(), getPedidos(), getGastos(), getCategorias(),
      ]);
      setClientes(c);
      setProductos(pr);
      setGastos(g);
      setCategorias(cats);

      // Procesar cuotas vencidas y guardar clientes para los toasts
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
      loadAll();
      isOwnerEmail(session.user.email).then(setIsOwner);
    }
  }, [authChecked, session, loadAll]);

  // ── Toast ─────────────────────────────────────────────────
  const toast = useCallback((msg, type = 'success') => {
    const id = ++_toastId;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);

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

  async function handleProductoCreado(newProd) {
    try {
      const arr = await saveProducto({ nombre: newProd.nombre, precio: newProd.precio, costo: newProd.costo || 0 });
      setProductos(arr);
    } catch (_) { /* inline creation already applied locally */ }
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
    return <LoginScreen />;
  }

  if (loading) {
    return <SkeletonLoader />;
  }

  const selectedCliente = clientes.find(c => c.id === selectedClienteId) || null;

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
              onBack={() => setSelectedClienteId(null)}
              onEdit={() => { setEditingCliente(selectedCliente); setClienteFormOpen(true); }}
              onDelete={() => handleDeleteCliente(selectedClienteId)}
              onNuevoPedido={() => {
                setPreClienteId(selectedClienteId);
                setSelectedClienteId(null);
                setActiveTab('pedidos');
                setTimeout(() => setShowPedidoForm(true), 60);
              }}
            />
          );
        }
        return (
          <ClientesList
            key="clientes-list"
            clientes={clientes}
            pedidos={pedidos}
            onSelect={id => setSelectedClienteId(id)}
            onNew={() => { setEditingCliente(null); setClienteFormOpen(true); }}
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
            toast={toast}
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
            toast={toast}
          />
        );

      case 'perfil':
        return (
          <PerfilPanel
            key="perfil-panel"
            session={session}
            isOwner={isOwner}
            clientes={clientes}
            pedidos={pedidos}
            gastos={gastos}
            toast={toast}
          />
        );

      default:
        return null;
    }
  }

  return (
    <div className="app-shell">
      <div className="tab-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + (showPedidoForm ? '-form' : '') + (selectedClienteId ? '-detail' : '')}
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
            style={{ display: 'flex', flexDirection: 'column', flex: 1 }}
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />

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

      <ToastContainer toasts={toasts} />
    </div>
  );
}
