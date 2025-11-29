// Simple client for our listings API. Keeps the fetch and normalize together.
import { normalizeListingPayload } from './normalizer';

export async function fetchListings(params = {}, placeholderImage, signal) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });

  const url = `/api/listings${search.toString() ? `?${search.toString()}` : ''}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    throw new Error(message || 'Listings fetch failed');
  }
  const payload = await res.json();
  return normalizeListingPayload(payload, placeholderImage);
}
