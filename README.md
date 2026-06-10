# Oroboro Dashboard

A full-screen marine instrument dashboard for Signal K. Built for liveaboard
sailors who want all critical data — wind, depth, speed, battery, solar, tanks
— on one screen, readable from across the galley.

![Dashboard Screenshot](screenshot.png)

## Features
- Wind rose with apparent and true wind angle/speed
- True wind calculated client-side from AWS + AWA + STW
- 10-minute true wind speed history graph
- Battery state of charge with charging mode badge
- AC loads, DC loads, solar production per panel array
- Shore power detection and inverter status
- Water tank levels in % and liters
- Victron Cerbo GX support via signalk-venus-plugin
- Single HTML file — no frameworks, no dependencies, no internet required
- Fully configurable via config.js

## Requirements
- Signal K server (tested with 1.46.x and 2.x)
- For Victron data: signalk-venus-plugin connected to a Cerbo GX
- Any modern browser (Chrome, Chromium, Firefox, Safari)
- Raspberry Pi with Chromium in kiosk/fullscreen mode (recommended)

## Installation

### Quick start
1. Download `dashboard.html` and `config.js`
2. Edit `config.js` to match your boat
3. Open `dashboard.html` in your browser

### On a Raspberry Pi (recommended)
```bash
cd ~ && wget https://raw.githubusercontent.com/fpugliano/oroboro-dashboard/main/dashboard.html
wget https://raw.githubusercontent.com/fpugliano/oroboro-dashboard/main/config.js
```
Edit config.js with your settings, then open in Chromium:
```bash
chromium-browser --start-fullscreen file:///home/pi/dashboard.html
```

### Via Signal K App Store
Once published, install directly from the Signal K admin panel:
1. Go to http://localhost:3000
2. Click Appstore
3. Search for "oroboro-dashboard"
4. Click Install
5. Access at http://localhost:3000/@fpugliano/oroboro-dashboard

### Auto-start on boot
```bash
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/dashboard.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=Marine Dashboard
Exec=chromium-browser --start-fullscreen --noerrdialogs file:///home/pi/dashboard.html
EOF
```

## Configuration
Edit `config.js` to set your Signal K server address, tank capacities,
solar panel maximums, and battery/inverter instance IDs.

Find your instance IDs in the Signal K Data Browser under
`electrical.batteries.*`, `electrical.inverters.*`, and `electrical.solar.*`.

## Signal K paths used

| Path | Description |
|------|-------------|
| `navigation.speedOverGround` | SOG in m/s |
| `navigation.speedThroughWater` | STW in m/s (used for true wind) |
| `navigation.headingTrue` | Heading in radians |
| `environment.depth.belowKeel` | Depth in meters |
| `environment.water.temperature` | Water temp in Kelvin |
| `environment.wind.speedApparent` | AWS in m/s |
| `environment.wind.angleApparent` | AWA in radians |
| `electrical.batteries.{id}.*` | SOC, voltage, current |
| `electrical.chargers.{id}.*` | Charging mode, temperature |
| `electrical.inverters.{id}.*` | AC loads, frequency, shore power, mode |
| `electrical.solar.{id}.panelPower` | Per-array solar power in W |
| `electrical.venus.totalPanelPower` | Total solar in W |
| `electrical.venus.dcPower` | DC loads in W |
| `tanks.freshWater.{id}.currentLevel` | Tank level as 0–1 ratio |
| `notifications.*` | Victron alarm notifications |

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `F` | Toggle fullscreen |
| `R` | Force reconnect |

## License
MIT — free to use, modify and distribute.

## Built by
Francesco Pugliano, S/V Oroboro — Leopard 38 catamaran, 30,000nm,
3 ocean crossings. https://sailingoroboro.com
