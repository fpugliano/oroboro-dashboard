# Oroboro Dashboard

A real-time marine instrument dashboard that runs on a Raspberry Pi aboard your sailboat. It displays live data from your boat's instruments, Victron energy system, and water tanks — accessible from any phone, tablet, or screen connected to the boat's WiFi.

Built with [Signal K](https://signalk.org), the open-source marine data server.

---

## What You'll See

- **Wind** — true and apparent wind speed, wind angle, interactive wind rose with trend chart
- **Navigation** — speed over ground, speed through water, heading, depth, water temperature
- **House Battery** — state of charge, voltage, current, shore power status
- **Solar Panels** — total watts plus individual array breakdown with progress bars
- **Electrical** — AC loads, DC loads, solar input, inverter mode
- **Water Tanks** — port and starboard tank levels in percentage and litres
- **Anchor Watch** — set and monitor your anchor with alarm notifications sent to your phone via Pushover

Works on any screen size — from a phone to a mounted 9-inch display in the cockpit.

---

## Hardware You'll Need

### The basics

| Item | What it does | Notes |
|------|-------------|-------|
| **Raspberry Pi 4** (or newer) | Runs the Signal K server and serves the dashboard | 2GB RAM is sufficient; 4GB recommended |
| **MicroSD card** (32GB+) | Stores the operating system and all software | Use a good quality card (SanDisk, Samsung) |
| **Pi power supply** | Powers the Pi reliably | Must deliver a steady 5V/3A — **do not** share a single USB power source between the Pi and other devices like a router |
| **NMEA 2000 interface** | Connects your boat's instrument network to the Pi | Two options: a CAN bus HAT (recommended) or a USB gateway — see below |
| **WiFi router with SIM card** | Creates the boat's WiFi network and provides internet via cellular | Any 4G/LTE router with WiFi will work — make sure it has its own dedicated power supply |
| **Display** (optional) | A screen attached to the Pi for cockpit viewing | A 7-9 inch HDMI touchscreen works well |

### Connecting to NMEA 2000: choosing your interface

You need a way to get data from the boat's NMEA 2000 backbone into the Raspberry Pi. There are two options:

**Option A — CAN bus HAT (recommended)**

A HAT (Hardware Attached on Top) is a small circuit board that plugs directly onto the Pi's GPIO pins, turning the Pi itself into an NMEA 2000 device. This is the simplest, most compact, and cheapest option. Popular choices:

- **[OpenMarine MacArthur HAT](https://shop.wegmatt.com/products/openmarine-macarthur-hat)** — designed specifically for OpenPlotter, supports NMEA 2000, NMEA 0183, and Seatalk1 all in one board. Fully supported by OpenPlotter with just a few clicks to configure.
- **[PiCAN-M](https://copperhilltech.com/pican-m-nmea-0183-nmea-2000-hat-for-raspberry-pi/)** — supports NMEA 2000 and NMEA 0183, can optionally power the Pi from the NMEA 2000 bus itself.
- **[Waveshare 2-Channel CAN HAT](https://www.waveshare.com/2-ch-can-hat.htm)** — a general-purpose isolated CAN bus board that works well with NMEA 2000.

To connect a HAT to the NMEA 2000 backbone, you'll need to tap into the backbone cable. Here's how:

1. **Get a spare NMEA 2000 drop cable** (or cut into an existing cable at a convenient point). The standard NMEA 2000 cable contains five wires:

   | Wire color | Name | Purpose |
   |-----------|------|---------|
   | **White** | CAN-H (Net-H) | Data signal — high |
   | **Blue** | CAN-L (Net-L) | Data signal — low |
   | Bare (no insulation) | Shield | Electromagnetic shielding |
   | Red | Net-S | 12V power (not needed for the HAT) |
   | Black | Net-C | 12V ground (not needed for the HAT) |

2. **Strip the white and blue wires** — these are the only two you need. The HAT has screw terminals labeled CAN-H and CAN-L (or similar). Connect:
   - **White wire → CAN-H** terminal
   - **Blue wire → CAN-L** terminal

3. **Leave the red and black power wires disconnected** (or capped with electrical tape) — the Pi powers the HAT, you don't need power from the NMEA 2000 bus. The bare shield wire can be left disconnected or tied to a ground point on the boat if you want extra noise protection.

4. **Plug the HAT onto the Pi's GPIO header**, boot up, and configure it in OpenPlotter's CAN Bus app — the HAT should appear automatically, and you just click "Add Connection" to link it to Signal K.

> **Important:** The NMEA 2000 backbone must have exactly two termination resistors (120Ω each), one at each physical end of the backbone. If your backbone is already properly terminated, adding the HAT tap doesn't change this — you're just adding a drop, not extending the backbone. You can verify termination by measuring resistance between the white and blue wires with a multimeter when the network is powered off — you should read approximately 60Ω (two 120Ω resistors in parallel).

**Option B — USB gateway (plug and play, but more expensive)**

A standalone USB gateway is a small box that plugs into the NMEA 2000 backbone via a standard drop cable on one side, and connects to the Pi via USB on the other. No wiring, no soldering — just plug in both ends. Common options:

- **[Actisense NGT-1](https://actisense.com/products/nmea-2000-to-pc-interface-ngt-1/)** — the most widely used and best-supported gateway in the Signal K community
- **[Yacht Devices YDNU-02](https://www.yachtd.com/products/usb_gateway.html)** — compact, well-regarded alternative

Signal K detects USB gateways automatically — no driver installation or configuration needed beyond plugging it in.

### For Victron energy monitoring (optional but recommended)

| Item | What it does |
|------|-------------|
| **Victron Cerbo GX** | Central hub for your Victron system — connects to batteries, solar chargers, inverter |
| **Victron solar chargers** (MPPT) | Charge batteries from solar panels — data flows through the Cerbo |
| **Victron inverter/charger** (Multiplus, etc.) | Powers AC loads from batteries — data flows through the Cerbo |
| **Victron battery monitor** (BMV-712 or similar) | Measures battery state of charge, voltage, current |

The Cerbo GX connects to the Pi's WiFi network and sends data via MQTT (a lightweight messaging protocol). The dashboard reads this data through a Signal K plugin.

---

## How Everything Connects

```
Boat Instruments (wind, depth, GPS, heading)
│
│  NMEA 2000 backbone (blue cable)
│
├──► CAN bus HAT (plugged onto Pi GPIO)  ──┐
│    White wire → CAN-H                    │
│    Blue wire  → CAN-L                    │
│                                          ▼
└──► USB Gateway (alternative) ──USB──▶ Raspberry Pi
                                    │
                                    ├── Signal K server (reads instruments)
                                    ├── Venus plugin (reads Victron via MQTT)
                                    ├── Dashboard (oroboro.html)
                                    ├── Anchor Watch (anchor.html)
                                    ├── Settings (settings.html)
                                    └── Anchor API proxy (handles secure writes)
                                    │
                                    ▼  WiFi
                                    │
                              WiFi Router (with SIM)
                              │           │
                              ▼           ▼
                         Your phone    Cerbo GX
                         / tablet      (Victron hub,
                                        also on WiFi)
```

### NMEA 2000 connections

Your boat's instruments (wind sensor, depth transducer, GPS, heading sensor) are connected to the **NMEA 2000 backbone** — a single cable that runs through the boat with T-connectors for each device.

To get this data into the Pi, you either:
- **With a CAN bus HAT:** tap into the backbone, strip the white (CAN-H) and blue (CAN-L) wires, and connect them to the screw terminals on the HAT board plugged into the Pi's GPIO header. See the detailed wiring guide above.
- **With a USB gateway:** plug the gateway into the backbone via a standard NMEA 2000 drop cable, then connect it to the Pi via USB. No wiring needed — just two cables plugged in.

Either way, Signal K detects the connection automatically and starts reading instrument data.

### Victron connections

The Cerbo GX communicates with Victron devices (solar chargers, inverter, battery monitor) via their own VE.Direct, VE.Can, or VE.Bus connections — all of which plug directly into the Cerbo. The Cerbo then joins the boat's WiFi network and makes this data available via MQTT. Signal K's Venus plugin reads from the Cerbo over WiFi — no physical cable needed between the Pi and the Cerbo.

### WiFi router

The router creates the boat's WiFi network and provides internet access via its SIM card. Every device — the Pi, the Cerbo, your phone, your tablet — connects to this same network. **Important:** the router must have its own dedicated power supply. Do not power it from the Pi's USB port — sharing power between the Pi and router causes voltage drops that destabilize both devices' WiFi.

---

## Software Setup

### Step 1: Install OpenPlotter on the Raspberry Pi

[OpenPlotter](https://openplotter.readthedocs.io/) is a ready-made operating system for Raspberry Pi that includes Signal K and all the marine software you need.

1. Download the latest OpenPlotter image from [openplotter.readthedocs.io](https://openplotter.readthedocs.io/)
2. Flash it to your MicroSD card using [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
3. Insert the card into the Pi, connect a display and keyboard, and boot
4. Follow the OpenPlotter setup wizard — it will configure Signal K automatically
5. Connect the NMEA 2000 gateway to the Pi via USB — OpenPlotter should detect it

After setup, Signal K's admin interface is available at `http://<pi-ip-address>:3000` from any device on the same WiFi network.

### Step 2: Give the Pi a static IP address

So the dashboard URL never changes, give the Pi a fixed IP address:

1. Open a terminal on the Pi
2. Run: `sudo nmcli connection modify "YourWiFiName" ipv4.method manual ipv4.addresses 192.168.1.238/24 ipv4.gateway 192.168.1.1 ipv4.dns 8.8.8.8`
3. Restart networking: `sudo nmcli connection down "YourWiFiName" && sudo nmcli connection up "YourWiFiName"`

Replace `192.168.1.238` with whatever IP you want, and `YourWiFiName` with your actual WiFi network name.

### Step 3: Connect the Cerbo GX (if using Victron)

1. On the Cerbo: **Settings → Services → MQTT on LAN → ON**
2. Connect the Cerbo to the boat's WiFi network
3. Note the Cerbo's IP address (visible on the Cerbo's own display or in the router's connected devices list)
4. In Signal K admin (`http://<pi-ip>:3000`): go to **Server → Plugin Config → Victron Venus Plugin**
5. Set the MQTT host to the Cerbo's IP address
6. Also set the "Address for remote Venus device" field to `tcp:host=<cerbo-ip>`
7. Save and restart Signal K

**Tip:** Give the Cerbo a static IP too (via the Cerbo's own Settings → WiFi → your network → Manual IP config) so this address never changes.

### Step 4: Install the PNA header plugin

Chrome on iOS blocks certain connections to local network devices unless the server sends a specific header. This small plugin adds that header to Signal K:

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

### Step 5: Deploy the dashboard files

```bash
sudo wget -q -O /usr/lib/node_modules/signalk-server/public/oroboro.html \
  https://raw.githubusercontent.com/fpugliano/oroboro-dashboard/main/oroboro.html
sudo wget -q -O /usr/lib/node_modules/signalk-server/public/anchor.html \
  https://raw.githubusercontent.com/fpugliano/oroboro-dashboard/main/anchor.html
sudo wget -q -O /usr/lib/node_modules/signalk-server/public/settings.html \
  https://raw.githubusercontent.com/fpugliano/oroboro-dashboard/main/settings.html
sudo wget -q -O /usr/lib/node_modules/signalk-server/public/config.js \
  https://raw.githubusercontent.com/fpugliano/oroboro-dashboard/main/config.js
sudo chown pi:pi /usr/lib/node_modules/signalk-server/public/config.js
echo "deploy ok"
```

The `chown` command gives the Pi user permission to save settings changes from the Settings page.

### Step 6: Set up the Anchor Watch proxy

The anchor watch feature needs a small background service to handle secure communication with Signal K:

```bash
# Create the directory and download the proxy
mkdir -p /home/pi/anchor-api
wget -O /home/pi/anchor-api/anchor-api.js \
  https://raw.githubusercontent.com/fpugliano/oroboro-dashboard/main/anchor-api.js
wget -O /home/pi/anchor-api/anchor-api-config.json \
  https://raw.githubusercontent.com/fpugliano/oroboro-dashboard/main/anchor-api-config.json

# Edit the config with your Signal K login
nano /home/pi/anchor-api/anchor-api-config.json
# Fill in "username" and "password" with your Signal K admin credentials, then save (Ctrl+X, Y, Enter)

# Install the service so it starts automatically on boot
sudo wget -O /etc/systemd/system/anchor-api.service \
  https://raw.githubusercontent.com/fpugliano/oroboro-dashboard/main/anchor-api.service
sudo systemctl daemon-reload
sudo systemctl enable anchor-api
sudo systemctl start anchor-api

# Verify it's running
sudo systemctl status anchor-api
# You should see "Authenticated to Signal K" and "Listening on port 3001"
```

### Step 7: Configure your boat's specifics

Open the dashboard in a browser: `http://<pi-ip>:3000/oroboro.html`

Tap the **⚙ Settings** icon in the bottom bar to configure:

- **Vessel name**
- **Solar panels** — add your arrays with their Signal K instance IDs and maximum wattage (use "Scan Signal K" to auto-discover available chargers)
- **Battery monitor** — set the instance ID (use "Scan Signal K" to find it)
- **Inverter/charger** — set the instance ID
- **Water tanks** — set Signal K paths and tank capacities in litres

All changes are saved automatically and take effect when the dashboard is reloaded.

### Step 8: Set up Pushover notifications (optional)

To receive anchor alarm alerts on your phone:

1. Install the **Pushover** app on your phone ([iOS](https://apps.apple.com/app/pushover-notifications/id506088175) / [Android](https://play.google.com/store/apps/details?id=net.superblock.pushover))
2. Create an account at [pushover.net](https://pushover.net)
3. Your **User Key** is shown on the main dashboard after logging in
4. Go to [pushover.net/apps](https://pushover.net/apps/build) and create a new application — the **API Token** is shown after creation
5. In the dashboard, tap ⚓ → Settings → enter both keys and save

---

## Using the Dashboard

### Viewing instruments

Open `http://<pi-ip>:3000/oroboro.html` on any device connected to the boat's WiFi. The dashboard updates every second automatically — no need to refresh.

### Anchor Watch

1. Tap the **⚓** icon in the bottom bar
2. Tap **Set Allowed Distance** to configure the alarm radius (Normal mode for a simple circle, Advanced mode for a directional sector)
3. Tap **Set Anchor** → choose Current Location (uses GPS) or Relative Location (enter distance and bearing to the anchor)
4. The map shows your boat's position, the anchor, the allowed zone, nearby AIS vessels, and your swing track
5. If the boat drifts outside the allowed zone, you'll get a Pushover notification on your phone
6. The anchor state syncs across all devices — set it on the Pi, check it on your phone

### Settings

Tap the **⚙** icon in the bottom bar to view and edit the dashboard configuration. Changes are saved to the Pi and take effect on the next page reload.

---

## Updating the Dashboard

When a new version is available, run these commands on the Pi:

```bash
sudo wget -q -O /usr/lib/node_modules/signalk-server/public/oroboro.html \
  https://raw.githubusercontent.com/fpugliano/oroboro-dashboard/main/oroboro.html
sudo wget -q -O /usr/lib/node_modules/signalk-server/public/anchor.html \
  https://raw.githubusercontent.com/fpugliano/oroboro-dashboard/main/anchor.html
sudo wget -q -O /usr/lib/node_modules/signalk-server/public/settings.html \
  https://raw.githubusercontent.com/fpugliano/oroboro-dashboard/main/settings.html
echo "update ok"
```

If the browser shows an old version after updating, clear the cache:
```bash
pkill -9 chromium
rm -rf /home/pi/.config/chromium/Default/Cache
rm -rf "/home/pi/.config/chromium/Default/Code Cache"
rm -rf /home/pi/.config/chromium/Default/Service\ Worker
chromium-browser --incognito http://<pi-ip>:3000/oroboro.html &
```

---

## Troubleshooting

### Dashboard shows no data
- Check that Signal K is running: `sudo systemctl status signalk`
- Check that the Pi is connected to WiFi: `nmcli connection show --active`
- Open Signal K admin (`http://<pi-ip>:3000`) and check the Data Browser for live values

### Battery/solar data missing but wind/depth work
- Wind and depth come from NMEA 2000 (direct USB connection) — if these work, the Pi and gateway are fine
- Battery and solar come from the Cerbo GX via MQTT over WiFi — check:
  - Is the Cerbo connected to the same WiFi network?
  - Is MQTT enabled on the Cerbo? (Settings → Services → MQTT on LAN → ON)
  - Is the Venus plugin configured with the correct Cerbo IP? (Signal K admin → Plugin Config → Venus)
  - Did the Cerbo's IP change? Check the router's connected devices list for its current address

### Anchor Watch not working
- Check the proxy is running: `sudo systemctl status anchor-api`
- Check the proxy logs: `sudo journalctl -u anchor-api -n 20`
- You should see "Authenticated to Signal K" and "Listening on port 3001"
- If authentication fails, check the credentials in `/home/pi/anchor-api/anchor-api-config.json`

### Browser shows old version after update
- The Pi's Chromium aggressively caches pages. Use the cache-clearing commands in the Updating section above
- On phones/tablets, a hard refresh (pull down to refresh, or clear browser cache) usually works

### WiFi keeps disconnecting
- Make sure the router has its own dedicated power supply — not powered from the Pi's USB
- Check the Pi isn't trying to connect to other saved networks: `nmcli -f NAME,AUTOCONNECT connection show` — disable autoconnect on any networks except your boat's WiFi

---

## Files in This Project

| File | Purpose |
|------|---------|
| `oroboro.html` | Main dashboard — instruments, wind rose, battery, solar, tanks |
| `anchor.html` | Anchor watch — set/monitor anchor with map, alarms, and notifications |
| `settings.html` | Settings page — configure solar, tanks, battery, inverter, vessel |
| `config.js` | Dashboard configuration — edited via Settings page or manually |
| `anchor-api.js` | Background proxy service — handles secure writes to Signal K |
| `anchor-api-config.json` | Proxy credentials (Signal K login) — stays on the Pi, never sent to browsers |
| `anchor-api.service` | Systemd unit file — starts the proxy automatically on boot |

---

## Signal K Plugins Required

| Plugin | Purpose | Must stay enabled? |
|--------|---------|-------------------|
| **Victron Venus Plugin** | Bridges Cerbo GX battery/solar/inverter data into Signal K via MQTT | Yes, if using Victron |
| **signalk-anchoralarm-plugin** | Manages anchor position storage in Signal K — the anchor watch depends on this for reading and writing anchor state | Yes |
| **signalk-pna-header** | Adds network access headers so iOS browsers can connect to Signal K | Yes |

---

## License

Proprietary — all rights reserved. See [LICENSE](LICENSE).

---

## About

Part of the Oroboro sailing project → [sailingoroboro.com](https://sailingoroboro.com)
