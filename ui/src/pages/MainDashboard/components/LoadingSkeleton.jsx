import React from 'react';

const LoadingSkeleton = () => {
  return (
    <div className="mdb-container">
      <div className="mdb-main">
        <div className="mdb-topbar" style={{ opacity: 0.7 }}>
          <div className="mdb-page-title">
            <div style={{ width: '240px', height: '14px', background: 'rgba(255,255,255,0.3)', borderRadius: '4px', marginBottom: '12px' }} />
            <div style={{ width: '450px', height: '32px', background: 'rgba(255,255,255,0.4)', borderRadius: '6px' }} />
          </div>
          <div className="mdb-status-pill" style={{ opacity: 0.8 }}>
            <div style={{ width: '80px', height: '10px', background: '#ccc', borderRadius: '3px', margin: '0 0 6px auto' }} />
            <div style={{ width: '120px', height: '18px', background: '#999', borderRadius: '4px', margin: '0 0 0 auto' }} />
          </div>
        </div>

        <div className="mdb-content">
          <div className="mdb-card" style={{ padding: '24px' }}>
            <div style={{ width: '200px', height: '24px', background: 'var(--mdb-blue-100)', borderRadius: '6px', marginBottom: '16px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              {[1, 2, 3, 4].map((n) => (
                <div key={n} style={{ height: '40px', background: 'var(--mdb-blue-50)', borderRadius: '10px' }} />
              ))}
            </div>
          </div>

          <div className="mdb-kpi-grid">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="mdb-kpi-card" style={{ height: '120px', animation: 'pulse 1.5s infinite' }}>
                <div style={{ width: '100px', height: '12px', background: 'var(--mdb-blue-100)', borderRadius: '4px' }} />
                <div style={{ width: '60px', height: '36px', background: 'var(--mdb-blue-50)', borderRadius: '6px' }} />
                <div style={{ width: '120px', height: '12px', background: 'var(--mdb-blue-100)', borderRadius: '4px' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSkeleton;
