// page that hooks Mapbox to Repliers and routes to detail.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';

import { wireMap } from '../lib/map/wireMap';
import { flyToMarker, highlightMarker } from '../lib/map/markerHelpers';
import { normalizeListing, type NormalizedListing } from '../lib/listings/normalizers';
import { useListingsStore } from '../store/listingsStore';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? '';

export function ListingsPage() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [listings, setListings] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const upsertListings = useListingsStore((state) => state.upsertListings);
  const setListingInStore = useListingsStore((state) => state.setListing);
  const navigate = useNavigate();

  useEffect(() => {
    if (!mapContainerRef.current) return () => undefined;
    if (!mapboxgl.accessToken) {
      setError('Mapbox token is missing. Please set VITE_MAPBOX_TOKEN.');
      setLoading(false);
      return () => undefined;
    }

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-98.5795, 39.8283],
      zoom: 4
    });

    mapRef.current = map;

    const unsubscribe = wireMap(map, {
      onFetchStart: () => { setLoading(true); setError(null); },
      onListings: (rows) => { setListings(rows); setHoveredId(null); setLoading(false); },
      onError: (err) => { setError(err.message); setLoading(false); }
    });

    return () => { unsubscribe(); map.remove(); };
  }, []);

  const normalizedListings = useMemo(
    () => listings.map((row, index) => normalizeListing(row, `listing-${index}`)),
    [listings]
  );

  useEffect(() => { if (normalizedListings.length > 0) upsertListings(normalizedListings); }, [normalizedListings, upsertListings]);
  useEffect(() => { if (!hoveredId) highlightMarker(null); }, [hoveredId]);

  const handleHover = (listing: NormalizedListing) => { setHoveredId(listing.id); highlightMarker(listing.id); flyToMarker(listing.id); };
  const handleLeave = () => { setHoveredId(null); highlightMarker(null); };
  const handleSelect = (listing: NormalizedListing) => {
    setListingInStore(listing);
    navigate(`/properties/${encodeURIComponent(listing.id)}`, { state: { listing } });
  };

  return (
    <div className="page listings">
      <div className="mapbox-container" ref={mapContainerRef} />
      {/* cards rendering; omitted for brevity */}
    </div>
  );
}
