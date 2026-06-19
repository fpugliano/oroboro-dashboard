This task builds a new settings.html page for configuring the Oroboro dashboard, plus the server-side proxy endpoints to read/write config.js, plus two small buttons in oroboro.html's bottom bar.

The attached `dashboard-settings-v2-mockup.jsx` is the visual reference for the settings page screens. Match its layout, navigation, and interaction patterns.

## Overview

settings.html is a new, separate page (like anchor.html) for editing dashboard configuration values — solar panels, water tanks, battery/inverter instance IDs, vessel name, and Signal K server host/port. Changes are saved directly to the real config.js file on the Pi via the proxy, so they take effect on the next dashboard page reload.

## 1. Dashboard changes: bottom bar buttons

In oroboro.html, the bottom bar (the row containing the fullscreen icon and Oroboro logo) needs two new 28×28px square icon buttons, placed to the RIGHT of the existing fullscreen icon:

**Anchor button (⚓):**
- 28×28px, border-radius 5px
- Unset state: background rgba(96,165,250,0.14), border 1.5px solid #60a5fa
- Set state: background rgba(248,113,113,0.16), border 1.5px solid #f87171, box-shadow 0 0 10px rgba(248,113,113,0.35)
- Contains ⚓ emoji at 14px
- Links to anchor.html
- Polls Signal K anchor state (same GET as the existing square button does) to toggle blue/red — reuse the existing polling logic, just apply it to this new button instead of the old one
- REMOVE the old large square anchor button from wherever it currently sits (the SOG card area)

