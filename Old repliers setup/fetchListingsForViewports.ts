//POST current map bounds to /api/listings
import type mapboxgl from 'mapbox-gl';
import { boundsToPolygon } from './boundsToPolygon';

export async function fetchListingsForViewport(map: mapboxgl.Map, signal?: AbortSignal) {
  const polygon = boundsToPolygon(map.getBounds());

  const response = await fetch('/api/listings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ map: polygon }),
    signal
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Listings fetch failed: ${response.status} ${message.slice(0, 120)}`);
  }

  return response.json();
}
