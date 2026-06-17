// Oroboro Dashboard — User Configuration
// Edit this file to match your boat's setup

const DASHBOARD_CONFIG = {

  // Signal K server
  signalk: {
    host: window.location.hostname || '192.168.1.238',
    port: 3000,
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
      userKey: '',
      apiToken: '',
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
