import React, { useMemo } from 'react';
import SavedProperties, { STAGES } from './SavedProperties';

const formatCurrency = (value) => {
  if (!Number.isFinite(value)) return '--';
  return `$${Math.round(value).toLocaleString()}`;
};

export default function Portfolio({
  savedDeals = [],
  onSavedChange,
  incomingDraft,
  onDraftConsumed,
}) {
  // Simple pipeline counts for each stage
  const pipeline = useMemo(() => {
    const counts = STAGES.reduce((acc, stage) => {
      acc[stage] = 0;
      return acc;
    }, {});
    savedDeals.forEach((deal) => {
      if (counts[deal.stage] !== undefined) counts[deal.stage] += 1;
    });
    const total = savedDeals.length;
    const stages = STAGES.map((stage) => ({
      stage,
      count: counts[stage],
      percent: total ? Math.round((counts[stage] / total) * 100) : 0,
    }));
    return { total, counts, stages };
  }, [savedDeals]);

  // Basic portfolio stats: net worth and monthly cash flow
  const stats = useMemo(() => {
    let totalEquity = 0;
    let monthlyCashFlow = 0;
    savedDeals.forEach((deal) => {
      const value = parseFloat(deal.currentValue || deal.purchasePrice) || 0;
      const loan = parseFloat(deal.mortgageBalance) || 0;
      const rent = parseFloat(deal.expectedRent) || 0;
      const costs = parseFloat(deal.expenses) || 0;
      totalEquity += Math.max(value - loan, 0);
      monthlyCashFlow += rent - costs;
    });
    return { totalEquity, monthlyCashFlow };
  }, [savedDeals]);

  const tileData = [
    { label: 'Tracked Properties', value: pipeline.total },
    { label: 'Total Equity (Estimate)', value: formatCurrency(stats.totalEquity) },
    { label: 'Monthly Cash Flow', value: formatCurrency(stats.monthlyCashFlow) },
    { label: 'Closed Deals', value: pipeline.counts?.Closed ?? 0 },
  ];

  return (
    <section className="portfolio-page">
      <header className="portfolio-header">
        <div>
          <p className="portfolio-eyebrow">Investment Tracker</p>
          <h1>Portfolio & Deal Pipeline</h1>
          <p className="portfolio-subtitle">
            Keep tabs on every property you're researching, from first look through closing.
          </p>
        </div>
      </header>

      {/* Quick stats so the user can skim progress */}
      <div className="portfolio-tiles">
        {tileData.map((metric) => (
          <div key={metric.label} className="portfolio-tile">
            <p className="tile-label">{metric.label}</p>
            <p className="tile-value">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="portfolio-pipeline">
        {pipeline.stages.map(({ stage, count, percent }) => (
          <div key={stage} className="pipeline-stage">
            <div className="pipeline-head">
              <p className="pipeline-label">{stage}</p>
              <span className="pipeline-count">{count}</span>
            </div>
            <div className="pipeline-bar">
              <span style={{ width: `${percent}%` }} />
            </div>
            <p className="pipeline-percentage">{percent}% of deals</p>
          </div>
        ))}
      </div>

      <SavedProperties
        onSavedChange={onSavedChange}
        savedList={savedDeals}
        incomingDraft={incomingDraft}
        onDraftConsumed={onDraftConsumed}
      />
    </section>
  );
}
