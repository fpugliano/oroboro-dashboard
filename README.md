# Oroboro Boat Manager

> Built by a sailor with 30,000nm and 3 ocean crossings. Finally, a boat management app built by someone who actually left the dock.

**Live app → [boat.sailingoroboro.com](https://boat.sailingoroboro.com)**

---

## What it is

Oroboro Boat Manager is a mobile-first progressive web app (PWA) for bluewater sailors. It keeps everything about your boat in one place — engine maintenance, spare parts, documents, provisions, watermaker, LPG, shipyard history, safety gear, crew, and all the Greek paperwork that can sink your season.

No installation. No App Store. No Google Play. Open it in any browser, save to your home screen, and it looks and feels like a native app.

---

## Oroboro Dashboard

A real-time boat instrument dashboard served from a Raspberry Pi running OpenPlotter and Signal K. Displays live data from NMEA2000 and Victron/Cerbo GX systems on any device connected to the boat's WiFi.

### Dashboard on iPhone
![Dashboard iPhone](dashboard-iphone.png)

### Dashboard on tablet
![Dashboard Tablet](dashboard-tablet.jpg)

### What it shows
- **Wind** — TWS, AWS, TWA, AWA, wind rose with true and apparent wind needles
- **Navigation** — SOG, STW, heading, depth, water temperature
- **TWS Trend** — 10-minute true wind speed chart with average reference line
- **House Bank** — battery state of charge %, progress bar, voltage, current
- **Electrical** — AC loads, DC loads, solar input, inverter mode, shore power status
- **Solar Panels** — total watts + individual array breakdown (Rigid, Flex 1, Flex 2) with progress bars
- **Water Tanks** — PORT and STBD tank levels in % and litres

### Dashboard architecture

```
Boat instruments (NMEA2000)
        │
        ▼
Raspberry Pi (OpenPlotter)
  ├── Signal K server (port 3000)
  │     └── Venus plugin → Cerbo GX (MQTT at 192.168.1.212)
  └── Dashboard served at /oroboro.html
        │
        ▼ HTTP polling every 1 second
        │
   ┌────┴────┐
   │ Alcatel │  ← boat WiFi router (Oroboro network)
   │  router │  ← powered from Pi USB (5V/2A)
   └────┬────┘
        │ ethernet
        ▼
    Cerbo GX (192.168.1.212)
        │
        ▼ VE.Direct / VE.Can / VE.Bus
   Victron devices (MPPT, Multiplus, BMV-712, batteries)
```

### Network setup
| Device | IP | Notes |
|---|---|---|
| Alcatel router | 192.168.1.1 | Creates `Oroboro` WiFi, powered from Pi USB |
| Raspberry Pi | 192.168.1.238 | Static IP, runs Signal K + dashboard |
| Cerbo GX | 192.168.1.212 | Connected to router via ethernet |

### Accessing the dashboard
- **On the boat WiFi (`Oroboro`)**: `http://192.168.1.238:3000/oroboro.html`
- **Victron dashboard**: `http://192.168.1.212`
- **Signal K admin**: `http://192.168.1.238:3000`

### Updating the dashboard
1. Edit on laptop with Claude Code → push to GitHub
2. Switch Pi WiFi to a network with internet (e.g. Yuka hotspot)
3. Run on Pi:
```bash
sudo wget -O /usr/lib/node_modules/signalk-server/public/oroboro.html \
  https://raw.githubusercontent.com/fpugliano/oroboro-dashboard/main/dashboard.html
```
4. Switch Pi WiFi back to `Oroboro`

### Key technical notes
- The dashboard uses HTTP polling (not WebSocket) because Chrome on iOS blocks WebSocket connections to local network IPs without the `Access-Control-Allow-Private-Network: true` header
- A custom Signal K plugin (`signalk-pna-header`) adds this header to all responses, enabling WebSocket if needed in future
- The Venus plugin connects to the Cerbo via MQTT — host must be set to the Cerbo's actual IP (`192.168.1.212`), not `venus.local`, which only resolves on the Cerbo's own WiFi network
- MQTT must be enabled on the Cerbo: **Settings → Services → MQTT on LAN → ON**

---

## Boat Manager Features

### 🔧 Engine Maintenance
- Track engine hours for port, starboard, and genset engines independently
- Automatic maintenance alerts — oil change, impeller, belts, fuel filters, heat exchanger, mixing elbow, saildrive, and more
- Configurable service intervals with custom tasks
- Full maintenance log with filtering by task type

### 📦 Spare Parts
- Inventory with quantities and minimum stock levels
- Low stock warnings
- Part numbers, locations, store URLs
- Category filtering (Yanmar Engine, Saildrive, Watermaker, Oils & Fluids, Outboard, etc.)

### 📄 Documents
- Vessel registration
- Insurance (with renewal history)
- Greek Transit Log (Δελτίο Κίνησης)
- Greek eTEPAY customs payment
- Crew list with passport and seaman's book expiry tracking

### 🛂 Schengen Tracker
- Rolling 180-day window calculator
- Multiple passport support per person
- Entry/exit log with check-in and check-out

### 🌊 Watermaker
- Hour meter tracking
- Filter change reminders (5 micron, 20 micron, charcoal)
- Filter change history with location log

### 🛥️ Shipyard
- Current haul-out tracking with costs and dates
- Quote comparison
- Full season history

### 🔥 LPG
- Bottle inventory
- Refill history with price per kg tracking

### 🥫 Provisions
- Shopping list and inventory
- Category organisation

### ⛵ Systems
- Installed equipment register (Victron, navigation, sails, rigging, etc.)
- Serial numbers, install dates, warranty expiry, manual URLs

### 🚨 Safety
- Flare inventory with expiry tracking
- Life raft service history

### 🏗️ Upgrades & Repairs
- Season-by-season refit tracking
- Line-item costs

### 📷 AI Import Assistant
- Point your phone at any document — insurance certificate, spare part label, maintenance receipt, chandlery invoice, Transit Log, Victron device sticker — and AI reads it and imports it into the correct tab automatically
- No copy-paste. No reformatting. Up and running in the blink of an eye.
- Supports photos and text paste
- Multilingual (Greek, French, Italian, Spanish, Norwegian, Polish, and more)

---

## Security & Privacy

All data is **end-to-end encrypted in your browser** before it ever leaves your device.

- Encryption: AES-GCM 256-bit
- Key derivation: PBKDF2 (100,000 iterations) from your PIN
- The server (Cloudflare Worker) only ever sees encrypted blobs — it cannot read your data
- Auto-lock after 5 minutes of inactivity
- Brute-force protection (5 attempts → 30-second lockout)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS, HTML, CSS — no framework |
| Backend | Cloudflare Worker |
| Storage | Cloudflare KV (encrypted blobs) |
| AI | Anthropic Claude (`claude-sonnet-4-6`) |
| Hosting | GitHub Pages + Cloudflare |
| Dashboard | Raspberry Pi + OpenPlotter + Signal K |
| Boat data | NMEA2000 + Victron Cerbo GX via MQTT |

---

## Repository Structure

```
index.html              App shell (PWA metadata, entry point)
app.js                  All frontend logic (~9500 lines)
boat-worker.js          Cloudflare Worker — API + AI proxy
styles.css              All styles
owner-config.js         Owner-specific config (see Deployment)
wrangler.toml           Cloudflare Worker deployment config
logo.js                 Oroboro logo as JS constant
oroboro-icon.js         App icon as JS constant
admin.html              Admin dashboard (usage analytics)
clear.html              Utility page to clear local storage
CLOUDFLARE-SETUP.md     Cloudflare deployment instructions
CLAUDE.md               AI assistant context file
signalk-plugin/         Signal K PNA header plugin
  index.js              Adds Access-Control-Allow-Private-Network header
  package.json
```

---

## Deployment

### Boat Manager (GitHub Pages + Cloudflare)

#### Prerequisites
- A Cloudflare account (free tier is sufficient)
- Node.js and Wrangler CLI (`npm install -g wrangler`)
- A GitHub account (for GitHub Pages hosting)

#### 1. Fork and configure

Fork this repo, then edit `owner-config.js`:

```js
const OWNER_EMAIL       = 'your@email.com';
const OWNER_STORAGE_URL = 'https://your-worker-name.your-account.workers.dev';
const ADMIN_PASSWORD    = 'CHANGE_ME'; // must match the Worker secret
```

#### 2. Deploy the Cloudflare Worker

```bash
wrangler login
wrangler kv:namespace create "BOAT_DATA"
# Copy the returned ID into wrangler.toml
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put ADMIN_PASSWORD
wrangler deploy
```

#### 3. Deploy the frontend

Enable GitHub Pages on your fork (Settings → Pages → Deploy from branch: `main`).

### Dashboard (Raspberry Pi)

#### Prerequisites
- Raspberry Pi running OpenPlotter with Signal K
- Alcatel HH41NH router (or similar) powered from Pi USB
- Victron Cerbo GX connected to router via ethernet

#### 1. Enable MQTT on Cerbo GX
On the Cerbo touchscreen: **Settings → Services → MQTT on LAN → ON**

#### 2. Configure Signal K Venus plugin
Edit `/home/pi/.signalk/plugin-config-data/venus.json`:
```json
{
  "configuration": {
    "installType": "mqtt",
    "MQTT": {
      "host": "192.168.1.212"
    }
  },
  "enabled": true
}
```
Replace `192.168.1.212` with your Cerbo's actual IP on your network.

#### 3. Install the PNA header plugin
```bash
sudo mkdir -p /home/pi/.signalk/node_modules/signalk-pna-header
sudo wget -q -O /home/pi/.signalk/node_modules/signalk-pna-header/index.js \
  https://raw.githubusercontent.com/fpugliano/oroboro-dashboard/main/signalk-plugin/index.js
sudo wget -q -O /home/pi/.signalk/node_modules/signalk-pna-header/package.json \
  https://raw.githubusercontent.com/fpugliano/oroboro-dashboard/main/signalk-plugin/package.json
sudo chown -R pi:pi /home/pi/.signalk/node_modules/signalk-pna-header
echo '{"configuration":{},"enabled":true}' \
  > /home/pi/.signalk/plugin-config-data/signalk-pna-header.json
sudo systemctl restart signalk
```

#### 4. Deploy the dashboard
```bash
sudo wget -O /usr/lib/node_modules/signalk-server/public/oroboro.html \
  https://raw.githubusercontent.com/fpugliano/oroboro-dashboard/main/dashboard.html
```

#### 5. Set up permanent web server (port 8080 fallback)
```bash
sudo nano /etc/systemd/system/oroboro-dashboard.service
```
```
[Unit]
Description=Oroboro Dashboard HTTP Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
ExecStart=/usr/bin/python3 -m http.server 8080
Restart=always

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable oroboro-dashboard
sudo systemctl start oroboro-dashboard
```

---

## License

Copyright © 2024–2026 Francesco Pugliano. All rights reserved.

This software may not be copied, modified, distributed, or used in any form without the express written permission of the copyright holder.

---

## About

Built by Francesco & Yuka aboard S/V Oroboro — Cape Town to Greece, 2018–present.

- 🌐 [sailingoroboro.com](https://sailingoroboro.com)
- 📱 [Live app](https://boat.sailingoroboro.com)
- 📸 [Instagram](https://www.instagram.com/sailingoroboro/)
