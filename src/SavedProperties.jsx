import React, { useEffect, useMemo, useState } from 'react';

// Simple pipeline labels for where each deal sits.
export const STAGES = ['Reviewing', 'Offer Out', 'Under Contract', 'Closed'];
const EMPTY_FORM = {
  address: '',
  purchasePrice: '',
  currentValue: '',
  mortgageBalance: '',
  expectedRent: '',
  expenses: '',
  stage: STAGES[0],
  notes: ''
};
// Local helper to keep ids unique across sessions
const makeId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
// Format any numeric string before we show it in the UI
const formatCurrency = (value) => {
  if (value === undefined || value === null || value === '') return '';
  const num = Number(value);
  if (Number.isFinite(num)) return num.toLocaleString();
  return value;
};
const noop = () => {};

export default function SavedProperties({
  incomingDraft,
  onDraftConsumed,
  onSavedChange = noop,
  savedList
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saved, setSaved] = useState([]);
  const [filterStage, setFilterStage] = useState('all');
  const storageKey = 'trackedProperties';
  const controlled = Array.isArray(savedList);

  // Load saved deals once from localStorage (when parent is not controlling the list)
  useEffect(() => {
    // Uncontrolled mode: bootstrap from localStorage
    if (controlled) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setSaved(JSON.parse(stored));
    } catch (err) {
      console.warn('Unable to read saved properties', err);
    }
  }, [controlled]);

  // Save changes back to localStorage
  useEffect(() => {
    if (controlled) return; // parent handles persistence
    try {
      localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch (err) {
      console.warn('Unable to persist saved properties', err);
    }
  }, [saved, controlled]);
  // Let parent know when the list changes (only in uncontrolled mode)
  useEffect(() => {
    if (controlled) return;
    onSavedChange(saved);
  }, [saved, onSavedChange, controlled]);

  // When the listings page pushes a draft, merge it into the form
  useEffect(() => {
    if (!incomingDraft) return;
    setForm((prev) => ({
      ...prev,
      ...incomingDraft,
      purchasePrice: incomingDraft.purchasePrice ?? prev.purchasePrice,
      expectedRent: incomingDraft.expectedRent ?? prev.expectedRent
    }));
    if (onDraftConsumed) onDraftConsumed();
  }, [incomingDraft, onDraftConsumed]);

  // Basic change handler so inputs stay small
  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Add a new tracked property and clear the form
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.address.trim()) return;
    const next = {
      id: makeId(),
      address: form.address.trim(),
      purchasePrice: form.purchasePrice.trim(),
      currentValue: form.currentValue.trim(),
      mortgageBalance: form.mortgageBalance.trim(),
      expectedRent: form.expectedRent.trim(),
      expenses: form.expenses.trim(),
      stage: form.stage,
      notes: form.notes.trim()
    };
    if (controlled) {
      onSavedChange([next, ...(savedList || [])]);
    } else {
      setSaved((prev) => [next, ...prev]);
    }
    setForm(EMPTY_FORM);
  };

  // Change stage without editing the whole card
  const updateStage = (id, stage) => {
    if (controlled) {
      const next = (savedList || []).map((prop) => (prop.id === id ? { ...prop, stage } : prop));
      onSavedChange(next);
    } else {
      setSaved((prev) => prev.map((prop) => (prop.id === id ? { ...prop, stage } : prop)));
    }
  };

  // Remove a tracked property
  const removeProperty = (id) => {
    if (controlled) {
      const next = (savedList || []).filter((prop) => prop.id !== id);
      onSavedChange(next);
    } else {
      setSaved((prev) => prev.filter((prop) => prop.id !== id));
    }
  };

  // Decide which list we show: parent list or local state
  const source = controlled ? (savedList || []) : saved;

  // Summary numbers update whenever the list changes
  const totals = useMemo(() => {
    const base = { total: source.length, projectedRent: 0, projectedCashFlow: 0, totalEquity: 0 };
    STAGES.forEach((stage) => {
      base[stage] = source.filter((p) => p.stage === stage).length;
    });
    base.projectedRent = source.reduce((sum, prop) => sum + (parseFloat(prop.expectedRent) || 0), 0);
    base.projectedCashFlow = source.reduce((sum, prop) => {
      const rent = parseFloat(prop.expectedRent) || 0;
      const costs = parseFloat(prop.expenses) || 0;
      return sum + (rent - costs);
    }, 0);
    base.totalEquity = source.reduce((sum, prop) => {
      const value = parseFloat(prop.currentValue || prop.purchasePrice) || 0;
      const loan = parseFloat(prop.mortgageBalance) || 0;
      return sum + Math.max(value - loan, 0);
    }, 0);
    return base;
  }, [source]);

  // Quick filter by stage
  const visible = filterStage === 'all' ? source : source.filter((prop) => prop.stage === filterStage);

  return (
      <section className="saved-section">
        <div className="saved-header">
          <div>
            <h2>Tracked Properties</h2>
            <p className="saved-note">Log deals you care about, update the status, and keep quick rent math handy.</p>
          </div>
        </div>

      <div className="saved-form-wrapper">
        <form className="saved-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Property address"
            value={form.address}
            onChange={(e) => handleChange('address', e.target.value)}
            required
          />
          <input
            type="number"
            placeholder="Purchase price"
            value={form.purchasePrice}
            onChange={(e) => handleChange('purchasePrice', e.target.value)}
            min="0"
            className="no-spin"
          />
          <input
            type="number"
            placeholder="Current value (estimate)"
            value={form.currentValue}
            onChange={(e) => handleChange('currentValue', e.target.value)}
            min="0"
            className="no-spin"
          />
          <input
            type="number"
            placeholder="Mortgage balance"
            value={form.mortgageBalance}
            onChange={(e) => handleChange('mortgageBalance', e.target.value)}
            min="0"
            className="no-spin"
          />
          <input
            type="number"
            placeholder="Expected monthly rent"
            value={form.expectedRent}
            onChange={(e) => handleChange('expectedRent', e.target.value)}
            min="0"
            className="no-spin"
          />
          <input
            type="number"
            placeholder="Monthly expenses (taxes, HOA, etc.)"
            value={form.expenses}
            onChange={(e) => handleChange('expenses', e.target.value)}
            min="0"
            className="no-spin"
          />
          <select value={form.stage} onChange={(e) => handleChange('stage', e.target.value)}>
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>
          <textarea
            placeholder="Notes, next steps, or financing thoughts"
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={2}
          />
          <button type="submit">Save Property</button>
        </form>
      </div>

      <div className="saved-filters">
        <label htmlFor="stage-filter">Filter by stage</label>
        <select
          id="stage-filter"
          value={filterStage}
          onChange={(e) => setFilterStage(e.target.value)}
        >
          <option value="all">All</option>
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>{stage}</option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="saved-empty">Nothing tracked yet. Add a property above or track one from the listings.</p>
      ) : (
        <div className="saved-list">
          <p className="saved-note">
            You have {totals.total} tracked {totals.total === 1 ? 'property' : 'properties'}.
            Use the stage and notes to keep next steps clear.
          </p>
          {visible.map((prop) => (
            <article key={prop.id} className="saved-card">
              <div className="saved-card-head">
                <h3>{prop.address}</h3>
                <span className={`pill pill-${prop.stage.replace(/\s+/g, '-').toLowerCase()}`}>{prop.stage}</span>
              </div>
              <p className="saved-meta">
                {prop.purchasePrice && <>Buy: ${formatCurrency(prop.purchasePrice)}{prop.currentValue ? ' • ' : ''}</>}
                {prop.currentValue && <>Value: ${formatCurrency(prop.currentValue)}</>}
              </p>
              <p className="saved-meta">
                {prop.expectedRent && <>Rent: ${formatCurrency(prop.expectedRent)}{prop.expenses ? ' • ' : ''}</>}
                {prop.expenses && <>Costs: ${formatCurrency(prop.expenses)}</>}
              </p>
              {(() => {
                const rent = parseFloat(prop.expectedRent) || 0;
                const costs = parseFloat(prop.expenses) || 0;
                const cashFlow = rent - costs;
                const value = parseFloat(prop.currentValue || prop.purchasePrice) || 0;
                const loan = parseFloat(prop.mortgageBalance) || 0;
                const equity = Math.max(value - loan, 0);
                if (!cashFlow && !equity) return null;
                return (
                  <p className="saved-meta">
                    {cashFlow ? <>Cash flow: ${formatCurrency(cashFlow)}</> : null}
                    {cashFlow && equity ? ' • ' : ''}
                    {equity ? <>Equity: ${formatCurrency(equity)}</> : null}
                  </p>
                );
              })()}
              {prop.notes && <p className="saved-notes">{prop.notes}</p>}
              <div className="saved-actions">
                <select
                  value={prop.stage}
                  onChange={(e) => updateStage(prop.id, e.target.value)}
                >
                  {STAGES.map((stage) => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
                <button type="button" onClick={() => removeProperty(prop.id)}>Remove</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
