# S/V Oroboro — Marine Dashboard

A single-file marine instrument dashboard for S/V Oroboro. Connects to Signal K via WebSocket and displays navigation, wind, depth, battery, solar, and tank data in a dark nautical interface designed for a fixed cockpit display.

## What it shows

| Panel | Instruments |
|---|---|
| Top left | SOG, COG, Depth, Water temperature |
| Center | Wind compass (AWA/TWA needles), AWS, TWS, STW, Heading, TWS sparkline |
| Top right | House bank SOC, Voltage, Current, Solar W, DC load, Shore power, AC loads |
| Bottom left | GPS position (deg/decimal min), Water tanks (PORT & STBD) |
| Bottom right | Individual MPPT solar panels, Inverter mode, Battery temperature |

## Requirements

- Signal K server running on the same network (default: `ws://localhost:3000`)
- Chromium or any modern browser

## Deploy to Raspberry Pi

### Option 1 — Open as local file

```bash
# Copy to the Pi
scp dashboard.html pi@oroboro.local:/home/pi/

# Set Chromium to open it on boot (add to ~/.config/lxsession/LXDE-pi/autostart)
@chromium-browser --noerrdialogs --disable-infobars --kiosk file:///home/pi/dashboard.html
```

### Option 2 — Serve with Python

```bash
# On the Pi, in the folder containing dashboard.html
python3 -m http.server 8080

# Then open
chromium-browser http://localhost:8080/dashboard.html
```

### Kiosk mode (recommended for a fixed display)

```bash
# /home/pi/start-dashboard.sh
#!/bin/bash
xset s off
xset -dpms
xset s noblank
chromium-browser \
  --noerrdialogs \
  --disable-infobars \
  --kiosk \
  --app=file:///home/pi/dashboard.html
```

## Signal K paths used

The dashboard subscribes to these paths on `vessels.self`:

- `navigation.speedOverGround` / `courseOverGroundTrue` / `speedThroughWater` / `headingTrue` / `position`
- `environment.depth.belowKeel` / `environment.water.temperature`
- `environment.wind.speedApparent` / `speedTrue` / `angleApparent` / `angleTrueWater`
- `electrical.batteries.288.*` — SOC, voltage, current
- `electrical.chargers.276.*` — charging mode, temperature
- `electrical.solar.278/279/289.panelPower` / `electrical.venus.totalPanelPower`
- `electrical.inverters.276.*` — AC in/out, mode
- `electrical.venus.dcPower`
- `tanks.freshWater.20/22.currentLevel`

## Keyboard shortcuts

| Key | Action |
|---|---|
| `F` | Toggle fullscreen |
| `R` | Force reconnect |

## Customisation

- **Signal K host**: change `WS_URL` at the top of the `<script>` block
- **Tank capacity**: change `380` (litres) in the `updateTank()` function
- **Solar max scale**: change `500` W in the `updateSolar()` function
- **Battery IDs**: paths use `288` (battery), `276` (charger/inverter), `278/279/289` (MPPTs) — update to match your Victron device instance IDs
