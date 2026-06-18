# Changelog

## [1.1.1] — 2026-06-18

### Fixed
- `anchor.html` — **Priority 0 (reliability):** anchor armed/unarmed state now derived entirely from Signal K (`GET /signalk/v1/api/vessels/self/navigation/anchor`) on every page load and every poll cycle. All devices converge within seconds. Anchor position is written back to Signal K via `PUT` on set and raised. Added `AnchorStatusBanner` on Main screen with three states: ANCHOR SET (green, synced), NO ANCHOR SET (muted), CHECKING SIGNAL K… (amber, shown briefly on load).
- `anchor.html` — **Priority 1 (navigation):** every screen now has a persistent `← Dashboard` button (top-right of header) linking to `oroboro.html`. Previously absent on all screens.
- `anchor.html` — **Priority 3 (arc alarm logic):** fixed `isOutsideBound()` — boat is now only "safe" if BOTH distance is within [small, big] AND bearing is within the angular wedge simultaneously. The previous logic allowed "outside sector but within big radius" as safe — now an alarm condition.
- `anchor.html` — **Priority 3 (arc SVG):** 32-step curve interpolation (was 24), red danger-zone wash background, dark inner cutout at small radius, fill-opacity 0.32, stroke-width 2.5.
- `anchor.html` — **Priority 3 (validation):** advanced mode now validates small < big. Red borders on small/big inputs, inline error message, confirm button disabled until corrected.
- `anchor.html` — **Priority 4 (Map):** renamed "Swing Track" → "Map" everywhere. Map screen now shows: stylized illustrative shoreline SVG, actual configured allowed-zone shape (dashed circle in Normal, precise arc sector in Advanced), and AIS targets from `vessels.*.navigation.position` (amber triangles with name/MMSI labels). Added AIS Targets stat.
- `anchor.html` — **Priority 5 (layout):** `min-width:0` on all stat tiles, `flex-wrap` on stat value containers.
- `dashboard.html` — **Priority 2:** replaced inline Anchor button with square 84×84px button side-by-side with SOG number. Blue border/text (`#60a5fa`) when no anchor set; red border/text (`#f87171`) with soft glow when anchor IS set. Dashboard now polls Signal K anchor state every 5 s to keep indicator live.

### Notes
- Shoreline on Map screen is a stylized illustrative SVG only — Signal K does not expose real chart/coastline data via its REST API.
- MARPA/radar integration was considered and intentionally excluded pending hardware verification (Raymarine Quantum + heading sensor present, but MARPA→NMEA→Signal K data path unconfirmed).

## [1.1.0] — 2026-06-17

### Added
- `anchor.html` — native Anchor Watch page, linked from dashboard nav card
  - Set anchor by Current GPS position or Relative position (distance + bearing)
  - Allowed radius: simple circular mode (10–100 m slider + quick picks) or Advanced directional-sector mode (inner/outer radius + start/end bearing with live arc preview)
  - Live distance and bearing computed from Signal K GPS position via haversine
  - Full-screen dragging alert overlay with pulsing animation; auto-sends Pushover on first trigger
  - Swing track SVG map with 500-point position history, max/avg/duration stats
  - GPS loss detection (30 s timeout) → Pushover alert
  - Pushover config screen: user key, API token (Show/Hide toggle), 5 configurable events (title, message, priority: Low / Normal / Emergency), per-event enable toggle, Send Test button
  - All state in-memory only — no localStorage or sessionStorage
- `config.js` — added `anchor` section: `defaultRadius`, `pushover.userKey`, `pushover.apiToken`, `pushover.events`
- `dashboard.html` — added small ⚓ ANCHOR button in nav card linking to `anchor.html`

## [1.0.2] — 2026-06-16

### Fixed
- `config.js` was not actually loaded by `dashboard.html` — an inline duplicate of `DASHBOARD_CONFIG` was being used instead. `config.js` is now loaded via `<script src="config.js">` and is the single source of truth for all boat-specific configuration.

## [1.0.0] — 2026-06-10

### Initial release
- Full-screen marine instrument dashboard for Signal K
- Wind rose with apparent and true wind (client-side calculation)
- 10-minute TWS history sparkline
- Battery SOC, voltage, AC/DC loads, solar production
- Water tank levels with liters
- Shore power and inverter status
- Victron Cerbo GX support via Venus SignalK plugin
- Rajdhani display font embedded for offline use
- Auto-reconnecting WebSocket
- Fullscreen toggle button
- Configurable via config.js
