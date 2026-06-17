# Changelog

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
