'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');

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

// ─── Server ───────────────────────────────────────────────────────────────────
const SK_ANCHOR_PATH = '/signalk/v1/api/vessels/self/navigation/anchor/position';
const SK_ANCHOR_READ = '/signalk/v1/api/vessels/self/navigation/anchor';

http.createServer(async (req, res) => {
  const { method, url } = req;
  console.log('[anchor-api]', method, url);

  if (method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

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
      r.status >= 200 && r.status < 300 ? json(res, 200, { ok: true }) : json(res, 502, { ok: false, error: 'SK returned HTTP ' + r.status });
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

  json(res, 404, { ok: false, error: 'not found' });
}).listen(PORT, async () => {
  console.log('[anchor-api] Listening on port ' + PORT);
  if (!USERNAME || !PASSWORD) {
    console.warn('[anchor-api] WARNING: username/password not set in anchor-api-config.json — PUT calls will fail');
  } else {
    try { await authenticate(); } catch (e) { console.error('[anchor-api] Auth error:', e.message); }
  }
});
