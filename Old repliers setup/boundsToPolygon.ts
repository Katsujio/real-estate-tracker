//converts viewport bounds to polygon sent to API.
import mapboxgl, { type LngLatBoundsLike } from 'mapbox-gl';

export function boundsToPolygon(bounds: LngLatBoundsLike): number[][][] {
  const lngLatBounds = mapboxgl.LngLatBounds.convert(bounds);
  const ne = lngLatBounds.getNorthEast();
  const sw = lngLatBounds.getSouthWest();
  const nw = { lng: sw.lng, lat: ne.lat };
  const se = { lng: ne.lng, lat: sw.lat };

  return [[
    [ne.lng, ne.lat],
    [nw.lng, nw.lat],
    [sw.lng, sw.lat],
    [se.lng, se.lat]
  ]];
}
