import React from 'react';

const KPISection = ({ kpiData }) => {
  const { totalCount, totalYears, regularCount, oicCount, vacantCount } = kpiData;

  return (
    <section className="mdb-kpi-grid">
      <div className="mdb-kpi-card">
        <div className="mdb-kpi-title">Personnel Records</div>
        <div className="mdb-kpi-number">{totalCount}</div>
        <div className="mdb-kpi-helper">Active System Profiles</div>
      </div>

      <div className="mdb-kpi-card">
        <div className="mdb-kpi-title">Total Service Years</div>
        <div className="mdb-kpi-number">{totalYears}</div>
        <div className="mdb-kpi-helper">Cumulative Executive Tenure</div>
      </div>

      <div className="mdb-kpi-card">
        <div className="mdb-kpi-title">Regular Appointees</div>
        <div className="mdb-kpi-number" style={{ color: 'var(--mdb-green)' }}>
          {regularCount}
        </div>
        <div className="mdb-kpi-helper">Permanent Appointments</div>
      </div>

      <div className="mdb-kpi-card">
        <div className="mdb-kpi-title">Designated OICs</div>
        <div className="mdb-kpi-number" style={{ color: 'var(--mdb-amber)' }}>
          {oicCount}
        </div>
        <div className="mdb-kpi-helper">Acting Officers-in-Charge</div>
      </div>

      <div className="mdb-kpi-card">
        <div className="mdb-kpi-title">Vacant Positions</div>
        <div className="mdb-kpi-number" style={{ color: 'var(--mdb-red)' }}>
          {vacantCount}
        </div>
        <div className="mdb-kpi-helper">Unfilled Plantilla Items</div>
      </div>
    </section>
  );
};

export default React.memo(KPISection);
