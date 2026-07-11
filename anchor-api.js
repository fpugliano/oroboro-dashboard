'use strict';
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const vm    = require('vm');

const STATE_FILE      = '/home/pi/anchor-api/anchor-state.json';
const GUARDIAN_FILE   = '/home/pi/anchor-api/guardian-state.json';
const CONFIG_JS_PATH  = '/usr/lib/node_modules/signalk-server/public/config.js';

const cfg      = JSON.parse(fs.readFileSync(path.join(__dirname, 'anchor-api-config.json'), 'utf8'));
const SK_HOST  = cfg.signalkHost || 'localhost';
const SK_PORT  = cfg.signalkPort || 3000;
const USERNAME = cfg.username    || '';
const PASSWORD = cfg.password    || '';
const PORT     = cfg.proxyPort   || 3001;

let skToken = null;

// ─── Monitoring state ─────────────────────────────────────────────────────
const _mon = {
  running:        false,
  alarmState:     'ok',   // 'ok' | 'dragging' | 'gpsLost'
  distance:       null,
  bearing:        null,
  lastCheck:      null,
  anchorLat:      null,
  anchorLon:      null,
  curLat:         null,
  curLon:         null,
  radius:         null,
  lastPosTime:    null,
  lastTrailWrite: null,
  trailPoints:    0,
  lastDragPush:   0,
  armingUntil:    0,
  _loop:          null,
  _trail:         null,
};

// ─── Guardian state (runs 24/7 regardless of any open browser) ────────────
const _guardian = {
  radius:      parseInt((function(){ try { return JSON.parse(fs.readFileSync(GUARDIAN_FILE,'utf8')).radius; } catch(e){ return 100; } })() || 100),
  armed:       (function(){ try { var a = JSON.parse(fs.readFileSync(GUARDIAN_FILE,'utf8')).armed; return a !== false; } catch(e){ return true; } })(),
  lastRadius:  parseInt((function(){ try { return JSON.parse(fs.readFileSync(GUARDIAN_FILE,'utf8')).lastRadius; } catch(e){ return 100; } })() || 100),
  selfUrn:     null,
  encounters:  {},
  reports:     (function(){ try { return JSON.parse(fs.readFileSync(GUARDIAN_FILE,'utf8')).reports || []; } catch(e){ return []; } })(),
  nbTrails:    {},
  _loop:       null,
};
const NB_RADIUS_M = 926;
const NB_MAX_PTS  = 240;
const GUARDIAN_ALERT_M = 40;

function saveGuardian() {
  try { fs.writeFileSync(GUARDIAN_FILE, JSON.stringify({ radius: _guardian.radius, armed: _guardian.armed, lastRadius: _guardian.lastRadius, reports: _guardian.reports.slice(0,50) })); } catch(e) {}
}

// ─── Math ─────────────────────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, p1 = lat1*Math.PI/180, p2 = lat2*Math.PI/180;
  const dp = (lat2-lat1)*Math.PI/180, dl = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function bearingTo(lat1, lon1, lat2, lon2) {
  const p1=lat1*Math.PI/180, p2=lat2*Math.PI/180, dl=(lon2-lon1)*Math.PI/180;
  return (Math.atan2(Math.sin(dl)*Math.cos(p2), Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl))*180/Math.PI+360)%360;
}
function bearingInArc(b, start, end) {
  let span = end - start; if (span < 0) span += 360; if (span === 0) return true;
  return ((b - start + 360) % 360) <= span;
}
function isOutsideBound(dist, bear, state) {
  if (state.mode === 'advanced') {
    return !(dist >= (state.small||20) && dist <= (state.big||40) &&
             bearingInArc(bear, state.startAngle||0, state.endAngle||90));
  }
  return dist > (state.radius || 30);
}

