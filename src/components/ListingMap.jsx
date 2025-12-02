import React, { useMemo } from 'react';
import Map, { Marker, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { fetchListingsForViewport } from '../api/repliers/fetchListingsForViewport';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const DEFAULT_VIEW = {
  latitude: 32.0809,
  longitude: -81.0912,
  zoom: 11
};

export default function ListingMap({ properties, selectedId, onSelect, onListingsChange }) {
  // When the map moves, ask the API for listings in the new bounds
  const handleMoveEnd = async (evt) => {
    try {
      const bounds = evt.target.getBounds?.();
      if (!bounds) return;
      // Fetch listings for the visible box so the list stays in sync with the map
      const nextListings = await fetchListingsForViewport(
        bounds,
        'https://via.placeholder.com/1200x800.png?text=Listing+Preview',
      );
      if (nextListings.length && onListingsChange) {
        onListingsChange(nextListings);
      }
    } catch (err) {
      console.warn('Map refresh failed', err);
    }
  };

  // Pick a starting view based on the first listing that has coordinates
  const initialView = useMemo(() => {
    const propWithCoords = properties.find(
      (prop) => typeof prop.latitude === 'number' && typeof prop.longitude === 'number'
    );
    if (!propWithCoords) return DEFAULT_VIEW;
    return {
      latitude: propWithCoords.latitude,
      longitude: propWithCoords.longitude,
      zoom: 11
    };
  }, [properties]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="map-placeholder">
        <p>Add <code>VITE_MAPBOX_TOKEN</code> to your .env file to enable the interactive map.</p>
      </div>
    );
  }

  return (
    <div className="map-wrapper">
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialView}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: '100%', height: 380, borderRadius: 12 }}
        onMoveEnd={handleMoveEnd}
      >
        {properties
          .filter((prop) => typeof prop.latitude === 'number' && typeof prop.longitude === 'number')
          .map((prop) => (
            <Marker
              key={prop.id}
              latitude={prop.latitude}
              longitude={prop.longitude}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelect(prop);
              }}
            >
              <button
                type="button"
                className={`map-pin ${selectedId === prop.id ? 'map-pin-active' : ''}`}
                aria-label={`View ${prop.address}`}
              >
                ${Math.round((prop.price || 0) / 1000)}k
              </button>
            </Marker>
          ))}
        {selectedId && (() => {
          const highlighted = properties.find((prop) => prop.id === selectedId);
          if (!highlighted || typeof highlighted.latitude !== 'number' || typeof highlighted.longitude !== 'number') {
            return null;
          }
          return (
            <Popup
              closeOnClick={false}
              closeButton={false}
              latitude={highlighted.latitude}
              longitude={highlighted.longitude}
            >
              <p className="map-popup-text">
                {highlighted.address || 'Selected Listing'}
              </p>
            </Popup>
          );
        })()}
      </Map>
    </div>
  );
}
