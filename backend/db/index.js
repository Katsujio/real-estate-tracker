// Database helper for the backend.
// - Opens a SQLite file on disk.
// - Creates tables on first run.
// - Exposes helper functions for users, properties, and favorites.

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'app.sqlite');

let db; // sqlite3 Database instance

// Promisified helpers for sqlite3
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

// Start the database and create tables if they do not exist
async function init() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  db = new sqlite3.Database(DB_FILE);

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      preferences_json TEXT NOT NULL
    );
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);

  await run(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mls_number TEXT UNIQUE NOT NULL,
      board_id INTEGER,
      status TEXT,
      class TEXT,
      type TEXT,
      list_price REAL,
      original_price REAL,
      sold_price REAL,
      list_date TEXT,
      sold_date TEXT,
      updated_on TEXT,
      address_city TEXT,
      address_state TEXT,
      address_zip TEXT,
      address_street_number TEXT,
      address_street_name TEXT,
      address_unit TEXT,
      latitude REAL,
      longitude REAL,
      bedrooms INTEGER,
      bathrooms_total REAL,
      property_type TEXT,
      style TEXT,
      sqft REAL,
      photo_count INTEGER,
      raw_json TEXT
    );
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_properties_mls ON properties(mls_number);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(address_city);`);

  // user_id uses TEXT to match existing auth user ids
  await run(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      default_city TEXT,
      min_price INTEGER,
      max_price INTEGER,
      min_bedrooms INTEGER,
      max_bedrooms INTEGER,
      property_type TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS user_saved_properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      property_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );
  `);
  await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_user_prop ON user_saved_properties(user_id, property_id);`);
}

// Turn a DB row into the user object we use in code
function rowToUser(row) {
  if (!row) return null;
  let preferences = {};
  try { preferences = JSON.parse(row.preferences_json || '{}'); } catch (_) { preferences = {}; }
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    preferences,
  };
}

async function getUserByEmail(email) {
  const row = await get('SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1', [email]);
  return rowToUser(row);
}

async function getUserById(id) {
  const row = await get('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rowToUser(row);
}

async function createUser(user) {
  await run(
    `
    INSERT INTO users (id, email, password_hash, created_at, updated_at, preferences_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    [
      user.id,
      user.email,
      user.passwordHash,
      user.createdAt,
      user.updatedAt,
      JSON.stringify(user.preferences || {}),
    ],
  );
  return user;
}

async function updateUserById(id, patch) {
  const existing = await getUserById(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  await run(
    `
    UPDATE users SET
      email = ?,
      password_hash = ?,
      created_at = ?,
      updated_at = ?,
      preferences_json = ?
    WHERE id = ?
  `,
    [
      updated.email,
      updated.passwordHash,
      updated.createdAt,
      updated.updatedAt,
      JSON.stringify(updated.preferences || {}),
      updated.id,
    ],
  );
  return updated;
}

// Save a listing record (minimal fields) if it does not exist, return its row id
async function upsertPropertyFromListing(listing) {
  if (!listing || !listing.id) return null;
  const mls = String(listing.id);
  const existing = await get('SELECT * FROM properties WHERE mls_number = ? LIMIT 1', [mls]);
  if (existing) return existing.id;
  const address = listing.address || '';
  await run(
    `
    INSERT INTO properties (
      mls_number,
      list_price,
      address_city,
      address_state,
      address_zip,
      address_street_name,
      latitude,
      longitude,
      bedrooms,
      bathrooms_total,
      sqft,
      raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      mls,
      listing.price || null,
      listing.city || null,
      listing.state || null,
      listing.zip || null,
      address,
      listing.latitude || null,
      listing.longitude || null,
      listing.beds || null,
      listing.baths || null,
      listing.sqft || null,
      JSON.stringify(listing),
    ],
  );
  const created = await get('SELECT * FROM properties WHERE mls_number = ? LIMIT 1', [mls]);
  return created?.id || null;
}

// Link a user to a saved property
async function addFavorite(userId, listing) {
  const propertyId = await upsertPropertyFromListing(listing);
  if (!propertyId) return null;
  const now = new Date().toISOString();
  await run(
    `
      INSERT OR IGNORE INTO user_saved_properties (user_id, property_id, created_at)
      VALUES (?, ?, ?)
    `,
    [userId, propertyId, now],
  );
  return propertyId;
}

// Remove a favorite row
async function removeFavorite(userId, propertyId) {
  await run(
    `
      DELETE FROM user_saved_properties
      WHERE user_id = ? AND property_id = ?
    `,
    [userId, propertyId],
  );
}

// Get a user's favorites with basic listing info
async function getFavoritesForUser(userId) {
  const rows = await all(
    `
    SELECT p.*, usp.created_at
    FROM user_saved_properties usp
    JOIN properties p ON usp.property_id = p.id
    WHERE usp.user_id = ?
    ORDER BY usp.created_at DESC
  `,
    [userId],
  );
  return rows.map((row) => {
    let listing = {};
    try { listing = JSON.parse(row.raw_json || '{}'); } catch (_) { listing = {}; }
    return {
      id: listing.id || row.mls_number,
      address: listing.address || row.address_street_name || 'Saved Property',
      price: listing.price || row.list_price || 0,
      beds: listing.beds || row.bedrooms || '--',
      baths: listing.baths || row.bathrooms_total || '--',
      sqft: listing.sqft || row.sqft || '--',
      latitude: listing.latitude || row.latitude,
      longitude: listing.longitude || row.longitude,
      description: listing.description || 'Saved from map/listings.',
      images: listing.images || listing.photos || [],
    };
  });
}

module.exports = {
  init,
  run,
  get,
  all,
  getUserByEmail,
  getUserById,
  createUser,
  updateUserById,
  addFavorite,
  removeFavorite,
  getFavoritesForUser,
  paths: { DATA_DIR, DB_FILE },
};
