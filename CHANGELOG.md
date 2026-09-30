# Changelog

## [1.6.0] — 2026-09-30

### Added
- **Compass dial around the wind rose** — a new outer ring (N/E/S/W in cardinal red for N, plus NE/SE/SW/NW and 10°/30° ticks) that **rotates with the boat's heading**, so the direction the wind is blowing *from* can be read as a true compass point where the yellow "T" (true wind) arrow lands. Cardinal letters stay upright for readability; the ring animates smoothly via the existing rose-smoothing loop and **hides gracefully if no heading source is available**. Inner wind rose is unchanged; the graphic's viewBox was enlarged to make room. (`oroboro.html`)

## [1.5.0] — 2026-09-28

### Added
- **Update banner on the main dashboard** — the "update available" notice (previously only in Settings) now also appears as a compact, dismissible floating banner on the main screen, since most users rarely open Settings. Overlay so it doesn't disturb the scaled cockpit grid; dismissible per-version; re-checks twice a day.
- **Anonymous usage stats (opt-out)** — once a day `anchor-api.js` sends a random anonymous install-ID + version to the Oroboro stats endpoint (no boat name, no position, no PII), powering an active-installs + version-adoption count. On by default; opt out via the new "Anonymous usage stats" toggle in Settings or `telemetry.enabled: false` in `config.js`. Install-ID persists in `/home/pi/anchor-api/install-id`.

## [1.4.0] — 2026-09-28

### Added — alarm-delivery assurance (safety hardening)
- **Proactive Pushover health check** — `anchor-api.js` validates the Pushover credentials against Pushover's `users/validate.json` endpoint (confirms token/user *and* a registered device, without sending a notification) at startup, hourly, on anchor-set, and after any config change. Result is exposed in `/api/anchor/status`.
- **Real end-to-end test button** — `POST /api/anchor/test-alarm` fires a real alarm down the exact production path (`resolvePushover()` + real send) and returns Pushover's actual verdict. The Settings "Send Test Notification" button now calls this instead of sending browser→Pushover, so a passing test proves the *real* drag alarm will deliver, and it reports "✅ delivered" / "❌ failed: <reason>".
- **Delivery-health indicator** — the anchor watch screen shows an "Alarm Delivery: Ready / FAILING" status, and raises a prominent banner (`⚠ ALARM DELIVERY FAILING — CHECK PUSHOVER`) when armed but delivery is broken.

### Changed
- **`/api/anchor/config` now refuses to blank valid Pushover credentials** — if a save arrives with empty keys, the existing valid keys are preserved. This closes the source of the silent-alarm bug (the app posting blank keys).

## [1.3.2] — 2026-09-28

### Fixed
- **Anchor/Guardian phone alarms could go silent after a state-file reset.** Pushover credentials were read only from `anchor-state.json`, which is volatile — an unclean shutdown (SD corruption) or an app save that posted blank keys would wipe the `userKey`/`apiToken`, and every alarm would then fail *silently* (the code logged "Pushover sent" but the send aborted). Hardened in `anchor-api.js`:
  - New `resolvePushover()` falls back to the credentials in `config.js` (the stable, user-configured source of truth) whenever the state file lacks valid keys. All send sites (dragging, gpsLost, anchorSet/Raised, Guardian) now use it.
  - `sendPushover()` no longer swallows Pushover's HTTP response — a rejection (e.g. `400 invalid token`) is now logged as `Pushover REJECTED …`, and a missing-key send logs `Pushover NOT SENT …`, so a broken alarm can never again look healthy in the logs.

## [1.3.1] — 2026-09-13

### Fixed
- **Anchor drag alarm — two safety-critical bugs** in `anchor-api.js` `monitorTick()`:
  - *Late alarm (fired ~5 min after leaving the zone):* position freshness was stamped with poll time (`Date.now()`), not the GPS fix time. Signal K keeps serving the last-known position with HTTP 200 after the GPS feed freezes, so distance was measured against a stale, still-inside fix and the drag went undetected until the feed caught up. Freshness now comes from the Signal K `timestamp` (the actual fix time) and only advances when a genuinely newer fix arrives — a frozen feed now trips the existing 120 s GPS-lost alarm instead of hiding a real drag.
  - *False alarm (fired while not dragging):* a single tick outside the bound immediately sounded the siren, so one GPS outlier fix (multipath / HDOP spike) triggered a false drag alarm. The boat must now read continuously outside for a confirmation window (default 15 s, `anchor.confirmSeconds` in `anchor-api-config.json`) before the alarm sounds. A real drag is sustained, so genuine alarms are effectively unaffected.

## [1.3.0] — 2026-08-30

### Added
- **In-app update notifications** — Settings page now checks the installed version against the latest GitHub release and shows a banner with one-line update instructions when a newer version is available.
- **Wind map reporter** — opt-in anonymous wind sharing to the Oroboro crowd-sourced wind map (`windShare.enabled` in config.js). Sends every 30 min; reports gust/lull over the window. Toggle visible in Settings.
- `anchor-api.js` — `GET /api/version` endpoint returns the running version so the dashboard can compare it against the latest release.

### Changed
- Wind reporter interval reduced from 5 min to 30 min to stay within the Cloudflare KV free tier (1,000 writes/day).

## [1.2.0] — 2026-07-16

### Added
- **12 V buzzer output** — anchor drag and Guardian zone breaches now sound a physical 12 V piezo buzzer via a relay on a Pi GPIO pin, waking crew even when all phones are silent.
  - `anchor-api.js` — GPIO driver via kernel sysfs (Pi 4 / Pi 5 compatible); mock mode on non-Pi for development. Distinct software patterns: urgent 3-burst for drag/GPS-loss, slow 800 ms pulse for Guardian. Clean pin-low on `SIGTERM`/`SIGINT`.
  - `anchor-api.js` — `POST /buzzer/silence` stops the buzzer and starts a rearm countdown; `POST /buzzer/test` plays the drag pattern for 3 s. Buzzer state (`mode`, `rearmIn`) included in `GET /api/anchor/status`.
  - `anchor.html` — large SILENCE button appears between the status banner and tabs while the buzzer is sounding; replaced by a countdown badge ("rearms in N s") while silenced. Driven entirely by the existing 5 s status poll — no extra polling.
  - `settings.html` — "12 V Buzzer" row in the Alarms section with a Test button; disabled with explanation when `buzzer.enabled: false`.
  - `anchor-api-config.json` — four new keys: `buzzer.enabled` (default `false`), `buzzer.gpioPin` (default `17`), `buzzer.rearmSeconds` (default `30`), `buzzer.rearmOnWorsening` (default `true`).
  - README — wiring guide, permissions setup, deploy steps.

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
- `oroboro.html` — replaced inline cyan anchor link with square 84×84px color-coded anchor button side-by-side with SOG number: blue (#60a5fa) when no anchor set; red (#f87171) with glow when anchor is set (Fix 2)
- `oroboro.html` — added 10s polling script for Signal K `/navigation/anchor` to drive button color state (Fix 2)

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
- `oroboro.html` — added small ⚓ ANCHOR button in nav card linking to `anchor.html`

## [1.0.2] — 2026-06-16

### Fixed
- `config.js` was not actually loaded by `oroboro.html` — an inline duplicate of `DASHBOARD_CONFIG` was being used instead. `config.js` is now loaded via `<script src="config.js">` and is the single source of truth for all boat-specific configuration.

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
