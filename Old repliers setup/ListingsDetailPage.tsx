//uses cached listing or refetch by id.
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { NormalizedListing } from '../lib/listings/normalizers';
import { fetchListingById } from '../services/listings';
import { useListingsStore } from '../store/listingsStore';

function useListingResolver(listingId: string | undefined, bootstrap: NormalizedListing | null) {
  const getListing = useListingsStore((state) => state.getListing);
  const setListing = useListingsStore((state) => state.setListing);
  const [listing, setListingState] = useState<NormalizedListing | null>(() => {
    if (bootstrap) return bootstrap;
    if (listingId) {
      const stored = getListing(listingId);
      if (stored) return stored;
    }
    return null;
  });
  const [loading, setLoading] = useState(() => listing === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!listingId) { setError('Missing listing identifier.'); setLoading(false); return; }
    if (listing) return;

    let cancelled = false;
    setLoading(true);
    fetchListingById(listingId)
      .then((resolved) => { if (cancelled) return; setListingState(resolved); setError(null); })
      .catch((err: unknown) => { if (cancelled) return; setError(err instanceof Error ? err.message : 'Unable to load listing details.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [listingId, listing, setListing]);

  useEffect(() => { if (listing) setListing(listing); }, [listing, setListing]);
  return { listing, loading, error };
}

export function ListingDetailPage() {
  const navigate = useNavigate();
  const { listingId } = useParams<{ listingId: string }>();
  const location = useLocation();
  const bootstrap = (location.state as { listing?: NormalizedListing } | undefined)?.listing ?? null;
  const { listing, loading, error } = useListingResolver(listingId, bootstrap);
  // render gallery/facts...
}