// ─── Pushover ────────────────────────────────────────────────────────────
function sendPushover(pvCfg, eventKey, detail) {
  if (!pvCfg || !pvCfg.apiToken || !pvCfg.userKey) return;
  const ev = (pvCfg.events || {})[eventKey];
  if (!ev || !ev.enabled) return;
  const msg = detail ? ev.message + ' ' + detail : ev.message;
  const payload = {
    token: pvCfg.apiToken, user: pvCfg.userKey,
    title: ev.title, message: msg, priority: ev.priority,
  };
  if (ev.priority === 2) { payload.retry = 30; payload.expire = 300; payload.sound = 'siren'; }
  const body = JSON.stringify(payload);
  const req = https.request({
    hostname: 'api.pushover.net', port: 443, path: '/1/messages.json',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, r => r.resume());
  req.on('error', e => console.error('[anchor-api] Pushover error:', e.message));
  req.write(body); req.end();
}

// ─── Monitoring loop ──────────────────────────────────────────────────────
async function monitorTick() {
  try {
    // 1. Current position from SK
    const posR = await skRequest('GET', '/signalk/v1/api/vessels/self/navigation/position', null, null);
    if (posR.status === 200) {
      const p = JSON.parse(posR.body)?.value;
      if (p && p.latitude != null && p.longitude != null) {
        _mon.curLat = p.latitude; _mon.curLon = p.longitude; _mon.lastPosTime = Date.now();
      }
    }

    // 2. Anchor state from SK
    const ancR = await skRequest('GET', SK_ANCHOR_READ, null, null);
    if (ancR.status !== 200) throw new Error('SK anchor HTTP ' + ancR.status);
    const anc = JSON.parse(ancR.body);
    const aPos = anc?.position?.value;
    if (!aPos || aPos.latitude == null) {
      console.log('[anchor-api] Anchor no longer set in SK — stopping monitoring');
      stopMonitoring(); return;
    }
    _mon.anchorLat = aPos.latitude; _mon.anchorLon = aPos.longitude;

    // 3. maxRadius from SK
    const radR = await skRequest('GET', '/signalk/v1/api/vessels/self/navigation/anchor/maxRadius', null, null);
    if (radR.status === 200) {
      const rv = JSON.parse(radR.body)?.value;
      if (typeof rv === 'number' && rv > 0) _mon.radius = rv;
    }

    _mon.lastCheck = Date.now();

    // 4. GPS lost (>120s with no position update)
    if (!_mon.lastPosTime || Date.now() - _mon.lastPosTime > 120000) {
      if (_mon.alarmState !== 'gpsLost') {
        _mon.alarmState = 'gpsLost';
        console.log('[anchor-api] GPS lost — no position update for 120s');
        sendPushover(readState().pushover, 'gpsLost');
      }
      return;
    }
    if (_mon.curLat == null) return;

    // 5. Distance and bearing
    _mon.distance = haversine(_mon.anchorLat, _mon.anchorLon, _mon.curLat, _mon.curLon);
    _mon.bearing  = bearingTo(_mon.anchorLat, _mon.anchorLon, _mon.curLat, _mon.curLon);

    // 6. Alarm check
    const state   = readState();
    const outside = isOutsideBound(_mon.distance, _mon.bearing, state);

    if (Date.now() < _mon.armingUntil) {
      _mon.alarmState = outside ? 'dragging' : 'ok';
      return; // suppress during arming window
    }

    const now = Date.now();
    if (outside) {
      const limit  = state.mode === 'advanced' ? state.big : state.radius;
      const detail = Math.round(_mon.distance) + 'm from anchor (allowed: ' + limit + 'm)';
      if (_mon.alarmState !== 'dragging') {
        _mon.alarmState = 'dragging'; _mon.lastDragPush = now;
        console.log('[anchor-api] ALARM: Boat is ' + detail + ' — Pushover sent');
        sendPushover(state.pushover, 'dragging', detail);
      } else if (now - _mon.lastDragPush > 60000) {
        _mon.lastDragPush = now;
        console.log('[anchor-api] ALARM (repeat): Boat is ' + detail + ' — Pushover sent');
        sendPushover(state.pushover, 'dragging', detail);
      }
    } else {
      if (_mon.alarmState !== 'ok') console.log('[anchor-api] Alarm cleared — boat back within bounds');
      _mon.alarmState = 'ok';
    }

  } catch(e) {
    console.error('[anchor-api] Poll error:', e.message);
  }
}

async function trailTick() {
  if (!_mon.running || _mon.curLat == null) return;
  try {
    const state = readState();
    const trail = state.trail || [];
    trail.push({ lat: _mon.curLat, lon: _mon.curLon, t: Date.now() });
    if (trail.length > 10000) trail.splice(0, trail.length - 10000);
    writeState(Object.assign({}, state, { trail }));
    _mon.lastTrailWrite = Date.now(); _mon.trailPoints = trail.length;
    console.log('[anchor-api] Trail point recorded (' + trail.length + ' total)');
  } catch(e) {
    console.error('[anchor-api] Trail write error:', e.message);
  }
}

async function guardianTick() {
  try {
    if (!_mon.running || _mon.anchorLat == null || _guardian.radius <= 0 || !_guardian.armed) {
      Object.keys(_guardian.encounters).forEach(id => finalizeEncounter(id));
      return;
    }
    const r = await skRequest('GET', '/signalk/v1/api/vessels', null, null);
    if (r.status !== 200) return;
    const vessels = JSON.parse(r.body);
    if (!_guardian.selfUrn) {
      try {
        const selfR = await skRequest('GET', '/signalk/v1/api/self', null, null);
        if (selfR.status === 200) {
          let u = selfR.body.trim().replace(/^"|"$/g, '');
          _guardian.selfUrn = u.replace(/^vessels\./, '');
        }
      } catch(e) {}
    }
    const now = Date.now();
    const seen = {};
    Object.entries(vessels).forEach(([id, v]) => {
      if (id === 'self') return;
      if (_guardian.selfUrn && (id === _guardian.selfUrn || id === 'vessels.' + _guardian.selfUrn)) return;
      const pos = v.navigation && v.navigation.position && v.navigation.position.value;
      if (!pos || pos.latitude == null) return;
      if (_mon.curLat != null) {
        const dSelf = haversine(pos.latitude, pos.longitude, _mon.curLat, _mon.curLon);
        if (dSelf < 25) return;
      }

      // ── Neighbourhood trail (within 0.5nm, every tick, no movement gate) ──
      const refLat = _mon.curLat != null ? _mon.curLat : _mon.anchorLat;
      const refLon = _mon.curLon != null ? _mon.curLon : _mon.anchorLon;
      const nbDist = haversine(pos.latitude, pos.longitude, refLat, refLon);
      if (nbDist <= NB_RADIUS_M) {
        if (!_guardian.nbTrails[id]) _guardian.nbTrails[id] = { name: (typeof v.name === 'string' ? v.name : (v.name && v.name.value)) || null, pts: [] };
        const tr = _guardian.nbTrails[id];
        tr.pts.push({ lat: pos.latitude, lon: pos.longitude, t: now });
        if (tr.pts.length > NB_MAX_PTS) tr.pts = tr.pts.slice(-NB_MAX_PTS);
      }

      // ── Guardian zone / encounter logic (only when armed) ──
      if (!guardianOn) return;
      const dist = haversine(pos.latitude, pos.longitude, _mon.anchorLat, _mon.anchorLon);
      if (dist > _guardian.radius) return;
      seen[id] = true;
      const name = (typeof v.name === 'string' ? v.name : (v.name && v.name.value)) || null;
      const mmsi = (v.mmsi || (id.match(/(\d{9})/) ? id.match(/(\d{9})/)[1] : '')) || '';
      const sog  = v.navigation && v.navigation.speedOverGround && v.navigation.speedOverGround.value;
      const sogKt = sog != null ? sog * 1.94384 : null;
      const cog  = v.navigation && v.navigation.courseOverGroundTrue && v.navigation.courseOverGroundTrue.value;
      const cogDeg = cog != null ? cog * 180/Math.PI : null;
      const pvCfg = readState().pushover;
      if (!_guardian.encounters[id]) {
        _guardian.encounters[id] = { name: name||'Unknown', mmsi, entered: new Date().toISOString(),
          minDist: dist, maxSog: sogKt, lastDist: dist, closing: false, lastCloseAlert: 0, track: [] };
        sendGuardianPush(pvCfg, 'guardianEntry', name||'Unknown', mmsi, Math.round(dist), sogKt);
      }
      const enc = _guardian.encounters[id];
      const prev = enc.lastDist; enc.lastDist = dist;
      enc.closing = dist < prev - 2;
      if (dist < enc.minDist) enc.minDist = dist;
      if (sogKt != null && (enc.maxSog == null || sogKt > enc.maxSog)) enc.maxSog = sogKt;
      enc.track.push({ t: new Date().toISOString(), lat: pos.latitude, lon: pos.longitude, sog: sogKt, cog: cogDeg, dist: Math.round(dist) });
      if (enc.track.length > 300) enc.track = enc.track.slice(-300);
      if (enc.closing && dist < GUARDIAN_ALERT_M && now - enc.lastCloseAlert > 120000) {
        enc.lastCloseAlert = now;
        sendGuardianPush(pvCfg, 'guardianClosing', enc.name, enc.mmsi, Math.round(dist), sogKt);
      }
    });

    // Prune neighbourhood trails: drop vessels no longer within 0.5nm this tick
    const nbSeen = {};
    Object.entries(vessels).forEach(([vid, vv]) => {
      const p = vv.navigation && vv.navigation.position && vv.navigation.position.value;
      if (!p || p.latitude == null) return;
      const rLat = _mon.curLat != null ? _mon.curLat : _mon.anchorLat;
      const rLon = _mon.curLon != null ? _mon.curLon : _mon.anchorLon;
      if (haversine(p.latitude, p.longitude, rLat, rLon) <= NB_RADIUS_M) nbSeen[vid] = true;
    });
    Object.keys(_guardian.nbTrails).forEach(id => { if (!nbSeen[id]) delete _guardian.nbTrails[id]; });

    if (guardianOn) Object.keys(_guardian.encounters).forEach(id => { if (!seen[id]) finalizeEncounter(id); });
  } catch(e) { console.error('[anchor-api] guardianTick error:', e.message); }
}

function finalizeEncounter(id) {
  const enc = _guardian.encounters[id];
  if (!enc) return;
  const report = {
    id: Date.now() + '_' + id, saved: new Date().toISOString(),
    vessel: enc.name, mmsi: enc.mmsi, entered: enc.entered, left: new Date().toISOString(),
    minDistM: Math.round(enc.minDist), maxSogKt: enc.maxSog != null ? enc.maxSog.toFixed(1) : '—',
    anchorLat: _mon.anchorLat, anchorLon: _mon.anchorLon, track: enc.track.slice(),
  };
  _guardian.reports.unshift(report);
  if (_guardian.reports.length > 50) _guardian.reports = _guardian.reports.slice(0, 50);
  saveGuardian();
  sendGuardianPush(readState().pushover, 'guardianCleared', enc.name, enc.mmsi, report.minDistM, null);
  delete _guardian.encounters[id];
  console.log('[anchor-api] Guardian encounter finalized:', enc.name, report.minDistM + 'm');
}

function sendGuardianPush(pvCfg, eventKey, vessel, mmsi, distM, sogKt) {
  if (!pvCfg || !pvCfg.apiToken || !pvCfg.userKey) return;
  const ev = (pvCfg.events || {})[eventKey];
  if (!ev || !ev.enabled) return;
  const detail = (vessel||'Unknown') + (mmsi ? ' (MMSI '+mmsi+')' : '') + ' — ' + distM + 'm away' + (sogKt ? ', '+sogKt.toFixed(1)+'kt' : '');
  const payload = { token: pvCfg.apiToken, user: pvCfg.userKey, title: ev.title, message: detail, priority: ev.priority };
  if (ev.priority === 2) { payload.retry = 60; payload.expire = 3600; payload.sound = 'siren'; }
  const body = JSON.stringify(payload);
  const req = https.request({ hostname:'api.pushover.net', port:443, path:'/1/messages.json', method:'POST',
    headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} }, r => r.resume());
  req.on('error', e => console.error('[anchor-api] Guardian pushover error:', e.message));
  req.write(body); req.end();
}

