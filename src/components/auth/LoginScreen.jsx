import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase.js';
import { isEmailAllowed, checkPrimerAcceso } from '../../lib/db.js';
import './LoginScreen.css';

export function LoginScreen({ onBack, initialMethod = 'otp', isFirstTime = false }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [method, setMethod] = useState(initialMethod);
  const [isFirstTimeState, setIsFirstTimeState] = useState(isFirstTime);
  const [password, setPassword] = useState('');

  async function sendMagicLink(emailValue, isRecovery = false) {
    const redirectTo = isRecovery
      ? `${window.location.origin}?flow=recovery`
      : window.location.origin;

    const { error: err } = await supabase.auth.signInWithOtp({
      email: emailValue,
      options: { emailRedirectTo: redirectTo },
    });
    if (err) throw err;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const normalized = email.trim();
    const allowed = await isEmailAllowed(normalized);
    if (allowed === false) {
      setLoading(false);
      setError('Este email no tiene acceso. Contactá al administrador.');
      return;
    }

    if (method === 'otp' && isFirstTimeState) {
      try {
        const ok = await checkPrimerAcceso(normalized);
        if (!ok) {
          setLoading(false);
          setError('Este email ya está registrado con una contraseña. Por favor, iniciá sesión usando tu contraseña.');
          return;
        }
      } catch (err) {
        setLoading(false);
        const rawMsg = err.message || '';
        if (rawMsg.includes('ya está registrado') || rawMsg.includes('contraseña') || rawMsg.includes('has password')) {
          setError('Este email ya está registrado con una contraseña. Por favor, iniciá sesión usando tu contraseña.');
        } else if (rawMsg.includes('no tiene acceso') || rawMsg.includes('whitelist')) {
          setError('Este email no tiene acceso. Contactá al administrador.');
        } else {
          setError('Ocurrió un problema al verificar el acceso. Por favor, intentá de nuevo.');
        }
        return;
      }
    }

    if (method === 'password') {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: normalized,
        password,
      });
      setLoading(false);
      if (err) {
        setError(err.message === 'Invalid login credentials' ? 'Credenciales incorrectas' : err.message);
      }
    } else if (method === 'recovery') {
      try {
        await sendMagicLink(normalized, true);
        setLoading(false);
        setSent(true);
      } catch (err) {
        setLoading(false);
        setError(err.message);
      }
    } else {
      try {
        await sendMagicLink(normalized, false);
        setLoading(false);
        setSent(true);
      } catch (err) {
        setLoading(false);
        setError(err.message);
      }
    }
  }

  return (
    <div className="login-screen">

      {onBack && (
        <button className="login-back-landing" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Volver
        </button>
      )}

      {/* Left panel — desktop only */}
      <div className="login-side">
        <div className="login-side-brand">
          <span className="login-side-mark">S</span>
          <span className="login-side-name">Solvr Gestión</span>
        </div>

        <div className="login-side-quote">
          <blockquote>
            "Antes tardaba una hora en saber cuánto había cobrado.<br />
            Ahora lo sé en segundos."
          </blockquote>
          <cite>— Cliente real, negocio de distribución</cite>
          <div className="login-side-dots" style={{ marginTop: 20 }}>
            <span className="active" />
            <span />
            <span />
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © {new Date().getFullYear()} Solvr Gestión
        </div>
      </div>

      {/* Right panel — form */}
      <div className="login-card">
        <div className="login-card-inner">

          {/* Mobile brand */}
          <div className="login-mobile-brand">
            <span className="login-side-mark">S</span>
            <span className="login-side-name">Solvr Gestión</span>
          </div>

          <AnimatePresence mode="wait">
            {!sent ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
              >
                <div>
                  <h1 className="login-heading">
                    {method === 'otp' ? 'Ingresá a tu cuenta' : (method === 'recovery' ? 'Recuperar contraseña' : 'Iniciá sesión')}
                  </h1>
                  <p className="login-subheading">
                    {method === 'otp'
                      ? 'Te mandamos un link directo a tu email.'
                      : (method === 'recovery' ? 'Te enviamos un enlace para restablecer tu clave.' : 'Usá tu email y contraseña.')}
                  </p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                  <div>
                    <label className="login-label" htmlFor="login-email">Email</label>
                    <input
                      id="login-email"
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>

                  {method === 'password' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label className="login-label" htmlFor="login-password" style={{ margin: 0 }}>Contraseña</label>
                        <button
                          type="button"
                          onClick={() => { setMethod('recovery'); setError(''); }}
                          style={{ fontSize: 12.5, textDecoration: 'underline', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--ink-2)' }}
                        >
                          ¿Olvidaste tu contraseña?
                        </button>
                      </div>
                      <input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                      />
                    </div>
                  )}

                  {error && (
                    <p style={{ fontSize: 12.5, color: '#f87171', margin: 0 }}>{error}</p>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary btn-full"
                    disabled={loading || !email.trim() || (method === 'password' && !password)}
                  >
                    {loading
                      ? (method === 'recovery' ? 'Enviando...' : 'Ingresando…')
                      : method === 'password'
                        ? 'Iniciar sesión'
                        : (method === 'recovery' ? 'Enviar enlace de recuperación' : 'Enviar link de acceso')}
                  </button>
                </form>

                {method === 'recovery' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <button
                      type="button"
                      className="login-back-btn login-back-btn-underline"
                      onClick={() => { setMethod('password'); setError(''); }}
                    >
                      Volver al inicio de sesión
                    </button>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="sent"
                className="login-sent"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="login-sent-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2>¡Enlace enviado!</h2>
                <p>
                  {method === 'recovery'
                    ? 'Revisá tu email para restablecer tu contraseña.'
                    : 'Revisá tu email para ingresar.'}
                </p>
                <button
                  className="login-back-btn login-back-btn-underline"
                  onClick={() => { setSent(false); setEmail(''); setPassword(''); }}
                >
                  Usar otro email
                </button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}
