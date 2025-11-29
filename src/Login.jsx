// File location: \real-estate-tracker\src\assets\Login.jsx


import React, { useEffect, useState } from 'react';
// Login or sign-up pop-up. Email + password (6+). People can still browse.


// sizes, colors, spacing
const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    padding: 20,
    transition: 'opacity 200ms ease',
    opacity: 0
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    background: '#fff',
    borderRadius: 12,
    padding: 18,
    outline: '2px solid var(--accent)',
    boxShadow: '0 8px 30px rgba(33,33,33,0.18)',
    transform: 'translateY(-12px)',
    opacity: 0,
    transition: 'transform 220ms ease-out, opacity 220ms ease-out'
  },
  header: {
    margin: 0,
    marginBottom: 8,
    fontSize: 20
  },
  note: {
    marginTop: 4,
    marginBottom: 12,
    color: '#555',
    fontSize: 13
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  label: {
    fontSize: 13,
    color: '#333'
  },
  input: {
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #ddd'
  },
  error: {
    color: '#b00020',
    fontSize: 12,
    marginTop: 4
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'flex-end'
  },
  loginBtn: {
    padding: '8px 12px',
    borderRadius: 6,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer'
  },
  outlineBtn: {
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--accent)',
    background: '#fff',
    color: 'var(--accent)',
    cursor: 'pointer'
  },
  launcher: {
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--accent)',
    background: '#fff',
    color: 'var(--accent)',
    cursor: 'pointer'
  }
};

// Quick email check
function isValidEmail(value) {
  return /\S+@\S+\.\S+/.test(value);
}

// Component handles open/close, validation, and submit 
export default function Login({
  onLogin,
  onRegister,
  requestOpen = 0,
  initialMode = 'login'
}) {

  // Local state: open/animateIn/email/password/error/touched 
  const [open, setOpen] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [mode, setMode] = useState(initialMode); // login or signup
  const [loading, setLoading] = useState(false);

  // Open the modal if the parent bumps requestOpen
  useEffect(() => {
    if (requestOpen > 0) {
      setOpen(true);
      setMode(initialMode);
    }
  }, [requestOpen, initialMode]);

// When open: start animation, stop page scroll, Escape closes
  useEffect(() => {
    if (!open) return;
    setAnimateIn(true);
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow || '';
      setAnimateIn(false);
    };
  }, [open]);

// Simple checks for email and password
  const emailError = touched.email && !isValidEmail(email) ? 'Enter a valid email' : '';
  const passwordError = touched.password && password.length < 6 ? 'Password must be at least 6 characters' : '';
  const hasError = Boolean(emailError || passwordError || error);

// Open/close
  const openModal = () => setOpen(true);
  const closeModal = () => setOpen(false);

  // Submit: need an email + 6+ char password, then proceed
  const submit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setError('');
    if (!isValidEmail(email)) return;
    if (password.length < 6) return;
    const action = mode === 'signup' ? onRegister : onLogin;
    if (!action) return;
    try {
      setLoading(true);
      const result = await action({ email, password, mode });
      if (result && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
    setError('');
  };

  return (
    <>
      {/* Button that opens the login box */}
      <button style={styles.launcher} onClick={openModal} aria-haspopup="dialog" aria-expanded={open}>
        Log In / Sign Up
      </button>

      {/* Dark background and the white box. It fades/slides in. */}
      {open && (
        <div style={{ ...styles.overlay, opacity: animateIn ? 1 : 0 }} onClick={closeModal}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
            style={{
              ...styles.modal,
              transform: animateIn ? 'translateY(0)' : 'translateY(-12px)',
              opacity: animateIn ? 1 : 0
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title and a simple note */}
            <h2 id="login-title" style={styles.header}>{mode === 'login' ? 'Log In' : 'Create Account'}</h2>
            <p style={styles.note}>
              {mode === 'login'
                ? 'Log in to sync your saved listings and unlock live property data.'
                : 'Sign up so you can save homes and keep your portfolio.'}
            </p>

            <form onSubmit={submit} style={styles.form} noValidate>
              {/* Email field */}
              <label style={styles.label} htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                style={styles.input}
                placeholder="you@example.com"
                required
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'email-error' : undefined}
              />
              {emailError && <div id="email-error" style={styles.error}>{emailError}</div>}

              {/* Password (at least 6) */}
              <label style={styles.label} htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                style={styles.input}
                placeholder="At least 6 characters"
                minLength={6}
                required
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? 'password-error' : undefined}
              />
              {passwordError && <div id="password-error" style={styles.error}>{passwordError}</div>}
              {error && <div style={styles.error}>{error}</div>}

              {/* Buttons: Cancel and Continue */}
              <div style={styles.actions}>
                <button type="button" style={styles.outlineBtn} onClick={switchMode}>
                  {mode === 'login' ? 'Need an account?' : 'Have an account?'}
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" style={styles.outlineBtn} onClick={closeModal}>Cancel</button>
                  <button
                    type="submit"
                    style={styles.loginBtn}
                    disabled={!email || password.length < 6 || hasError || loading}
                  >
                    {loading ? 'Working...' : mode === 'login' ? 'Log In' : 'Sign Up'}
                  </button>
                </div>
              </div>
              {error && <div style={styles.error}>{error}</div>}
            </form>
            {/* People can still browse without logging in */}
          </div>
        </div>
      )}
    </>
  );
}
