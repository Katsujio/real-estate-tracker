import React, { useEffect, useState } from 'react';
import { useAuth } from './authContext';
import { demoPaymentHistory, demoRenterProfile } from './demoData';
import { getRenterLease, payLease } from './api/rentals';

// Renter view: logs in via AuthContext, loads lease/payments, and lets renters pay or see charges/credits.
// Demo renter account seeded in the backend
const DEMO_RENTER = {
  email: 'renter@demo.com',
  password: 'password123',
};
const RENTER_AUTH_KEY = 'renter_portal_authed';

const formatMoney = (value) => {
  const num = Number(value) || 0;
  return `$${num.toLocaleString()}`;
};

const formatDate = (iso) => {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleDateString();
};

// Build nice strings for due dates and ordinals
const formatOrdinal = (day) => {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = day % 100;
  return `${day}${suffix[(v - 20) % 10] || suffix[v] || suffix[0]}`;
};

const dueLabel = (day) => `${formatOrdinal(day || 1)} of each month`;

const nextDueDate = (day) => {
  const now = new Date();
  // For the demo, show the due date as the first of the *next* month in local time
  const due = new Date(now.getFullYear(), now.getMonth() + 1, day || 1);
  return due.toLocaleDateString();
};

const contractEndInMonths = (months) => {
  const now = new Date();
  now.setUTCMonth(now.getUTCMonth() + months);
  return now.toISOString().slice(0, 10);
};

const formatLedgerAmount = (entry) => {
  const abs = Math.abs(Number(entry.amount) || 0);
  const prefix = entry.type === 'charge' ? '+' : '-';
  return `${prefix}${formatMoney(abs)}`;
};

// Decide the label and dot color based on what kind of entry it is
const ledgerLabel = (entry) => {
  if (entry.type === 'charge') return 'Rent issued';
  if (entry.type === 'credit') return 'Credited on';
  return 'Paid on';
};

const ledgerDotClass = (entry) => {
  if (entry.type === 'charge') return 'dot-yellow';
  if (entry.type === 'credit') return 'dot-purple';
  return 'dot-green';
};

// Turn "MM/YY" into month + full year so we can compare with today (keeps it simple)
const parseExpiry = (value) => {
  if (!value || typeof value !== 'string') return null;
  const parts = value.split('/');
  if (parts.length !== 2) return null;
  const [mm, yy] = parts;
  const month = Number(mm);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  const yearNum = Number(yy.length === 2 ? `20${yy}` : yy);
  if (!Number.isInteger(yearNum) || yearNum < 2000) return null;
  return { month, year: yearNum };
};

