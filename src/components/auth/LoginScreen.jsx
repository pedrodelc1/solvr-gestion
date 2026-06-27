import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase.js';
import { isEmailAllowed, emailHasPassword } from '../../lib/db.js';
import './LoginScreen.css';

export function LoginScreen({ onBack }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [method, setMethod] = useState('otp');
  const [password, setPassword] = useState('');
  const [info, setInfo] = useState('');

  async function sendMagicLink(emailValue) {
    const { error: err } = await supabase.auth.signInWithOtp({
      email: emailValue,
      options: { emailRedirectTo: window.location.origin },
    });
    if (err) throw err;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    setInfo('');
    const normalized = email.trim();
    const allowed = await isEmailAllowed(normalized);
    if (allowed === false) {
      setLoading(false);
      setError('Este email no tiene acceso. Contactá al administrador.');
      return;
    }

    if (method === 'password') {
      // Primer ingreso: si nunca seteó password, vamos directo al magic link.
      // El gate real es backend (Supabase Auth + RPC email_has_password) —
      // este check evita el flash de "Credenciales incorrectas" engañoso.
      const hasPw = await emailHasPassword(normalized);
      if (hasPw === false) {
        try {
          await sendMagicLink(normalized);
          setLoading(false);
          setMethod('otp');
          setSent(true);
          setInfo('Es tu primer ingreso. Te mandamos un link para entrar — después podés crear tu contraseña en Perfil.');
        } catch (err) {
          setLoading(false);
          setError(err.message);
        }
        return;
      }
      const { error: err } = await supabase.auth.signInWithPassword({
        email: normalized,
        password,
      });
      setLoading(false);
      if (err) {
        setError(err.message === 'Invalid login credentials' ? 'Credenciales incorrectas' : err.message);
      }
    } else {
      try {
        await sendMagicLink(normalized);
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
                    {method === 'otp' ? 'Ingresá a tu cuenta' : 'Iniciá sesión'}
                  </h1>
                  <p className="login-subheading">
                    {method === 'otp'
                      ? 'Te mandamos un link directo a tu email.'
                      : 'Usá tu email y contraseña.'}
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
                      <label className="login-label" htmlFor="login-password">Contraseña</label>
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
                      ? 'Ingresando…'
                      : method === 'password'
                        ? 'Iniciar sesión'
                        : 'Enviar link de acceso'}
                  </button>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div className="login-divider">o</div>
                  {method === 'otp' ? (
                    <button
                      type="button"
                      className="login-back-btn login-back-btn-underline"
                      onClick={() => { setMethod('password'); setError(''); }}
                    >
                      Ingresar con contraseña
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="login-back-btn login-back-btn-underline"
                      onClick={() => { setMethod('otp'); setError(''); }}
                    >
                      Ingresar sin contraseña
                    </button>
                  )}
                </div>
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
                <h2>Revisá tu email</h2>
                <p>
                  Enviamos un link de acceso a<br />
                  <strong>{email}</strong>.<br />
                  Tocá el link para entrar.
                </p>
                {info && (
                  <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 8, maxWidth: 320, lineHeight: 1.5 }}>
                    {info}
                  </p>
                )}
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
