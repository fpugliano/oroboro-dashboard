This is a COMPLETE REWRITE of anchor.html from scratch. Do not patch the existing file — delete its contents and rebuild entirely. The attached `anchor-redesign-v3-mockup.jsx` is the authoritative visual and interaction reference.

The current anchor.html has accumulated too many incremental patches with interacting bugs. This rewrite starts fresh with a clean architecture that gets the data flow right from the beginning, especially cross-device persistence.

## CRITICAL REQUIREMENT: Cross-device persistence

The user may set the anchor from the Pi's display, then go onshore and check/adjust settings from their iPhone. ALL configurable values must persist across devices and page reloads. Nothing may be stored in browser memory, localStorage, or page-local JavaScript variables as the source of truth. Every value must come from either Signal K or the proxy's server-side config file.

## Architecture

### Data storage — where each value lives:

| Value | Storage | Read | Write |
|-------|---------|------|-------|
| Anchor position (lat/lon) | Signal K `navigation.anchor.position` | GET SK REST API (no auth needed) | POST proxy `/api/anchor/set` |
| Max radius | Signal K `navigation.anchor.maxRadius` | GET SK REST API (no auth needed) | POST proxy `/api/anchor/radius` |
| Mode (normal/advanced) | Proxy config file | GET proxy `/api/anchor/config` | POST proxy `/api/anchor/config` |
| Small distance | Proxy config file | GET proxy `/api/anchor/config` | POST proxy `/api/anchor/config` |
| Big distance | Proxy config file | GET proxy `/api/anchor/config` | POST proxy `/api/anchor/config` |
| Start angle | Proxy config file | GET proxy `/api/anchor/config` | POST proxy `/api/anchor/config` |
| End angle | Proxy config file | GET proxy `/api/anchor/config` | POST proxy `/api/anchor/config` |
| Anchor history | Proxy config file | GET proxy `/api/anchor/config` | POST proxy `/api/anchor/config` |

### New proxy endpoints (add to anchor-api.js):

**POST /api/anchor/config** — body: `{"mode":"normal","radius":55,"small":40,"big":55,"startAngle":345,"endAngle":20,"history":[...]}` — writes the entire config object to `/home/pi/anchor-api/anchor-state.json` (simple JSON file, created on first write). Returns `{"ok":true}`.

**GET /api/anchor/config** — reads `/home/pi/anchor-api/anchor-state.json` and returns its contents. Returns `{"ok":true,"config":{...}}` or `{"ok":true,"config":null}` if the file doesn't exist yet.

These endpoints do NOT need Signal K auth — they're reading/writing a local file, not Signal K paths. Keep them simple: `fs.readFileSync`/`fs.writeFileSync` with try/catch, no database, no npm dependencies.

### Page load sequence (EVERY page load, EVERY device):

1. Fetch anchor position from Signal K: `GET /signalk/v1/api/vessels/self/navigation/anchor`
2. Fetch maxRadius from Signal K: same response, look for `maxRadius.value`
3. Fetch config from proxy: `GET /api/anchor/config`
4. Derive the ENTIRE UI state from these three responses:
   - If SK has a position → anchor is set, show armed state on Main screen
   - Mode, small, big, startAngle, endAngle → from proxy config
   - Radius → from SK maxRadius (authoritative), proxy config as fallback
   - History → from proxy config
5. Only AFTER all three fetches complete, render the UI and start the poll loop

### Set Anchor flow:

1. User configures allowed distance (Normal or Advanced) via Set Distance modal
2. Config is written to proxy immediately: `POST /api/anchor/config`
3. User taps Set Anchor → chooses Current/Relative/Custom location
4. Radius written to SK via proxy: `POST /api/anchor/radius` (maxRadius = radius for Normal, maxRadius = big for Advanced)
5. WAIT for `{"ok":true}` from radius write
6. Position written to SK via proxy: `POST /api/anchor/set`
7. WAIT for `{"ok":true}` from position write
8. Add entry to history in proxy config: `POST /api/anchor/config` with updated history array
9. Transition to armed state
10. Any failure at steps 4-7 shows a visible red error toast and aborts — NO silent failures, NO partial state

### Raise Anchor flow:

1. User taps Cancel Anchor → confirmation modal ("Are you sure?")
2. On confirm: `POST /api/anchor/raise` → wait for `{"ok":true}`
3. Transition to unset state
4. Any failure shows error toast

### Adjust Distance flow (while anchor is set):

1. User taps Set Allowed Distance → modal opens pre-filled with current values FROM the proxy config (not defaults)
2. User changes values, taps Set Distance
3. New config written to proxy: `POST /api/anchor/config`
4. New maxRadius written to SK: `POST /api/anchor/radius`
5. Armed screen updates immediately
6. No need to raise and re-set the anchor — position stays, only distance changes

## UI Design (match reference screenshots exactly)

### Main screen (always visible behind modals)
Two-column layout:
- Left column: CURRENT POSITION (lat/lon), GPS ACCURACY, LAST GPS UPDATE, BATTERY
- Right column: ANCHOR POSITION (lat/lon or blank), ANCHOR DISTANCE, ANCHOR BEARING, ALLOWED DISTANCE
- When no anchor set: right column values show "—"
- When anchor set: all values populated, update on each poll cycle
- Two buttons at bottom: "SET ALLOWED DISTANCE" (cyan outline) and "SET ANCHOR" (blue filled) / "CANCEL ANCHOR" (red outline when set)
- Values update live every poll cycle (1 second)

