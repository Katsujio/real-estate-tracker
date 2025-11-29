//create/highlight/fly-to markers and normalize API rows.
import mapboxgl from 'mapbox-gl';
import { getListingId } from '../listings/normalizers';

let markers: mapboxgl.Marker[] = [];
let markerIndex = new Map<string, mapboxgl.Marker>();
let activeMarkerId: string | null = null;
let currentMap: mapboxgl.Map | null = null;

export function clearMarkers() { markers.forEach((m) => m.remove()); markers = []; markerIndex.clear(); activeMarkerId = null; currentMap = null; }

export function normalizeRows(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.listings)) return data.listings;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.properties)) return data.properties;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

export function extractLngLat(row: any): [number, number] | null {
  if (typeof row?.longitude === 'number' && typeof row?.latitude === 'number') return [row.longitude, row.latitude];
  if (typeof row?.lng === 'number' && typeof row?.lat === 'number') return [row.lng, row.lat];
  if (typeof row?.location?.lng === 'number' && typeof row?.location?.lat === 'number') return [row.location.lng, row.location.lat];
  if (typeof row?.map?.longitude === 'number' && typeof row?.map?.latitude === 'number') return [row.map.longitude, row.map.latitude];
  if (Array.isArray(row?.coordinates) && row.coordinates.length >= 2) {
    const [lng, lat] = row.coordinates;
    if (typeof lng === 'number' && typeof lat === 'number') return [lng, lat];
  }
  return null;
}

export function renderMarkers(map: mapboxgl.Map, data: any) {
  clearMarkers();
  currentMap = map;
  const rows = normalizeRows(data);
  rows.forEach((row: any, index: number) => {
    const pair = extractLngLat(row);
    if (!pair) return;
    const marker = new mapboxgl.Marker({ color: '#2563eb' }).setLngLat(pair).addTo(map);
    marker.getElement().classList.add('listing-marker');
    markers.push(marker);
    const id = getListingId(row, `listing-${index}`);
    markerIndex.set(id, marker);
  });
}

function toggleMarkerClass(marker: mapboxgl.Marker | undefined, active: boolean) {
  if (!marker) return;
  marker.getElement().classList.toggle('is-active', active);
}

export function highlightMarker(id: string | null) {
  if (id === activeMarkerId) return;
  if (activeMarkerId) toggleMarkerClass(markerIndex.get(activeMarkerId), false);
  activeMarkerId = id;
  if (id) toggleMarkerClass(markerIndex.get(id), true);
}

export function flyToMarker(id: string | null, zoom = 12) {
  if (!id || !currentMap) return;
  const marker = markerIndex.get(id);
  if (!marker) return;
  currentMap.easeTo({ center: marker.getLngLat(), zoom: Math.max(currentMap.getZoom(), zoom), duration: 600 });
}
