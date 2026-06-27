import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { updateUserPassword } from '../../lib/db.js';
import './LoginScreen.css';

export function ForcePasswordReset({ onComplete, toast }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (savingRef.current) return;
    setError('');

    const pw = newPassword.trim();
    if (!pw || pw.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await updateUserPassword(pw);
      toast('Contraseña restablecida con éxito');
      onComplete();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la contraseña');
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-card-inner">

          {/* Branding */}
          <div className="login-mobile-brand" style={{ marginBottom: 12 }}>
            <span className="login-side-mark">S</span>
            <span className="login-side-name">Solvr Gestión</span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
          >
            <div>
              <h1 className="login-heading">Restablecer contraseña</h1>
              <p className="login-subheading">
                Para ingresar de forma segura y proteger tu cuenta, ingresá una nueva contraseña.
              </p>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              <div>
                <label className="login-label" htmlFor="reset-new-password">Nueva contraseña</label>
                <input
                  id="reset-new-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="login-label" htmlFor="reset-confirm-password">Repetir nueva contraseña</label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  placeholder="Repetí la contraseña"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  style={{
                    borderColor: confirmPassword && confirmPassword !== newPassword ? '#f87171' : undefined,
                  }}
                  required
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <span style={{ fontSize: 11.5, color: '#f87171', marginTop: 6, display: 'block' }}>
                    Las contraseñas no coinciden
                  </span>
                )}
              </div>

              {error && (
                <p style={{ fontSize: 12.5, color: '#f87171', margin: 0 }}>{error}</p>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={saving || !newPassword.trim() || newPassword !== confirmPassword || newPassword.length < 6}
                style={{ marginTop: 8 }}
              >
                {saving ? 'Guardando...' : 'Establecer contraseña e ingresar'}
              </button>
            </form>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
