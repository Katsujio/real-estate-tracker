// Simple rental routes for class demo.
// Landlords can add properties and leases.
// Renters can see their lease and post payments.
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// Small helper to enforce role on a route
const requireRole = (neededRole) => async (req, res, next) => {
  try {
    const user = await db.getUserById(req.auth.sub);
    if (!user || user.role !== neededRole) {
      return res.status(403).json({ error: `Only ${neededRole}s can do this action.` });
    }
    req.currentUser = user;
    return next();
  } catch (err) {
    console.error('Role check failed', err);
    return res.status(500).json({ error: 'Unable to verify role.' });
  }
};

// Landlord: list properties they own
router.get('/rentals/properties', requireAuth, requireRole('landlord'), async (req, res) => {
  try {
    const properties = await db.listRentalPropertiesForLandlord(req.auth.sub);
    // Attach the active lease (if any) to each property
    const withLease = await Promise.all(properties.map(async (prop) => {
      const lease = await db.getActiveLeaseForProperty(prop.id);
      return { ...prop, activeLease: lease || null };
    }));
    return res.json({ properties: withLease });
  } catch (err) {
    console.error('List rental properties error', err);
    return res.status(500).json({ error: 'Could not load properties.' });
  }
});

// Landlord: add a property
router.post('/rentals/properties', requireAuth, requireRole('landlord'), async (req, res) => {
  try {
    const { title, address, imageUrl, stage, monthlyRent } = req.body || {};
    if (!title || !address) {
      return res.status(400).json({ error: 'Title and address are required.' });
    }
    const rentValue = Number.isFinite(Number(monthlyRent)) ? Number(monthlyRent) : 0;
    const created = await db.createRentalProperty({
      landlordId: req.auth.sub,
      title: title.trim(),
      address: address.trim(),
      imageUrl,
      stage: stage || 'Reviewing',
      monthlyRent: rentValue,
    });
    return res.status(201).json({ property: created });
  } catch (err) {
    console.error('Create rental property error', err);
    return res.status(500).json({ error: 'Could not save property.' });
  }
});

// Landlord: see leases tied to their properties
router.get('/rentals/leases', requireAuth, requireRole('landlord'), async (req, res) => {
  try {
    // Only leases tied to the current landlord's properties
    const leases = await db.listLeasesForLandlord(req.auth.sub);
    return res.json({ leases });
  } catch (err) {
    console.error('List leases error', err);
    return res.status(500).json({ error: 'Could not load leases.' });
  }
});

// Landlord: create a lease for one of their properties
router.post('/rentals/leases', requireAuth, requireRole('landlord'), async (req, res) => {
  try {
    const { propertyId, renterId, startDate, occupantsCount = 1, monthlyRent, dueDay, currentBalance = 0 } = req.body || {};
    if (!propertyId || !renterId) {
      return res.status(400).json({ error: 'Property and renter are required.' });
    }
    const rentValue = Number(monthlyRent);
    if (!Number.isFinite(rentValue) || rentValue <= 0) {
      return res.status(400).json({ error: 'Monthly rent must be a positive number.' });
    }
    const dueValue = Number(dueDay);
    if (!Number.isInteger(dueValue) || dueValue < 1 || dueValue > 31) {
      return res.status(400).json({ error: 'Due day should be a day of the month (1-31).' });
    }

    const property = await db.getRentalPropertyById(propertyId);
    if (!property || property.landlord_id !== req.auth.sub) {
      return res.status(403).json({ error: 'You can only lease your own properties.' });
    }

    const lease = await db.createLease({
      propertyId,
      renterId,
      startDate,
      occupantsCount,
      monthlyRent: rentValue,
      dueDay: dueValue,
      currentBalance: Number.isFinite(Number(currentBalance)) ? Number(currentBalance) : 0,
    });
    return res.status(201).json({ lease });
  } catch (err) {
    console.error('Create lease error', err);
    return res.status(500).json({ error: 'Could not create lease.' });
  }
});

// Renter: view their latest lease
router.get('/rentals/my-lease', requireAuth, requireRole('renter'), async (req, res) => {
  try {
    const leases = await db.listLeasesForRenter(req.auth.sub);
    const lease = leases[0] || null;
    if (!lease) return res.status(404).json({ error: 'No lease found for this renter.' });
    const payments = await db.listPaymentsForLease(lease.id);
    return res.json({ lease, payments });
  } catch (err) {
    console.error('Renter lease error', err);
    return res.status(500).json({ error: 'Could not load renter lease.' });
  }
});

// Renter: pay against their lease
router.post('/rentals/payments', requireAuth, requireRole('renter'), async (req, res) => {
  try {
    const { leaseId, amount } = req.body || {};
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ error: 'Payment amount must be positive.' });
    }
    const lease = await db.getLeaseById(leaseId);
    if (!lease || lease.renter_id !== req.auth.sub) {
      return res.status(403).json({ error: 'You can only pay your own lease.' });
    }
    const payment = await db.recordPayment({ leaseId, amount: value, type: 'payment' });
    const updatedLease = await db.getLeaseById(leaseId);
    const payments = await db.listPaymentsForLease(leaseId);
    return res.status(201).json({ payment, lease: updatedLease, payments });
  } catch (err) {
    console.error('Record payment error', err);
    return res.status(500).json({ error: 'Could not record payment.' });
  }
});

// Landlord: update a lease balance directly (add charge or credit)
router.patch('/rentals/leases/:leaseId/balance', requireAuth, requireRole('landlord'), async (req, res) => {
  try {
    const { leaseId } = req.params;
    const { balance } = req.body || {};
    const value = Number(balance);
    if (!Number.isFinite(value)) {
      return res.status(400).json({ error: 'Balance must be a number.' });
    }
    const lease = await db.getLeaseById(leaseId);
    if (!lease) return res.status(404).json({ error: 'Lease not found.' });

    const property = await db.getRentalPropertyById(lease.property_id);
    if (!property || property.landlord_id !== req.auth.sub) {
      return res.status(403).json({ error: 'You can only update your own leases.' });
    }

    const updated = await db.updateLeaseBalance(leaseId, value);
    // Log the adjustment so the renter sees it in their ledger
    const entryType = value > 0 ? 'charge' : 'credit';
    await db.recordPayment({ leaseId, amount: value, type: entryType });
    return res.json({ lease: updated });
  } catch (err) {
    console.error('Update lease balance error', err);
    return res.status(500).json({ error: 'Could not update lease balance.' });
  }
});

module.exports = router;
