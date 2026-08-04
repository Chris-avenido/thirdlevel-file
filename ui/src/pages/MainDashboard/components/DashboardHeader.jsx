import React from 'react';

const DashboardHeader = ({ recordCount, statusText = "Registry Verified" }) => {
  return (
    <header className="mdb-topbar">
      <div className="mdb-page-title">
        <p className="mdb-eyebrow">Department of Education • Records Management System</p>
        <h1>Third-Level Officials Inventory &amp; Monitoring Dashboard</h1>
        <p>
          Real-time monitoring of plantilla positions, executive designations, geographic distribution, 
          and career executive profiles across Central, Regional, and Division offices nationwide.
        </p>
      </div>
      <div className="mdb-status-pill">
        <small>System Status</small>
        <strong>{statusText}</strong>
        <span>Loaded {recordCount} Records</span>
      </div>
    </header>
  );
};

export default React.memo(DashboardHeader);
