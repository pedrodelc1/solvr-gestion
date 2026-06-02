import { motion } from 'framer-motion';

export function TrialBanner({ dias, onUpgrade }) {
  if (dias == null || dias < 0) return null;

  const urgente = dias <= 3;

  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      style={{
        background: urgente ? 'var(--danger)' : '#1a1a1a',
        color: urgente ? '#fff' : 'var(--ink-2)',
        fontSize: 'var(--text-xs)',
        padding: '8px var(--space-4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        borderBottom: urgente ? 'none' : '1px solid var(--border)',
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      <span style={{ fontWeight: 500 }}>
        {dias === 0
          ? 'Tu período de prueba vence hoy.'
          : `Período de prueba: ${dias} día${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}.`}
      </span>
      <button
        onClick={onUpgrade}
        style={{
          background: urgente ? '#fff' : 'var(--primary)',
          color: urgente ? 'var(--danger)' : '#080808',
          border: 'none',
          borderRadius: 4,
          padding: '3px 10px',
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Suscribirme
      </button>
    </motion.div>
  );
}