function startMonitoring(armMs) {
  if (_mon.running) { clearInterval(_mon._loop); clearInterval(_mon._trail); }
  _mon.running     = true;
  _mon.alarmState  = 'ok';
  _mon.armingUntil = Date.now() + (armMs || 0);
  _mon._loop  = setInterval(monitorTick, 5000);
  _mon._trail = setInterval(trailTick,  60000);
  if (_guardian._loop) clearInterval(_guardian._loop);
  _guardian._loop = setInterval(guardianTick, 15000);
  monitorTick(); // immediate first tick
  guardianTick();
}

function stopMonitoring() {
  clearInterval(_mon._loop); clearInterval(_mon._trail);
  if (_guardian._loop) { clearInterval(_guardian._loop); _guardian._loop = null; }
  Object.keys(_guardian.encounters).forEach(id => finalizeEncounter(id));
  _mon.running    = false;  _mon.alarmState = 'ok';
  _mon.distance   = null;   _mon.bearing    = null;
  _mon._loop      = null;   _mon._trail     = null;
}

// ─── Signal K helpers ─────────────────────────────────────────────────────
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

// ─── HTTP helpers ─────────────────────────────────────────────────────────
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

// ─── Server ───────────────────────────────────────────────────────────────
const SK_ANCHOR_PATH = '/signalk/v1/api/vessels/self/navigation/anchor/position';
const SK_ANCHOR_READ = '/signalk/v1/api/vessels/self/navigation/anchor';

