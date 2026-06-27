import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase.js';
import { formatCurrency, formatDate, saldoCliente } from '../../lib/utils.js';
import {
  getAllowedEmails, addAllowedEmail, removeAllowedEmail, updateMemberRol,
  emailHasPassword, updateUserPassword,
  getAlertasConfig, saveAlertasConfig,
  getSuscripciones, updateSuscripcion, renovarSuscripcion,
  esSuperadmin, getAdminWhitelist, adminGrantOwner, adminRevokeAccess,
  getMiPlanAsientos, getAdminPlanes, adminSetPlan,
} from '../../lib/db.js';

const BRAND = 'var(--lime)';
const BRAND_DIM = 'var(--lime-bg)';
const BRAND_GLOW = '0 0 20px rgba(204,255,0,0.25)';

const ROLES = [
  {
    id: 'admin',
    label: 'Admin',
    desc: 'Acceso completo',
    color: BRAND,
    bg: BRAND_DIM,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    id: 'vendedor',
    label: 'Vendedor',
    desc: 'Crea y edita pedidos',
    color: BRAND,
    bg: BRAND_DIM,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
      </svg>
    ),
  },
  {
    id: 'visualizador',
    label: 'Solo lectura',
    desc: 'Solo puede ver',
    color: BRAND,
    bg: BRAND_DIM,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    ),
  },
];

function getRoleData(rol) {
  return ROLES.find(r => r.id === rol) || ROLES[2];
}

function RolBadge({ rol }) {
  const r = getRoleData(rol);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999,
      background: r.bg, border: `1px solid var(--lime-border)`,
      color: r.color, fontSize: 11, fontWeight: 700,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {r.icon}
      {r.label}
    </span>
  );
}

function SoftwareOwnerBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999,
      background: 'linear-gradient(135deg, rgba(204,255,0,0.18), rgba(186,85,255,0.18))',
      border: `1px solid rgba(204,255,0,0.6)`,
      color: BRAND, fontSize: 11, fontWeight: 800,
      whiteSpace: 'nowrap', flexShrink: 0,
      textShadow: '0 0 8px rgba(204,255,0,0.4)',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>
      </svg>
      Software Owner
    </span>
  );
}

