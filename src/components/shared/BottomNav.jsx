import { useRef } from 'react';
import { motion } from 'framer-motion';

const TABS = [
  {
    id: 'clientes',
    label: 'Clientes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 'pedidos',
    label: 'Pedidos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="2" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </svg>
    ),
  },
  {
    id: 'gastos',
    label: 'Gastos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="1" y="4" width="22" height="16" rx="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    id: 'stats',
    label: 'Stats',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    id: 'productos',
    label: 'Catálogo',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    ),
  },
  {
    id: 'perfil',
    label: 'Perfil',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

const TAB_PCT = 100 / TABS.length;

export function BottomNav({ activeTab, onTabChange }) {
  const navRef = useRef(null);
  const activeIndex = TABS.findIndex(t => t.id === activeTab);

  function handleDragEnd(_, info) {
    const nav = navRef.current;
    if (!nav) return;
    const tabWidth = nav.getBoundingClientRect().width / TABS.length;
    const newIndex = Math.max(0, Math.min(TABS.length - 1,
      Math.round((activeIndex * tabWidth + info.offset.x) / tabWidth)
    ));
    onTabChange(TABS[newIndex].id);
  }

  return (
    <nav ref={navRef} className="bottom-nav" aria-label="Navegación">
      {/* Draggable bubble */}
      <motion.div
        className="nav-indicator"
        drag="x"
        dragConstraints={navRef}
        dragElastic={0.05}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        animate={{ left: `${activeIndex * TAB_PCT}%`, x: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        style={{ position: 'absolute', top: 5, bottom: 5, width: `${TAB_PCT}%`, cursor: 'grab', zIndex: 0 }}
        whileDrag={{ cursor: 'grabbing', scale: 1.04 }}
      />

      {TABS.map(tab => (
        <motion.button
          key={tab.id}
          className={`nav-btn${activeTab === tab.id ? ' active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          aria-label={tab.label}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          <span style={{ position: 'relative', zIndex: 1, display: 'contents' }}>{tab.icon}</span>
          <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
        </motion.button>
      ))}
    </nav>
  );
}
