import { AnimatePresence, motion } from 'framer-motion';

function ToastItem({ t }) {
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        background: 'var(--bg-3)',
        border: '1px solid var(--border)',
        borderLeft: t.type === 'error'
          ? '3px solid var(--danger)'
          : '3px solid var(--success)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-4)',
        paddingBottom: 0,
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
        color: 'var(--ink)',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <div style={{ paddingBottom: 'var(--space-3)' }}>{t.msg}</div>
      <motion.div
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: 3, ease: 'linear' }}
        style={{
          height: 2,
          background: t.type === 'error' ? 'var(--danger)' : 'var(--success)',
          opacity: 0.5,
          borderRadius: 1,
        }}
      />
    </motion.div>
  );
}

export function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map(t => (
          <ToastItem key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
