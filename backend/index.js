// Main server for the project.
// Handles:
// - User auth (register, login, current user).
// - User preferences.
// - Listings proxy to the Repliers API.
// - Favorites for logged-in users.
// Uses SQLite as the database (see backend/db/index.js).

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Local modules: SQLite DB helpers, JWT helpers, and validators
const db = require('./db');
const { createToken, requireAuth } = require('./auth');
const { isValidEmail, isValidPassword, sanitizePreferences } = require('./utils/validators');
const propertiesRoutes = require('./routes/propertiesRoutes');
const favoritesRoutes = require('./routes/favoritesRoutes');

// Basic settings for dev
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'; // allow any origin in dev

const app = express();

// Allow cross-origin requests and read JSON bodies
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Quick check to see if the server is alive
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Create an account
// Body: { email, password, preferences? }
const registerHandler = async (req, res) => {
  try {
    const { email, password, preferences } = req.body || {};

    // Check the inputs
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email.' });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Do not allow the same email twice
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // Hash the password so we never store the plain text
    const passwordHash = await bcrypt.hash(password, 10);

    // Build the user record we will save
    const now = new Date().toISOString();
    const user = {
      id: uuidv4(),
      email: String(email).toLowerCase(),
      passwordHash,
      createdAt: now,
      updatedAt: now,
      preferences: {
        theme: 'light',
        currency: 'USD',
        ...sanitizePreferences(preferences),
      },
    };

    // Save the user in the DB
    await db.createUser(user);

    // Make a JWT so the user can stay logged in
    const token = createToken(user);

    // Send back the safe fields
    const publicUser = { id: user.id, email: user.email, createdAt: user.createdAt, updatedAt: user.updatedAt, preferences: user.preferences };
    return res.status(201).json({ token, user: publicUser });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};
app.post('/auth/register', registerHandler);
app.post('/api/auth/register', registerHandler);

// Login with email and password
const loginHandler = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!isValidEmail(email) || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const user = await db.getUserByEmail(email);
    if (!user) {
      // Do not leak which emails exist
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = createToken(user);
    const publicUser = { id: user.id, email: user.email, createdAt: user.createdAt, updatedAt: user.updatedAt, preferences: user.preferences };
    return res.json({ token, user: publicUser });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};
app.post('/auth/login', loginHandler);
app.post('/api/auth/login', loginHandler);

// Get the current user (needs a valid token)
const meHandler = async (req, res) => {
  try {
    const userId = req.auth.sub; // set by requireAuth()
    const user = await db.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const publicUser = { id: user.id, email: user.email, createdAt: user.createdAt, updatedAt: user.updatedAt, preferences: user.preferences };
    return res.json(publicUser);
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};
app.get('/me', requireAuth, meHandler);
app.get('/api/me', requireAuth, meHandler);

// Update the current user's preferences
app.put('/me/preferences', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.sub;
    const incoming = req.body?.preferences || {};
    const allowed = sanitizePreferences(incoming);

    // Load the user and merge new preferences
    const user = await db.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const updatedAt = new Date().toISOString();
    const updated = await db.updateUserById(userId, {
      updatedAt,
      preferences: { ...user.preferences, ...allowed },
    });

    const publicUser = { id: updated.id, email: updated.email, createdAt: updated.createdAt, updatedAt: updated.updatedAt, preferences: updated.preferences };
    return res.json(publicUser);
  } catch (err) {
    console.error('Update preferences error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Mount feature routes (listings proxy)
app.use('/api/properties', propertiesRoutes);
app.use('/api/listings', propertiesRoutes);
app.use('/api/favorites', favoritesRoutes);

// Start the server after the DB is ready
db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API server listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
