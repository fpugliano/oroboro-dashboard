# Changelog

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
