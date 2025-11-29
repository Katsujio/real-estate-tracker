//wires Mapbox events to fetch listings and render markers.
import type mapboxgl from 'mapbox-gl';
import { fetchListingsForViewport } from './fetchListingsForViewport';
import { clearMarkers, normalizeRows, renderMarkers } from './markerHelpers';
import { debounce } from './debounce';

interface WireOptions { onListings?: (rows: any[]) => void; onError?: (error: Error) => void; onFetchStart?: () => void; }

export function wireMap(map: mapboxgl.Map, options: WireOptions = {}) {
  const update = debounce(async () => {
    try {
      options.onFetchStart?.();
      const payload = await fetchListingsForViewport(map);
      const rows = normalizeRows(payload);
      renderMarkers(map, payload);
      if (import.meta.env.DEV && rows[0]) console.log('[Repliers sample]', rows[0]);
      options.onListings?.(rows);
    } catch (error) {
      console.error('[Listings] refresh failed:', error);
      clearMarkers();
      options.onError?.(error as Error);
      options.onListings?.([]);
    }
  });

  const events: Array<'load' | 'moveend' | 'zoomend'> = ['load', 'moveend', 'zoomend'];
  events.forEach((event) => map.on(event, update));

  return () => { events.forEach((event) => map.off(event, update)); clearMarkers(); };
}
