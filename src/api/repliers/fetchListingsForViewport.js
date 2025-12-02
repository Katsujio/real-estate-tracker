// Post the current map viewport to our API so Repliers can filter by shape.
// Expects a map bounds object (with _ne/_sw) and a placeholder image.
import { boundsToPolygon } from '../map/boundsToPolygon';
import { normalizeListingPayload } from './normalizer';

export async function fetchListingsForViewport(bounds, placeholderImage, signal) {
  const polygon = boundsToPolygon(bounds);
  // POST map shape so backend can filter to the viewport
  const res = await fetch('/api/listings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ map: polygon }),
    signal,
  });
  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    throw new Error(message || 'Listings fetch failed');
  }
  const payload = await res.json();
  return normalizeListingPayload(payload, placeholderImage);
}
