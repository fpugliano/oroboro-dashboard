# Changelog

## [1.1.3] — 2026-06-18

### Added
- `anchor-api.js` — Node.js reverse proxy (built-in modules only, 110 lines) that authenticates to Signal K server-side and exposes `POST /api/anchor/set`, `POST /api/anchor/raise`, `GET /api/anchor/status` on port 3001. SK credentials never leave the Pi.
- `anchor-api-config.json` — config template (signalkHost, signalkPort, username, password, proxyPort); credentials filled in manually on Pi after deploy.
- `anchor-api.service` — systemd unit to run the proxy as `pi` user on boot with auto-restart.

### Fixed
- `anchor.html` — `putAnchorPosition()` now routes through the proxy instead of direct SK PUT (which was silently 401-ing). Write failures now show a visible red error toast that auto-dismisses after 5 seconds.

## [1.1.2] — 2026-06-18

### Fixed
- `anchor.html` — persistent "← Dashboard" link added to every screen via `topBar()` (Fix 1)
- `anchor.html` — stat tile truncation: `min-width:0` on `.stat-block`, `flex-wrap` + `text-overflow:ellipsis` on value/label rows (Fix 3)
- `anchor.html` — button container gap restored to 8px; `.quick-picks` now wraps on narrow viewports (Fix 3)
- `dashboard.html` — replaced inline cyan anchor link with square 84×84px color-coded anchor button side-by-side with SOG number: blue (#60a5fa) when no anchor set; red (#f87171) with glow when anchor is set (Fix 2)
- `dashboard.html` — added 10s polling script for Signal K `/navigation/anchor` to drive button color state (Fix 2)

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
