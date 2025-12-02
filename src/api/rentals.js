// Simple rental API helpers

export async function getRenterLease(token) {
  const res = await fetch('/api/rentals/my-lease', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Unable to load lease');
  return data; // { lease, payments }
}

export async function payLease(token, leaseId, amount) {
  const res = await fetch('/api/rentals/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ leaseId, amount }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Unable to record payment');
  return data; // { payment, lease, payments }
}

export async function getLandlordProperties(token) {
  const res = await fetch('/api/rentals/properties', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Unable to load properties');
  return data.properties || [];
}

export async function getLandlordLeases(token) {
  const res = await fetch('/api/rentals/leases', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Unable to load leases');
  return data.leases || [];
}

export async function updateLeaseBalance(token, leaseId, balance) {
  const res = await fetch(`/api/rentals/leases/${leaseId}/balance`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ balance }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Unable to update balance');
  return data.lease;
}
// Tiny helper client for rental endpoints.
// Keeps fetch calls in one place so portals stay readable.
