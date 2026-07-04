import { useEffect } from 'react';
import { motion } from 'framer-motion';

export function SplashScreen({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 700);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="splash-screen">
      <motion.div
        className="splash-logo"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
      >
        S.
      </motion.div>
      <motion.div
        className="splash-title"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2, ease: [0, 0, 0.2, 1] }}
      >
        Solvnt Gestión
      </motion.div>
    </div>
  );
}
