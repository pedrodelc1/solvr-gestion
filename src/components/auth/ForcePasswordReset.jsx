import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { updateUserPassword } from '../../lib/db.js';

export function ForcePasswordReset({ onComplete, toast }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  const inputStyle = {
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '12px 14px',
    color: 'var(--ink)',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
    fontSize: 15,
    marginTop: 6,
    transition: 'border-color 150ms',
  };

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
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)', background: 'var(--bg)', color: '#fff' }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: 380, background: 'var(--bg-2)', border: '1px solid var(--border)', padding: 28, borderRadius: 'var(--radius-lg)', boxSizing: 'border-box' }}
      >
        <div style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', textAlign: 'center', marginBottom: 12 }}>Solvnt.</div>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, textAlign: 'center', color: '#fff', margin: '0 0 8px' }}>Restablecer tu contraseña</h2>
        <p style={{ color: 'var(--ink-2)', fontSize: 'var(--text-sm)', lineHeight: 1.5, textAlign: 'center', margin: '0 0 24px' }}>
          Para ingresar de forma segura y proteger tu cuenta, ingresá una nueva contraseña.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Nueva contraseña</label>
            <input
              type="password"
              placeholder="Mín. 6 caracteres"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
              style={inputStyle}
              required
              autoFocus
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Repetir nueva contraseña</label>
            <input
              type="password"
              placeholder="Repetí tu nueva contraseña"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              style={{
                ...inputStyle,
                borderColor: confirmPassword && confirmPassword !== newPassword ? 'var(--danger)' : 'var(--border)',
              }}
              required
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <span style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4, display: 'block' }}>Las contraseñas no coinciden</span>
            )}
          </div>

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)', margin: 0, lineHeight: 1.4 }}>{error}</p>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            className="btn btn-primary btn-full"
            disabled={saving || !newPassword.trim() || newPassword !== confirmPassword}
            style={{ minHeight: 48, fontSize: 'var(--text-base)', fontWeight: 700, marginTop: 8 }}
          >
            {saving ? 'Guardando...' : 'Establecer Contraseña e Ingresar'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
