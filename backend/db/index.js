// Database helper for the backend.
// - Opens a SQLite file on disk.
// - Creates tables on first run.
// - Exposes helper functions for users, properties, and favorites.

const fsp = require('fs/promises');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

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

  // Users table stores both landlords and renters for auth
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'renter',
      full_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      preferences_json TEXT NOT NULL
    );
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
  // Add optional columns for roles and names if the DB already exists
  await run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'renter'`).catch(() => {});
  await run(`ALTER TABLE users ADD COLUMN full_name TEXT`).catch(() => {});

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

  // Rental tables for landlord/renter flow
  await run(`
    CREATE TABLE IF NOT EXISTS rental_properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      landlord_id TEXT NOT NULL,
      title TEXT NOT NULL,
      address TEXT NOT NULL,
      image_url TEXT,
      stage TEXT NOT NULL DEFAULT 'Reviewing',
      monthly_rent INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (landlord_id) REFERENCES users(id)
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS leases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      renter_id TEXT NOT NULL,
      start_date TEXT,
      occupants_count INTEGER DEFAULT 1,
      monthly_rent INTEGER NOT NULL,
      due_day INTEGER NOT NULL,
      current_balance INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES rental_properties(id),
      FOREIGN KEY (renter_id) REFERENCES users(id)
    );
  `);
  // Backfill columns if the DB was created before these fields existed
  await run(`ALTER TABLE leases ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`).catch(() => {});
  await run(`ALTER TABLE leases ADD COLUMN due_day INTEGER`).catch(() => {});
  await run(`ALTER TABLE leases ADD COLUMN current_balance INTEGER NOT NULL DEFAULT 0`).catch(() => {});
  await run(`ALTER TABLE leases ADD COLUMN occupants_count INTEGER DEFAULT 1`).catch(() => {});

  await run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lease_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      type TEXT NOT NULL DEFAULT 'payment',
      FOREIGN KEY (lease_id) REFERENCES leases(id)
    );
  `);
  // Backfill paid_at if table exists without it
  await run(`ALTER TABLE payments ADD COLUMN paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`).catch(() => {});
  await run(`ALTER TABLE payments ADD COLUMN type TEXT NOT NULL DEFAULT 'payment'`).catch(() => {});
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
    role: row.role || 'renter',
    fullName: row.full_name || null,
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
    INSERT INTO users (id, email, password_hash, role, full_name, created_at, updated_at, preferences_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      user.id,
      user.email,
      user.passwordHash,
      user.role || 'renter',
      user.fullName || null,
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
      preferences_json = ?,
      role = ?,
      full_name = ?
    WHERE id = ?
  `,
    [
      updated.email,
      updated.passwordHash,
      updated.createdAt,
      updated.updatedAt,
      JSON.stringify(updated.preferences || {}),
      updated.role || 'renter',
      updated.fullName || null,
      updated.id,
    ],
  );
  return updated;
}

// Save a listing record (minimal fields) if it does not exist, return its row id
async function upsertPropertyFromListing(listing) {
  if (!listing || !listing.id) return null;
  // Use MLS/listing id as the unique key
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
  // Use INSERT OR IGNORE so double clicks do not break
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

// --- Rental helpers ---

async function ensureDemoUsers() {
  const landlordEmail = 'landlord@demo.com';
  const renterEmail = 'renter@demo.com';
  const now = new Date().toISOString();

  const landlord = await getUserByEmail(landlordEmail);
  if (!landlord) {
    const landlordUser = {
      id: uuidv4(),
      email: landlordEmail,
      passwordHash: await bcrypt.hash('password123', 10),
      role: 'landlord',
      fullName: 'Demo Landlord',
      createdAt: now,
      updatedAt: now,
      preferences: {},
    };
    await createUser(landlordUser);
  }

  const renter = await getUserByEmail(renterEmail);
  if (!renter) {
    const renterUser = {
      id: uuidv4(),
      email: renterEmail,
      passwordHash: await bcrypt.hash('password123', 10),
      role: 'renter',
      fullName: 'Demo Renter',
      createdAt: now,
      updatedAt: now,
      preferences: {},
    };
    await createUser(renterUser);
  }
}

async function createRentalProperty({ landlordId, title, address, imageUrl, stage = 'Reviewing', monthlyRent = 0 }) {
  const now = new Date().toISOString();
  await run(
    `
      INSERT INTO rental_properties (landlord_id, title, address, image_url, stage, monthly_rent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [landlordId, title, address, imageUrl || null, stage, monthlyRent, now],
  );
  const created = await get(
    `
      SELECT * FROM rental_properties
      WHERE landlord_id = ? AND title = ? AND address = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [landlordId, title, address],
  );
  return created;
}

async function listRentalPropertiesForLandlord(landlordId) {
  return all(
    `
      SELECT * FROM rental_properties
      WHERE landlord_id = ?
      ORDER BY created_at DESC
    `,
    [landlordId],
  );
}

async function getRentalPropertyById(id) {
  return get('SELECT * FROM rental_properties WHERE id = ? LIMIT 1', [id]);
}

async function createLease({
  propertyId,
  renterId,
  startDate,
  occupantsCount = 1,
  monthlyRent,
  dueDay,
  currentBalance = 0,
}) {
  const now = new Date().toISOString();
  await run(
    `
      INSERT INTO leases (property_id, renter_id, start_date, occupants_count, monthly_rent, due_day, current_balance, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `,
    [propertyId, renterId, startDate || null, occupantsCount, monthlyRent, dueDay, currentBalance, now],
  );
  const created = await get(
    `
      SELECT * FROM leases
      WHERE property_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [propertyId],
  );
  return created;
}

async function listLeasesForLandlord(landlordId) {
  return all(
    `
      SELECT l.*, rp.title as property_title, rp.address as property_address, u.email as renter_email, u.full_name as renter_name
      FROM leases l
      JOIN rental_properties rp ON rp.id = l.property_id
      LEFT JOIN users u ON u.id = l.renter_id
      WHERE rp.landlord_id = ?
      ORDER BY l.created_at DESC
    `,
    [landlordId],
  );
}

async function listLeasesForRenter(renterId) {
  return all(
    `
      SELECT l.*, rp.title as property_title, rp.address as property_address
      FROM leases l
      JOIN rental_properties rp ON rp.id = l.property_id
      WHERE l.renter_id = ?
      ORDER BY l.created_at DESC
    `,
    [renterId],
  );
}

async function getActiveLeaseForProperty(propertyId) {
  return get(
    `
      SELECT l.*, u.email as renter_email, u.full_name as renter_name
      FROM leases l
      LEFT JOIN users u ON u.id = l.renter_id
      WHERE l.property_id = ? AND l.is_active = 1
      ORDER BY l.id DESC
      LIMIT 1
    `,
    [propertyId],
  );
}

async function getLeaseById(id) {
  return get('SELECT * FROM leases WHERE id = ? LIMIT 1', [id]);
}

// Save a payment-like entry. type can be 'payment' (renter paid), 'charge' (landlord added rent), or 'credit' (landlord reduced balance).
async function recordPayment({ leaseId, amount, type = 'payment' }) {
  const now = new Date().toISOString();
  await run(
    `
      INSERT INTO payments (lease_id, amount, paid_at, type)
      VALUES (?, ?, ?, ?)
    `,
    [leaseId, amount, now, type],
  );
  // Only reduce balance for renter payments; charges/credits already change balance upstream
  if (type === 'payment') {
    await run(
      `
        UPDATE leases
        SET current_balance = current_balance - ?
        WHERE id = ?
      `,
      [amount, leaseId],
    );
  }
  return get('SELECT * FROM payments WHERE lease_id = ? ORDER BY id DESC LIMIT 1', [leaseId]);
}

async function listPaymentsForLease(leaseId) {
  return all(
    `
      SELECT * FROM payments
      WHERE lease_id = ?
      ORDER BY paid_at DESC
    `,
    [leaseId],
  );
}

// Add a delta to the current balance (positive = add owed, negative = give credit)
async function updateLeaseBalance(leaseId, delta) {
  await run(
    `
      UPDATE leases
      SET current_balance = current_balance + ?
      WHERE id = ?
    `,
    [delta, leaseId],
  );
  return get('SELECT * FROM leases WHERE id = ? LIMIT 1', [leaseId]);
}

// Seed a simple landlord/renter, property, and lease for demos
async function ensureDemoRentalData() {
  // Bootstraps a simple landlord/renter/property so the demo has data
  await ensureDemoUsers();
  const landlord = await getUserByEmail('landlord@demo.com');
  const renter = await getUserByEmail('renter@demo.com');
  if (!landlord || !renter) return;

  const existingProps = await listRentalPropertiesForLandlord(landlord.id);
  let prop = existingProps[0];
  if (!prop) {
    prop = await createRentalProperty({
      landlordId: landlord.id,
      title: 'Demo Duplex',
      address: '500 Oak St, Demo City',
      imageUrl: null,
      stage: 'Reviewing',
      monthlyRent: 1200,
    });
  }

  const activeLease = await getActiveLeaseForProperty(prop.id);
  if (!activeLease) {
    await createLease({
      propertyId: prop.id,
      renterId: renter.id,
      startDate: new Date().toISOString(),
      occupantsCount: 1,
      monthlyRent: 1200,
      dueDay: 1,
      currentBalance: 1200, // one month due
    });
  }
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
  ensureDemoUsers,
  createRentalProperty,
  listRentalPropertiesForLandlord,
  getRentalPropertyById,
  createLease,
  listLeasesForLandlord,
  listLeasesForRenter,
  getActiveLeaseForProperty,
  getLeaseById,
  recordPayment,
  listPaymentsForLease,
  updateLeaseBalance,
  ensureDemoRentalData,
  paths: { DATA_DIR, DB_FILE },
};
