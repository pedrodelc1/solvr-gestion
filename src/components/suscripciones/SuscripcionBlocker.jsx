import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { renovarSuscripcion } from '../../services/suscripcionesService.js';
import { supabase } from '../../lib/supabase.js';
import { clearLocalCache } from '../../lib/db.js';
import { formatCurrency } from '../../lib/utils.js';

const PLANES = [
  { id: 'basico', nombre: 'Básico', precio: 4990, features: ['Clientes ilimitados', 'Pedidos ilimitados', 'Estadísticas', 'Exportar CSV', 'Stock y catálogo'] },
];

export function SuscripcionBlocker({ suscripcion, onRenovada }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [planSeleccionado, setPlanSeleccionado] = useState('basico');

  const bloqueada = suscripcion?.estado === 'bloqueada';
  const hoy = new Date();
  const vencimiento = suscripcion ? new Date(suscripcion.fecha_vencimiento) : null;
  const diasDiff = vencimiento ? Math.round((vencimiento - hoy) / (1000 * 60 * 60 * 24)) : 0;

  const [loggingOut, setLoggingOut] = useState(false);
  const loggingOutRef = useRef(false);
  const loadingRef = useRef(false);

  async function handleLogout() {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    setLoggingOut(true);
    clearLocalCache();
    await supabase.auth.signOut();
    window.location.reload();
  }

  async function handleRenovar() {
    if (loadingRef.current) return;
    const mpFunctionUrl = import.meta.env.VITE_MP_FUNCTION_URL;

    if (!mpFunctionUrl) {
      loadingRef.current = true;
      setLoading(true);
      try {
        if (suscripcion?.id) {
          await renovarSuscripcion(suscripcion.id);
          onRenovada();
        }
      } catch (e) {
        setError(e.message);
        loadingRef.current = false;
      } finally {
        setLoading(false);
      }
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(mpFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ suscripcionId: suscripcion?.id, plan: planSeleccionado }),
      });
      const data = await res.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        setError('No se pudo iniciar el pago. Intentá de nuevo.');
        loadingRef.current = false;
      }
    } catch (e) {
      setError('Error al conectar con el servicio de pagos.');
      loadingRef.current = false;
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-6)',
        zIndex: 500,
        overflowY: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 'var(--space-4)' }}>
          {bloqueada ? '🔒' : '⏰'}
        </div>

        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
          {bloqueada ? 'Cuenta suspendida' : 'Período de prueba finalizado'}
        </h1>
        <p style={{ color: 'var(--ink-2)', fontSize: 'var(--text-sm)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
          {bloqueada
            ? 'Tu cuenta fue suspendida. Contactate con el administrador.'
            : `Tu prueba venció hace ${Math.abs(diasDiff)} día${Math.abs(diasDiff) !== 1 ? 's' : ''}. Elegí un plan para continuar.`
          }
        </p>

        {!bloqueada && (
          <>
            {PLANES.map(plan => (
              <div
                key={plan.id}
                onClick={() => setPlanSeleccionado(plan.id)}
                style={{
                  border: `2px solid ${planSeleccionado === plan.id ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                  marginBottom: 'var(--space-4)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: planSeleccionado === plan.id ? 'rgba(204,255,0,0.06)' : 'var(--tarjeta-bg)',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>{plan.nombre}</span>
                  <span style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--primary)' }}>
                    {formatCurrency(plan.precio)}<span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', fontWeight: 500 }}>/mes</span>
                  </span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: 'var(--success)' }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <button
              className="btn btn-primary btn-full"
              onClick={handleRenovar}
              disabled={loading}
              style={{ minHeight: 52, fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-3)' }}
            >
              {loading ? 'Procesando...' : `Suscribirme — ${formatCurrency(PLANES.find(p => p.id === planSeleccionado)?.precio || 4990)}/mes`}
            </button>
            {error && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>{error}</p>}
          </>
        )}

        <button
          className="btn btn-secondary"
          onClick={handleLogout}
          disabled={loading || loggingOut}
          style={{ minHeight: 44, fontSize: 'var(--text-sm)', width: '100%', marginBottom: 'var(--space-4)', opacity: (loading || loggingOut) ? 0.5 : 1 }}
        >
          {loggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
        </button>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>¿Problemas? Contactá al administrador.</p>
      </div>
    </motion.div>
  );
}
