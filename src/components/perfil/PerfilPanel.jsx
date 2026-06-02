import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase.js';
import { formatCurrency, saldoCliente } from '../../lib/utils.js';
import { getAllowedEmails, addAllowedEmail, removeAllowedEmail } from '../../lib/db.js';

export function PerfilPanel({ session, isOwner, offline, clientes, pedidos, gastos, toast }) {
  const email = session?.user?.email || null;
  const inicial = email ? email[0].toUpperCase() : '?';

  const totalClientes = clientes.length;
  const pendientes = pedidos.filter(p => !p.cobrado).length;
  const totalDeuda = clientes.reduce((s, c) => s + Math.max(0, saldoCliente(c.id, pedidos)), 0);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);

  const [allowedEmails, setAllowedEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!offline) getAllowedEmails().then(setAllowedEmails);
  }, [offline]);

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

  async function handleLogout() {
    await supabase.auth.signOut();
    toast('Sesión cerrada');
    setTimeout(() => window.location.reload(), 500);
  }

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
        {offline ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>Modo sin conexión</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', marginTop: 4 }}>Datos guardados localmente</div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{email}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 'var(--text-sm)', color: '#ccff00' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ccff00', display: 'inline-block', boxShadow: '0 0 6px #ccff00' }} />
              Conectado
            </div>
          </div>
        )}
      </div>

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

      {/* Whitelist */}
      {!offline && isOwner && (
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
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>Sin emails autorizados aún.</p>
              ) : (
                allowedEmails.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.email}
                    </span>
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
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Logout */}
      <div style={{ padding: '0 var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingBottom: 'var(--space-6)' }}>
        {!offline && (
          <button
            className="btn btn-secondary btn-full"
            style={{ minHeight: 48, color: 'var(--danger)', borderColor: 'var(--danger)' }}
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        )}
        <div style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>
          Solvr Gestión · v1.0
        </div>
      </div>
    </div>
  );
}
