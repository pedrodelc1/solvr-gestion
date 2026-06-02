import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase.js';
import { formatCurrency, saldoCliente } from '../../lib/utils.js';

export function PerfilPanel({ session, offline, clientes, pedidos, gastos, toast }) {
  const email = session?.user?.email || null;
  const inicial = email ? email[0].toUpperCase() : '?';

  const totalClientes = clientes.length;
  const pendientes = pedidos.filter(p => !p.cobrado).length;
  const totalDeuda = clientes.reduce((s, c) => s + Math.max(0, saldoCliente(c.id, pedidos)), 0);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);

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
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ccff00, #88dd00)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            fontWeight: 800,
            color: '#080808',
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
              Conectado con Supabase
            </div>
          </div>
        )}
      </div>

      {/* Stats resumen */}
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

      {/* Acciones */}
      <div style={{ padding: '0 var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'auto', paddingBottom: 'var(--space-6)' }}>
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
