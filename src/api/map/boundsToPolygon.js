// Convert a map bounds object into a simple polygon array the API can use.
// Works with Mapbox bounds that expose _ne and _sw lat/lng pairs.
export function boundsToPolygon(bounds) {
  if (!bounds || !bounds._ne || !bounds._sw) return [];
  const ne = bounds._ne;
  const sw = bounds._sw;
  const nw = { lng: sw.lng, lat: ne.lat };
  const se = { lng: ne.lng, lat: sw.lat };
  return [[
    [ne.lng, ne.lat],
    [nw.lng, nw.lat],
    [sw.lng, sw.lat],
    [se.lng, se.lat],
  ]];
}
