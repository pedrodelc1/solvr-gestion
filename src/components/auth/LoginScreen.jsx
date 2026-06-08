import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase.js';
import { isEmailAllowed } from '../../lib/db.js';
import './LoginScreen.css';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const [otpToken, setOtpToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const [method, setMethod] = useState('otp'); // 'otp' or 'password'
  const [password, setPassword] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const allowed = await isEmailAllowed(email.trim());
    // null = can't verify (RLS/anon), false = definitely not allowed
    if (allowed === false) {
      setLoading(false);
      setError('Este email no tiene acceso. Contactá al administrador.');
      return;
    }

    if (method === 'password') {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });
      setLoading(false);
      if (err) {
        setError(err.message === 'Invalid login credentials' ? 'Credenciales incorrectas' : err.message);
      }
    } else {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      setLoading(false);
      if (err) {
        setError(err.message);
      } else {
        setSent(true);
      }
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (otpToken.trim().length !== 6) return;
    setVerifying(true);
    setVerifyError('');
    try {
      // Try 'magiclink' type first (standard for signInWithOtp)
      const { error: err } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpToken.trim(),
        type: 'magiclink',
      });
      if (err) {
        // Try fallback to 'email' type if configuration differs
        const { error: errFallback } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: otpToken.trim(),
          type: 'email',
        });
        if (errFallback) throw errFallback;
      }
    } catch (err) {
      setVerifyError(err.message === 'Token has expired' ? 'El código expiró o es incorrecto' : err.message);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <AnimatePresence>
          {!sent && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="login-logo">Solvnt.</div>
              <div className="login-tagline">
                Gestión simple para tu negocio.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!sent ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
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
                  <div style={{ marginTop: 'var(--space-3)' }}>
                    <label className="login-label" htmlFor="login-password">Contraseña</label>
                    <input
                       id="login-password"
                       type="password"
                       placeholder="••••••••"
                       value={password}
                       onChange={e => setPassword(e.target.value)}
                       autoComplete="current-password"
                       required
                       style={{ background: '#111111', borderColor: '#333333', color: '#ffffff', width: '100%', padding: '10px', borderRadius: '6px', minHeight: 44 }}
                    />
                  </div>
                )}
                {error && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)', marginTop: 'var(--space-2)' }}>{error}</p>
                )}
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={loading || !email.trim() || (method === 'password' && !password)}
                  style={{ marginTop: 'var(--space-4)' }}
                >
                  {loading ? 'Ingresando...' : method === 'password' ? 'Iniciar sesión' : 'Enviar acceso'}
                </button>
              </form>
              <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
                {method === 'otp' ? (
                  <button 
                    type="button" 
                    className="login-back-btn" 
                    onClick={() => { setMethod('password'); setError(''); }}
                  >
                    Ingresar con contraseña
                  </button>
                ) : (
                  <button 
                    type="button" 
                    className="login-back-btn" 
                    onClick={() => { setMethod('otp'); setError(''); }}
                  >
                    Ingresar sin contraseña (link/código)
                  </button>
                )}
              </div>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <p className="login-hint">
                  {method === 'otp' 
                    ? 'Te enviaremos un link de acceso a tu email. Sin contraseña.'
                    : 'Ingresá con tu email y la contraseña establecida desde tu perfil.'
                  }
                </p>
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2>Revisá tu email</h2>
              <p style={{ marginBottom: 'var(--space-4)' }}>
                Enviamos un acceso a<br />
                <strong>{email}</strong>.
              </p>
              
              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%', marginBottom: 'var(--space-4)' }}>
                <label className="login-label" style={{ textAlign: 'left' }}>O ingresá el código de 6 dígitos:</label>
                <input
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={otpToken}
                  onChange={e => setOtpToken(e.target.value.replace(/\D/g, ''))}
                  style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '4px', fontWeight: 'bold', minHeight: 44 }}
                  required
                />
                {verifyError && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)', margin: '4px 0 0', textAlign: 'center' }}>{verifyError}</p>
                )}
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={verifying || otpToken.length !== 6}
                  style={{ minHeight: 40 }}
                >
                  {verifying ? 'Verificando...' : 'Ingresar con código'}
                </button>
              </form>

              <button className="login-back-btn" onClick={() => { setSent(false); setEmail(''); setOtpToken(''); setVerifyError(''); }}>
                Usar otro email
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

