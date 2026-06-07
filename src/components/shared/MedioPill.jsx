const SvgEfectivo = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <circle cx="12" cy="12" r="3"/>
    <line x1="1" y1="10" x2="4" y2="10"/>
    <line x1="20" y1="10" x2="23" y2="10"/>
  </svg>
);

const SvgTransferencia = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="17 1 21 5 17 9"/>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <polyline points="7 23 3 19 7 15"/>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
);

const SvgTarjeta = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);

export function MedioPill({ medio, cuotas }) {
  if (medio === 'efectivo') {
    return (
      <span className="medio-pill medio-efectivo" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <SvgEfectivo /> Efectivo
      </span>
    );
  }
  if (medio === 'transferencia') {
    return (
      <span className="medio-pill medio-transferencia" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <SvgTransferencia /> Transf.
      </span>
    );
  }
  if (medio === 'tarjeta' || medio === 'fiado') {
    const label = cuotas && cuotas > 1 ? `${cuotas} cuotas` : 'Tarjeta';
    return (
      <span className="medio-pill medio-tarjeta" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <SvgTarjeta /> {label}
      </span>
    );
  }
  return <span className="medio-pill">{medio}</span>;
}

export function MedioIcon({ medio }) {
  if (medio === 'efectivo') return <SvgEfectivo />;
  if (medio === 'transferencia') return <SvgTransferencia />;
  return <SvgTarjeta />;
}
