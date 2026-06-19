'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const STATE_FILE      = '/home/pi/anchor-api/anchor-state.json';
const CONFIG_JS_PATH  = '/usr/lib/node_modules/signalk-server/public/config.js';

const cfg      = JSON.parse(fs.readFileSync(path.join(__dirname, 'anchor-api-config.json'), 'utf8'));
const SK_HOST  = cfg.signalkHost || 'localhost';
const SK_PORT  = cfg.signalkPort || 3000;
const USERNAME = cfg.username    || '';
const PASSWORD = cfg.password    || '';
const PORT     = cfg.proxyPort   || 3001;

let skToken = null;

// ─── Signal K helpers ─────────────────────────────────────────────────────────
function skRequest(method, skPath, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    const req = http.request({ hostname: SK_HOST, port: SK_PORT, path: skPath, method, headers }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function authenticate() {
  const res = await skRequest('POST', '/signalk/v1/auth/login', { username: USERNAME, password: PASSWORD }, null);
  if (res.status !== 200) throw new Error('SK auth failed: HTTP ' + res.status);
  const parsed = JSON.parse(res.body);
  if (!parsed.token) throw new Error('SK auth: no token in response');
  skToken = parsed.token;
  console.log('[anchor-api] Authenticated to Signal K');
}

async function skPut(skPath, value) {
  let res = await skRequest('PUT', skPath, { value }, skToken);
  if (res.status === 401) {
    console.log('[anchor-api] Token expired, re-authenticating…');
    await authenticate();
    res = await skRequest('PUT', skPath, { value }, skToken);
  }
  return res;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function json(res, status, obj) {
  cors(res); res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise(resolve => { let d = ''; req.on('data', c => { d += c; }); req.on('end', () => resolve(d)); });
}
function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch(e) { return {}; }
}
function writeState(obj) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(obj, null, 2), 'utf8');
}

// ─── Server ───────────────────────────────────────────────────────────────────
const SK_ANCHOR_PATH = '/signalk/v1/api/vessels/self/navigation/anchor/position';
const SK_ANCHOR_READ = '/signalk/v1/api/vessels/self/navigation/anchor';

