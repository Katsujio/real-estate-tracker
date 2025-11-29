// Small input checks to keep routes tidy.
// Helps the API reject bad data early.

function isValidEmail(email) {
  // Simple pattern: some text, @, some text, dot, some text
  return /\S+@\S+\.\S+/.test(String(email || ''));
}

function isValidPassword(password) {
  // Minimum 6 characters for the MVP
  return typeof password === 'string' && password.length >= 6;
}

// Only allow supported preference keys and coerce to a normalized object
function sanitizePreferences(prefs = {}) {
  const out = {};
  if (prefs.theme && ['light', 'dark'].includes(prefs.theme)) out.theme = prefs.theme;
  if (prefs.currency && typeof prefs.currency === 'string') out.currency = prefs.currency;
  if (prefs.language && typeof prefs.language === 'string') out.language = prefs.language;
  return out;
}

module.exports = { isValidEmail, isValidPassword, sanitizePreferences };
