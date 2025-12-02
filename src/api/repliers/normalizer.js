// Keeps the fields small and safe for the UI.

const CDN_PREFIX = 'https://cdn.repliers.io/';

function ensureUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  // Repliers CDN paths need the base prefix
  return `${CDN_PREFIX}${url.startsWith('/') ? url.slice(1) : url}`;
}

function firstNumber(...values) {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function uniqueStrings(list) {
  const out = [];
  const seen = new Set();
  list.forEach((item) => {
    if (typeof item === 'string' && item.trim() && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  });
  return out;
}

function pickId(row, fallback) {
  const ids = uniqueStrings([
    row.id,
    row.listingId,
    row.listing_id,
    row.mlsNumber,
    row.mls_number,
  ]);
  return ids[0] || fallback;
}

function pickImages(row) {
  const buckets = [
    row.images,
    row.photos,
    row.image_urls,
    row.media?.photos,
    row.imageInsights?.images?.map((img) => img?.image),
  ];
  const singles = [row.image_url, row.thumbnail_url, row.heroImage];
  const urls = [];
  buckets.forEach((bucket) => {
    if (Array.isArray(bucket)) {
      bucket.forEach((item) => {
        const url = ensureUrl(String(item || ''));
        if (url) urls.push(url);
      });
    }
  });
  singles.forEach((item) => {
    const url = ensureUrl(String(item || ''));
    if (url) urls.push(url);
  });
  return Array.from(new Set(urls));
}

function pickCoordinates(row) {
  const map = row.map || row.location || {};
  const lng = firstNumber(map.longitude, map.lng, row.longitude);
  const lat = firstNumber(map.latitude, map.lat, row.latitude);
  if (lng === null || lat === null) return null;
  return [lng, lat];
}

function buildAddress(row) {
  if (typeof row.address === 'string') return row.address;
  const address = typeof row.address === 'object' && row.address ? row.address : {};
  const line = firstString(row.address_line, address.streetNumber, address.streetName);
  const city = firstString(row.city, address.city);
  const state = firstString(row.state, address.state);
  const postal = firstString(address.zip, address.postalCode);
  const parts = uniqueStrings([line, city, state, postal]);
  return parts.join(', ') || 'Listing';
}

function buildDescription(row) {
  const details = row.details || {};
  const text = firstString(details.description, row.description, row.publicRemarks);
  if (!text) return null;
  // Remove common sample markers from upstream data
  return text.replace(/\*+ sample data \*+/gi, '').trim();
}

export function normalizeListing(row, fallbackId, placeholderImage) {
  const images = pickImages(row);
  const coords = pickCoordinates(row);
  return {
    id: pickId(row, fallbackId),
    address: buildAddress(row),
    price: firstNumber(
      row.listPrice,
      row.list_price,
      row.price,
      row.market_value,
      row.valuation?.currentValue,
    ) || 0,
    beds: firstNumber(row.beds, row.details?.numBedrooms, row.details?.numBedroomsPlus) || '--',
    baths:
      firstNumber(
        row.baths,
        row.details?.numBathrooms,
        row.details?.numBathroomsPlus,
        row.details?.bathrooms?.length,
      ) || '--',
    sqft:
      firstNumber(
        row.sqft,
        row.squareFeet,
        row.livingArea,
        row.details?.sqft,
        row.details?.livingArea,
        row.lot?.size,
      ) || '--',
    latitude: coords ? coords[1] : undefined,
    longitude: coords ? coords[0] : undefined,
    description: buildDescription(row) || 'No description provided.',
    images: images.length > 0 ? images : [placeholderImage],
  };
}

export function normalizeListingPayload(payload, placeholderImage) {
  const pool =
    payload?.listings ||
    payload?.items ||
    payload?.results ||
    payload?.properties ||
    payload?.data ||
    [];
  return pool
    .map((item, index) => normalizeListing(item, `listing-${index}`, placeholderImage))
    .filter(Boolean);
}