http.createServer(async (req, res) => {
  const method = req.method;
  const url    = req.url.split('?')[0]; // strip query strings for routing
  console.log('[anchor-api]', method, url);

  if (method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  if (method === 'GET' && url === '/api/anchor/config') {
    try {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      json(res, 200, { ok: true, config: JSON.parse(raw) });
    } catch (e) {
      json(res, 200, { ok: true, config: null });
    }
    return;
  }

  if (method === 'POST' && url === '/api/anchor/config') {
    try {
      const body = JSON.parse(await readBody(req));
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

  if (method === 'POST' && url === '/api/anchor/radius') {
    try {
      const body = JSON.parse(await readBody(req));
      if (body.value == null || isNaN(Number(body.value))) {
        json(res, 400, { ok: false, error: 'value (meters) required' }); return;
      }
      const newRadius = Number(body.value);
      const r = await skPut('/signalk/v1/api/vessels/self/navigation/anchor/maxRadius', newRadius);
      if (r.status >= 200 && r.status < 300) {
        _mon.radius = newRadius;
        json(res, 200, { ok: true });
      } else {
        json(res, 502, { ok: false, error: 'SK returned HTTP ' + r.status });
      }
    } catch (e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }

  if (method === 'POST' && url === '/api/anchor/set') {
    try {
      const body = JSON.parse(await readBody(req));
      const { latitude, longitude } = body;
      if (latitude == null || longitude == null) {
        json(res, 400, { ok: false, error: 'latitude and longitude required' }); return;
      }
      const r = await skPut(SK_ANCHOR_PATH, { latitude, longitude });
      if (r.status >= 200 && r.status < 300) {
        // Clear trail, update known anchor position, start monitoring with 30s arming window
        try { writeState(Object.assign({}, readState(), { trail: [] })); } catch(e) {}
        _mon.anchorLat = latitude; _mon.anchorLon = longitude;
        _mon.trailPoints = 0; _mon.lastTrailWrite = null;
        stopMonitoring();
        startMonitoring(30000);
        console.log(`[anchor-api] Anchor monitoring started — position: ${latitude},${longitude}, arming 30s`);
        sendPushover(readState().pushover, 'anchorSet');
        json(res, 200, { ok: true });
      } else {
        json(res, 502, { ok: false, error: 'SK returned HTTP ' + r.status });
      }
    } catch (e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }

  if (method === 'POST' && url === '/api/anchor/raise') {
    try {
      const r = await skPut(SK_ANCHOR_PATH, null);
      if (r.status >= 200 && r.status < 300) {
        stopMonitoring();
        try { writeState(Object.assign({}, readState(), { trail: [] })); } catch(e) {}
        _mon.trailPoints = 0; _mon.lastTrailWrite = null;
        console.log('[anchor-api] Anchor monitoring stopped — anchor raised');
        sendPushover(readState().pushover, 'anchorRaised');
        json(res, 200, { ok: true });
      } else {
        json(res, 502, { ok: false, error: 'SK returned HTTP ' + r.status });
      }
    } catch (e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }

  if (method === 'GET' && url === '/api/guardian/state') {
    json(res, 200, {
      ok: true,
      radius: _guardian.radius,
      armed: _guardian.armed,
      active: Object.entries(_guardian.encounters).map(([id, e]) => ({
        id, vessel: e.name, mmsi: e.mmsi, entered: e.entered,
        minDistM: Math.round(e.minDist), maxSogKt: e.maxSog != null ? e.maxSog.toFixed(1) : '—',
        closing: e.closing, trackPts: e.track.length,
        lastPos: e.track.length ? e.track[e.track.length-1] : null, track: e.track,
      })),
      reports: _guardian.reports.slice(0, 20),
      nbTrails: Object.entries(_guardian.nbTrails).map(([id, t]) => ({ id, name: t.name, pts: t.pts })),
    });
    return;
  }
  if (method === 'POST' && url === '/api/guardian/config') {
    try {
      const body = JSON.parse(await readBody(req));
      if (typeof body.radius === 'number') {
        _guardian.radius = body.radius;
        if (body.radius > 0) _guardian.lastRadius = body.radius;  // remember for re-arm
      }
      if (typeof body.armed === 'boolean') {
        _guardian.armed = body.armed;
        if (body.armed && _guardian.radius <= 0) _guardian.radius = _guardian.lastRadius || 100;  // restore radius on re-arm
        if (!body.armed) {
          Object.keys(_guardian.encounters).forEach(id => finalizeEncounter(id));  // close open encounters when disarming
        }
      }
      saveGuardian();
      json(res, 200, { ok: true, radius: _guardian.radius, armed: _guardian.armed });
    } catch(e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }
  if (method === 'GET' && url === '/api/anchor/status') {
    json(res, 200, {
      ok:             true,
      monitoring:     _mon.running,
      alarmState:     _mon.alarmState,
      distance:       _mon.distance,
      bearing:        _mon.bearing,
      lastCheck:      _mon.lastCheck,
      lastTrailWrite: _mon.lastTrailWrite,
      trailPoints:    _mon.trailPoints,
      anchorLat:      _mon.anchorLat,
      anchorLon:      _mon.anchorLon,
      curLat:         _mon.curLat,
      curLon:         _mon.curLon,
      radius:         _mon.radius,
    });
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
    console.warn('[anchor-api] WARNING: username/password not set — PUT calls will fail');
  } else {
    try { await authenticate(); } catch (e) { console.error('[anchor-api] Auth error:', e.message); }
  }

  // Resume monitoring if an anchor is already set in Signal K
  console.log('[anchor-api] Startup: checking SK for existing anchor at', SK_ANCHOR_READ);
  try {
    const r = await skRequest('GET', SK_ANCHOR_READ, null, null);
    console.log('[anchor-api] Startup: SK responded HTTP', r.status);
    if (r.status === 200) {
      let data;
      try {
        data = JSON.parse(r.body);
      } catch(pe) {
        console.error('[anchor-api] Startup: JSON parse error:', pe.message);
        console.error('[anchor-api] Startup: raw body (first 300):', r.body.slice(0, 300));
        return;
      }
      console.log('[anchor-api] Startup: anchor data keys:', Object.keys(data));
      const pos = data?.position?.value;
      console.log('[anchor-api] Startup: position.value =', JSON.stringify(pos));
      if (pos && pos.latitude != null && pos.longitude != null) {
        _mon.anchorLat = pos.latitude; _mon.anchorLon = pos.longitude;
        const maxR = data?.maxRadius?.value;
        console.log('[anchor-api] Startup: maxRadius.value =', maxR);
        if (typeof maxR === 'number' && maxR > 0) _mon.radius = maxR;
        const state = readState();
        _mon.trailPoints = (state.trail || []).length;
        startMonitoring(0); // no arming window on resume
        console.log('[anchor-api] Anchor detected on startup — monitoring resumed (lat=' + pos.latitude + ', lon=' + pos.longitude + ', radius=' + _mon.radius + 'm)');
      } else {
        console.log('[anchor-api] Startup: no anchor position found in SK — monitoring not started');
      }
    } else {
      console.log('[anchor-api] Startup: SK returned non-200 — monitoring not started. Body:', r.body.slice(0, 200));
    }
  } catch(e) {
    console.error('[anchor-api] Startup anchor check error:', e.message);
  }
});
