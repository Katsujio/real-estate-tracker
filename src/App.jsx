import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import Login from './Login';
import Portfolio from './Portfolio';
import ListingMap from './components/ListingMap';
import LandlordPortal from './LandlordPortal';
import RenterPortal from './RenterPortal';
import { useAuth } from './authContext';
import { fetchListings } from './api/repliers/fetchListings';

// Main app: listings on the home tab, tracker on the portfolio tab
// Small sample set we can fall back to if the live API is not reachable.
const FALLBACK_PROPERTIES = [
  {
    id: 'fallback-1',
    address: '123 Oak St, Savannah, GA',
    price: 250000,
    beds: 3,
    baths: 2,
    sqft: 1800,
    latitude: 32.0602,
    longitude: -81.1031,
    description: 'Cozy home near downtown with a big backyard.',
    images: [
      'https://via.placeholder.com/1200x800.png?text=House+1+Front',
      'https://via.placeholder.com/1200x800.png?text=House+1+Backyard',
      'https://via.placeholder.com/1200x800.png?text=House+1+Living+Room'
    ]
  },
  {
    id: 'fallback-2',
    address: '45 River Rd, Savannah, GA',
    price: 320000,
    beds: 4,
    baths: 3,
    sqft: 2400,
    latitude: 32.0851,
    longitude: -81.0815,
    description: 'Spacious riverfront property with modern upgrades.',
    images: [
      'https://via.placeholder.com/1200x800.png?text=House+2+Front',
      'https://via.placeholder.com/1200x800.png?text=House+2+Kitchen',
      'https://via.placeholder.com/1200x800.png?text=House+2+View'
    ]
  },
  {
    id: 'fallback-3',
    address: '89 Pine Ave, Savannah, GA',
    price: 180000,
    beds: 2,
    baths: 1,
    sqft: 1200,
    latitude: 32.0944,
    longitude: -81.1203,
    description: 'Charming starter home in a quiet neighborhood.',
    images: [
      'https://via.placeholder.com/1200x800.png?text=House+3+Front',
      'https://via.placeholder.com/1200x800.png?text=House+3+Bedroom',
      'https://via.placeholder.com/1200x800.png?text=House+3+Yard'
    ]
  }
];

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/1200x800.png?text=Listing+Preview';

