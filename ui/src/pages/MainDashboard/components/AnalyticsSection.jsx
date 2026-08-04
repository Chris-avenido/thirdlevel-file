import React from 'react';
import DrilldownChart from './DrilldownChart';

const AnalyticsSection = ({
  drillLevel,
  drillPath,
  drilldownViewType,
  groups,
  maxTotal,
  groupKey,
  onToggleView,
  onSetDrillLevel,
  onRowDrill
}) => {
  return (
    <section className="mdb-card">
      <div className="mdb-card-inner">
        <div className="mdb-card-header">
          <div>
            <h2>Geographic &amp; Organizational Drilldown</h2>
            <p className="mdb-card-subtitle">
              Click a row to drill down: Region → Division → Municipality / City.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="mdb-chart-toggle"
              onClick={onToggleView}
            >
              {drilldownViewType === 'stacked' ? 'Heat Map' : 'Stacked Bar'}
            </button>
          </div>
        </div>

        {/* Breadcrumb Navigation */}
        <div className="mdb-breadcrumb">
          <span onClick={() => onSetDrillLevel(0, null)}>National Overview</span>
          {drillLevel >= 1 && drillPath[0] && (
            <>
              &nbsp;➔&nbsp;
              <span onClick={() => onSetDrillLevel(1, drillPath[0])}>{drillPath[0]}</span>
            </>
          )}
          {drillLevel >= 2 && drillPath[1] && (
            <>
              &nbsp;➔&nbsp;
              <span onClick={() => onSetDrillLevel(2, drillPath[1])}>{drillPath[1]}</span>
            </>
          )}
        </div>

        {/* Analytics Drilldown Container */}
        <DrilldownChart
          groupKey={groupKey}
          groups={groups}
          maxTotal={maxTotal}
          viewType={drilldownViewType}
          onRowDrill={onRowDrill}
        />
      </div>
    </section>
  );
};

export default React.memo(AnalyticsSection);
