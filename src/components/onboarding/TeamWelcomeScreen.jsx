import { motion } from 'framer-motion';

const ROL_LABEL = { admin: 'Administrador', vendedor: 'Vendedor', visualizador: 'Solo lectura' };

const ROL_ACCESOS = {
  admin: [
    { ok: true,  text: 'Ver y gestionar clientes, pedidos y gastos' },
    { ok: true,  text: 'Crear y editar pedidos' },
    { ok: true,  text: 'Cobrar y enviar recordatorios por WhatsApp' },
    { ok: true,  text: 'Ver estadísticas y caja' },
    { ok: false, text: 'Eliminar datos (solo el dueño)' },
  ],
  vendedor: [
    { ok: true,  text: 'Ver clientes y pedidos' },
    { ok: true,  text: 'Crear y editar pedidos' },
    { ok: true,  text: 'Cobrar y enviar recordatorios por WhatsApp' },
    { ok: true,  text: 'Ver catálogo y estadísticas' },
    { ok: false, text: 'Eliminar datos o gestionar productos/gastos' },
  ],
  visualizador: [
    { ok: true,  text: 'Ver clientes, pedidos y catálogo' },
    { ok: true,  text: 'Ver estadísticas' },
    { ok: false, text: 'Crear, editar o eliminar datos' },
    { ok: false, text: 'Cobrar o enviar mensajes' },
  ],
};

export function TeamWelcomeScreen({ userRole, negocioConfig, onDismiss }) {
  const label = ROL_LABEL[userRole] || userRole;
  const accesos = ROL_ACCESOS[userRole] || ROL_ACCESOS.visualizador;
  const empresa = negocioConfig?.nombre || 'la empresa';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-6)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--accent-2)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 800,
            margin: '0 auto var(--space-4)',
          }}>
            {empresa.charAt(0).toUpperCase()}
          </div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, marginBottom: 'var(--space-1)' }}>
            Bienvenido a {empresa}
          </h2>
          <span style={{
            display: 'inline-block',
            background: 'var(--accent-2)', color: 'var(--accent)',
            borderRadius: 999, fontSize: 'var(--text-xs)', fontWeight: 700,
            padding: '3px 10px',
          }}>
            {label}
          </span>
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Tu acceso
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {accesos.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: a.ok ? 'var(--success)' : 'var(--danger)', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                  {a.ok ? '✓' : '✗'}
                </span>
                <span style={{ color: a.ok ? 'var(--ink-1)' : 'var(--ink-3)' }}>{a.text}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          className="btn btn-primary btn-full"
          style={{ minHeight: 52, fontSize: 'var(--text-base)', fontWeight: 700 }}
          onClick={onDismiss}
        >
          Entrar a la app →
        </button>
      </div>
    </motion.div>
  );
}
