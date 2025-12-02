# Real Estate Tracker – Simple Guide

---

## What you can do in the app

**Listings tab**

- See properties on a map and in a list.  
- Click a card to see more details and photos.  
- Click “Save” to favorite a property.  
- Click “Track Deal” to add it to your investment portfolio (requires login).

**Favorites tab**

- See the homes you saved.  
- Open them again from here.

**Portfolio tab**

- See tracked deals as simple “investments”.  
- Change basic numbers (price, stage, etc.) to play with scenarios.

**My Rentals (Landlord)**

- Log in as the demo landlord and see a unit dashboard.  
- See unit address, tenant name and email, monthly rent, and current balance.  
- See if “This month” is paid or not.  
- Add the next month’s rent as a charge with one button.  
- Add or remove extra amounts (fees, discounts, etc.).  
- All changes update the renter view too.

**Renter Login / Rent & Payments Dashboard**

- Log in as the demo renter and see your rent page.  
- See current balance, monthly amount, due date, and contract length.  
- See an Account Ledger of:
  - Rent issued by the landlord,  
  - Your payments,  
  - Any credits or discounts.  
- Make a payment:
  - Pay the full balance,  
  - Pay the regular monthly amount,  
  - Or pay a custom amount.  
- Payments and landlord changes show up in the ledger with:
  - A label (“Rent issued”, “Paid by you”, “Credited on”),  
  - A color dot (yellow, green, purple),  
  - A plus or minus sign on the amount.  

---

## Demo logins

These accounts are created automatically when the backend starts.

**Landlord**  
- Email: `landlord@demo.com`  
- Password: `password123`

**Renter**  
- Email: `renter@demo.com`  
- Password: `password123`

If the rental data ever looks broken, you can delete the file `backend/data/app.sqlite` and restart the server. The app will rebuild the database and re‑create these demo users, a demo property, and a demo lease.

---

## What you need before running

- Node.js and npm installed.  
- Optional but recommended:
  - Repliers API key (for live listings).  
  - Mapbox access token (for the map).  
- A secret string for login tokens (`JWT_SECRET`). This can be any random text for class use.

---

## One‑time setup

1. Install packages:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root (same folder as `package.json`) with values like:

   ```text
   REPLIERS_API_BASE_URL=https://api.repliers.io
   REPLIERS_API_KEY=your_repliers_key_here
   VITE_MAPBOX_TOKEN=your_mapbox_token_here
   JWT_SECRET=some_secret_here
   ```

   For local testing, you can comment out the Repliers and Mapbox keys if you just want to use the built‑in sample listings.

3. Start the app:

   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:5173  
   - Backend: http://localhost:4000  

The dev script will run both the React app and the Express server together.

---

## How the backend works (very short)

- The backend is an Express server with a SQLite database stored in `backend/data/app.sqlite`.  
- On startup, it creates tables for `users`, `rental_properties`, `leases`, and `payments`.  
- It seeds demo data for:
  - Landlord and renter users,  
  - One demo property,  
  - One demo lease and some starting values.

Main API ideas:

- `/api/listings` talks to the Repliers API (if keys are set) and returns listings to the frontend. If it fails, the frontend uses fallback sample data.  
- Auth routes handle login and register and return a JWT token.  
- Rental routes handle:
  - Getting landlord units and their active leases,  
  - Getting the renter’s current lease and all payments,  
  - Posting rent payments,  
  - Posting landlord charges and credits that change the lease balance.

---

## How the frontend works (very short)

- React + Vite app.  
- `App.jsx` holds the main tabs and passes auth data and callbacks to children.  
- `Login.jsx` is a reusable login/sign‑up popup with simple email and password checks.  
- `LandlordPortal.jsx` shows landlord tools and lets the landlord change the renter’s balance.  
- `RenterPortal.jsx` shows the Rent & Payments Dashboard and the Account Ledger.  
- `ListingMap.jsx` shows a Mapbox map; when the map moves, it asks for listings in view.  
- If live listings fail, the app shows a small set of baked‑in sample listings so the app never looks empty.

---

## If something breaks

- If the rentals or demo users look wrong:  
  - Stop the dev server.  
  - Delete `backend/data/app.sqlite`.  
  - Run `npm run dev` again.  
  - The database and demo data will be rebuilt.

- If listings do not show:  
  - Check the browser console and Network tab to see if `/api/listings` errors.  
  - Make sure `.env` exists and restart `npm run dev` after changing it.  
  - If Repliers is not working, you should still see three sample properties.

---