### Set Distance modal (overlays Main screen)
- Normal/Advanced tab toggle at top
- Normal: single text input for "Maximum distance" in meters, "SET DISTANCE" button
- Advanced: four text inputs (Small distance, Big distance, Start angle, End angle) with arc preview SVG below, "SET DISTANCE" button
- Arc preview: corrected curved-sector geometry (32-step interpolation, same as mockup)
- Validation: small must be < big; red borders + disabled button if invalid
- Closing the modal (tapping outside or pressing back) cancels without saving

### Set Anchor modal
- "How do you want to set the anchor?" with three options:
  - Current location — uses boat's current GPS position
  - Relative location — opens sub-modal with Distance to anchor (m) and Bearing to anchor (°) text inputs, plus compass button, and Set Anchor button
  - Custom coordinates — opens sub-modal with Latitude and Longitude text inputs

### Cancel Anchor modal
- "Are you sure you want to cancel the current anchor?"
- "Yes, Cancel Anchor" button (red)

### Map screen (bottom nav tab)
- Leaflet map with BRIGHT OpenStreetMap tiles (standard `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, NOT dark CartoDB tiles)
- Attribution: © OpenStreetMap contributors
- When anchor is set, show:
  - Anchor marker: a distinctive anchor icon (use a Leaflet divIcon with an anchor emoji or SVG, large and clearly visible)
  - Allowed zone: green circle (Normal) or green curved-sector polygon (Advanced) with semi-transparent fill
  - Boat position: a small catamaran-shaped SVG icon (two hulls + crossbeam, simple geometric shapes) or at minimum a distinctive blue dot that's clearly different from the anchor marker
  - Swing trail: blue polyline showing the boat's position history since the anchor was set (accumulated client-side from poll loop data, AND read from the Tracks plugin if available at `/signalk/v1/api/vessels/self/navigation/track`)
  - AIS targets: amber triangle markers for nearby vessels from `vessels.*` (excluding `vessels.self`), labeled with vessel name or MMSI fallback + distance
- Zoom level: auto-fit to show the entire allowed zone with some padding
- Disable scroll-zoom (use pinch-zoom on mobile) to prevent accidental map movement

### Anchor History screen (bottom nav tab)
- Chronological list grouped by date
- Each entry shows: coordinates (lat lon) and timestamp
- Data comes from the proxy config's history array
- Tapping an entry could center the Map on that location (nice to have, not required)

### Settings screen (bottom nav tab)
- Pushover configuration: User Key, API Token (masked), event toggles
- Same as what currently exists — port it over without changes to the Pushover logic

### Bottom navigation bar
- Four tabs: Main (star icon), Map (map icon), Anchor history (pin icon), Settings (gear icon)
- Active tab highlighted in cyan
- Always visible at the bottom of every screen

## Pushover notifications

Port the existing sendPushover() function with ALL its fixes:
- Only fires on genuine ok→dragging STATE TRANSITION (not every poll where boat is outside)
- NEVER fires during the Set Anchor flow (armingInProgress/alarmSuppressed flag)
- 60-second cooldown between repeated dragging notifications
- Sends to the Pushover API using credentials from config.js (anchor.pushover.userKey and anchor.pushover.apiToken)

## Alarm logic

- Normal mode: distance > radius = alarm
- Advanced mode: distance < small OR distance > big OR bearing outside [startAngle, endAngle] wedge = alarm (strict, both conditions required simultaneously to be "in bounds")
- Angle wrap-around handled correctly (e.g. 345°→20° crosses through 0°/north)

## Styling

- Dark theme matching oroboro.html exactly: background #0a0e14, panels #111820, text #e2e8f0, cyan #22d3ee, amber #f59e0b, red #f87171, blue #60a5fa, green #5db832
- Font: Rajdhani (loaded from Google Fonts CDN)
- Leaflet CSS loaded from CDN: `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css`
- Leaflet JS loaded from CDN: `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js`
- Single file: all CSS in a `<style>` block, all JS in a `<script>` block, no external files except CDN resources
- Mobile-responsive: works on both the Pi's 9" display and a ~380px phone screen

## What NOT to do

- Do not use localStorage, sessionStorage, or any browser storage
- Do not store ANY credentials in anchor.html or any browser-downloadable file
- Do not touch oroboro.html (the square anchor button and its polling are already working from Stage 2)
- Do not touch anchor-api-config.json (contains SK credentials)
- Do not attempt radar/MARPA integration
- Do not create multiple files — anchor.html must remain a single self-contained file (except CDN resources)

## After building

1. Show me the anchor-api.js diff (new /config endpoints)
2. Show me the first 50 and last 50 lines of the new anchor.html (to confirm structure/architecture, not the full file)
3. Commit both files with a clear message
4. Push to main
5. In your summary, confirm:
   - Every configurable value persists via proxy config file or Signal K
   - Page load reads from server, never from defaults after first configuration
   - Set Anchor writes radius BEFORE position
   - Alarm fires only on state transition, with cooldown and arming suppression
   - Leaflet uses bright OSM tiles
   - No browser storage used anywhere
   - Give exact deployment steps: wget for anchor.html to the correct path (/usr/lib/node_modules/signalk-server/public/anchor.html), wget for anchor-api.js to /home/pi/anchor-api/, restart anchor-api service
