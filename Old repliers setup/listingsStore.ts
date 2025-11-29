// zustand cache so list/detail share fetched listings.
import { create } from 'zustand';
import type { NormalizedListing } from '../lib/listings/normalizers';

interface ListingsState {
  listings: Record<string, NormalizedListing>;
  upsertListings: (items: NormalizedListing[]) => void;
  setListing: (listing: NormalizedListing) => void;
  getListing: (id: string) => NormalizedListing | undefined;
  clear: () => void;
}

export const useListingsStore = create<ListingsState>((set, get) => ({
  listings: {},
  upsertListings: (items) =>
    set((state) => {
      if (!items.length) return state;
      const next = { ...state.listings };
      for (const item of items) next[item.id] = item;
      return { listings: next };
    }),
  setListing: (listing) =>
    set((state) => ({ listings: { ...state.listings, [listing.id]: listing } })),
  getListing: (id) => get().listings[id],
  clear: () => set({ listings: {} })
}));
