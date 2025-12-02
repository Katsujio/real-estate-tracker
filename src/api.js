// Talk to the API to log a user in
export async function login(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Unable to login');
  return data;
}

// Create an account
export async function register(email, password, preferences) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, preferences })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Unable to register');
  return data;
}

// Get the current user from the API
export async function getMe(token) {
  const res = await fetch('/api/me', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Unable to fetch user');
  return data;
}

// Get saved listings for the logged in user
export async function getFavorites(token) {
  const res = await fetch('/api/favorites', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Unable to load favorites');
  return data.favorites || [];
}

// Save a listing as a favorite
export async function saveFavorite(token, listing) {
  const res = await fetch('/api/favorites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ listing })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Unable to save favorite');
  return data.favorites || [];
}

// Remove a listing from favorites
export async function deleteFavorite(token, listingId) {
  const res = await fetch(`/api/favorites/${listingId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Unable to remove favorite');
  return data.favorites || [];
}
// Small helper wrappers around auth/favorites API calls.
// Keeps fetch logic out of components.
