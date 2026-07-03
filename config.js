// Oroboro Dashboard — User Configuration
// Edit this file to match your boat's setup
//
// ⚠️  SECRETS: the influx token and pushover keys below are
// PLACEHOLDERS in the repository. Put your real values ONLY in the
// copy of this file on the boat's Raspberry Pi. Never commit real
// tokens/keys to GitHub — this repo is public.

const DASHBOARD_CONFIG = {

  // Signal K server
  signalk: {
    host: window.location.hostname || 'localhost',
    port: 3000,
  },

  // InfluxDB (historical data for the Polar Performance page)
  // host: leave '' to use the same hostname as the page — this works
  // on the boat LAN and over Tailscale without changes.
  // token: create a READ-ONLY token for the signalk bucket in the
  // InfluxDB UI (http://<pi>:8086 → Load Data → API Tokens).
  influx: {
    host: '',
    port: 8086,
    org: 'Oroboro',
    bucket: 'signalk',
    token: 'PASTE_YOUR_INFLUX_READ_TOKEN_HERE',
  },

  // Vessel
  vessel: {
    name: 'My Boat',
  },

  // Water tanks — set capacity in liters for each tank
  tanks: {
    port: {
      path: 'tanks.freshWater.22.currentLevel',
      capacity: 380,
      label: 'PORT'
    },
    stbd: {
      path: 'tanks.freshWater.20.currentLevel',
      capacity: 380,
      label: 'STBD'
    }
  },

  // Solar chargers — set max watts for each panel array
  // Find your instance IDs in Signal K Data Browser under electrical.solar.*
  solar: [
    { id: '278', label: 'Rigid panels',  maxWatts: 960 },
    { id: '279', label: 'Flex panels 1', maxWatts: 200 },
    { id: '289', label: 'Flex panels 2', maxWatts: 200 },
  ],

  // Battery monitor instance ID
  // Find under electrical.batteries.* in Signal K Data Browser
  battery: {
    instance: '288',
  },

  // Inverter/charger instance ID
  // Find under electrical.inverters.* in Signal K Data Browser
  inverter: {
    instance: '276',
  },

  // Anchor Watch
  anchor: {
    defaultRadius: 30,
    pushover: {
      userKey: 'PASTE_YOUR_PUSHOVER_USER_KEY_HERE',
      apiToken: 'PASTE_YOUR_PUSHOVER_API_TOKEN_HERE',
      events: {
        dragging:     { enabled: true,  priority: 2,  title: "⚠️ Anchor Dragging!", message: "S/V Oroboro is dragging anchor. Check position immediately." },
        gpsLost:      { enabled: true,  priority: 2,  title: "⚠️ Anchor Alarm: GPS Lost", message: "No GPS position updates received." },
        anchorSet:    { enabled: true,  priority: 0,  title: "Anchor Set", message: "Anchor alarm armed on S/V Oroboro." },
        anchorRaised: { enabled: true,  priority: 0,  title: "Anchor Raised", message: "Anchor alarm disarmed on S/V Oroboro." },
        okCheckin:    { enabled: false, priority: -1, title: "Anchor OK", message: "Anchor holding, all normal." },
      },
    },
  },

};
