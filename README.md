# Real Estate Tracker (Plain English)

**What this is:**  
A simple web app where you can see houses on a map, save the ones you like, and track them in a little portfolio.

**What you need before running:**
- Node.js and npm installed.
- Two keys:
  - Repliers API key (for live listings).
  - Mapbox token (for the map).
- A secret for login tokens (`JWT_SECRET`).

**Set up (one-time):**
1. Run `npm install`.
2. Make a file named `.env` in the project root with:
   ```
   REPLIERS_API_BASE_URL=https://api.repliers.io
   REPLIERS_API_KEY=your_repliers_key_here
   VITE_MAPBOX_TOKEN=your_mapbox_token_here
   JWT_SECRET=some_secret_here
   ```
3. Start everything: `npm run dev`  
   - Frontend is at `http://localhost:5173`  
   - Backend listens on `http://localhost:4000`

**Using the app:**
- Go to the Listings page.
- Move/zoom the map: the app calls `/api/listings` and shows properties in view.
- Filter by address or price if you want.
- Click “Track Deal” to save/unsave a listing (needs login).
- Go to the Portfolio tab to see your tracked properties, edit numbers, and view simple stats.
- If Repliers is down or the key is wrong, you’ll see a few sample listings instead.

**How the backend works (short):**
- `/api/listings` → proxies to Repliers. Supports GET (filters) and POST (map polygon).
- Auth routes:
  - `POST /api/auth/register` `{ email, password }`
  - `POST /api/auth/login` `{ email, password }`
  - `GET /api/me` (needs JWT)
- Favorites (needs JWT):
  - `GET /api/favorites`
  - `POST /api/favorites` `{ listing }`
  - `DELETE /api/favorites/:listingId`
- Data is stored in a local SQLite file (`data/app.sqlite`).

**How the frontend works (short):**
- `ListingMap` uses Mapbox. When the map moves, it calls `/api/listings` with the current bounds.
- `fetchListings` and `fetchListingsForViewport` live in `src/api/repliers/`.
- Listings are normalized so cards always show price, address, beds/baths, etc.
- “Track Deal” toggles a saved state for each listing (shows “Untrack?” on hover).

**If you get stuck:**
- Check the browser console and Network tab (see if `/api/listings` is failing).
- Make sure `.env` is present and you restarted `npm run dev` after adding keys.
- If nothing shows, the fallback sample listings should appear so the page isn’t blank.