function isSuperEmail(emailValue) {
  const env = import.meta.env.VITE_SUPERADMIN_EMAIL;
  if (!env || !emailValue) return false;
  return String(emailValue).toLowerCase().trim() === String(env).toLowerCase().trim();
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: BRAND_DIM, border: `1px solid var(--lime-border)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: BRAND, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', lineHeight: 1.2 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.3 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-2)' }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.35 }}>{hint}</span>}
    </div>
  );
}

const inputStyle = {
  minHeight: 48,
  fontSize: 15,
  background: 'var(--bg-3)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '0 14px',
  color: 'var(--ink)',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 150ms',
  outline: 'none',
};

// Sección desplegable (acordeón) — mismo lenguaje visual que SectionHeader
function Collapsible({ icon, title, subtitle, defaultOpen = false, badge = null, children }) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
    }
  }, [defaultOpen]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderRadius: 14, background: 'var(--bg-2)',
        border: `1px solid ${open ? 'var(--lime-border)' : 'var(--border)'}`,
        overflow: 'hidden', transition: 'border-color 200ms',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: BRAND_DIM, border: `1px solid var(--lime-border)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: BRAND, flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', lineHeight: 1.2 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.3 }}>{subtitle}</div>}
        </div>
        {badge}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '2px 18px 20px' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function PerfilPanel({ session, isOwner, userRole, clientes, pedidos, gastos, devoluciones = [], cobros = [], suscripcion, negocioConfig, onNegocioSave, toast, theme, onThemeChange, autoExpandPassword, onResetAutoExpand }) {
  const email = session?.user?.email || null;
  const inicial = email ? email[0].toUpperCase() : '?';

  const isOtpLogin = useMemo(() => {
    try {
      if (!session?.access_token) return false;
      const parts = session.access_token.split('.');
      if (parts.length < 2) return false;
      const payload = JSON.parse(atob(parts[1]));
      const amr = payload?.amr || [];
      const methods = amr.map(a => typeof a === 'object' ? a.method : String(a));
      return methods.includes('otp') || methods.includes('magiclink') || methods.includes('recovery');
    } catch (e) {
      console.error('Error parsing token AMR:', e);
      return false;
    }
  }, [session]);

  const [avatarUrl, setAvatarUrl] = useState(() => {
    return session?.user?.user_metadata?.avatar_url || localStorage.getItem('sg_avatar_' + (email || '')) || null;
  });
  const [hoverAvatar, setHoverAvatar] = useState(false);

  useEffect(() => {
    if (session?.user?.user_metadata?.avatar_url) {
      setAvatarUrl(session.user.user_metadata.avatar_url);
    } else if (email) {
      setAvatarUrl(localStorage.getItem('sg_avatar_' + email) || null);
    }
  }, [session, email]);

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new Image();
      img.onload = async function () {
        const canvas = document.createElement('canvas');
        const MAX = 150;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
        else { if (h > MAX) { w *= MAX / h; h = MAX; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setAvatarUrl(dataUrl);
        if (email) localStorage.setItem('sg_avatar_' + email, dataUrl);
        try {
          const { error } = await supabase.auth.updateUser({ data: { avatar_url: dataUrl } });
          if (error) throw error;
          toast('Foto de perfil actualizada');
        } catch { toast('Guardado localmente', 'info'); }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  const [isSuperAdminDb, setIsSuperAdminDb] = useState(false);
  useEffect(() => {
    esSuperadmin().then(setIsSuperAdminDb);
  }, []);

  const isSuperAdmin = isSuperAdminDb || (email && import.meta.env.VITE_SUPERADMIN_EMAIL &&
    email.toLowerCase().trim() === import.meta.env.VITE_SUPERADMIN_EMAIL.toLowerCase().trim());

  const totalClientes = clientes.length;
  const pendientes = pedidos.filter(p => !p.cobrado && p.tipo !== 'presupuesto').length;
  const totalDeuda = clientes.reduce((s, c) => s + Math.max(0, saldoCliente(c, pedidos, devoluciones, cobros)), 0);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);

  const [negocioNombre, setNegocioNombre] = useState('');
  const [moneda, setMoneda] = useState('$');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [negocioEmail, setNegocioEmail] = useState('');
  const [cuit, setCuit] = useState('');
  const [notaPdf, setNotaPdf] = useState('');
  const [numInicial, setNumInicial] = useState(1);
  const [metodosPago, setMetodosPago] = useState('');
  const [recordatorioPlantilla, setRecordatorioPlantilla] = useState('');
  const [savingNegocio, setSavingNegocio] = useState(false);
  const savingNegocioRef = useRef(false);

  useEffect(() => {
    setNegocioNombre(negocioConfig?.nombre || '');
    setMoneda(negocioConfig?.moneda || '$');
    setTelefono(negocioConfig?.telefono || '');
    setDireccion(negocioConfig?.direccion || '');
    setNegocioEmail(negocioConfig?.email || '');
    setCuit(negocioConfig?.cuit || '');
    setNotaPdf(negocioConfig?.nota_pdf || '');
    setNumInicial(negocioConfig?.num_inicial || 1);
    setMetodosPago(negocioConfig?.metodos_pago || 'Efectivo, Transferencia, Tarjeta');
    setRecordatorioPlantilla(negocioConfig?.recordatorio_plantilla || '');
  }, [negocioConfig]);

  async function handleSaveConfig() {
    if (savingNegocioRef.current) return;
    if (!negocioNombre.trim()) return;
    savingNegocioRef.current = true;
    setSavingNegocio(true);
    try {
      const isMonedaChanged = moneda !== negocioConfig?.moneda;
      await onNegocioSave({
        ...negocioConfig,
        nombre: negocioNombre.trim(), moneda,
        telefono: telefono.trim(), direccion: direccion.trim(),
        email: negocioEmail.trim(), cuit: cuit.trim(),
        nota_pdf: notaPdf.trim(), num_inicial: parseInt(numInicial) || 1,
        metodos_pago: metodosPago.trim(),
        recordatorio_plantilla: recordatorioPlantilla.trim(),
      });
      toast('Configuración guardada');
      if (isMonedaChanged) setTimeout(() => window.location.reload(), 300);
    } catch (e) {
      toast(e.message, 'error');
      savingNegocioRef.current = false;
    } finally {
      setSavingNegocio(false);
    }
  }

  const [allowedEmails, setAllowedEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRol, setNewRol] = useState('vendedor');
  const [adding, setAdding] = useState(false);
  const [editingRolId, setEditingRolId] = useState(null);
  const [teamView, setTeamView] = useState('tree');
  const [diasAlerta, setDiasAlerta] = useState(7);
  const [savingAlerta, setSavingAlerta] = useState(false);
  const [suscripciones, setSuscripciones] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [planInfo, setPlanInfo] = useState({ limite: null, usados: 0, plan: null });
  const [loadingSus, setLoadingSus] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [grantingOwner, setGrantingOwner] = useState(false);
  const grantingOwnerRef = useRef(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [hasPassword, setHasPassword] = useState(true);
  const [loadingMap, setLoadingMap] = useState({});
  const [loggingOut, setLoggingOut] = useState(false);

  const updatingPasswordRef = useRef(false);
  const loadingMapRef = useRef({});
  const loggingOutRef = useRef(false);
  const addingRef = useRef(false);
  const savingAlertaRef = useRef(false);

  const securitySectionRef = useRef(null);

  useEffect(() => {
    if (autoExpandPassword) {
      setTimeout(() => {
        if (securitySectionRef.current) {
          securitySectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 350);
      if (onResetAutoExpand) {
        onResetAutoExpand();
      }
    }
  }, [autoExpandPassword, onResetAutoExpand]);

  async function runAction(id, actionFn) {
    if (loadingMapRef.current[id]) return;
    loadingMapRef.current[id] = true;
    setLoadingMap(prev => ({ ...prev, [id]: true }));
    try {
      await actionFn();
    } catch (e) {
      console.error(e);
    } finally {
      loadingMapRef.current[id] = false;
      setLoadingMap(prev => ({ ...prev, [id]: false }));
    }
  }

  async function handleUpdatePassword() {
    if (updatingPasswordRef.current) return;
    // Validación frontend (1ª verificación). Si el usuario nunca seteó
    // contraseña (primer ingreso por magic link) o entró con OTP, no pedimos la actual.
    if (hasPassword && !isOtpLogin && !currentPassword.trim()) {
      toast('Ingresá tu contraseña actual', 'error');
      return;
    }
    if (!newPassword.trim() || newPassword.trim().length < 6) {
      toast('La nueva contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('Las contraseñas nuevas no coinciden', 'error');
      return;
    }
    if (hasPassword && !isOtpLogin && newPassword.trim() === currentPassword.trim()) {
      toast('La nueva contraseña debe ser distinta a la actual', 'error');
      return;
    }
    if (!email) {
      toast('No se pudo identificar tu cuenta', 'error');
      return;
    }
    updatingPasswordRef.current = true;
    setUpdatingPassword(true);
    try {
      // 2ª verificación (backend): si ya hay contraseña y no es login OTP, re-autenticamos con
      // la actual (Supabase valida el hash en server). Si no hay contraseña o entramos con OTP,
      // confiamos en la sesión activa — Supabase Auth solo permite updateUser
      // con un access_token válido del usuario, así que el backend igual
      // protege la operación (no se puede setear password ajena desde el front).
      if (hasPassword && !isOtpLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword.trim(),
        });
        if (signInError) {
          toast('La contraseña actual es incorrecta', 'error');
          updatingPasswordRef.current = false;
          setUpdatingPassword(false);
          return;
        }
      }
      await updateUserPassword(newPassword.trim());
      toast(hasPassword ? 'Contraseña cambiada con éxito' : 'Contraseña creada con éxito');
      setHasPassword(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      updatingPasswordRef.current = false;
      setUpdatingPassword(false);
    }
  }

  useEffect(() => {
    getAllowedEmails().then(setAllowedEmails);
    getAlertasConfig().then(cfg => setDiasAlerta(cfg.dias_sin_cobro));
    getMiPlanAsientos().then(setPlanInfo);
    if (email) emailHasPassword(email).then(v => { if (v !== null) setHasPassword(v); });
  }, [email]);

  useEffect(() => {
    if (isOwner && showAdminPanel) {
      setLoadingSus(true);
      Promise.all([getSuscripciones(), getAdminWhitelist(), getAdminPlanes()]).then(([sus, wl, pl]) => {
        setSuscripciones(sus);
        setWhitelist(wl);
        setPlanes(pl);
        setLoadingSus(false);
      });
    }
  }, [isOwner, showAdminPanel]);

  async function handleAdd() {
    if (addingRef.current) return;
    if (!newEmail.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      toast('Ingresá un email válido', 'error');
      return;
    }
    addingRef.current = true;
    setAdding(true);
    try {
      const arr = await addAllowedEmail(newEmail.trim(), newRol);
      setAllowedEmails(arr); setNewEmail('');
      getMiPlanAsientos().then(setPlanInfo);
      toast('Miembro agregado al equipo');
    } catch (e) {
      toast(e.message.includes('unique') ? 'Ese email ya está en el equipo' : e.message, 'error');
      addingRef.current = false;
    } finally {
      setAdding(false);
    }
  }

  async function handleChangeRol(id, rol) {
    await runAction(id, async () => {
      try {
        const arr = await updateMemberRol(id, rol);
        setAllowedEmails(arr); setEditingRolId(null);
        getMiPlanAsientos().then(setPlanInfo);
        toast('Rol actualizado');
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  async function handleRemove(id) {
    await runAction(id, async () => {
      try {
        const arr = await removeAllowedEmail(id);
        setAllowedEmails(arr);
        getMiPlanAsientos().then(setPlanInfo);
        toast('Email eliminado');
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  async function handleSaveAlerta() {
    if (savingAlertaRef.current) return;
    savingAlertaRef.current = true;
    setSavingAlerta(true);
    try {
      await saveAlertasConfig(diasAlerta);
      toast('Configuración guardada');
    } catch (e) {
      toast(e.message, 'error');
      savingAlertaRef.current = false;
    } finally {
      setSavingAlerta(false);
    }
  }

  async function handleUpdateSuscripcion(id, estado) {
    await runAction(id + '-' + estado, async () => {
      try {
        const arr = await updateSuscripcion(id, { estado });
        setSuscripciones(arr); toast(`Suscripción ${estado}`);
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  async function handleGrantOwner() {
    if (grantingOwnerRef.current) return;
    const clean = newOwnerEmail.trim();
    // Validación frontend (la real está en el backend: es_superadmin + regex)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      toast('Ingresá un email válido', 'error');
      return;
    }
    grantingOwnerRef.current = true;
    setGrantingOwner(true);
    try {
      const wl = await adminGrantOwner(clean);
      setWhitelist(wl);
      setNewOwnerEmail('');
      toast('Acceso de dueño otorgado');
    } catch (e) {
      toast(e.message, 'error');
      grantingOwnerRef.current = false;
    } finally {
      setGrantingOwner(false);
      grantingOwnerRef.current = false;
    }
  }

  async function handleRevokeAccess(wlEmail) {
    await runAction('revoke-' + wlEmail, async () => {
      try {
        const wl = await adminRevokeAccess(wlEmail);
        setWhitelist(wl);
        toast('Acceso revocado');
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  async function handleSetPlan(id, planId) {
    await runAction(id + '-plan', async () => {
      try {
        const arr = await adminSetPlan(id, planId);
        setSuscripciones(arr);
        toast('Plan actualizado');
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  async function handleRenovar(id) {
    await runAction(id + '-renovar', async () => {
      try {
        const arr = await renovarSuscripcion(id);
        setSuscripciones(arr); toast('+30 días aplicados');
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  async function handleLogout() {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      toast('Sesión cerrada');
      setTimeout(() => window.location.reload(), 500);
    } catch (e) {
      toast(e.message, 'error');
      loggingOutRef.current = false;
      setLoggingOut(false);
    }
  }

  const diasRestantes = suscripcion
    ? Math.round((new Date(suscripcion.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const roleData = isOwner
    ? { label: 'Dueño', color: BRAND, bg: BRAND_DIM }
    : getRoleData(userRole);

  const statItems = [
    {
      label: 'Clientes',
      value: totalClientes,
      color: BRAND,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
      ),
    },
    {
      label: 'Pendientes',
      value: pendientes,
      color: pendientes > 0 ? '#f59e0b' : BRAND,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
    {
      label: 'Por cobrar',
      value: formatCurrency(totalDeuda),
      color: totalDeuda > 0 ? '#f87171' : BRAND,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
        </svg>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>

      {/* ── HERO HEADER ── */}
      <div style={{
        position: 'relative',
        padding: '32px 20px 28px',
        background: 'linear-gradient(160deg, rgba(204,255,0,0.06) 0%, transparent 60%)',
        borderBottom: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        {/* decorative glow */}
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 160, height: 160, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(204,255,0,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, position: 'relative' }}>
          {/* Avatar */}
          <div
            onMouseEnter={() => setHoverAvatar(true)}
            onMouseLeave={() => setHoverAvatar(false)}
            style={{ position: 'relative', width: 92, height: 92 }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              onClick={() => document.getElementById('avatar-upload').click()}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              style={{
                width: '100%', height: '100%', borderRadius: '50%',
                background: avatarUrl ? 'none' : `linear-gradient(135deg, ${BRAND}, #88dd00)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, fontWeight: 800, color: '#080808',
                boxShadow: BRAND_GLOW,
                cursor: 'pointer',
                border: `2px solid var(--lime-border)`,
                position: 'relative', overflow: 'hidden',
              }}
            >
              {avatarUrl
                ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt="Avatar" />
                : inicial
              }
              <AnimatePresence>
                {hoverAvatar && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(0,0,0,0.55)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '50%',
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* remove photo btn */}
            <AnimatePresence>
              {avatarUrl && hoverAvatar && (
                <motion.button
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setAvatarUrl(null);
                    if (email) localStorage.removeItem('sg_avatar_' + email);
                    try {
                      const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } });
                      if (error) throw error;
                      toast('Foto eliminada');
                    } catch { toast('Error al actualizar', 'error'); }
                  }}
                  style={{
                    position: 'absolute', top: -2, right: -2,
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'var(--danger)', color: '#fff',
                    border: '2px solid var(--bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    zIndex: 10,
                  }}
                >
                  ✕
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <input type="file" id="avatar-upload" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />

          {/* Name + role */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 6 }}>{email}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              {isSuperAdmin ? (
                <SoftwareOwnerBadge />
              ) : (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 12px', borderRadius: 999,
                  background: roleData.bg, border: `1px solid var(--lime-border)`,
                  color: roleData.color, fontSize: 12, fontWeight: 700,
                }}>
                  {isOwner ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  ) : roleData.icon}
                  {isOwner ? 'Dueño' : roleData.label}
                </span>
              )}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 12, color: '#4ade80', fontWeight: 600,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', background: '#4ade80',
                  display: 'inline-block',
                  boxShadow: '0 0 0 0 rgba(74,222,128,0.4)',
                  animation: 'pulse-dot 2s infinite',
                }} />
                Conectado
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0% { box-shadow: 0 0 0 0 rgba(74,222,128,0.5); }
          70% { box-shadow: 0 0 0 6px rgba(74,222,128,0); }
          100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); }
        }
      `}</style>

      {/* ── TRIAL BANNER ── */}
      {suscripcion && diasRestantes !== null && diasRestantes <= 10 && diasRestantes >= 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            margin: '16px 16px 0',
            padding: '12px 16px',
            borderRadius: 12,
            background: diasRestantes <= 2 ? 'rgba(239,68,68,0.12)' : 'rgba(251,191,36,0.1)',
            border: `1px solid ${diasRestantes <= 2 ? 'rgba(239,68,68,0.4)' : 'rgba(251,191,36,0.3)'}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={diasRestantes <= 2 ? '#ef4444' : '#fbbf24'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: diasRestantes <= 2 ? '#ef4444' : '#fbbf24' }}>
            {diasRestantes === 0 ? 'Tu prueba gratuita vence hoy.' : `Tu prueba gratuita vence en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}.`}
          </span>
        </motion.div>
      )}

      {/* ── ACCESO (vendedor/visualizador) ── */}
      {!isOwner && userRole !== 'admin' && (() => {
        const ownerEntry = allowedEmails.find(e => e.is_owner);
        const ownerEmail = ownerEntry?.email || null;
        const negocioNombreDisplay = negocioConfig?.nombre || null;
        const r = getRoleData(userRole);
        const permisos = userRole === 'vendedor'
          ? {
              si: ['Crear y editar clientes y pedidos', 'Registrar cobros y pagos', 'Ver catálogo y estadísticas'],
              no: ['Gastos, Caja y configuración', 'Eliminar registros'],
            }
          : {
              si: ['Ver clientes, pedidos y catálogo', 'Ver cuenta corriente y descargarla'],
              no: ['Crear, editar o eliminar cualquier dato', 'Registrar cobros ni enviar mensajes'],
            };

        return (
          <div style={{ padding: '16px 16px 0' }}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                borderRadius: 14, background: 'var(--bg-2)',
                border: `1px solid var(--lime-border)`,
                overflow: 'hidden',
              }}
            >
              <div style={{
                padding: '12px 16px',
                background: r.bg,
                borderBottom: `1px solid var(--lime-border)`,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ color: r.color }}>{r.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: r.color }}>Tu nivel de acceso: {r.label}</span>
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(negocioNombreDisplay || ownerEmail) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                    {negocioNombreDisplay && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>EMPRESA</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: BRAND }}>{negocioNombreDisplay}</span>
                      </div>
                    )}
                    {ownerEmail && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>TITULAR</span>
                        <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{ownerEmail}</span>
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {permisos.si.map(p => (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      {p}
                    </div>
                  ))}
                  {permisos.no.map(p => (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-3)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* ── STATS ── */}
      <div style={{ padding: '20px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {statItems.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 24 }}
            style={{
              borderRadius: 14, background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              padding: '14px 14px 12px',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}
          >
            <div style={{ color: item.color, opacity: 0.85 }}>{item.icon}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
            <div style={{
              fontSize: typeof item.value === 'string' && item.value.length > 10 ? 15 : 22,
              fontWeight: 800, color: item.color,
              lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {item.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── CONFIGURACIÓN DEL SISTEMA (owner/admin) ── */}
      {(isOwner || userRole === 'admin') && (
        <div style={{ padding: '24px 16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* label */}
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: 2 }}>
            Configuración del Sistema
          </div>

          {/* Acordeón: Datos de tu Negocio */}
          <Collapsible
            defaultOpen
            title="Datos de tu Negocio"
            subtitle="Nombre e información fiscal"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Nombre del negocio *" hint="Este nombre aparece en tus PDFs y presupuestos">
                <input
                  type="text" placeholder="Ej: Repuestos Ferrari"
                  value={negocioNombre} onChange={e => setNegocioNombre(e.target.value)}
                  style={inputStyle} autoComplete="off" autoCorrect="off"
                />
              </Field>
              <Field label="CUIT / Tax ID" hint="Tu número de identificación fiscal">
                <input
                  type="text" placeholder="Ej: 30-12345678-9"
                  value={cuit} onChange={e => setCuit(e.target.value)}
                  style={inputStyle} autoComplete="off" autoCorrect="off"
                />
              </Field>
            </div>
          </Collapsible>

          {/* Acordeón: Información de Contacto */}
          <Collapsible
            title="Información de Contacto"
            subtitle="Aparece en los PDFs que generás"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.69 12 19.79 19.79 0 011.61 3.4 2 2 0 013.6 1.22h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.91 8.78a16 16 0 006.29 6.29l.96-.96a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
              </svg>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Teléfono / WhatsApp">
                <input
                  type="text" placeholder="Ej: +54 9 11 1234 5678"
                  value={telefono} onChange={e => setTelefono(e.target.value)}
                  style={inputStyle} autoComplete="off" autoCorrect="off"
                />
              </Field>
              <Field label="Dirección">
                <input
                  type="text" placeholder="Ej: Av. Siempreviva 742"
                  value={direccion} onChange={e => setDireccion(e.target.value)}
                  style={inputStyle} autoComplete="off" autoCorrect="off"
                />
              </Field>
              <Field label="Email del negocio">
                <input
                  type="email" placeholder="Ej: contacto@minegocio.com"
                  value={negocioEmail} onChange={e => setNegocioEmail(e.target.value)}
                  style={inputStyle} autoComplete="off" autoCorrect="off"
                />
              </Field>
            </div>
          </Collapsible>

          {/* Acordeón: Documentos y Preferencias */}
          <Collapsible
            title="Documentos y Preferencias"
            subtitle="Moneda, numeración y métodos de pago"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Moneda">
                  <select
                    value={moneda} onChange={e => setMoneda(e.target.value)}
                    style={{ ...inputStyle, padding: '0 10px' }}
                  >
                    <option value="$">$ Pesos</option>
                    <option value="U$D">U$D Dólares</option>
                    <option value="€">€ Euros</option>
                    <option value="Gs">Gs Guaraníes</option>
                    <option value="R$">R$ Reales</option>
                    <option value="UF">UF Fomento</option>
                  </select>
                </Field>
                <Field label="N° inicial pedido">
                  <input
                    type="number" min="1"
                    value={numInicial}
                    onChange={e => setNumInicial(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ ...inputStyle, textAlign: 'center' }}
                  />
                </Field>
              </div>
              <Field label="Métodos de pago" hint="Separados por comas. Ej: Efectivo, Transferencia, Tarjeta">
                <input
                  type="text" placeholder="Efectivo, Transferencia, Tarjeta"
                  value={metodosPago} onChange={e => setMetodosPago(e.target.value)}
                  style={inputStyle} autoComplete="off" autoCorrect="off"
                />
              </Field>
              <Field label="Términos / Notas al pie (PDF)" hint="Se imprime al final de tus presupuestos y remitos">
                <textarea
                  placeholder="Ej: Validez del presupuesto: 15 días. Cuenta para transferencia: ..."
                  value={notaPdf} onChange={e => setNotaPdf(e.target.value)}
                  style={{ ...inputStyle, minHeight: 80, padding: '10px 14px', lineHeight: 1.4, resize: 'vertical' }}
                  autoComplete="off" autoCorrect="off"
                />
              </Field>
            </div>
          </Collapsible>

          {/* Acordeón: WhatsApp */}
          <Collapsible
            title="Mensaje de Cobro (WhatsApp)"
            subtitle="Plantilla para recordar pagos pendientes"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            }
          >
            <Field label="Plantilla del mensaje" hint={`Variables: {cliente}, {saldo}, {fecha}. Dejar vacío para usar el mensaje por defecto.`}>
              <textarea
                placeholder="Hola {cliente}, tenés un pago pendiente de {saldo} del pedido del {fecha}."
                value={recordatorioPlantilla} onChange={e => setRecordatorioPlantilla(e.target.value)}
                style={{ ...inputStyle, minHeight: 90, padding: '10px 14px', lineHeight: 1.45, resize: 'vertical' }}
                autoComplete="off" autoCorrect="off"
              />
            </Field>
          </Collapsible>

          {/* GUARDAR — solo aparece si hay cambios sin guardar */}
          {(() => {
            const negocioDirty =
              negocioNombre !== (negocioConfig?.nombre || '') ||
              moneda !== (negocioConfig?.moneda || '$') ||
              telefono !== (negocioConfig?.telefono || '') ||
              direccion !== (negocioConfig?.direccion || '') ||
              negocioEmail !== (negocioConfig?.email || '') ||
              cuit !== (negocioConfig?.cuit || '') ||
              notaPdf !== (negocioConfig?.nota_pdf || '') ||
              numInicial !== (negocioConfig?.num_inicial || 1) ||
              metodosPago !== (negocioConfig?.metodos_pago || 'Efectivo, Transferencia, Tarjeta') ||
              recordatorioPlantilla !== (negocioConfig?.recordatorio_plantilla || '');
            if (!negocioDirty && !savingNegocio) return null;
            return (
              <motion.button
                key="guardar-config"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="btn btn-primary btn-full"
                onClick={handleSaveConfig}
                disabled={savingNegocio || !negocioNombre.trim()}
                style={{
                  minHeight: 52, fontSize: 16, fontWeight: 700,
                  borderRadius: 14,
                  boxShadow: savingNegocio ? 'none' : `0 4px 20px rgba(204,255,0,0.25)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {savingNegocio ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                      <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
                    </svg>
                    Guardando...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Guardar Cambios
                  </>
                )}
              </motion.button>
            );
          })()}

          {/* Acordeón: Alertas */}
          <Collapsible
            title="Alerta de Cobro Tardío"
            subtitle="Te avisamos cuando un cliente no paga hace mucho"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <input
                  type="number" min="1" max="365"
                  value={diasAlerta}
                  onChange={e => setDiasAlerta(parseInt(e.target.value) || 7)}
                  style={{ ...inputStyle, width: 80, textAlign: 'center', flex: 'none' }}
                />
                <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>días sin cobrar</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                className="btn btn-secondary"
                onClick={handleSaveAlerta}
                disabled={savingAlerta}
                style={{ minHeight: 48, padding: '0 18px', fontSize: 14, whiteSpace: 'nowrap', borderRadius: 10 }}
              >
                {savingAlerta ? 'Guardando...' : 'Guardar'}
              </motion.button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '10px 0 0', lineHeight: 1.4 }}>
              Si un cliente tiene deuda de hace más de este tiempo, verás un aviso de mora en la lista de clientes.
            </p>
          </Collapsible>
        </div>
      )}

      {/* ── EQUIPO (owner/admin) ── */}
      {(isOwner || userRole === 'admin') && (
        <div style={{ padding: '24px 16px 0' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: 2, marginBottom: 12 }}>
            Tu Equipo
          </div>

          <Collapsible
            defaultOpen
            title="Equipo y roles"
            subtitle="Invitá personas y asigná permisos"
            badge={
              <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', background: 'var(--bg-3)', border: '1px solid var(--border)', padding: '3px 9px', borderRadius: 7 }}>
                {planInfo.usados}{planInfo.limite == null ? '' : `/${planInfo.limite}`}
              </span>
            }
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Invitar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Contador de asientos del plan */}
              {(() => {
                const ilimitado = planInfo.limite == null;
                const atLimit = !ilimitado && planInfo.usados >= planInfo.limite;
                return (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    borderRadius: 10, padding: '10px 12px',
                    background: atLimit ? 'rgba(248,113,113,0.08)' : 'var(--bg-3)',
                    border: `1px solid ${atLimit ? 'rgba(248,113,113,0.3)' : 'var(--border)'}`,
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                      <strong style={{ color: atLimit ? '#f87171' : 'var(--ink)' }}>{planInfo.usados}</strong>
                      {ilimitado ? ' usuarios · plan ilimitado' : ` de ${planInfo.limite} usuarios`}
                      {planInfo.plan && <span style={{ color: 'var(--ink-3)' }}> · {planInfo.plan}</span>}
                      <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>Los visualizadores no cuentan</div>
                    </div>
                    {atLimit && (
                      <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#f87171', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', padding: '3px 8px', borderRadius: 6 }}>
                        Límite alcanzado
                      </span>
                    )}
                  </div>
                );
              })()}

              <input
                type="email" placeholder="email@persona.com"
                value={newEmail} onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                style={inputStyle}
              />

              {/* Rol picker */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>¿Qué puede hacer esta persona?</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ROLES.map(r => (
                    <motion.button
                      key={r.id}
                      type="button"
                      onClick={() => setNewRol(r.id)}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: `1.5px solid ${newRol === r.id ? r.color : 'var(--border)'}`,
                        background: newRol === r.id ? r.bg : 'var(--bg-3)',
                        cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 12,
                        transition: 'all 150ms',
                      }}
                    >
                      <span style={{ color: newRol === r.id ? r.color : 'var(--ink-3)' }}>{r.icon}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: newRol === r.id ? r.color : 'var(--ink)', lineHeight: 1.2 }}>{r.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{r.desc}</div>
                      </div>
                      {newRol === r.id && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={r.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              {(() => {
                const ilimitado = planInfo.limite == null;
                const bloqueado = !ilimitado && planInfo.usados >= planInfo.limite && newRol !== 'visualizador';
                return (
                  <>
                    {bloqueado && (
                      <div style={{ fontSize: 12, color: '#f87171', lineHeight: 1.4 }}>
                        Llegaste al límite de usuarios de tu plan. Podés agregar un <strong>visualizador</strong> (no cuenta) o cambiar a un plan más grande.
                      </div>
                    )}
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      className="btn btn-primary btn-full"
                      onClick={handleAdd}
                      disabled={adding || !newEmail.trim() || bloqueado}
                      style={{ minHeight: 48, fontSize: 15, fontWeight: 700, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: bloqueado ? 0.5 : 1 }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      {adding ? 'Agregando...' : 'Agregar al equipo'}
                    </motion.button>
                  </>
                );
              })()}
            </div>

            {/* Lista / Árbol de miembros */}
            {allowedEmails.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Miembros actuales · {allowedEmails.length}
                  </div>
                  <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--bg-3)', borderRadius: 999, border: '1px solid var(--border)' }}>
                    {[
                      { id: 'tree', label: 'Árbol' },
                      { id: 'list', label: 'Lista' },
                    ].map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setTeamView(v.id)}
                        style={{
                          padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          border: 'none',
                          background: teamView === v.id ? BRAND_DIM : 'transparent',
                          color: teamView === v.id ? BRAND : 'var(--ink-3)',
                        }}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
                {teamView === 'tree' && (() => {
                  const owner = allowedEmails.find(m => m.is_owner);
                  const groups = [
                    { rolId: 'admin',        label: 'Administradores',  members: allowedEmails.filter(m => !m.is_owner && m.rol === 'admin') },
                    { rolId: 'vendedor',     label: 'Vendedores',       members: allowedEmails.filter(m => !m.is_owner && (m.rol === 'vendedor' || !m.rol)) },
                    { rolId: 'visualizador', label: 'Solo lectura',     members: allowedEmails.filter(m => !m.is_owner && m.rol === 'visualizador') },
                  ].filter(g => g.members.length > 0);
                  const LINE = 'var(--border)';
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', padding: '4px 0 8px' }}>
                      {/* Nodo raíz: dueño */}
                      {owner && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px', borderRadius: 14,
                            background: BRAND_DIM, border: `1.5px solid var(--lime-border)`,
                            boxShadow: `0 0 0 4px rgba(204,255,0,0.06)`,
                          }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: 'var(--bg)', border: `1.5px solid ${BRAND}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 800, color: BRAND,
                            }}>{owner.email[0].toUpperCase()}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                              <span style={{ fontSize: 10, color: BRAND, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Dueño</span>
                              <span style={{ fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{owner.email}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {groups.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '8px 0' }}>
                          Aún no agregaste miembros al equipo.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'relative', paddingTop: 4 }}>
                          {/* Línea vertical central que une raíz con grupos */}
                          {owner && <div style={{ position: 'absolute', top: -14, left: '50%', width: 1.5, height: 18, background: LINE }} />}
                          {groups.map((g) => {
                            const r = getRoleData(g.rolId);
                            return (
                              <div key={g.rolId} style={{ position: 'relative', paddingTop: 10 }}>
                                {/* Línea que entra al header del grupo desde arriba */}
                                <div style={{ position: 'absolute', top: 0, left: 18, width: 1.5, height: 10, background: LINE }} />
                                {/* Header del grupo */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 10, background: 'var(--bg-3)', border: `1px solid var(--border)`, marginLeft: 0 }}>
                                  <div style={{
                                    width: 24, height: 24, borderRadius: 6,
                                    background: r.bg, border: `1px solid var(--lime-border)`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: r.color,
                                  }}>{r.icon}</div>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{g.label}</span>
                                  <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>· {g.members.length}</span>
                                </div>
                                {/* Hijos del grupo: línea vertical a la izquierda + ramas horizontales */}
                                <div style={{ marginLeft: 18, paddingLeft: 16, marginTop: 8, position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ position: 'absolute', top: 0, left: 0, bottom: 16, width: 1.5, background: LINE }} />
                                  {g.members.map((m, idx) => (
                                    <div key={m.id} style={{ position: 'relative', paddingLeft: 14 }}>
                                      <div style={{ position: 'absolute', top: 18, left: 0, width: 14, height: 1.5, background: LINE }} />
                                      {idx === g.members.length - 1 && (
                                        <div style={{ position: 'absolute', top: 18, left: -1.5, bottom: -8, width: 3, background: 'var(--bg-2)' }} />
                                      )}
                                      <div style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '8px 12px', borderRadius: 10,
                                        background: 'var(--bg-3)', border: '1px solid var(--border)',
                                      }}>
                                        <div style={{
                                          width: 28, height: 28, borderRadius: '50%',
                                          background: r.bg, border: `1.5px solid var(--lime-border)`,
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          fontSize: 12, fontWeight: 800, color: r.color, flexShrink: 0,
                                        }}>{m.email[0].toUpperCase()}</div>
                                        <span style={{ fontSize: 12, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</span>
                                        {(isOwner || userRole === 'admin') && (
                                          <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                              onClick={() => setEditingRolId(m.id)}
                                              disabled={loadingMap[m.id]}
                                              style={{ fontSize: 11, color: BRAND, background: 'none', border: 'none', cursor: loadingMap[m.id] ? 'not-allowed' : 'pointer', padding: 0, fontWeight: 700, opacity: loadingMap[m.id] ? 0.5 : 1 }}
                                            >Rol</button>
                                            <button
                                              onClick={() => handleRemove(m.id)}
                                              disabled={loadingMap[m.id]}
                                              style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: loadingMap[m.id] ? 'not-allowed' : 'pointer', padding: 0, fontWeight: 700, opacity: loadingMap[m.id] ? 0.5 : 1 }}
                                            >Quitar</button>
                                          </div>
                                        )}
                                      </div>
                                      {editingRolId === m.id && (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, marginLeft: 14 }}>
                                          {ROLES.map(rr => (
                                            <button
                                              key={rr.id}
                                              type="button"
                                              onClick={() => handleChangeRol(m.id, rr.id)}
                                              disabled={loadingMap[m.id]}
                                              style={{
                                                padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: loadingMap[m.id] ? 'not-allowed' : 'pointer',
                                                border: `1px solid ${(m.rol || 'vendedor') === rr.id ? rr.color : 'var(--border)'}`,
                                                background: (m.rol || 'vendedor') === rr.id ? rr.bg : 'none',
                                                color: (m.rol || 'vendedor') === rr.id ? rr.color : 'var(--ink-3)',
                                              }}
                                            >{rr.label}</button>
                                          ))}
                                          <button
                                            onClick={() => setEditingRolId(null)}
                                            style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, background: 'none', border: '1px solid var(--border)', color: 'var(--ink-3)', cursor: 'pointer' }}
                                          >Cancelar</button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {teamView === 'list' && allowedEmails.map(m => {
                  const mr = m.is_owner ? { label: 'Dueño', color: BRAND, bg: BRAND_DIM } : getRoleData(m.rol || 'vendedor');
                  return (
                    <motion.div
                      key={m.id}
                      layout
                      style={{
                        borderRadius: 12, padding: '12px 14px',
                        background: 'var(--bg-3)',
                        border: '1px solid var(--border)',
                        display: 'flex', flexDirection: 'column', gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: mr.bg, border: `1.5px solid var(--lime-border)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, fontWeight: 800, color: mr.color, flexShrink: 0,
                        }}>
                          {m.email[0].toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>
                          {m.email}
                        </span>
                        {isSuperEmail(m.email)
                          ? <SoftwareOwnerBadge />
                          : <RolBadge rol={m.is_owner ? 'admin' : (m.rol || 'vendedor')} />}
                      </div>

                      {!m.is_owner && (isOwner || userRole === 'admin') && (
                        editingRolId === m.id ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {ROLES.map(r => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => handleChangeRol(m.id, r.id)}
                                disabled={loadingMap[m.id]}
                                style={{
                                  padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: loadingMap[m.id] ? 'not-allowed' : 'pointer',
                                  border: `1px solid ${(m.rol || 'vendedor') === r.id ? r.color : 'var(--border)'}`,
                                  background: (m.rol || 'vendedor') === r.id ? r.bg : 'none',
                                  color: (m.rol || 'vendedor') === r.id ? r.color : 'var(--ink-3)',
                                  transition: 'all 120ms',
                                  opacity: loadingMap[m.id] ? 0.5 : 1,
                                }}
                              >
                                {r.label}
                              </button>
                            ))}
                            <button
                              onClick={() => setEditingRolId(null)}
                              disabled={loadingMap[m.id]}
                              style={{ padding: '5px 10px', borderRadius: 999, fontSize: 12, background: 'none', border: '1px solid var(--border)', color: 'var(--ink-3)', cursor: loadingMap[m.id] ? 'not-allowed' : 'pointer', opacity: loadingMap[m.id] ? 0.5 : 1 }}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 12 }}>
                            <button
                              onClick={() => setEditingRolId(m.id)}
                              disabled={loadingMap[m.id]}
                              style={{ fontSize: 12, color: BRAND, background: 'none', border: 'none', cursor: loadingMap[m.id] ? 'not-allowed' : 'pointer', padding: 0, fontWeight: 600, opacity: loadingMap[m.id] ? 0.5 : 1 }}
                            >
                              Cambiar rol
                            </button>
                            <button
                              onClick={() => handleRemove(m.id)}
                              disabled={loadingMap[m.id]}
                              style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: 'none', cursor: loadingMap[m.id] ? 'not-allowed' : 'pointer', padding: 0, fontWeight: 600, opacity: loadingMap[m.id] ? 0.5 : 1 }}
                            >
                              Quitar acceso
                            </button>
                          </div>
                        )
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
            </div>
          </Collapsible>
        </div>
      )}

      {/* ── SUSCRIPCIONES (solo owner) ── */}
      {isSuperAdmin && (
        <div style={{ padding: '24px 16px 0' }}>
          <button
            onClick={() => setShowAdminPanel(v => !v)}
            style={{
              width: '100%', padding: '14px 16px',
              borderRadius: 14, background: 'var(--bg-2)',
              border: `1px solid ${showAdminPanel ? 'var(--lime-border)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'border-color 200ms',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: BRAND_DIM, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BRAND }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                </svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Panel de Suscripciones</div>
                {!showAdminPanel && suscripciones.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>
                    {suscripciones.filter(s => s.estado === 'activa').length} activas · {suscripciones.length} total
                  </div>
                )}
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: showAdminPanel ? 'rotate(180deg)' : 'none', transition: 'transform 200ms', flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          <AnimatePresence>
            {showAdminPanel && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                style={{ overflow: 'hidden' }}
              >
                {/* Dar acceso a un dueño nuevo */}
                <div style={{ marginTop: 8, borderRadius: 14, background: 'var(--bg-2)', border: `1px solid var(--lime-border)`, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: BRAND_DIM, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BRAND, flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-3-3.87"/><path d="M4 21v-2a4 4 0 0 1 3-3.87"/><circle cx="12" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Dar acceso a un dueño nuevo</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>Autorizá un email como dueño de su propio negocio</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="email"
                      placeholder="nuevo-dueño@email.com"
                      value={newOwnerEmail}
                      onChange={e => setNewOwnerEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleGrantOwner()}
                      style={{ ...inputStyle, flex: 1 }}
                      autoComplete="off"
                      autoCorrect="off"
                      disabled={grantingOwner}
                    />
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      className="btn btn-primary"
                      onClick={handleGrantOwner}
                      disabled={grantingOwner || !newOwnerEmail.trim()}
                      style={{ minHeight: 48, padding: '0 18px', fontSize: 14, fontWeight: 700, borderRadius: 10, whiteSpace: 'nowrap' }}
                    >
                      {grantingOwner ? '...' : 'Dar acceso'}
                    </motion.button>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '10px 0 0', lineHeight: 1.4 }}>
                    Cuando inicie sesión con ese email, se le crea su negocio con 14 días de prueba. Aparecerá abajo en la whitelist.
                  </p>
                </div>

                <div style={{ marginTop: 8, borderRadius: 14, background: 'var(--bg-2)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  {loadingSus ? (
                    <p style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', padding: 24 }}>Cargando...</p>
                  ) : suscripciones.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--ink-3)', padding: 20 }}>Sin clientes registrados aún.</p>
                  ) : (() => {
                    const PRECIO_PLAN = 4990;
                    const activas = suscripciones.filter(s => s.estado === 'activa').length;
                    const pruebas = suscripciones.filter(s => s.estado === 'prueba').length;
                    const bajas  = suscripciones.filter(s => s.estado === 'bloqueada').length;
                    const mrr = activas * PRECIO_PLAN;

                    const estadoConfig = {
                      activa:    { label: 'Activo',     color: '#4ade80', bg: 'rgba(74,222,128,0.1)'  },
                      prueba:    { label: 'En prueba',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
                      vencida:   { label: 'Vencido',    color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
                      bloqueada: { label: 'Dado de baja', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
                    };

                    return (
                      <>
                        {/* KPIs */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--border)' }}>
                          {[
                            { label: 'MRR estimado', value: formatCurrency(mrr), color: BRAND },
                            { label: 'Activos',       value: activas,             color: '#4ade80' },
                            { label: 'En prueba',     value: pruebas,             color: '#f59e0b' },
                          ].map((k, i) => (
                            <div key={k.label} style={{
                              padding: '14px 12px', textAlign: 'center',
                              borderRight: i < 2 ? '1px solid var(--border)' : 'none',
                            }}>
                              <div style={{ fontSize: 9, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
                              <div style={{ fontWeight: 800, fontSize: 17, color: k.color }}>{k.value}</div>
                            </div>
                          ))}
                        </div>

                        {/* Lista */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {suscripciones.filter(s => s.user_email !== email).map((s, i, arr) => {
                            const dias = Math.round((new Date(s.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24));
                            const est = estadoConfig[s.estado] || estadoConfig.vencida;
                            const isBaja = s.estado === 'bloqueada';

                            return (
                              <div key={s.id} style={{
                                padding: '14px 16px',
                                borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                                opacity: isBaja ? 0.55 : 1,
                                transition: 'opacity 200ms',
                              }}>
                                {/* Avatar */}
                                <div style={{
                                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                                  background: est.bg, border: `1.5px solid ${est.color}44`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 14, fontWeight: 800, color: est.color,
                                }}>
                                  {(s.user_email || '?')[0].toUpperCase()}
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {s.user_email || s.user_id?.slice(0, 12) + '...'}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: est.color }}>{est.label}</span>
                                    <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>·</span>
                                    <span style={{ fontSize: 10, color: dias < 0 ? '#f87171' : 'var(--ink-3)' }}>
                                      {dias < 0 ? `Venció hace ${Math.abs(dias)}d` : `${dias}d restantes`}
                                    </span>
                                  </div>
                                </div>

                                {/* Acciones */}
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                  {!isBaja && (
                                    <button
                                      onClick={() => handleRenovar(s.id)}
                                      disabled={loadingMap[s.id + '-renovar'] || loadingMap[s.id + '-activa'] || loadingMap[s.id + '-bloqueada']}
                                      style={{
                                        height: 32, padding: '0 10px', borderRadius: 8,
                                        background: BRAND_DIM, border: `1px solid var(--lime-border)`,
                                        color: BRAND, fontSize: 11, fontWeight: 700, cursor: (loadingMap[s.id + '-renovar'] || loadingMap[s.id + '-activa'] || loadingMap[s.id + '-bloqueada']) ? 'not-allowed' : 'pointer',
                                        whiteSpace: 'nowrap',
                                        opacity: (loadingMap[s.id + '-renovar'] || loadingMap[s.id + '-activa'] || loadingMap[s.id + '-bloqueada']) ? 0.5 : 1,
                                      }}
                                    >
                                      {loadingMap[s.id + '-renovar'] ? '...' : '+30d'}
                                    </button>
                                  )}
                                  {isBaja ? (
                                    <button
                                      onClick={() => handleUpdateSuscripcion(s.id, 'activa')}
                                      disabled={loadingMap[s.id + '-renovar'] || loadingMap[s.id + '-activa'] || loadingMap[s.id + '-bloqueada']}
                                      style={{
                                        height: 32, padding: '0 10px', borderRadius: 8,
                                        background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.35)',
                                        color: '#4ade80', fontSize: 11, fontWeight: 700, cursor: (loadingMap[s.id + '-renovar'] || loadingMap[s.id + '-activa'] || loadingMap[s.id + '-bloqueada']) ? 'not-allowed' : 'pointer',
                                        whiteSpace: 'nowrap',
                                        opacity: (loadingMap[s.id + '-renovar'] || loadingMap[s.id + '-activa'] || loadingMap[s.id + '-bloqueada']) ? 0.5 : 1,
                                      }}
                                    >
                                      {loadingMap[s.id + '-activa'] ? '...' : 'Reactivar'}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleUpdateSuscripcion(s.id, 'bloqueada')}
                                      disabled={loadingMap[s.id + '-renovar'] || loadingMap[s.id + '-activa'] || loadingMap[s.id + '-bloqueada']}
                                      style={{
                                        height: 32, padding: '0 10px', borderRadius: 8,
                                        background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
                                        color: '#f87171', fontSize: 11, fontWeight: 700, cursor: (loadingMap[s.id + '-renovar'] || loadingMap[s.id + '-activa'] || loadingMap[s.id + '-bloqueada']) ? 'not-allowed' : 'pointer',
                                        whiteSpace: 'nowrap',
                                        opacity: (loadingMap[s.id + '-renovar'] || loadingMap[s.id + '-activa'] || loadingMap[s.id + '-bloqueada']) ? 0.5 : 1,
                                      }}
                                    >
                                      {loadingMap[s.id + '-bloqueada'] ? '...' : 'Dar de baja'}
                                    </button>
                                  )}
                                </div>

                                {/* Plan asignado + asientos usados */}
                                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 50 }}>
                                  <span style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plan</span>
                                  <select
                                    value={s.plan_id || ''}
                                    onChange={e => handleSetPlan(s.id, e.target.value || null)}
                                    disabled={loadingMap[s.id + '-plan']}
                                    style={{
                                      flex: 1, minWidth: 0, height: 32, borderRadius: 8, padding: '0 8px',
                                      background: 'var(--bg-3)', border: '1px solid var(--border)',
                                      color: 'var(--ink)', fontSize: 12, fontWeight: 600,
                                      cursor: loadingMap[s.id + '-plan'] ? 'wait' : 'pointer',
                                    }}
                                  >
                                    <option value="">Sin plan (prueba)</option>
                                    {planes.map(p => (
                                      <option key={p.id} value={p.id}>
                                        {p.nombre}{p.max_asientos == null ? ' · ilimitado' : ` · ${p.max_asientos} usuario${p.max_asientos === 1 ? '' : 's'}`}
                                      </option>
                                    ))}
                                  </select>
                                  <span style={{ fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                                    {s.asientos_usados} en uso
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Whitelist global de accesos */}
                <div style={{ marginTop: 8, borderRadius: 14, background: 'var(--bg-2)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: BRAND_DIM, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BRAND, flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Whitelist de acceso</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>
                        {whitelist.length} email{whitelist.length !== 1 ? 's' : ''} con acceso a la app
                      </div>
                    </div>
                  </div>

                  {loadingSus ? (
                    <p style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', padding: 20 }}>Cargando...</p>
                  ) : whitelist.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--ink-3)', padding: 20 }}>Sin emails autorizados.</p>
                  ) : (() => {
                    // La fila del dueño tiene owner_user_id null: se agrupa por su propio email
                    const grupos = whitelist.reduce((acc, w) => {
                      const key = w.owner_email || (w.is_owner ? w.email : 'sin-dueño');
                      if (!acc[key]) acc[key] = { negocio: w.negocio_nombre, members: [] };
                      if (!acc[key].negocio && w.negocio_nombre) acc[key].negocio = w.negocio_nombre;
                      acc[key].members.push(w);
                      return acc;
                    }, {});
                    Object.values(grupos).forEach(g => g.members.sort((a, b) => (b.is_owner ? 1 : 0) - (a.is_owner ? 1 : 0)));

                    return Object.entries(grupos).map(([ownerEmail, grupo], gi, arr) => (
                      <div key={ownerEmail} style={{ borderBottom: gi < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ padding: '10px 16px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {grupo.negocio || 'Negocio sin nombre'}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            · {ownerEmail}
                          </span>
                        </div>
                        {grupo.members.map(w => (
                          <div key={w.id} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                              background: w.is_owner ? BRAND_DIM : 'var(--bg-3)',
                              border: `1px solid ${w.is_owner ? 'var(--lime-border)' : 'var(--border)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 800, color: w.is_owner ? BRAND : 'var(--ink-2)',
                            }}>
                              {(w.email || '?')[0].toUpperCase()}
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {w.email}
                              {email && w.email?.toLowerCase() === email.toLowerCase() && (
                                <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: BRAND, background: BRAND_DIM, padding: '1px 6px', borderRadius: 999 }}>vos</span>
                              )}
                            </span>
                            {isSuperEmail(w.email)
                              ? <SoftwareOwnerBadge />
                              : <RolBadge rol={w.is_owner ? 'admin' : (w.rol || 'vendedor')} />}
                            {!w.is_owner && (!email || w.email?.toLowerCase() !== email.toLowerCase()) && (
                              <button
                                onClick={() => handleRevokeAccess(w.email)}
                                disabled={loadingMap['revoke-' + w.email]}
                                aria-label={`Quitar acceso a ${w.email}`}
                                title="Quitar acceso"
                                style={{
                                  flexShrink: 0, width: 30, height: 30, borderRadius: 8,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
                                  color: '#f87171', cursor: loadingMap['revoke-' + w.email] ? 'not-allowed' : 'pointer',
                                  opacity: loadingMap['revoke-' + w.email] ? 0.5 : 1,
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── SEGURIDAD ── */}
      <div ref={securitySectionRef} style={{ padding: '24px 16px 0' }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: 2, marginBottom: 12 }}>
          Seguridad y Preferencias
        </div>

        <Collapsible
          title={hasPassword ? (isOtpLogin ? 'Restablecer contraseña' : 'Contraseña de acceso') : 'Crear contraseña'}
          subtitle={hasPassword
            ? (isOtpLogin ? 'Ingresá una nueva contraseña directamente' : 'Cambiala ingresando primero la actual')
            : 'Hoy ingresás solo por magic link. Creá una contraseña para entrar más rápido.'}
          defaultOpen={autoExpandPassword}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {hasPassword && !isOtpLogin && (
              <Field label="Contraseña actual" hint="Por seguridad, confirmá que sos vos antes de cambiarla">
                <input
                  type="password" placeholder="Tu contraseña actual" autoComplete="current-password"
                  value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            )}
            <Field label="Nueva contraseña">
              <input
                type="password" placeholder="Mín. 6 caracteres" autoComplete="new-password"
                value={newPassword} onChange={e => setNewPassword(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Repetir nueva contraseña">
              <input
                type="password" placeholder="Repetí la nueva contraseña" autoComplete="new-password"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUpdatePassword()}
                style={{
                  ...inputStyle,
                  borderColor: confirmPassword && confirmPassword !== newPassword ? 'var(--danger)' : 'var(--border)',
                }}
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <span style={{ fontSize: 11, color: 'var(--danger)' }}>Las contraseñas no coinciden</span>
              )}
            </Field>
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="btn btn-secondary btn-full"
              onClick={handleUpdatePassword}
              disabled={updatingPassword || (hasPassword && !currentPassword.trim()) || !newPassword.trim() || !confirmPassword.trim()}
              style={{ minHeight: 48, fontSize: 14, borderRadius: 10 }}
            >
              {updatingPassword ? (hasPassword ? 'Cambiando...' : 'Creando...') : (hasPassword ? 'Cambiar contraseña' : 'Crear contraseña')}
            </motion.button>
          </div>
        </Collapsible>
      </div>

      {/* ── TEMA ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ borderRadius: 14, background: 'var(--bg-2)', border: '1px solid var(--border)', padding: 20 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: BRAND_DIM, border: `1px solid var(--lime-border)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BRAND }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Tema de la App</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Modo oscuro o claro</div>
              </div>
            </div>

            <div style={{ display: 'flex', background: 'var(--bg-3)', padding: 3, borderRadius: 10, border: '1px solid var(--border)', gap: 2 }}>
              {[
                { id: 'dark', label: 'Oscuro' },
                { id: 'light', label: 'Claro' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onThemeChange(t.id)}
                  style={{
                    background: theme === t.id ? 'var(--bg-2)' : 'none',
                    border: theme === t.id ? `1px solid var(--lime-border)` : '1px solid transparent',
                    color: theme === t.id ? 'var(--ink)' : 'var(--ink-3)',
                    padding: '7px 14px', borderRadius: 8,
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    transition: 'all 150ms',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── LOGOUT ── */}
      <div style={{ padding: '20px 16px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <motion.button
          whileHover={loggingOut ? undefined : { scale: 1.01 }}
          whileTap={loggingOut ? undefined : { scale: 0.97 }}
          className="btn btn-secondary btn-full"
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            minHeight: 52, fontSize: 15, fontWeight: 700,
            color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.35)',
            borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            opacity: loggingOut ? 0.5 : 1,
            cursor: loggingOut ? 'not-allowed' : 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {loggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
        </motion.button>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-3)' }}>
          Solvnt Gestión · v1.0
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input:focus, textarea:focus, select:focus {
          border-color: rgba(204,255,0,0.5) !important;
          box-shadow: 0 0 0 3px rgba(204,255,0,0.08);
        }
      `}</style>
    </div>
  );
}
