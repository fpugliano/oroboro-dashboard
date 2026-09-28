# Oroboro usage-stats Worker

Receives the anonymous daily heartbeat from each dashboard install and serves an
admin page that shows active-install counts and version adoption.

- `POST /beat` — `{ id, version, ts }` from `anchor-api.js` (random anon id + version).
- `GET /stats?key=…` — aggregated JSON (active 24h / 7d / 30d, total, version breakdown).
- `GET /admin` — the admin dashboard (prompts for the key).

Data is one KV key per install (`beat:<id>`), value empty, metadata `{ v, t }`, with a
45-day TTL — an install that stops reporting simply ages out. No IP, name, or position
is stored.

## Deploy (one-time)

From this folder:

```bash
# 1. Create the KV namespace, then paste the printed id into wrangler.jsonc
npx wrangler kv namespace create STATS

# 2. Set the admin password used by /stats and the admin page
npx wrangler secret put STATS_KEY

# 3. Deploy
npx wrangler deploy
```

That gives you a `https://oroboro-stats.<account>.workers.dev` URL.

- **Quickest:** point the client at that URL — set `HEARTBEAT_ENDPOINT` in `anchor-api.js`
  to `https://oroboro-stats.<account>.workers.dev/beat`, redeploy the Pi.
- **Production (boat.sailingoroboro.com):** uncomment the `routes` block in `wrangler.jsonc`
  and redeploy, so `/beat`, `/stats`, `/admin` are served on that host (matches the
  default `HEARTBEAT_ENDPOINT` already in `anchor-api.js`). The zone must be in this
  Cloudflare account.

Then open `…/admin`, enter the key, and you'll see the counts. Heartbeats arrive within a
day of each Pi updating to v1.5.0+ (or ~15 s after each `anchor-api` restart).

## Free-tier note
Each install writes once per day, so N installs ≈ N KV writes/day — well within the
free tier for hundreds of boats. `/stats` uses KV `list` (metadata only), so viewing the
admin page is cheap.