export default function App() {
  // Central app state: listings, filters, auth, favorites, and modals.
  // Auth context gives us who is signed in and helpers to log in/out
  const { user, login, register, logout, booting } = useAuth();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [savedDeals, setSavedDeals] = useState([]); // track saved deals so they persist between tabs
  const [favorites, setFavorites] = useState([]); // saved properties (simple heart/save)
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [mainImage, setMainImage] = useState('');
  const [authPromptKey, setAuthPromptKey] = useState(0);
  const [authMode, setAuthMode] = useState('login');
  const [saveMessage, setSaveMessage] = useState('');
  // Tracks which listing card the mouse is over so we can show "Untrack?" text
  const [hoverListingId, setHoverListingId] = useState(null);
  // Bump this to re-trigger a small fade when listings change
  const [listVersion, setListVersion] = useState(0);
  const location = useLocation();
  const isPortfolioView = location.pathname === '/portfolio';
  const isFavoritesView = location.pathname === '/favorites';
  const isLandlordView = location.pathname === '/landlord';
  const isRenterView = location.pathname === '/renter';
  const isHomeView = location.pathname === '/';

  // On first load, try to fetch live listings; fall back to sample data if it fails
  useEffect(() => {
    let ignore = false;
    const loadListings = async () => {
      setLoading(true);
      setError('');
      try {
        const normalized = await fetchListings({ limit: 30 }, PLACEHOLDER_IMAGE);
        if (!ignore) {
          // If we got real data, use it; otherwise fall back to the baked-in samples
          if (normalized.length > 0) {
            setProperties(normalized);
            setListVersion(Date.now());
          } else {
            setError('No live listings returned yet. Showing sample data instead.');
            setProperties(FALLBACK_PROPERTIES);
            setListVersion(Date.now());
          }
        }
      } catch (err) {
        console.warn('Repliers fetch failed', err);
        if (!ignore) {
          setError('Unable to load live listings from Repliers. Showing sample data instead.');
          setProperties(FALLBACK_PROPERTIES);
          setListVersion(Date.now());
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    loadListings();
    return () => {
      ignore = true;
    };
  }, []);

  // Load tracked deals from localStorage so they stick when we switch tabs
  useEffect(() => {
    try {
      const stored = localStorage.getItem('trackedProperties');
      // Avoid parse errors crashing the view
      if (stored) setSavedDeals(JSON.parse(stored));
    } catch (err) {
      console.warn('Could not load tracked deals', err);
    }
  }, []);

  // Keep tracked deals in localStorage so users do not lose them on refresh
  useEffect(() => {
    try {
      localStorage.setItem('trackedProperties', JSON.stringify(savedDeals));
    } catch (err) {
      console.warn('Could not save tracked deals', err);
    }
  }, [savedDeals]);

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('favorites');
      if (stored) setFavorites(JSON.parse(stored));
    } catch (err) {
      console.warn('Could not load favorites', err);
    }
  }, []);

  // Persist favorites
  useEffect(() => {
    try {
      localStorage.setItem('favorites', JSON.stringify(favorites));
    } catch (err) {
      console.warn('Could not save favorites', err);
    }
  }, [favorites]);

  const requireAuth = (mode = 'login') => {
    setAuthMode(mode);
    setAuthPromptKey((prev) => prev + 1);
  };

  const handleLogin = async ({ email, password }) => {
    await login({ email, password });
    return { ok: true };
  };

  const handleRegister = async ({ email, password }) => {
    await register({ email, password });
    return { ok: true };
  };

  const handleLogout = () => {
    logout();
    // Leave tracked deals alone so the tracker still has data
  };

  // Simple filters for the list view
  const filtered = useMemo(() => {
    return properties.filter((property) => {
      const matchesSearch = property.address.toLowerCase().includes(search.toLowerCase());
      const matchesMin = minPrice ? property.price >= parseInt(minPrice, 10) : true;
      const matchesMax = maxPrice ? property.price <= parseInt(maxPrice, 10) : true;
      return matchesSearch && matchesMin && matchesMax;
    });
  }, [properties, search, minPrice, maxPrice]);

  // Open the detail modal and show the first photo
  const openProperty = (property) => {
    setSelectedProperty(property);
    setMainImage(property.images && property.images.length ? property.images[0] : PLACEHOLDER_IMAGE);
    document.body.style.overflow = 'hidden';
  };

  // When a user clicks "Track Deal", toggle it in saved deals.
  // Click once to track, click again to untrack.
  const handleTrackProperty = (property) => {
    // If it is already tracked, remove it (untrack)
    if (savedDeals.some((deal) => deal.listingId === property.id)) {
      setSavedDeals((prev) => prev.filter((deal) => deal.listingId !== property.id));
      return;
    }
    const estimatedRent = property.price ? Math.round(property.price * 0.008) : '';
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const newDeal = {
      id,
      listingId: property.id,
      address: property.address,
      purchasePrice: property.price?.toString() || '',
      expectedRent: estimatedRent ? estimatedRent.toString() : '',
      stage: 'Reviewing',
      notes: ''
    };
    setSavedDeals((prev) => [newDeal, ...prev]);
    setSaveMessage('Saved to your portfolio');
    window.clearTimeout(handleTrackProperty._timeoutId);
    handleTrackProperty._timeoutId = window.setTimeout(() => {
      setSaveMessage('');
    }, 2000);
  };

  // Toggle favorite (save/unsave)
  const handleFavorite = (property) => {
    const isFav = favorites.some((fav) => fav.id === property.id);
    if (isFav) {
      setFavorites((prev) => prev.filter((fav) => fav.id !== property.id));
    } else {
      setFavorites((prev) => [
        {
          id: property.id,
          address: property.address,
          price: property.price,
          beds: property.beds,
          baths: property.baths,
          sqft: property.sqft,
          images: property.images,
        },
        ...prev,
      ]);
    }
  };

  const closeModal = () => {
    setSelectedProperty(null);
    setMainImage('');
    document.body.style.overflow = '';
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (booting) {
    return (
      <div className="app">
        <p className="status-message">Loading account...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="title-row">
          <h1><span role="img" aria-label="House">🏠</span> Real Estate Tracker</h1>
        </div>
        <nav className="app-nav-links">
          <Link to="/" className={isHomeView ? 'active-link' : ''}>Listings</Link>
          <Link to="/favorites" className={isFavoritesView ? 'active-link' : ''}>Favorites</Link>
          <Link
            to="/portfolio"
            className={isPortfolioView ? 'active-link' : ''}
            onClick={(e) => {
              if (!user) {
                e.preventDefault();
                requireAuth('signup');
              }
            }}
          >
            Portfolio
          </Link>
          <Link to="/landlord" className={isLandlordView ? 'active-link' : ''}>My Rentals</Link>
          <Link to="/renter" className={isRenterView ? 'active-link' : ''}>Renter Login</Link>
        </nav>
      </header>

      {isFavoritesView ? (
        <div className="listing-view">
          <h2>Favorites</h2>
          <div className="property-list fade-list">
            {favorites.map((fav) => (
              <div
                key={fav.id}
                className="property-card"
                onClick={() => openProperty(fav)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') openProperty(fav); }}
              >
                <img src={fav.images?.[0] || PLACEHOLDER_IMAGE} alt={`${fav.address} thumbnail`} />
                <div className="card-body">
                  <h3>{fav.address}</h3>
                  <p className="price">${fav.price.toLocaleString()}</p>
                  <p className="meta">{fav.beds} Beds | {fav.baths} Baths</p>
                  <div className="card-actions">
                    <button
                      className={`save-btn ${favorites.some((f) => f.id === fav.id) ? 'save-btn-active' : ''}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFavorite(fav);
                      }}
                    >
                      {favorites.some((f) => f.id === fav.id) ? 'Saved' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {favorites.length === 0 && <p className="status-message">No favorites yet.</p>}
          </div>
        </div>
      ) : isPortfolioView ? (
        user ? (
          <Portfolio
            savedDeals={savedDeals}
            onSavedChange={setSavedDeals}
          />
        ) : (
          <div className="locked-card">
            <h2>Sign in to view your portfolio</h2>
            <p>Create an account to keep your pipeline and tracked deals.</p>
            <div className="locked-actions">
              <button onClick={() => requireAuth('login')}>Log in</button>
              <button className="outline" onClick={() => requireAuth('signup')}>Sign up</button>
            </div>
          </div>
        )
      ) : isLandlordView ? (
        <LandlordPortal />
      ) : isRenterView ? (
        <RenterPortal />
      ) : (
        <div className="listing-view">
          {saveMessage && (
            <div className="toast">
              {saveMessage}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {user && <span style={{ fontSize: 13 }}>Signed in as {user.email}</span>}
              {user && (
                <button className="track-btn" onClick={handleLogout} type="button">
                  Log out
                </button>
              )}
              {!user && (
                <Login
                  onLogin={handleLogin}
                  onRegister={handleRegister}
                  requestOpen={authPromptKey}
                  initialMode={authMode}
                />
              )}
            </div>
          </div>

          <div className="filters">
            <input
              aria-label="Search by address"
              type="text"
              placeholder="Search by address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <input
              aria-label="Minimum price"
              type="number"
              placeholder="Min Price"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="no-spin"
            />
            <input
              aria-label="Maximum price"
              type="number"
              placeholder="Max Price"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="no-spin"
            />
          </div>

          {/* Map shell to mirror the reference layout */}
          <div className="map-shell">
            <ListingMap
              properties={filtered}
              selectedId={selectedProperty?.id}
              onSelect={(property) => {
                openProperty(property);
              }}
              onListingsChange={(next) => {
                if (Array.isArray(next) && next.length > 0) {
                  setProperties(next);
                  setListVersion(Date.now());
                }
              }}
            />
          </div>

          {/* Listings panel with header + cards */}
          <div className="listings-section">
            <div className="listings-header">
              <div>
                <p className="listings-eyebrow">Listings in View</p>
                <h2>Explore live market inventory powered by Repliers.</h2>
                <p className="listings-sub">Hover a card to spotlight the map marker.</p>
              </div>
              <span className="listings-count">{filtered.length} results</span>
            </div>

            {loading && (
              <p className="status-message">Loading live listings from Repliers...</p>
            )}
            {error && !loading && (
              <p className="status-message error">{error}</p>
            )}

            {/* Key forces a quick fade when the list refreshes */}
            <div key={listVersion} className="property-list property-list-wide fade-list">
              {filtered.map((property) => (
                <div
                  key={property.id}
                  className="property-card property-card-wide"
                  onClick={() => openProperty(property)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') openProperty(property); }}
                >
                  <div className="property-thumb">
                    <img src={property.images[0] || PLACEHOLDER_IMAGE} alt={`${property.address} thumbnail`} />
                  </div>
                  <div className="card-body">
                    <p className="price">${property.price.toLocaleString()}</p>
                    <p className="property-title">{property.address}</p>
                    <div className="chip-row">
                      <span className="chip">{property.beds} bd</span>
                      <span className="chip">{property.baths} ba</span>
                      <span className="chip">{property.sqft ? `${property.sqft} sqft` : 'Size N/A'}</span>
                    </div>
                    <div className="card-actions">
                      <button
                        className={`save-btn ${favorites.some((fav) => fav.id === property.id) ? 'save-btn-active' : ''}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFavorite(property);
                        }}
                      >
                        {favorites.some((fav) => fav.id === property.id) ? 'Saved' : 'Save'}
                      </button>
                      {/* Show that a property is already tracked by changing the button and text */}
                      {(() => {
                        const isTracked = savedDeals.some((deal) => deal.listingId === property.id);
                        return (
                        <button
                          className={`track-btn ${isTracked ? 'track-btn-tracked' : ''}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!user) {
                              requireAuth('signup');
                              return;
                            }
                            handleTrackProperty(property);
                          }}
                          onMouseEnter={() => setHoverListingId(property.id)}
                          onMouseLeave={() => setHoverListingId((current) => (current === property.id ? null : current))}
                        >
                          {isTracked
                            ? hoverListingId === property.id
                              ? 'Untrack?'
                              : 'Tracked'
                            : 'Track Deal'}
                        </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && !loading && (
                <p>No properties found.</p>
              )}
            </div>
          </div>
        </div>
      )}
      {selectedProperty && (
        <div className="modal" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={closeModal} aria-label="Close">X</button>

            <div className="detail-image">
              <img
                src={mainImage || selectedProperty.images?.[0] || PLACEHOLDER_IMAGE}
                alt={`${selectedProperty.address} large`}
              />
            </div>

            <div className="thumbnails">
              {(selectedProperty.images || [PLACEHOLDER_IMAGE]).map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt={`thumbnail ${i + 1}`}
                  className={img === mainImage ? 'active' : ''}
                  onClick={(e) => { e.stopPropagation(); setMainImage(img); }}
                />
              ))}
            </div>

            <h2>{selectedProperty.address}</h2>
            <p className="price">${selectedProperty.price.toLocaleString()}</p>
            <p className="meta">
              {selectedProperty.beds} Beds | {selectedProperty.baths} Baths | {selectedProperty.sqft || '--'} sqft
            </p>
            <p className="description">{selectedProperty.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}
