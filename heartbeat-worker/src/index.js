// Oroboro usage-stats Worker
// ───────────────────────────
//   POST /beat    { id, version, ts }   → record an anonymous heartbeat (KV, 45-day TTL)
//   GET  /stats?key=SECRET              → aggregated JSON (active installs + version breakdown)
//   GET  /admin                         → the admin dashboard page (asks for the key)
//
// Storage: one KV key per install, `beat:<id>`, value empty, with metadata { v, t }.
// KV list returns that metadata, so /stats aggregates without a read per key.
// The 45-day TTL means an install that stops phoning home simply ages out.
//
// Privacy: the only thing stored is a random client-generated id + version string.
// No IP is persisted, no boat name, no position.

const TTL_SECONDS = 45 * 24 * 3600;
const DAY = 86400000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // ── Heartbeat ingest ──
    if (request.method === 'POST' && url.pathname === '/beat') {
      let b;
      try { b = await request.json(); } catch { return json({ ok: false, error: 'bad json' }, 400, cors); }
      const id = typeof b.id === 'string' ? b.id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64) : '';
      if (!id) return json({ ok: false, error: 'id required' }, 400, cors);
      const version = typeof b.version === 'string' ? b.version.slice(0, 20) : '?';
      await env.STATS.put('beat:' + id, '', {
        expirationTtl: TTL_SECONDS,
        metadata: { v: version, t: Date.now() },
      });
      return json({ ok: true }, 200, cors);
    }

    // ── Aggregated stats (token-protected) ──
    if (request.method === 'GET' && url.pathname === '/stats') {
      if (env.STATS_KEY && url.searchParams.get('key') !== env.STATS_KEY) {
        return json({ ok: false, error: 'unauthorized' }, 401, cors);
      }
      const now = Date.now();
      let active24h = 0, active7d = 0, active30d = 0, total = 0;
      const versions = {};
      let cursor;
      do {
        const list = await env.STATS.list({ prefix: 'beat:', cursor, limit: 1000 });
        for (const k of list.keys) {
          const m = k.metadata || {};
          const age = now - (m.t || 0);
          total++;
          if (age <= DAY) active24h++;
          if (age <= 7 * DAY) active7d++;
          if (age <= 30 * DAY) active30d++;
          const v = m.v || '?';
          versions[v] = (versions[v] || 0) + 1;
        }
        cursor = list.list_complete ? null : list.cursor;
      } while (cursor);
      return json({ ok: true, now, active24h, active7d, active30d, total, versions }, 200, cors);
    }

    // ── Admin page ──
    if (request.method === 'GET' && (url.pathname === '/admin' || url.pathname === '/' || url.pathname === '/admin.html')) {
      return new Response(ADMIN_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return json({ ok: false, error: 'not found' }, 404, cors);
  },
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const ADMIN_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Oroboro — Usage Stats</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:#0b1220; color:#e2e8f0; }
  .wrap { max-width:720px; margin:0 auto; padding:28px 18px 60px; }
  h1 { font-size:20px; font-weight:700; margin:0 0 4px; }
  .sub { color:#64748b; font-size:12px; margin-bottom:22px; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; }
  .card { background:#111c2e; border:1px solid #1e2a3c; border-radius:12px; padding:16px; }
  .card .n { font-size:38px; font-weight:700; line-height:1; }
  .card .l { color:#94a3b8; font-size:12px; margin-top:6px; text-transform:uppercase; letter-spacing:.05em; }
  .active .n { color:#22c55e; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; margin:28px 0 10px; }
  .vrow { display:flex; align-items:center; gap:10px; margin-bottom:6px; font-size:13px; }
  .vrow .tag { width:64px; font-weight:600; color:#22d3ee; }
  .vrow .bar { height:16px; background:#22d3ee33; border-left:3px solid #22d3ee; border-radius:3px; }
  .vrow .cnt { color:#94a3b8; }
  input { background:#111c2e; border:1px solid #1e2a3c; color:#e2e8f0; border-radius:8px; padding:10px 12px; font-size:14px; width:240px; }
  button { background:#2563eb; color:#fff; border:none; border-radius:8px; padding:10px 16px; font-size:14px; font-weight:600; cursor:pointer; }
  .err { color:#fca5a5; font-size:13px; margin-top:10px; }
  .muted { color:#64748b; font-size:11px; margin-top:18px; }
</style></head>
<body><div class="wrap">
  <h1>Oroboro — Usage Stats</h1>
  <div class="sub">Anonymous active-install counts. No boat names, no positions.</div>
  <div id="auth">
    <input id="key" type="password" placeholder="Admin key" autocomplete="off"/>
    <button onclick="load()">View</button>
    <div id="err" class="err"></div>
  </div>
  <div id="dash" style="display:none">
    <div class="cards">
      <div class="card active"><div class="n" id="a24">–</div><div class="l">Active · 24h</div></div>
      <div class="card active"><div class="n" id="a7">–</div><div class="l">Active · 7 days</div></div>
      <div class="card active"><div class="n" id="a30">–</div><div class="l">Active · 30 days</div></div>
      <div class="card"><div class="n" id="tot">–</div><div class="l">Known installs</div></div>
    </div>
    <h2>By version</h2>
    <div id="versions"></div>
    <div class="muted" id="asof"></div>
  </div>
</div>
<script>
  const K = 'oroboroStatsKey';
  function fmt(n){ return n.toLocaleString(); }
  async function load(){
    const key = document.getElementById('key').value || localStorage.getItem(K) || '';
    document.getElementById('err').textContent = '';
    try {
      const r = await fetch('/stats?key=' + encodeURIComponent(key));
      if (r.status === 401) { document.getElementById('err').textContent = 'Wrong key.'; return; }
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'error');
      localStorage.setItem(K, key);
      document.getElementById('auth').style.display = 'none';
      document.getElementById('dash').style.display = '';
      document.getElementById('a24').textContent = fmt(d.active24h);
      document.getElementById('a7').textContent  = fmt(d.active7d);
      document.getElementById('a30').textContent = fmt(d.active30d);
      document.getElementById('tot').textContent = fmt(d.total);
      const entries = Object.entries(d.versions).sort((a,b)=>b[1]-a[1]);
      const max = entries.reduce((m,[,c])=>Math.max(m,c),1);
      document.getElementById('versions').innerHTML = entries.map(([v,c])=>
        '<div class="vrow"><span class="tag">v'+v+'</span>'+
        '<span class="bar" style="width:'+Math.max(6,Math.round(c/max*100))+'%"></span>'+
        '<span class="cnt">'+c+'</span></div>').join('') || '<div class="cnt">no data yet</div>';
      document.getElementById('asof').textContent = 'as of ' + new Date(d.now).toLocaleString();
    } catch(e){ document.getElementById('err').textContent = 'Failed: ' + e.message; }
  }
  if (localStorage.getItem(K)) load();
</script>
</body></html>`;
