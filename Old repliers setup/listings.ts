//detail fetch by id (normalized).
import { apiClient } from './apiClient';
import { normalizeListing, type NormalizedListing } from '../lib/listings/normalizers';

export async function fetchListingById(listingId: string): Promise<NormalizedListing> {
  const { data } = await apiClient.get(`/api/listings/${encodeURIComponent(listingId)}`);
  return normalizeListing(data, listingId);
}
