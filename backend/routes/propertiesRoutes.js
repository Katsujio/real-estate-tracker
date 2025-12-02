// Routes for listing data.
// These endpoints call the Repliers listings API
// so the frontend can show market data.
const express = require('express');
require('dotenv').config();

const router = express.Router();

const BASE_URL = process.env.REPLIERS_API_BASE_URL || 'https://api.repliers.io';
const API_KEY = process.env.REPLIERS_API_KEY;

const buildUrl = (path, query = {}) => {
  // Build a URL with any non-empty params
  const url = new URL(path, BASE_URL);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  // Some Repliers examples include the key as a query param.
  if (API_KEY && !url.searchParams.has('key')) {
    url.searchParams.set('key', API_KEY);
  }
  return url;
};

async function proxyRepliers(path, query, body, method, res) {
  if (!API_KEY) {
    return res.status(500).json({ message: 'Missing REPLIERS_API_KEY' });
  }
  try {
    const url = buildUrl(path, query);
    const upstream = await fetch(url, {
      method,
      headers: {
        // Send both header names to match different Repliers examples.
        'x-api-key': API_KEY,
        'REPLIERS-API-KEY': API_KEY,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ message: text || 'Repliers request failed' });
    }
    const data = await upstream.json();
    return res.json(data);
  } catch (err) {
    console.error('Repliers API error:', err);
    return res.status(500).json({ message: 'Unable to reach Repliers API' });
  }
}

// List or search for properties
router.get('/', (req, res) => {
  const { limit = 20, offset = 0, city, state, minPrice, maxPrice } = req.query;
  return proxyRepliers('/listings', { limit, offset, city, state, minPrice, maxPrice }, null, 'GET', res);
});

// List or search for properties using a map polygon (from the map viewport)
router.post('/', (req, res) => {
  // Body can contain { map: [...] } from the map bounds.
  const body = req.body || {};
  const { limit = 20, offset = 0, city, state, minPrice, maxPrice } = req.query;
  return proxyRepliers('/listings', { limit, offset, city, state, minPrice, maxPrice }, body, 'POST', res);
});

// Details for one property
router.get('/:id', (req, res) => {
  return proxyRepliers(`/listings/${req.params.id}`, {}, null, 'GET', res);
});

module.exports = router;
