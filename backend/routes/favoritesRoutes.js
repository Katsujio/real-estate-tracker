// Routes for saved / favorite properties.
// All routes here require a logged-in user with a valid token.
const express = require('express');
const { requireAuth } = require('../auth');
const db = require('../db');

const router = express.Router();

// Get all favorites for the logged-in user
router.get('/', requireAuth, async (req, res) => {
  try {
    // Pull normalized listings back out of the DB
    const favorites = await db.getFavoritesForUser(req.auth.sub);
    return res.json({ favorites });
  } catch (err) {
    console.error('Favorites list error', err);
    return res.status(500).json({ error: 'Unable to load favorites' });
  }
});

// Save a property as a favorite (expects a listing object in the body)
router.post('/', requireAuth, async (req, res) => {
  try {
    const listing = req.body?.listing;
    if (!listing || !listing.id) {
      return res.status(400).json({ error: 'Missing listing id' });
    }
    await db.addFavorite(req.auth.sub, listing);
    const favorites = await db.getFavoritesForUser(req.auth.sub);
    return res.status(201).json({ favorites });
  } catch (err) {
    console.error('Add favorite error', err);
    return res.status(500).json({ error: 'Unable to save favorite' });
  }
});

// Remove a favorite by listing id
router.delete('/:listingId', requireAuth, async (req, res) => {
  try {
    const listingId = req.params.listingId;
    if (!listingId) return res.status(400).json({ error: 'Missing listing id' });
    // Find the property id for this mls/listing id
    const property = await db.get(
      'SELECT id FROM properties WHERE mls_number = ? LIMIT 1',
      [listingId],
    );
    if (property) {
      await db.removeFavorite(req.auth.sub, property.id);
    }
    const favorites = await db.getFavoritesForUser(req.auth.sub);
    return res.json({ favorites });
  } catch (err) {
    console.error('Remove favorite error', err);
    return res.status(500).json({ error: 'Unable to remove favorite' });
  }
});

module.exports = router;
