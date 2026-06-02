export function SkeletonLoader() {
  return (
    <div style={{ height: '100dvh', background: '#080808', display: 'flex', flexDirection: 'column' }}>
      {/* Header skeleton */}
      <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222' }}>
        <div className="skeleton" style={{ width: 120, height: 28, borderRadius: 8 }} />
        <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8 }} />
      </div>
      {/* Search skeleton */}
      <div style={{ padding: '12px 16px' }}>
        <div className="skeleton" style={{ width: '100%', height: 44, borderRadius: 999 }} />
      </div>
      {/* Cards skeleton */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div className="skeleton" style={{ width: '40%', height: 18, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: '25%', height: 18, borderRadius: 6 }} />
            </div>
            <div className="skeleton" style={{ width: '60%', height: 14, borderRadius: 6 }} />
          </div>
        ))}
      </div>
      {/* Bottom nav skeleton */}
      <div style={{ marginTop: 'auto', height: 66, background: '#111', borderTop: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 8px' }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div className="skeleton" style={{ width: 22, height: 22, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: 36, height: 10, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
