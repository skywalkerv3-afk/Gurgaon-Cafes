# Gurgaon Cafe Explorer 3D

A map-first cafe discovery starter for Gurugram, built with Next.js, React, TypeScript and MapLibre GL JS.

## Included now

- Interactive MapLibre map centred on Gurugram with pan, zoom, rotate and pitch controls.
- Optional MapTiler dark vector style and 3D building extrusions when a MapTiler key is configured.
- OpenStreetMap/Overpass viewport cafe discovery for cafes, coffee shops and bakeries.
- Server-side bounds proxy with input validation, provider fallback, timeout and short revalidation.
- Marker clustering, category markers, clickable cafe details and Google Maps directions.
- Browser GPS permission, live watch updates, distance calculations and radius filters.
- Neighbourhood jump list for the requested Gurgaon areas.
- Search, category filters, sort controls, favourites (local browser storage), shortlist/compare tray.
- Responsive dark interface for mobile and desktop.
- Supabase/PostGIS schema for a future persistent curated catalogue and user favourites.

## Run locally

Requires Node.js 20+.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000.

The app works without a MapTiler key using OpenStreetMap raster tiles. For the richer dark vector style and 3D building footprints/heights, create a MapTiler key and set `NEXT_PUBLIC_MAPTILER_KEY` in `.env.local`. Restrict the browser key to your production domains in the provider dashboard.

## Data integrity and current coverage

The included live data adapter queries OpenStreetMap's Overpass API for the current visible map bounds. Results are attributed and linked to their OSM source objects. Coverage depends on community mapping completeness and Overpass availability; it is **not** a complete census of all Gurgaon cafes.

OpenStreetMap does not reliably supply Google ratings, review counts, business photos, per-person prices, Instagram accounts or structured open-now status. The UI deliberately labels these fields unavailable instead of inventing them. OSM opening-hours tags are displayed as source text, not interpreted as a guaranteed current open/closed state.

For a comprehensive commercial listing layer, connect a licensed provider such as Google Places through a server-only route. Implement its current attribution, photo, caching, retention and display requirements before storing or redisplaying provider content. Do not scrape Google Maps. Keep restricted credentials server-side. Google Places content has provider-specific storage restrictions; review the current terms before persistence. OSM data is under the ODbL and requires attribution.

## Production checklist

1. Configure a vector map provider and domain-restricted browser token.
2. Choose and contract a licensed business-data provider; implement provider-specific attribution and cache policies.
3. Add Supabase project credentials and apply `supabase/schema.sql` after enabling PostGIS.
4. Add authenticated server-side sync jobs, stable provider IDs, deduplication and audit timestamps.
5. Add a proper hours parser and tests before enabling Open Now.
6. Add provider-backed photo gallery and ratings; do not infer missing values.
7. Add user authentication and RLS policies for favourites.
8. Add rate limiting, monitoring, provider quotas, consent/privacy copy and a retention policy.
9. Deploy on Vercel or another Next.js host with environment variables configured.

## API

`GET /api/cafes?south=...&west=...&north=...&east=...`

Returns cafe-like OSM objects within the requested bounds, with source identifiers and Google Maps search links.

## Known prototype boundaries

- The map is real and interactive; 3D buildings are enabled with MapTiler vector tiles. The no-key fallback is a 2D OSM raster map with map pitch controls.
- The neighbourhood list is a navigation shortcut, not an assertion that every point has verified sector boundaries.
- Rating and review-based filtering is intentionally not simulated until a legitimate business provider is connected.
- Compare currently supports a shortlist tray; a richer side-by-side comparison table is a straightforward next iteration.
- Favourites persist in the current browser only until authentication/database sync is configured.