export default function RenterPortal() {
  const { user, token, login, logout } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [isAuthed, setIsAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [profile, setProfile] = useState(demoRenterProfile);
  const [paymentHistory, setPaymentHistory] = useState(demoPaymentHistory);
  const [payment, setPayment] = useState({ cardNumber: '', expiry: '', cvv: '' });
  const [status, setStatus] = useState('');
  const [paymentErrors, setPaymentErrors] = useState([]);
  const [paymentChoice, setPaymentChoice] = useState('saved');
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('saved');
  const [lease, setLease] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showLedger, setShowLedger] = useState(false);

  // If already logged in as renter, mark authed
  useEffect(() => {
    if (user && user.role === 'renter' && token) {
      setIsAuthed(true);
      localStorage.setItem(RENTER_AUTH_KEY, 'true');
    }
  }, [user, token]);

  // Restore auth flag so the login form stays closed after refresh
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RENTER_AUTH_KEY);
      if (stored === 'true' && user && user.role === 'renter') {
        setIsAuthed(true);
      }
    } catch (err) {
      console.warn('Could not read renter auth state', err);
    }
  }, [user]);

  // Load lease + payments from the API
  useEffect(() => {
    if (!isAuthed || !token) return;
    setStatus('');
    setAuthError('');
    setLoading(true);
    getRenterLease(token)
      .then((data) => {
        setLease(data.lease);
        // Map backend payments/charges into the ledger
        setPaymentHistory(
          (data.payments || []).map((p) => ({
            id: p.id,
            date: p.paid_at,
            amount: p.amount,
            method: p.type === 'charge' ? 'Due amount' : 'Online payment',
            // Treat credits like rent charges: both are posted by the landlord
            note: (p.type === 'charge' || p.type === 'credit') ? 'Posted by landlord' : 'Paid by you',
            type: p.type || 'payment',
          })),
        );
        const balance = Number(data.lease?.current_balance) || 0;
        const monthly = Number(data.lease?.monthly_rent) || 0;
        // Track balance + monthly rent for paid/overdue checks
        setProfile((prev) => ({
          ...prev,
          balance,
          monthlyRent: monthly || prev.monthlyRent || 0,
          payDay: data.lease?.due_day ? `${data.lease.due_day} of month` : prev.payDay,
          address: data.lease?.property_address || prev.address,
          email: user?.email || prev.email,
          name: user?.fullName || prev.name,
          paidThisMonth: monthly ? balance <= monthly : balance <= 0,
        }));
      })
      .catch((err) => {
        setStatus(err.message || 'Could not load lease.');
      })
      .finally(() => setLoading(false));
  }, [isAuthed, token, user]);

  // Login through the shared auth context (uses backend)
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await login({ email: form.email, password: form.password });
      setIsAuthed(true);
      localStorage.setItem(RENTER_AUTH_KEY, 'true');
    } catch (err) {
      setAuthError(err?.message || 'Login failed. Use the demo renter account.');
    }
  };

  const handleLogout = () => {
    setIsAuthed(false);
    logout();
    try {
      localStorage.removeItem(RENTER_AUTH_KEY);
    } catch (err) {
      console.warn('Could not clear renter auth', err);
    }
  };

  // Tiny checks so the card fields are not empty or broken
  const validatePayment = () => {
    const errors = [];
    if (!/^\d{16}$/.test(payment.cardNumber.replace(/\s+/g, ''))) {
      errors.push('Card number should be 16 digits.');
    }
    // Make sure expiry looks like MM/YY and is in the future
    const expiryMatch = /^(0[1-9]|1[0-2])\/\d{2}$/.test(payment.expiry);
    if (!expiryMatch) {
      errors.push('Use MM/YY for expiry.');
    } else {
      const parsed = parseExpiry(payment.expiry);
      if (!parsed) {
        errors.push('Use MM/YY for expiry.');
      } else {
        // Simple month/year check (no fancy date math)
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // months are 0-based in JS
        const isExpired =
          parsed.year < currentYear ||
          (parsed.year === currentYear && parsed.month < currentMonth);
        if (isExpired) {
          errors.push('Card appears to be expired.');
        }
      }
    }
    if (!/^\d{3,4}$/.test(payment.cvv)) {
      errors.push('CVV should be 3 or 4 numbers.');
    }
    return errors;
  };

  const handlePaymentSave = (e) => {
    e.preventDefault();
    setPaymentErrors([]);
    setStatus('');
    const errors = validatePayment();
    if (errors.length) {
      setPaymentErrors(errors);
      return;
    }
    const masked = `Card ending in ${payment.cardNumber.slice(-4)} (exp ${payment.expiry})`;
    const nextProfile = { ...profile, paymentMethod: masked };
    setProfile(nextProfile);
    setStatus('Payment method saved.');
    setPayment({ cardNumber: '', expiry: '', cvv: '' });
  };

  // When confirming in the modal, require a payment method if "new" is chosen
  const handleConfirmPayment = async () => {
    const value = Number(payAmount);
    if (!Number.isFinite(value) || value <= 0) {
      setStatus('Enter an amount to pay.');
      return;
    }

    let methodLabel = profile.paymentMethod || 'Manual payment';
    if (selectedMethod === 'new') {
      const errors = validatePayment();
      if (errors.length) {
        setPaymentErrors(errors);
        setStatus('Fix the card details before paying.');
        return;
      }
      const masked = `Card ending in ${payment.cardNumber.slice(-4)} (exp ${payment.expiry})`;
      setProfile((prev) => ({ ...prev, paymentMethod: masked }));
      methodLabel = masked;
      setPaymentErrors([]);
    } else if (selectedMethod === 'saved' && profile.paymentMethod) {
      methodLabel = profile.paymentMethod;
    }

    if (!lease) {
      setStatus('No lease to pay yet.');
      return;
    }

    try {
      const res = await payLease(token, lease.id, value);
      setLease(res.lease);
        setPaymentHistory(
          (res.payments || []).map((p) => ({
            id: p.id,
            date: p.paid_at,
            amount: p.amount,
            method: p.type === 'charge' ? 'Due amount' : methodLabel,
            type: p.type || 'payment',
            // For both charges and credits, show that the landlord posted it
            note: (p.type === 'charge' || p.type === 'credit') ? 'Posted by landlord' : 'Paid by you',
          })),
        );
        const balance = Number(res.lease?.current_balance) || 0;
        const monthly = Number(res.lease?.monthly_rent) || 0;
        setProfile((prev) => ({
          ...prev,
          balance,
          paidThisMonth: monthly ? balance <= monthly : balance <= 0,
        }));
      const balanceNote = balance < 0
        ? `You now have a credit of ${formatMoney(Math.abs(balance))}.`
        : `New balance: ${formatMoney(balance)}.`;
      setStatus(`Payment of ${formatMoney(value)} recorded. ${balanceNote}`);
      setShowPayModal(false);
      setPayAmount('');
    } catch (err) {
      setStatus(err?.message || 'Could not record payment.');
    }
  };

  const currentBalance = Number(profile.balance) || 0;
  const monthlyRent = Number(profile.monthlyRent) || 0;
  // Paid = covered at least the monthly rent; overdue = balance still above monthly
  const paidThisMonth = monthlyRent ? currentBalance <= monthlyRent : currentBalance <= 0;
  const balanceOverdue = monthlyRent ? currentBalance > monthlyRent : currentBalance > 0;
  const dueDay = lease?.due_day || 1;
  const dueText = dueLabel(dueDay);
  const nextDue = nextDueDate(dueDay);
  const contractLength = '6 months';
  const contractEnd = contractEndInMonths(6);
  const suggestedPayment = currentBalance > 0 ? currentBalance : 0;
  const now = new Date();
  const monthLabel = now.toLocaleString('default', { month: 'long' });
  const yearLabel = now.getFullYear();

  if (!isAuthed) {
    return (
      <section className="portal-card">
        <h2>Renter Login</h2>
        <p className="status-message">Login to view your payment details.</p>
        <form className="simple-form" onSubmit={handleLogin}>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder=""
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder=""
              required
            />
          </label>
          {authError && <p className="status-message error">{authError}</p>}
          <button type="submit" className="track-btn">Sign In</button>
        </form>
      </section>
    );
  }

  if (loading && !lease) {
    return (
      <section className="portal-card">
        <h2>Loading lease...</h2>
        <p className="status-message">Pulling your current lease and payments.</p>
        <button type="button" className="outline" onClick={handleLogout}>Sign out</button>
      </section>
    );
  }

  if (!lease) {
    return (
      <section className="portal-card">
        <h2>No lease found</h2>
        <p className="status-message">If you logged in with the demo renter, a sample lease should load. Ask the landlord to create one.</p>
        <button type="button" className="outline" onClick={handleLogout}>Sign out</button>
      </section>
    );
  }

  return (
    <section className="portal-page">
      <header className="portal-header">
        <div>
          <h1>Rent & Payments Dashboard</h1>
          <p className="portfolio-subtitle">
            View your rental details, pay your balance, and update your payment method.
          </p>
        </div>
        <div className="portal-actions">
          <span className="pill pill-muted">Demo email: renter@demo.com</span>
          <button type="button" className="outline" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <div className="portal-grid portal-two-col">
        <div className="panel">
          <div className="panel-bar bar-green" />
          <div className="panel-body balance-hero">
            <div>
              <p className="tile-label">Your Current Balance</p>
              <h2 className="balance-amount">{formatMoney(currentBalance)}</h2>
              <p className="tile-label">Next payment on {dueText}</p>
              <p className="status-message">Next due: {nextDue}</p>
              <div className="portal-row">
                <button
                  type="button"
                  className="track-btn"
                  onClick={() => {
                    setPayAmount(String(suggestedPayment));
                    setSelectedMethod(profile.paymentMethod ? 'saved' : 'new');
                    setShowPayModal(true);
                  }}
                >
                  Make a Payment
                </button>
              </div>
            </div>
            <div className="balance-status">
              <span className={`pill ${paidThisMonth ? 'pill-good' : 'pill-bad'}`}>
                {paidThisMonth ? 'Payment received' : 'Payment pending'}
              </span>
              {/* Nudge the user if they still owe more than their monthly rent */}
              {balanceOverdue && <p className="status-message" style={{ color: '#b45309', margin: 0 }}>Balance overdue</p>}
              <p className="status-message">Monthly amount: {formatMoney(monthlyRent || 0)}</p>
            </div>
          </div>
          <div className="panel-body table-shell">
            <p className="listings-eyebrow">{monthLabel} {yearLabel}</p>
            <div className="balance-table">
              <div className="balance-row">
                <span>Rent</span>
                <span>{formatMoney(monthlyRent || 0)}</span>
              </div>
              <div className="balance-row total">
                <span>Total Balance</span>
                <span>{formatMoney(currentBalance || 0)}</span>
              </div>
            </div>
          </div>
          </div>

        <div className="panel">
          <div className="panel-bar bar-green" />
          <div className="panel-body">
            <div className="panel-head">
              <h3>Account Ledger</h3>
              <button type="button" className="track-btn outline" onClick={() => setShowLedger(true)}>
                View full account ledger
              </button>
            </div>
            <ul className="ledger-list">
              {paymentHistory.map((pay) => (
                <li key={pay.id} className="ledger-item">
                  <div className="ledger-main">
                    <span className={`dot ${ledgerDotClass(pay)}`} />
                    <div>
                      <p className="ledger-title">{ledgerLabel(pay)} {formatDate(pay.date)}</p>
                      <p className="ledger-note">{pay.note} • {pay.method}</p>
                    </div>
                  </div>
                  <span className="ledger-amount">{formatLedgerAmount(pay)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-bar" />
        <div className="panel-body">
          <div className="step-row">
            <div className="step active">1</div>
            <div className="step-line" />
            <div className="step">2</div>
            <div className="step-line" />
            <div className="step">3</div>
          </div>
          <h3>Payment Method</h3>
          <p className="status-message">Use a saved card or add a new one.</p>

          <div className="saved-methods">
            <label className="radio-row">
              <input
                type="radio"
                name="pay-choice"
                checked={paymentChoice === 'saved'}
                onChange={() => setPaymentChoice('saved')}
              />
              <span>Use saved payment info {profile.paymentMethod ? `(${profile.paymentMethod})` : '(none on file yet)'}</span>
            </label>
            <label className="radio-row">
              <input
                type="radio"
                name="pay-choice"
                checked={paymentChoice === 'new'}
                onChange={() => setPaymentChoice('new')}
              />
              <span>Create new payment method</span>
            </label>
          </div>

          {paymentChoice === 'new' && (
            <form className="simple-form" onSubmit={handlePaymentSave}>
              <label>
                Card number
                <input
                  type="text"
                  value={payment.cardNumber}
                  onChange={(e) => setPayment((prev) => ({ ...prev, cardNumber: e.target.value }))}
                  placeholder="1234123412341234"
                  required
                />
              </label>
              <div className="portal-row">
                <label>
                  Expiry (MM/YY)
                  <input
                    type="text"
                    value={payment.expiry}
                    onChange={(e) => setPayment((prev) => ({ ...prev, expiry: e.target.value }))}
                    placeholder="04/27"
                    required
                  />
                </label>
                <label>
                  CVV
                  <input
                    type="text"
                    value={payment.cvv}
                    onChange={(e) => setPayment((prev) => ({ ...prev, cvv: e.target.value }))}
                    placeholder="123"
                    required
                  />
                </label>
              </div>
              {paymentErrors.length > 0 && (
                <ul className="error-list">
                  {paymentErrors.map((err) => <li key={err}>{err}</li>)}
                </ul>
              )}
              <button type="submit" className="track-btn">Save card</button>
            </form>
          )}

          {profile.paymentMethod && paymentChoice === 'saved' && (
            <p className="status-message">Using saved: {profile.paymentMethod}</p>
          )}
        </div>
      </div>

      <div className="portal-grid portal-two-col">
        <div className="panel">
          <div className="panel-bar bar-purple" />
          <div className="panel-body">
            <h3>Your details</h3>
            <div className="read-only-grid">
              <div>
                <p className="tile-label">Name</p>
                <p className="tile-value small">{profile.name}</p>
              </div>
              <div>
                <p className="tile-label">Email</p>
                <p className="tile-value small">{profile.email}</p>
              </div>
              <div>
                <p className="tile-label">Address</p>
                <p className="tile-value small">{profile.address}</p>
              </div>
              <div>
                <p className="tile-label">Monthly rent</p>
                <p className="tile-value small">{formatMoney(profile.monthlyRent || 0)}</p>
              </div>
              <div>
                <p className="tile-label">Due date</p>
                <p className="tile-value small">{dueText}</p>
              </div>
              <div>
                <p className="tile-label">Contract</p>
                <p className="tile-value small">{contractLength} • Ends {contractEnd}</p>
              </div>
              <span className={`pill ${profile.paidThisMonth ? 'pill-good' : 'pill-bad'}`}>
                {profile.paidThisMonth ? 'This month is paid' : 'Payment pending'}
              </span>
            </div>
          </div>
        </div>

          <div className="panel">
            <div className="panel-bar bar-purple" />
            <div className="panel-body">
              <h3>Contact Info</h3>
              <p className="tile-label">Property Manager</p>
              <p className="tile-value small">Riverbend Property Group</p>
              <p className="tile-label">Text</p>
              <p className="tile-value small">+1 (470) 415-2220</p>
              <p className="tile-label">Call</p>
              <p className="tile-value small">(470) 555-0198</p>
            </div>
          </div>
      </div>

      {status && <p className="status-message" style={{ marginTop: 12 }}>{status}</p>}

      {/* Simple payment modal with quick amount buttons */}
      {showPayModal && (
        <div className="modal" onClick={() => setShowPayModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowPayModal(false)} aria-label="Close">X</button>
            <h3>Pay your rent</h3>
            <p className="status-message">Choose an amount and payment method.</p>

            <div className="portal-row" style={{ flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="track-btn"
                  onClick={() => setPayAmount(String(Math.max(monthlyRent, 0)))}
                >
                  Pay monthly amount ({formatMoney(monthlyRent)})
                </button>
                <button
                  type="button"
                  className="track-btn outline"
                  onClick={() => setPayAmount(String(suggestedPayment))}
                >
                  Pay full balance ({formatMoney(currentBalance)})
                </button>
                <button
                  type="button"
                  className="track-btn outline"
                  onClick={() => setPayAmount('')}
                >
                  Custom amount
                </button>
              </div>

              <label className="tile-label">
                Amount to pay
                <input
                  type="number"
                  className="no-spin"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Enter amount"
                  min="0"
                />
              </label>

              <div className="saved-methods">
                <label className="radio-row">
                  <input
                    type="radio"
                    name="pay-method"
                    checked={selectedMethod === 'saved'}
                    onChange={() => setSelectedMethod('saved')}
                    disabled={!profile.paymentMethod}
                  />
                  <span>Use saved method {profile.paymentMethod ? `(${profile.paymentMethod})` : '(none saved yet)'}</span>
                </label>
                <label className="radio-row">
                  <input
                    type="radio"
                    name="pay-method"
                    checked={selectedMethod === 'new'}
                    onChange={() => setSelectedMethod('new')}
                  />
                  <span>Use a new card (from the form above)</span>
                </label>
              </div>

              {selectedMethod === 'new' && (
                <div className="simple-form" style={{ marginTop: 8 }}>
                  <p className="status-message">Enter card details to use a new method.</p>
                  <label>
                    Card number
                    <input
                      type="text"
                      value={payment.cardNumber}
                      onChange={(e) => setPayment((prev) => ({ ...prev, cardNumber: e.target.value }))}
                      placeholder="1234123412341234"
                      required
                    />
                  </label>
                  <div className="portal-row">
                    <label>
                      Expiry (MM/YY)
                      <input
                        type="text"
                        value={payment.expiry}
                        onChange={(e) => setPayment((prev) => ({ ...prev, expiry: e.target.value }))}
                        placeholder="04/27"
                        required
                      />
                    </label>
                    <label>
                      CVV
                      <input
                        type="text"
                        value={payment.cvv}
                        onChange={(e) => setPayment((prev) => ({ ...prev, cvv: e.target.value }))}
                        placeholder="123"
                        required
                      />
                    </label>
                  </div>
                  {paymentErrors.length > 0 && (
                    <ul className="error-list">
                      {paymentErrors.map((err) => <li key={err}>{err}</li>)}
                    </ul>
                  )}
                </div>
              )}

              <button
                type="button"
                className="track-btn"
                onClick={handleConfirmPayment}
              >
                Confirm payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full ledger modal */}
      {showLedger && (
        <div className="modal" onClick={() => setShowLedger(false)}>
          <div
            className="modal-content"
            style={{
              maxWidth: 1000,
              width: '95%',
              maxHeight: '95vh',
              minHeight: '70vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close-btn" onClick={() => setShowLedger(false)} aria-label="Close">X</button>
            <h3>Full Account Ledger</h3>
            <p className="status-message">All recorded payments for your lease.</p>
            {paymentHistory.length === 0 && <p className="status-message">No payments yet.</p>}
            <ul className="ledger-list" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {paymentHistory.map((pay) => (
              <li key={pay.id} className="ledger-item">
                <div className="ledger-main">
                  <span className={`dot ${ledgerDotClass(pay)}`} />
                  <div>
                    <p className="ledger-title">{ledgerLabel(pay)} {formatDate(pay.date)}</p>
                    <p className="ledger-note">{pay.note} • {pay.method || 'Method not recorded'}</p>
                  </div>
                </div>
                <span className="ledger-amount">{formatLedgerAmount(pay)}</span>
              </li>
            ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
