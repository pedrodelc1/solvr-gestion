import { useState } from 'react';
import { motion } from 'framer-motion';
import { renovarSuscripcion } from '../../lib/db.js';
import { supabase } from '../../lib/supabase.js';

// Pantalla que se muestra cuando la suscripción está vencida o bloqueada
export function SuscripcionBlocker({ suscripcion, onRenovada }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const vencida = suscripcion?.estado === 'vencida';
  const bloqueada = suscripcion?.estado === 'bloqueada';

  // Calcula días restantes del trial o días vencida
  const hoy = new Date();
  const vencimiento = suscripcion ? new Date(suscripcion.fecha_vencimiento) : null;
  const diasDiff = vencimiento ? Math.round((vencimiento - hoy) / (1000 * 60 * 60 * 24)) : 0;

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  async function handleRenovar() {
    // Integración con MercadoPago Checkout Pro
    // CONFIGURAR: Reemplazá esta URL con la de tu Supabase Edge Function
    // que crea la preferencia de pago en MercadoPago.
    // Ejemplo: https://<proyecto>.supabase.co/functions/v1/mp-preference
    const mpFunctionUrl = import.meta.env.VITE_MP_FUNCTION_URL;

    if (!mpFunctionUrl) {
      // Sin integración MP configurada: renovación manual
      setLoading(true);
      try {
        if (suscripcion?.id) {
          await renovarSuscripcion(suscripcion.id);
          onRenovada();
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Con MP configurado: redirigir al checkout
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(mpFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ suscripcionId: suscripcion?.id }),
      });
      const data = await res.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        setError('No se pudo iniciar el pago. Intentá de nuevo.');
      }
    } catch (e) {
      setError('Error al conectar con el servicio de pagos.');
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
        padding: 'var(--space-8)',
        zIndex: 500,
        textAlign: 'center',
        gap: 'var(--space-4)',
      }}
    >
      <div style={{ fontSize: 56, lineHeight: 1 }}>
        {bloqueada ? '🔒' : '⏰'}
      </div>

      <div>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
          {bloqueada ? 'Cuenta suspendida' : 'Suscripción vencida'}
        </h1>
        <p style={{ color: 'var(--ink-2)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
          {bloqueada
            ? 'Tu cuenta fue suspendida por el administrador. Contactate para regularizarla.'
            : `Tu plan venció hace ${Math.abs(diasDiff)} día${Math.abs(diasDiff) !== 1 ? 's' : ''}. Renovalo para seguir usando Solvr.`
          }
        </p>
      </div>

      {!bloqueada && (
        <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <button
            className="btn btn-primary btn-full"
            onClick={handleRenovar}
            disabled={loading}
            style={{ minHeight: 52, fontSize: 'var(--text-base)', fontWeight: 700 }}
          >
            {loading ? 'Procesando...' : 'Renovar suscripción — $4.990/mes'}
          </button>
          {error && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>{error}</p>}
        </div>
      )}

      <button
        className="btn btn-secondary"
        onClick={handleLogout}
        style={{ minHeight: 44, fontSize: 'var(--text-sm)' }}
      >
        Cerrar sesión
      </button>

      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>
        ¿Problemas? Contactá al administrador.
      </p>
    </motion.div>
  );
}
