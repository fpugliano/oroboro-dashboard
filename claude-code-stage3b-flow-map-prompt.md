This is a major UX overhaul of anchor.html's flow, map, and armed screen. The attached `anchor-flow-v2-mockup.jsx` is the authoritative visual reference — match its layout, flow, and interaction patterns, translating from React into the existing vanilla JS/DOM architecture.

Do NOT touch: Stage 1 reliability code (fetchAnchorState, _applySkAnchorState, renderAnchorBanner), Stage 2 navigation/layout code (topBar Dashboard link, square dashboard button), the anchor-api proxy files (anchor-api.js, anchor-api-config.json, anchor-api.service), or oroboro.html.

## Architecture context you need to know

- The anchor-api proxy runs on port 3001 and handles authenticated writes to Signal K.
- The `signalk-anchoralarm-plugin` (Scott Bender's) is enabled and is the thing that registers the PUT handler for `navigation.anchor.*`. It MUST stay enabled or writes break (we tested: disabling it → HTTP 405 on PUT).
- The plugin also accepts PUT to `navigation.anchor.maxRadius` (value in meters) — this is how we tell the plugin what radius to use for its own server-side alarm check.
- The proxy currently has two endpoints: POST /api/anchor/set (writes position) and POST /api/anchor/raise (clears position). You will need to ADD a third endpoint to the proxy: POST /api/anchor/radius — body: `{"value": N}` — which PUTs to `http://localhost:3000/signalk/v1/api/vessels/self/navigation/anchor/maxRadius` with the stored JWT.

## The redesigned flow

### Step 1: Dashboard → tap Anchor button
- If no anchor set (from Stage 1's fetchAnchorState): open the **zone configuration screen** directly. No intermediate screen, no two-button choice.
- If anchor IS set: open the **armed/monitoring screen**.

### Step 2: Zone configuration screen ("Set Allowed Radius")

**Top bar:** "‹ Back" on left (returns to dashboard if anchor not set, or armed screen if adjusting), "← Dashboard" on right.

**First thing visible in BOTH Normal and Advanced tabs: Anchor Placement**
A compact card showing:
- A live compass dial (small SVG circle with N/E/S/W labels) with a line from the boat (center) to the anchor (at the configured distance + bearing), updating in real time as sliders move.
- Slider: "Distance to anchor" (5–80m)
- Slider: "Bearing to anchor" (0–359°)
This tells the app where the anchor actually is relative to the boat's current GPS position. The anchor's absolute GPS position is then calculated as: anchor_lat = boat_lat + distance * cos(bearing), anchor_lon = boat_lon + distance * sin(bearing) (with proper geodesic math, not naive arithmetic).

**Below the placement card: Normal / Advanced toggle**

**Normal tab:**
- A Leaflet map (see Map Implementation below) centered on the boat's current position, showing:
  - The anchor point (amber marker)
  - A circle overlay at the configured radius, updating IN REAL TIME as the slider moves — not on release, during the drag.
  - OpenStreetMap tile background so you see real coastline/geography.
- Slider: "Allowed Radius" (10–100m)
- NO quick-pick buttons (20/30/50/75 are removed).

**Advanced tab:**
- Same Leaflet map, showing:
  - The anchor point (amber marker)
  - The curved sector shape (between small and big distance circles, within start/end angle) updating live as any slider moves.
  - Draggable "S" and "E" angle handles on the map would be ideal but slider-driven positioning is acceptable if true Leaflet marker drag is too complex.
- Sliders (NOT typed number inputs) for all four values:
  - Small distance (inner radius): 5–95m
  - Big distance (outer radius): 10–150m
  - Start angle: 0–359°
  - End angle: 0–359°
- Validation: if small ≥ big, show red slider values, inline error message, and disable the Set Anchor button.

**Bottom of both tabs:** Single button: **"⚓ Set Anchor"** (or **"⚓ Update Anchor"** if anchor is already set and user is adjusting).

This button does THREE things in this exact order:
1. Writes the radius to Signal K via the proxy: `POST http://192.168.1.238:3001/api/anchor/radius` with `{"value": radius}` (for Normal mode) or `{"value": big}` (for Advanced mode — the plugin uses maxRadius as its alarm boundary, so use the outer/big distance).
2. Waits for confirmation (`{"ok":true}`).
3. Then writes the anchor position via the proxy: `POST http://192.168.1.238:3001/api/anchor/set` with the calculated lat/lon from the placement card.
4. On success, transitions to the armed screen.
5. On failure at any step, shows a visible red error toast (not a silent failure) and does NOT transition.

This ordering (radius BEFORE position) is critical — it ensures the server-side plugin already knows the correct alarm boundary before it sees a new anchor position, preventing the false "dragging" alarm that was happening before.

### Step 3: Armed/monitoring screen

**Status banner:** Green "ANCHOR SET — synced from Signal K" (existing Stage 1 banner, unchanged). The subtitle should show the current configuration: "Normal: 30m radius" or "Advanced: 40–55m, 345°–20°".

**Leaflet map (same tile provider, same style) showing:**
- Anchor position (amber marker)
- Boat's current GPS position (white marker, updating live)
- The configured allowed zone shape overlaid at correct geographic scale:
  - Normal: a Leaflet circle overlay at the configured radius
  - Advanced: a Leaflet polygon approximating the curved sector (32-point arc interpolation, same geometry as the mockup)
- Swing track trail: the boat's historical position trace since the anchor was set. Use the `@signalk/tracks-plugin` data if available (GET /signalk/v1/api/vessels/self/navigation/track), or accumulate positions client-side from the poll loop if the tracks plugin isn't active. Color the trail so newer positions are brighter/more visible than older ones.
- AIS targets: query `vessels.*` from Signal K (excluding `vessels.self`), plot each vessel with a `navigation.position` as an amber triangle marker with a label (vessel name from `name` field, or MMSI as fallback) and distance from own vessel. Update on each poll cycle.

**Stats row:** Distance to anchor, Max swing, AIS nearby count.

**Buttons:**
- "Adjust Distance" → returns to zone configuration screen, pre-filled with current values, on whichever tab (Normal/Advanced) was used when the anchor was set. Button reads "Update Anchor" instead of "Set Anchor" in this context.
- "Raise Anchor" → calls `POST /api/anchor/raise`, confirms success, returns to dashboard.

## Map implementation (Leaflet + OpenStreetMap)

Use Leaflet loaded from CDN (no npm install needed):
```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
```

Tile layer: `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with attribution `© OpenStreetMap contributors`.

The map should:
- Center on the anchor position (or boat position if no anchor yet) at a zoom level that fits the configured radius comfortably.
- Be interactive (pan/zoom enabled) but not so sensitive that accidental touches during slider use cause map movement — consider disabling scroll-zoom and using pinch-zoom only on mobile.
- Use a dark-styled tile if available (e.g. CartoDB dark matter: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`) to match the dashboard's dark theme. Fall back to standard OSM tiles if the dark tiles don't load.

Create the map once per screen, then update overlays (circle, sector, markers, trail) by modifying existing Leaflet layers rather than destroying and recreating the map on every slider change — this is critical for performance, especially on the Pi.

## Proxy addition: /api/anchor/radius endpoint

Add to anchor-api.js:
- `POST /api/anchor/radius` — body: `{"value": N}` where N is the radius in meters
- Internally PUTs to `http://localhost:${config.signalkPort}/signalk/v1/api/vessels/self/navigation/anchor/maxRadius` with body `{"value": N}` and the stored JWT
- Returns `{"ok":true}` or `{"ok":false,"error":"..."}` same pattern as existing endpoints

## Alarm logic

Keep the existing alarm logic from the previous Stage 3 pass:
- Normal: distance > radius = alarm
- Advanced: distance < small OR distance > big OR bearing outside [startAngle, endAngle] wedge = alarm (strict, both conditions required, no exceptions)
- Handle angle wrap-around correctly (e.g. 345°→20° crosses through 0°/north)

## Geometry rendering on Leaflet

For Normal mode: use `L.circle(anchorLatLng, {radius: radiusInMeters})` — Leaflet handles the geographic projection natively.

For Advanced mode: compute the 32-point arc polygon in geographic coordinates (not pixel coordinates) using proper geodesic math, then render as `L.polygon(points)`. The sector spans from small distance to big distance between startAngle and endAngle, same curved-sector shape as the mockup's ArcWedgePreview but in real lat/lon space.

## What NOT to do
- Do not touch Stage 1 reliability functions.
- Do not touch Stage 2 navigation/layout code or oroboro.html.
- Do not add localStorage or browser storage.
- Do not store credentials in any browser-accessible file.
- Do not attempt radar/MARPA integration.
- Do not add quick-pick buttons.

## After building
1. Show me the diff for anchor-api.js (should be small — just the new /radius endpoint).
2. Show me the full anchor.html diff summary (this will be large — that's expected).
3. Commit with a clear message.
4. Push to main.
5. In your summary, confirm:
   - Leaflet loads from CDN, dark tiles attempted with fallback
   - Radius is written BEFORE position on Set Anchor
   - AIS targets are queried and rendered
   - Swing track is rendered (accumulated or from tracks plugin)
   - Advanced mode alarm logic is strict (distance AND bearing)
   - No Stage 1/2 functions were modified
   - Give exact deployment steps: the standard three-file wget for anchor.html, plus `sudo systemctl restart anchor-api` to pick up the new /radius endpoint in the proxy
