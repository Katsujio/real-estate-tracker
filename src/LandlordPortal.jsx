import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from './authContext';
import { getLandlordLeases, getLandlordProperties, updateLeaseBalance } from './api/rentals';

// Landlord view: pull data from the backend, show lease/payment state, and let the landlord adjust balances.
const DEMO_LANDLORD = {
  email: 'landlord@demo.com',
  password: 'password123',
};

const formatMoney = (value) => `$${Number(value || 0).toLocaleString()}`;
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : '--');
const formatOrdinal = (day) => {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = day % 100;
  return `${day}${suffix[(v - 20) % 10] || suffix[v] || suffix[0]}`;
};
const dueLabel = (day) => `${formatOrdinal(day || 1)} of each month`;
const nextDueDate = (day) => {
  const now = new Date();
  // Show the due date on the first of the *next* month in local time
  const due = new Date(now.getFullYear(), now.getMonth() + 1, day || 1);
  return due.toLocaleDateString();
};
const contractEndInMonths = (months) => {
  const now = new Date();
  now.setUTCMonth(now.getUTCMonth() + months);
  return now.toISOString().slice(0, 10);
};

export default function LandlordPortal() {
  const { user, token, login, logout } = useAuth();
  const [form, setForm] = useState({ email: DEMO_LANDLORD.email, password: DEMO_LANDLORD.password });
  const [error, setError] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [properties, setProperties] = useState([]);
  const [leases, setLeases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [balanceInputs, setBalanceInputs] = useState({});

  // If already logged in as landlord, mark authed and load data
  useEffect(() => {
    if (user && user.role === 'landlord' && token) {
      setIsAuthed(true);
    }
  }, [user, token]);

  const loadData = () => {
    if (!token) return;
    setLoading(true);
    Promise.all([getLandlordProperties(token), getLandlordLeases(token)])
      .then(([props, leasesRes]) => {
        setProperties(props);
        setLeases(leasesRes);
      })
      .catch((err) => setError(err?.message || 'Could not load rentals.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAuthed) loadData();
  }, [isAuthed]);

  // Simple totals to show the landlord a quick snapshot
  const stats = useMemo(() => {
    const occupied = properties.filter((p) => p.activeLease).length;
    const paid = properties.filter((p) => {
      const lease = p.activeLease;
      return lease ? Number(lease.current_balance) <= 0 : false;
    }).length;
    return { total: properties.length, occupied, paid };
  }, [properties]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login({ email: form.email, password: form.password });
      setIsAuthed(true);
    } catch (err) {
      setError(err?.message || 'Check the demo landlord account (landlord@demo.com / password123).');
    }
  };

  const handleLogout = () => {
    setIsAuthed(false);
    logout();
  };

  const refresh = () => loadData();

  const handleBalanceSave = async (leaseId, explicitValue) => {
    const raw = explicitValue !== undefined ? explicitValue : balanceInputs[leaseId];
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      setError('Balance must be a number.');
      return;
    }
    try {
      await updateLeaseBalance(token, leaseId, value);
      setError('');
      refresh();
    } catch (err) {
      setError(err?.message || 'Could not update balance.');
    }
  };

  if (!isAuthed) {
    return (
      <section className="portal-card">
        <h2>Landlord Login</h2>
        <p className="status-message">Use landlord@demo.com / password123 to view the demo data.</p>
        <form className="simple-form" onSubmit={handleLogin}>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </label>
          {error && <p className="status-message error">{error}</p>}
          <button type="submit" className="track-btn">Sign In</button>
        </form>
      </section>
    );
  }

  return (
    <section className="portal-page">
      <header className="portal-header">
        <div>
          <p className="portfolio-eyebrow">My Rentals</p>
          <h1>Landlord tools</h1>
          <p className="portfolio-subtitle">
            See who is in each unit, when they pay, and if this month is covered.
          </p>
        </div>
        <div className="portal-actions">
          {/* Show which landlord is signed in, same style as renter portal */}
          <span className="pill pill-muted">
            Demo email: {user?.email || 'landlord@demo.com'}
          </span>
          <button type="button" className="outline" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <div className="portal-tiles">
        <div className="portal-tile">
          <p className="tile-label">Units</p>
          <p className="tile-value">{stats.total}</p>
        </div>
        <div className="portal-tile">
          <p className="tile-label">Occupied</p>
          <p className="tile-value">{stats.occupied}</p>
        </div>
        <div className="portal-tile">
          <p className="tile-label">Paid this month</p>
          <p className="tile-value">{stats.paid}</p>
        </div>
      </div>

      {error && <p className="status-message error">{error}</p>}
      {loading && <p className="status-message">Loading rentals...</p>}

      <div className="portal-grid">
        {properties.map((prop) => {
          const lease = prop.activeLease || leases.find((l) => l.property_id === prop.id);
          const occupancy = lease ? 'Occupied' : 'Vacant';
          const balance = lease ? Number(lease.current_balance || 0) : 0;
          const monthlyRent = lease ? Number(lease.monthly_rent || 0) : 0;
          // Mark paid if the balance is at or below the monthly due
          const paidThisMonth = lease ? balance <= (monthlyRent || 0) : false;
          const dueDay = lease?.due_day || 1;
          const dueText = dueLabel(dueDay);
          const nextDue = nextDueDate(dueDay);
          const contractLength = '6 months';
          const contractEnd = contractEndInMonths(6);
          const tenantLabel = lease?.renter_name || lease?.renter_email || lease?.renter_id || 'No tenant yet';
          return (
          <div key={prop.id} className="portal-card">
            <div className="portal-card-head">
              <div>
                <p className="listings-eyebrow">{prop.title}</p>
                <h3>{prop.address}</h3>
              </div>
              <span className={`pill ${occupancy === 'Occupied' ? 'pill-good' : 'pill-muted'}`}>
                {occupancy}
              </span>
            </div>
            <div className="portal-row">
              <div>
                <p className="tile-label">Tenant</p>
                <p className="tile-value small">{tenantLabel}</p>
              </div>
              <div>
                <p className="tile-label">Payment plan</p>
                <p className="tile-value small">{dueText}</p>
                <p className="tile-note">Next due: {nextDue}</p>
              </div>
            </div>
            <div className="portal-row">
              <div>
                <p className="tile-label">Contract</p>
                <p className="tile-value small">{lease?.start_date ? `Started ${formatDate(lease.start_date)}` : 'Not set'}</p>
                <p className="tile-note">{contractLength} • Ends {formatDate(contractEnd)}</p>
              </div>
              <div>
                <p className="tile-label">Monthly rent</p>
                <p className="tile-value small">{formatMoney(monthlyRent || 0)}</p>
              </div>
            </div>
            <div className="portal-row">
              <div>
                <p className="tile-label">Balance</p>
                <p className="tile-value small">${Number(balance || 0).toLocaleString()}</p>
              </div>
            </div>
            {lease && (
              <div className="portal-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                <label className="tile-label">Adjust balance (positive adds, negative credits)</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    className="no-spin"
                    value={balanceInputs[lease.id] ?? ''}
                    onChange={(e) => setBalanceInputs((prev) => ({ ...prev, [lease.id]: e.target.value }))}
                    placeholder="Enter amount to add or remove"
                    style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd' }}
                  />
                  {/* Apply any arbitrary adjustment */}
                  <button type="button" className="track-btn" onClick={() => handleBalanceSave(lease.id)}>
                    Apply change
                  </button>
                  {/* Quick button to post the normal monthly rent */}
                  <button type="button" className="track-btn outline" onClick={() => handleBalanceSave(lease.id, monthlyRent || 0)}>
                    Add monthly charge ({monthlyRent ? formatMoney(monthlyRent) : '$0'})
                  </button>
                </div>
              </div>
            )}
            <div className="portal-row">
              <div>
                <p className="tile-label">This month</p>
                <span className={`pill ${paidThisMonth ? 'pill-good' : 'pill-bad'}`}>
                  {paidThisMonth ? 'Paid' : 'Not paid'}
                </span>
              </div>
            </div>
          </div>
        );
        })}
      </div>
    </section>
  );
}