**Settings button (⚙):**
- 28×28px, border-radius 5px
- background rgba(122,154,191,0.08), border 1.5px solid #1e2a38
- Contains a small gear SVG icon (14×14px, stroke #7a9abf, stroke-width 1.5)
- Links to settings.html

Both buttons sit in a group: [fullscreen] [⚓] [⚙], left-aligned in the bottom bar. The Oroboro logo stays in the center, the Live indicator stays on the right.

## 2. Proxy endpoints (add to anchor-api.js)

**GET /api/dashboard/config**
- Reads the actual config.js file from the Signal K public directory: `/usr/lib/node_modules/signalk-server/public/config.js`
- Parses out the DASHBOARD_CONFIG object (the file contains `const DASHBOARD_CONFIG = { ... };` — extract the JSON-like object between `= ` and `;`)
- Returns `{"ok":true,"config":{...the parsed object...}}`
- If the file doesn't exist or can't be parsed, return `{"ok":false,"error":"..."}`

**POST /api/dashboard/config**
- Body: `{"config":{...the full DASHBOARD_CONFIG object...}}`
- Writes it back to config.js as: `const DASHBOARD_CONFIG = <pretty-printed JSON>;`
- Preserves the exact format: `const DASHBOARD_CONFIG = ` + `JSON.stringify(config, null, 2)` + `;`
- Returns `{"ok":true}` on success
- IMPORTANT: This overwrites the entire config.js file. The client must send the COMPLETE config object, not a partial update — read first, merge changes client-side, then write back.

**GET /api/signalk/scan/:category**
- Queries Signal K's REST API to discover available instances for a given category
- Categories supported:
  - `solar` → scans `GET /signalk/v1/api/vessels/self/electrical/solar/` — returns list of instance IDs found with their current power values
  - `batteries` → scans `GET /signalk/v1/api/vessels/self/electrical/batteries/` — returns instance IDs with voltage/SOC
  - `inverters` → scans `GET /signalk/v1/api/vessels/self/electrical/inverters/` — returns instance IDs with mode/state
- Returns `{"ok":true,"instances":[{"id":"278","path":"electrical.solar.278","sample":"412W"}, ...]}` 
- Uses the stored JWT token for auth (same as other proxy endpoints)
- If the SK path doesn't exist or returns empty, return `{"ok":true,"instances":[]}`

## 3. settings.html — complete new file

Single-file HTML page (all CSS in `<style>`, all JS in `<script>`, same pattern as anchor.html). Dark theme matching oroboro.html exactly (bg #0a0e14, panels #111820, text #e2e8f0, cyan #22d3ee, etc.). Font: Rajdhani from Google Fonts CDN.

### Page structure

**Top bar:** "SETTINGS" title on left, "← Dashboard" button on right (links back to oroboro.html).

**Main content:** A scrollable list of sections, each clickable to drill into a detail screen. Navigation is done by showing/hiding DOM sections (not separate pages or modals), with a "‹ Back" link at the top of each detail screen to return to the main list.

### Sections and their detail screens:

**Vessel**
- Field: Vessel Name (text input, current value from config.vessel.name or config.title)
- Save button → writes updated config via POST /api/dashboard/config

**Signal K Server**
- Fields: Host (text input), Port (text input)
- Current values from config.signalk.host and config.signalk.port (or however the host/port are stored in config.js — check the actual file structure)
- Save button

**Solar Panels**
- List view: shows each solar array as a card (label, instance ID, max watts)
- Tap a card → edit screen with Label, Instance ID, Max Watts fields
- "+ Add Solar Array" button at bottom of list
- "Scan Signal K" button → calls GET /api/signalk/scan/solar → shows discovered instances with current values, each with an "Add" button (if not already configured) or a "✓ Configured" badge (if already in the list)
- Save All button → writes updated config

**Battery Monitor**
- Field: Instance ID (text input)
- "Scan Signal K" button → calls GET /api/signalk/scan/batteries → shows discovered instances as selectable cards (tap to select, highlighted border when selected)
- Save button

**Inverter / Charger**
- Field: Instance ID (text input)  
- "Scan Signal K" button → calls GET /api/signalk/scan/inverters → shows discovered instances as selectable cards
- Save button

**Water Tanks**
- List view: shows each tank as a card (label, Signal K path, capacity in liters)
- Tap a card → edit screen with Label, Signal K Path, Capacity fields
- Save All button

### Save flow (critical — must be correct):

1. On page load: `GET /api/dashboard/config` → parse response → populate all fields with current values
2. When user taps Save on any screen:
   a. Read the FULL current config from the page's in-memory state (not from the server again — use the object loaded at step 1, with the user's changes applied)
   b. `POST /api/dashboard/config` with the complete updated object
   c. Show a brief green "Saved" toast on success, red error toast on failure
   d. The dashboard will pick up the changes on its next page reload (config.js is loaded fresh by oroboro.html on every load via `<script src="config.js">`)

### Config.js field mapping

Map the settings fields to the actual config.js structure. Based on the current config.js, the structure is approximately:

```javascript
const DASHBOARD_CONFIG = {
  title: "My Boat — Marine Dashboard",
  vessel: { name: "S/V Oroboro" },
  signalk: { host: "192.168.1.238", port: 3000 },
  solar: [
    { id: "278", label: "Rigid panels", maxWatts: 960 },
    { id: "279", label: "Flex panels 1", maxWatts: 200 },
    { id: "289", label: "Flex panels 2", maxWatts: 200 }
  ],
  battery: { instance: 288 },
  inverter: { instance: 276 },
  tanks: {
    port: { path: "tanks.freshWater.22.currentLevel", capacity: 380, label: "PORT" },
    stbd: { path: "tanks.freshWater.20.currentLevel", capacity: 380, label: "STBD" }
  },
  anchor: { ... }  // DO NOT TOUCH this section — anchor config is managed by anchor.html
};
```

CHECK THE ACTUAL config.js file structure before building — the above is approximate. Match whatever structure is actually there. Do NOT modify the `anchor` section of config.js from settings.html — that's managed separately.

## What NOT to do

- Do not touch anchor.html
- Do not modify the anchor section of config.js
- Do not use localStorage or sessionStorage
- Do not store any credentials in settings.html
- Do not change oroboro.html's data display logic, Signal K connections, or card layouts — only the bottom bar buttons
- Do not add npm dependencies to the proxy

## After building

1. Show me the anchor-api.js diff (new endpoints only)
2. Show me the first 30 and last 30 lines of settings.html
3. Show me the oroboro.html diff (bottom bar changes only)
4. Commit all files with a clear message
5. Push to main
6. In your summary, confirm:
   - Config.js is read and written via the proxy, never directly from the browser
   - The scan endpoints query live Signal K data
   - The anchor config section is never touched by settings.html
   - Dashboard bottom bar has both buttons at 28×28px
   - Old large anchor button is removed from the SOG card area
   - Give exact deployment steps: wget for settings.html, anchor-api.js, oroboro.html, plus service restart
