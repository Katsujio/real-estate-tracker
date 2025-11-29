//normalize Repliers response into a consistent shape (id, images, beds/baths, etc.).
const REPLIERS_CDN = 'https://cdn.repliers.io/';

function ensureAbsoluteUrl(url: string): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${REPLIERS_CDN}${url.startsWith('/') ? url.slice(1) : url}`;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickFirstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const coerced = coerceNumber(value);
    if (coerced !== null) return coerced;
  }
  return null;
}

function pickFirstString(...values: unknown[]): string | null {
  for (const value of values) if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  values.forEach((value) => { if (typeof value === 'string' && value.trim().length > 0) set.add(value.trim()); });
  return Array.from(set);
}

export function getListingId(row: Record<string, any>, fallback: string): string {
  const candidates = uniqueStrings([
    row.id, row.listingId, row.listing_id, row.mlsNumber, row.mls_number, row.mls_id, row.property_id, row.slug,
  ]);
  return candidates[0] ?? fallback;
}

export function extractImages(row: Record<string, any>): string[] {
  const collections: Array<unknown> = [
    row.images, row.photos, row.image_urls, row.photo_urls, row.media?.photos, row.media?.images,
    row.imageInsights?.images?.map((item: any) => item?.image),
  ];
  const singles = [row.image_url, row.thumbnail_url, row.image, row.thumbnail, row.heroImage];

  const urls: string[] = [];
  for (const collection of collections) {
    if (Array.isArray(collection)) {
      for (const item of collection) {
        const url = ensureAbsoluteUrl(String(item ?? ''));
        if (url) urls.push(url);
      }
    }
  }
  for (const single of singles) {
    const url = ensureAbsoluteUrl(String(single ?? ''));
    if (url) urls.push(url);
  }
  return Array.from(new Set(urls));
}

export function extractBeds(row: Record<string, any>): number | null {
  const details = row.details ?? {};
  return pickFirstNumber(row.beds, details.numBedrooms, details.numBedroomsPlus);
}

export function extractBaths(row: Record<string, any>): number | null {
  const details = row.details ?? {};
  return pickFirstNumber(row.baths, row.baths_total, details.numBathrooms, details.numBathroomsPlus, details.bathrooms?.length);
}

export function extractSqft(row: Record<string, any>): number | null {
  const details = row.details ?? {};
  const lot = row.lot ?? {};
  return pickFirstNumber(row.sqft, row.squareFeet, row.livingArea, details.sqft, details.livingArea, lot.size);
}

export function extractYearBuilt(row: Record<string, any>): number | null {
  const details = row.details ?? {};
  return pickFirstNumber(details.yearBuilt, row.year_built, row.yearBuilt);
}

export function extractStatus(row: Record<string, any>): string | null {
  return pickFirstString(row.standardStatus, row.status, row.lastStatus);
}

export function extractListDate(row: Record<string, any>): Date | null {
  const raw = pickFirstString(row.listDate, row.timestamps?.listDate);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function extractDescription(row: Record<string, any>): string | null {
  const details = row.details ?? {};
  return pickFirstString(details.description, row.description, row.publicRemarks);
}

export function extractCoordinates(row: Record<string, any>): [number, number] | null {
  const map = row.map ?? row.location ?? {};
  const lng = pickFirstNumber(map.longitude, map.lng, row.longitude);
  const lat = pickFirstNumber(map.latitude, map.lat, row.latitude);
  return lng !== null && lat !== null ? [lng, lat] : null;
}

export interface NormalizedListing {
  id: string;
  title: string;
  subtitle: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  yearBuilt: number | null;
  status: string | null;
  listedAt: Date | null;
  description: string | null;
  images: string[];
  coordinates: [number, number] | null;
  raw: Record<string, any>;
}

export function buildPrimaryLine(row: Record<string, any>): string {
  if (typeof row.address_line === 'string') return row.address_line;
  if (typeof row.formatted_address === 'string') return row.formatted_address;
  if (typeof row.property_address === 'string') return row.property_address;
  if (typeof row.address === 'string') return row.address;

  const address = row.address && typeof row.address === 'object' ? row.address : {};
  const parts = uniqueStrings([address.streetNumber ?? address.street_number, address.streetName ?? address.street_name, address.streetSuffix ?? address.street_suffix]);
  if (parts.length > 0) return parts.join(' ');

  if (row.location?.address) return row.location.address;
  return 'Listing';
}

export function buildSecondaryLine(row: Record<string, any>): string | null {
  const address = row.address && typeof row.address === 'object' ? row.address : {};
  const city = pickFirstString(row.city, address.city, row.location?.city);
  const state = pickFirstString(row.state, address.state, row.location?.state);
  const postal = pickFirstString(row.postal_code, address.zip, address.postalCode, row.location?.postalCode);
  const parts = uniqueStrings([city, state, postal]);
  return parts.length === 0 ? null : parts.join(', ');
}

export function extractPrice(row: Record<string, any>): number | null {
  return pickFirstNumber(row.listPrice, row.list_price, row.price, row.market_value, row.marketValue, row.valuation?.currentValue);
}

export function normalizeListing(row: Record<string, any>, fallbackId: string): NormalizedListing {
  return {
    id: getListingId(row, fallbackId),
    title: buildPrimaryLine(row),
    subtitle: buildSecondaryLine(row),
    price: extractPrice(row),
    beds: extractBeds(row),
    baths: extractBaths(row),
    sqft: extractSqft(row),
    yearBuilt: extractYearBuilt(row),
    status: extractStatus(row),
    listedAt: extractListDate(row),
    description: extractDescription(row),
    images: extractImages(row),
    coordinates: extractCoordinates(row),
    raw: row,
  };
}
