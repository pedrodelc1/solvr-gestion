import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase.js';
import { formatCurrency, formatDate, saldoCliente, inRange } from '../../lib/utils.js';
import {
  getAllowedEmails, addAllowedEmail, removeAllowedEmail,
  getAlertasConfig, saveAlertasConfig,
  getSuscripciones, updateSuscripcion,
} from '../../lib/db.js';

export function PerfilPanel({ session, isOwner, clientes, pedidos, gastos, suscripcion, toast }) {
  const email = session?.user?.email || null;
  const inicial = email ? email[0].toUpperCase() : '?';

  const totalClientes = clientes.length;
  const pendientes = pedidos.filter(p => !p.cobrado && p.tipo !== 'presupuesto').length;
  const totalDeuda = clientes.reduce((s, c) => s + Math.max(0, saldoCliente(c.id, pedidos)), 0);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);

  const [allowedEmails, setAllowedEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);

  // Alertas config
  const [diasAlerta, setDiasAlerta] = useState(7);
  const [savingAlerta, setSavingAlerta] = useState(false);

  // Panel admin suscripciones
  const [suscripciones, setSuscripciones] = useState([]);
  const [loadingSus, setLoadingSus] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  useEffect(() => {
    getAllowedEmails().then(setAllowedEmails);
    getAlertasConfig().then(cfg => setDiasAlerta(cfg.dias_sin_cobro));
  }, []);

  useEffect(() => {
    if (isOwner && showAdminPanel) {
      setLoadingSus(true);
      getSuscripciones().then(data => {
        setSuscripciones(data);
        setLoadingSus(false);
      });
    }
  }, [isOwner, showAdminPanel]);

  async function handleAdd() {
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      const arr = await addAllowedEmail(newEmail.trim());
      setAllowedEmails(arr);
      setNewEmail('');
      toast('Email autorizado');
    } catch (e) {
      toast(e.message.includes('unique') ? 'Ese email ya está en la lista' : e.message, 'error');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id) {
    try {
      const arr = await removeAllowedEmail(id);
      setAllowedEmails(arr);
      toast('Email eliminado');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleSaveAlerta() {
    setSavingAlerta(true);
    try {
      await saveAlertasConfig(diasAlerta);
      toast('Configuración guardada');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSavingAlerta(false);
    }
  }

  async function handleUpdateSuscripcion(id, estado) {
    try {
      const arr = await updateSuscripcion(id, { estado });
      setSuscripciones(arr);
      toast(`Suscripción ${estado}`);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    toast('Sesión cerrada');
    setTimeout(() => window.location.reload(), 500);
  }

  // Info del trial / suscripción actual
  const diasRestantes = suscripcion ? Math.round((new Date(suscripcion.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
      <div className="page-header">
        <h1>Perfil</h1>
      </div>

      {/* Avatar + info */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-8) var(--space-4) var(--space-6)', gap: 'var(--space-3)' }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #ccff00, #88dd00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, fontWeight: 800, color: '#080808',
            boxShadow: '0 0 24px #ccff0044',
          }}
        >
          {inicial}
        </motion.div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{email}</div>
          {isOwner && (
            <div style={{ fontSize: 'var(--text-xs)', color: '#ccff00', fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Dueño
            </div>
          )}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 'var(--text-sm)', color: '#ccff00' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ccff00', display: 'inline-block', boxShadow: '0 0 6px #ccff00' }} />
            Conectado
          </div>
        </div>
      </div>

      {/* Suscripción trial banner */}
      {suscripcion && diasRestantes !== null && diasRestantes <= 10 && diasRestantes >= 0 && (
        <div style={{ margin: '0 var(--space-4) var(--space-4)', background: 'var(--tarjeta-bg)', border: '1px solid var(--tarjeta)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--tarjeta)' }}>
          {diasRestantes === 0
            ? 'Tu prueba gratuita vence hoy.'
            : `Tu prueba gratuita vence en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}.`
          }
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', padding: '0 var(--space-4) var(--space-4)' }}>
        {[
          { label: 'Clientes', value: totalClientes },
          { label: 'Pedidos pendientes', value: pendientes },
          { label: 'Saldo por cobrar', value: formatCurrency(totalDeuda), accent: totalDeuda > 0 },
          { label: 'Total gastos', value: formatCurrency(totalGastos) },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            className="card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, type: 'spring', stiffness: 300, damping: 24 }}
            style={{ gap: 'var(--space-1)' }}
          >
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', fontWeight: 500 }}>{item.label}</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: item.accent ? 'var(--danger)' : 'var(--ink)' }}>
              {item.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Alertas de cobro */}
      <div style={{ padding: '0 var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <div className="section-label">Alertas de cobro</div>
        <div className="card" style={{ gap: 'var(--space-3)' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-2)' }}>
            Alertar en Clientes si un saldo lleva más de:
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <input
              type="number"
              min="1"
              max="365"
              value={diasAlerta}
              onChange={e => setDiasAlerta(parseInt(e.target.value) || 7)}
              style={{ width: 80, minHeight: 40, textAlign: 'center', fontSize: 'var(--text-base)' }}
            />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-2)' }}>días sin cobrar</span>
            <button
              className="btn btn-secondary"
              style={{ minHeight: 40, padding: '0 var(--space-4)', fontSize: 'var(--text-sm)', marginLeft: 'auto' }}
              onClick={handleSaveAlerta}
              disabled={savingAlerta}
            >
              {savingAlerta ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>

      {/* Accesos autorizados — solo owner */}
      {isOwner && (
        <div style={{ padding: '0 var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div className="section-label">Accesos autorizados</div>
          <div className="card" style={{ gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                type="email"
                placeholder="nuevo@email.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                style={{ flex: 1, minHeight: 40, fontSize: 'var(--text-sm)' }}
              />
              <button
                className="btn btn-primary"
                style={{ minHeight: 40, padding: '0 var(--space-4)', fontSize: 'var(--text-sm)' }}
                onClick={handleAdd}
                disabled={adding || !newEmail.trim()}
              >
                + Agregar
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {allowedEmails.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>Sin emails autorizados.</p>
              ) : (
                allowedEmails.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.email} {e.is_owner && <span style={{ color: '#ccff00', fontSize: 'var(--text-xs)' }}>owner</span>}
                    </span>
                    {!e.is_owner && (
                      <button
                        className="btn-icon danger"
                        onClick={() => handleRemove(e.id)}
                        aria-label="Quitar acceso"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Panel admin suscripciones — solo owner */}
      {isOwner && (
        <div style={{ padding: '0 var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div className="section-label">
            <button
              onClick={() => setShowAdminPanel(v => !v)}
              style={{ background: 'none', border: 'none', color: 'var(--ink-3)', font: 'inherit', cursor: 'pointer', padding: 0, fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
            >
              Suscripciones {showAdminPanel ? '▲' : '▼'}
            </button>
          </div>
          {showAdminPanel && (
            <div className="card" style={{ gap: 'var(--space-3)' }}>
              {loadingSus ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>Cargando...</p>
              ) : suscripciones.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>Sin suscripciones activas.</p>
              ) : (
                suscripciones.map(s => {
                  const dias = Math.round((new Date(s.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {s.user_email || s.user_id.slice(0, 8) + '...'}
                        </span>
                        <span className={`badge ${s.estado === 'activa' ? 'badge-ok' : s.estado === 'vencida' ? 'badge-warn' : 'badge-neutral'}`}>
                          {s.estado}
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>
                        Vence: {formatDate(s.fecha_vencimiento)} · {dias >= 0 ? `${dias} días restantes` : `Vencida hace ${Math.abs(dias)} días`}
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        {s.estado !== 'activa' && (
                          <button
                            className="btn btn-secondary"
                            style={{ flex: 1, minHeight: 36, fontSize: 'var(--text-xs)' }}
                            onClick={() => handleUpdateSuscripcion(s.id, 'activa')}
                          >
                            Activar
                          </button>
                        )}
                        {s.estado !== 'bloqueada' && (
                          <button
                            className="btn btn-danger"
                            style={{ flex: 1, minHeight: 36, fontSize: 'var(--text-xs)' }}
                            onClick={() => handleUpdateSuscripcion(s.id, 'bloqueada')}
                          >
                            Bloquear
                          </button>
                        )}
                        {s.estado !== 'vencida' && s.estado !== 'bloqueada' && (
                          <button
                            className="btn btn-secondary"
                            style={{ flex: 1, minHeight: 36, fontSize: 'var(--text-xs)' }}
                            onClick={() => handleUpdateSuscripcion(s.id, 'vencida')}
                          >
                            Vencer
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Logout */}
      <div style={{ padding: '0 var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingBottom: 'var(--space-6)' }}>
        <button
          className="btn btn-secondary btn-full"
          style={{ minHeight: 48, color: 'var(--danger)', borderColor: 'var(--danger)' }}
          onClick={handleLogout}
        >
          Cerrar sesión
        </button>
        <div style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>
          Solvr Gestión · v1.0
        </div>
      </div>
    </div>
  );
}