http.createServer(async (req, res) => {
  const { method, url } = req;
  console.log('[anchor-api]', method, url);

  if (method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  if (method === 'GET' && url === '/api/anchor/config') {
    try {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      json(res, 200, { ok: true, config: JSON.parse(raw) });
    } catch (e) {
      json(res, 200, { ok: true, config: null }); // file doesn't exist yet — not an error
    }
    return;
  }

  if (method === 'POST' && url === '/api/anchor/config') {
    try {
      const body = JSON.parse(await readBody(req));
      // Preserve the trail field — config saves must not wipe accumulated trail points
      const existing = readState();
      writeState(Object.assign({}, body, { trail: existing.trail || [] }));
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }

  if (method === 'GET' && url === '/api/anchor/trail') {
    try {
      const state = readState();
      json(res, 200, { ok: true, trail: state.trail || [] });
    } catch (e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }

  if (method === 'POST' && url === '/api/anchor/trail') {
    try {
      const body = JSON.parse(await readBody(req));
      if (body.lat == null || body.lon == null) { json(res, 400, { ok: false, error: 'lat and lon required' }); return; }
      const state = readState();
      const trail = state.trail || [];
      trail.push({ lat: Number(body.lat), lon: Number(body.lon), t: Date.now() });
      if (trail.length > 2000) trail.splice(0, trail.length - 2000);
      writeState(Object.assign({}, state, { trail }));
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }

  if (method === 'POST' && url === '/api/anchor/radius') {
    try {
      const body = JSON.parse(await readBody(req));
      if (body.value == null || isNaN(Number(body.value))) {
        json(res, 400, { ok: false, error: 'value (meters) required' }); return;
      }
      const r = await skPut('/signalk/v1/api/vessels/self/navigation/anchor/maxRadius', Number(body.value));
      r.status >= 200 && r.status < 300
        ? json(res, 200, { ok: true })
        : json(res, 502, { ok: false, error: 'SK returned HTTP ' + r.status });
    } catch (e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }

  if (method === 'POST' && url === '/api/anchor/set') {
    try {
      const body = JSON.parse(await readBody(req));
      const { latitude, longitude } = body;
      if (latitude == null || longitude == null) { json(res, 400, { ok: false, error: 'latitude and longitude required' }); return; }
      const r = await skPut(SK_ANCHOR_PATH, { latitude, longitude });
      r.status >= 200 && r.status < 300 ? json(res, 200, { ok: true }) : json(res, 502, { ok: false, error: 'SK returned HTTP ' + r.status });
    } catch (e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }

  if (method === 'POST' && url === '/api/anchor/raise') {
    try {
      const r = await skPut(SK_ANCHOR_PATH, null);
      if (r.status >= 200 && r.status < 300) {
        // Clear the swing trail on raise
        try { writeState(Object.assign({}, readState(), { trail: [] })); } catch(e) {}
        json(res, 200, { ok: true });
      } else {
        json(res, 502, { ok: false, error: 'SK returned HTTP ' + r.status });
      }
    } catch (e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }

  if (method === 'GET' && url === '/api/anchor/status') {
    try {
      const r = await skRequest('GET', SK_ANCHOR_READ, null, null);
      cors(res); res.writeHead(r.status, { 'Content-Type': 'application/json' }); res.end(r.body);
    } catch (e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }

  if (method === 'GET' && url === '/api/dashboard/config') {
    try {
      console.log('[anchor-api] GET /api/dashboard/config, path:', CONFIG_JS_PATH);
      const exists = fs.existsSync(CONFIG_JS_PATH);
      console.log('[anchor-api] config.js exists:', exists);
      if (!exists) { json(res, 500, { ok: false, error: 'config.js not found at ' + CONFIG_JS_PATH }); return; }
      const src = fs.readFileSync(CONFIG_JS_PATH, 'utf8');
      console.log('[anchor-api] config.js first 200 chars:', src.slice(0, 200));
      const eqIdx = src.indexOf('DASHBOARD_CONFIG');
      if (eqIdx === -1) { json(res, 500, { ok: false, error: 'DASHBOARD_CONFIG not found in config.js' }); return; }
      const afterEq = src.slice(src.indexOf('=', eqIdx) + 1).trim().replace(/\s*;\s*$/, '');
      console.log('[anchor-api] extracted object (first 100):', afterEq.slice(0, 100));
      const config = vm.runInNewContext('(' + afterEq + ')', { window: { location: { hostname: '' } } });
      console.log('[anchor-api] parsed config keys:', Object.keys(config));
      json(res, 200, { ok: true, config });
    } catch(e) {
      console.error('[anchor-api] GET /api/dashboard/config error:', e.message);
      json(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  if (method === 'POST' && url === '/api/dashboard/config') {
    try {
      const body = JSON.parse(await readBody(req));
      if (!body.config) { json(res, 400, { ok: false, error: 'config required' }); return; }
      const out = 'const DASHBOARD_CONFIG = ' + JSON.stringify(body.config, null, 2) + ';\n';
      fs.writeFileSync(CONFIG_JS_PATH, out, 'utf8');
      json(res, 200, { ok: true });
    } catch(e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }

  if (method === 'GET' && url.startsWith('/api/signalk/scan/')) {
    const category = url.slice('/api/signalk/scan/'.length);
    const SK_SCAN = {
      solar:     '/signalk/v1/api/vessels/self/electrical/solar',
      batteries: '/signalk/v1/api/vessels/self/electrical/batteries',
      inverters:  '/signalk/v1/api/vessels/self/electrical/inverters',
    };
    const skPath = SK_SCAN[category];
    if (!skPath) { json(res, 400, { ok: false, error: 'unknown category' }); return; }
    try {
      let r = await skRequest('GET', skPath, null, skToken);
      if (r.status === 401) { await authenticate(); r = await skRequest('GET', skPath, null, skToken); }
      if (r.status !== 200) { json(res, 200, { ok: true, instances: [] }); return; }
      const data = JSON.parse(r.body);
      const instances = Object.entries(data)
        .filter(([k]) => !k.startsWith('_') && typeof data[k] === 'object' && data[k] !== null)
        .map(([id, val]) => {
          let sample = '—';
          if (category === 'solar') {
            const pw = val?.panelPower?.value;
            if (pw != null) sample = Math.round(pw) + 'W';
          } else if (category === 'batteries') {
            const v = val?.voltage?.value, soc = val?.stateOfCharge?.value;
            const parts = [];
            if (v != null) parts.push(v.toFixed(1) + 'V');
            if (soc != null) parts.push(Math.round(soc * 100) + '%');
            if (parts.length) sample = parts.join(' / ');
          } else if (category === 'inverters') {
            const mode = val?.mode?.value ?? val?.state?.value;
            if (mode != null) sample = String(mode);
          }
          return { id, path: 'electrical.' + category + '.' + id, sample };
        });
      json(res, 200, { ok: true, instances });
    } catch(e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }

  json(res, 404, { ok: false, error: 'not found' });
}).listen(PORT, async () => {
  console.log('[anchor-api] Listening on port ' + PORT);
  if (!USERNAME || !PASSWORD) {
    console.warn('[anchor-api] WARNING: username/password not set in anchor-api-config.json — PUT calls will fail');
  } else {
    try { await authenticate(); } catch (e) { console.error('[anchor-api] Auth error:', e.message); }
  }
});
