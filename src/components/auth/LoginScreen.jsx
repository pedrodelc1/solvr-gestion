import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase.js';
import { isEmailAllowed } from '../../lib/db.js';
import './LoginScreen.css';

export function LoginScreen({ onOfflineMode }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const allowed = await isEmailAllowed(email.trim());
    if (!allowed) {
      setLoading(false);
      setError('Este email no tiene acceso. Pedíselo al administrador.');
      return;
    }
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

  const container = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08, delayChildren: 0 } },
  };
  const letter = {
    hidden: { y: -60, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 350, damping: 10 } },
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div>
          <motion.div
            className="login-logo"
            style={{ display: 'flex', letterSpacing: '-0.04em', overflow: 'visible' }}
            variants={container}
            initial="hidden"
            animate="visible"
          >
            {'Solvr.'.split('').map((char, i) => (
              <motion.span key={i} variants={letter} style={{ display: 'inline-block' }}>
                {char}
              </motion.span>
            ))}
          </motion.div>
          <motion.div
            className="login-tagline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.4 }}
          >
            Gestión simple para tu negocio.
          </motion.div>
        </div>

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
                {error && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>{error}</p>
                )}
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={loading || !email.trim()}
                >
                  {loading ? 'Enviando...' : 'Enviar acceso'}
                </button>
              </form>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <p className="login-hint">
                  Te enviaremos un link de acceso a tu email.<br />Sin contraseña.
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
              <p>
                Enviamos un link de acceso a<br />
                <strong>{email}</strong>.<br />
                Tocá el link para entrar.
              </p>
              <button className="login-back-btn" onClick={() => { setSent(false); setEmail(''); }}>
                Usar otro email
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
