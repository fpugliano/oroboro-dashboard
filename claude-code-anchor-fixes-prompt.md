This is a fix pass on the existing Anchor Watch feature (anchor.html) in this repo, based on real-world testing on the actual Pi/Signal K setup. The attached anchor-watch-fixes-mockup.jsx is the authoritative reference for every fix below — match its logic and visual treatment, translating from React/JSX into the existing vanilla JS/DOM of anchor.html.

## Priority 0 — RELIABILITY BUG, fix this first

**The problem:** if the anchor is set via anchor.html on one device (e.g. the Pi's own display), opening anchor.html on a different device (a phone, a tablet) shows "no anchor set" — as if nothing happened. This is a serious reliability issue for safety-critical software.

**Root cause to find and fix:** the current code almost certainly determines "is the anchor armed" from page-local JavaScript state (a variable set when the user completes the Set Anchor flow in that browser tab), rather than treating Signal K's stored `navigation.anchor.position` (and whatever notification/state value indicates armed vs. not) as the single source of truth.

**The fix:** on every single page load of anchor.html, before rendering the main screen's armed/unarmed UI, fetch the current anchor state directly from Signal K's REST API (`GET /signalk/v1/api/vessels/self/navigation/anchor` or equivalent) and derive the UI ENTIRELY from that response — never from any local variable that might have been set in a previous session or a different tab. If Signal K reports a position is set, show the armed UI with that position's data. If not, show the unarmed UI. Re-fetch this on every page load, every navigation back to the Main screen, and ideally on an interval (e.g. every poll cycle, same cadence as position polling) so two devices open simultaneously converge on the same displayed state within a few seconds of each other.

Add a small status banner at the top of the Main screen (see mockup's `AnchorStatusBanner`) with three states — set (green dot, "ANCHOR SET", subtitle "Synced from Signal K"), unset (muted dot, "NO ANCHOR SET"), and unknown/loading (amber dot, "CHECKING SIGNAL K…", shown briefly while the fetch is in flight) — so the sync behavior is visibly confirmed, not just fixed silently.

## Priority 1 — Navigation: no way back to the dashboard

Every screen in anchor.html needs a persistent, consistently-placed "← Dashboard" button (top-right of the header, see mockup's `TopBar` component) that navigates back to `oroboro.html`. This must appear on every screen (Main, Set Anchor, Set Distance, Map, Settings, Pushover config) in the same position, not just some of them.

## Priority 2 — Main dashboard: square color-coded anchor button

In `oroboro.html`'s `#card-nav` card, change the existing "Anchor Alarm" button (already resized once this session) to be a square, sized to visually match the SOG number's footprint (see mockup's dashboard preview — roughly 84×84px, adjust to fit the actual card proportions). Color logic: blue border/text (`#60a5fa`) when no anchor is set, red border/text (`#f87171`) with a soft box-shadow glow when an anchor IS set. This requires `oroboro.html` itself to poll Signal K's anchor state too (same fetch as the Priority 0 fix, just also done here) so this indicator is live and accurate without needing to open anchor.html at all.

## Priority 3 — Corrected geometry for Small/Big distance + Start/End angle (Advanced mode)

This was wrong in the current implementation and needs to be corrected precisely. The reference behavior, confirmed against real screenshots of the original inspiration app:

- **Small distance and Big distance are a strict minimum/maximum band, not independent values or two unrelated circles.** Small MUST be less than Big. If small ≥ big, this is an invalid configuration: show inline validation (red-bordered inputs, an explanatory error message — see mockup's validation block) and disable the confirm/arm button until corrected. Do not silently clamp or swap the values.
- **The shape is a curved sector** (like a thick partial ring / pie-slice-with-a-bite-taken-out-of-the-middle) spanning from the inner radius (small distance) to the outer radius (big distance), confined to the angular wedge between start angle and end angle. This is NOT a straight-line trapezoid and NOT two independent full circles — it's a true curved arc on both the inner and outer boundary, matching the mockup's `ArcWedgePreview` exactly (32-step curve interpolation, filled solid to read clearly as "the safe zone").
- **Angle wrap-around must work correctly**: e.g. start=345°, end=20° must produce a 35°-wide wedge crossing through 0°/north, not an inverted ~325° wedge. The mockup's span calculation (`if (span < 0) span += 360`) handles this — port it exactly.
- **Alarm logic (this is the most important part — confirmed explicitly with the user):** the boat is "in bounds" only if BOTH of the following are true simultaneously: (1) its distance from the anchor is ≥ small AND ≤ big, AND (2) its bearing from the anchor falls within the [startAngle, endAngle] wedge (handling wrap-around the same way). If EITHER condition fails — too close, too far, OR swung to a bearing outside the configured wedge — that is a dragging/alarm condition, full stop. There is no "distance is fine so direction doesn't matter" exception. Implement this as the actual live monitoring check for Advanced/arc mode, replacing whatever logic currently exists for it.
- Normal mode (single radius, no angle) is unaffected by any of this — its logic (distance > radius = alarm) was already correct and should not change.

## Priority 4 — Rename "Swing" to "Map", and make it a real map with shape + AIS

Rename the tab/screen currently called "Swing Track" or "Swing" to **"Map"** everywhere (nav label, screen title, any internal references).

This screen needs to show:
1. A stylized representation of the actual shoreline/coastline near the anchor position if chart/coastline data is available via Signal K or a bundled lightweight approach (the mockup uses a simple illustrative SVG shape for this — if real chart/shoreline data isn't readily available from Signal K in this setup, use your judgment on the most practical approximation, but flag this clearly in your summary rather than silently faking precision that isn't there).
2. The boat's recorded swing-position-history trail (this already exists in some form — keep it).
3. **The actual currently-configured allowed zone, rendered to scale and in the correct shape** — a dashed circle in Normal mode, or the precise curved sector (per Priority 3's corrected geometry) in Advanced mode. This must reflect the REAL configured values, not a generic placeholder shape.
4. **AIS targets**: query Signal K for other vessels' positions (paths like `vessels.<mmsi>.navigation.position`, excluding `vessels.self`) and render each as a small marker (amber triangle, per mockup) with a label showing vessel name if available (fall back to MMSI) and distance from own vessel. Update this on each poll cycle. If no AIS plugin/data is present in this Signal K instance, the screen should simply show zero targets gracefully, not error.
5. Keep existing stats (max swing, duration) and add a "Dist. to Shore" stat if shoreline data is available; omit it gracefully if not.

Do NOT attempt to add radar/MARPA target integration — this was investigated and explicitly deferred pending separate hardware verification (Raymarine Quantum + heading sensor present, but MARPA-to-NMEA-to-Signal K data path unconfirmed). Leave a code comment noting this was considered and intentionally excluded, so it's not mistaken for an oversight later.

## Priority 5 — Layout/truncation fixes

Several text elements and stat tiles are visibly clipped on both the 9" Pi display and phone screens (e.g. "ANCHOR" button text cut to "ANCHOI", DEPTH/WATER TEMP values sliced off, the Advanced distance popup overflowing both edges of the phone viewport). Audit every stat tile, label, and modal/popup in anchor.html (and the touched parts of oroboro.html) for fixed pixel widths or heights that don't accommodate real content at different screen sizes. Replace with flexible layout (flex-wrap, min-width: 0, text-overflow handling only where truly necessary, responsive popup sizing that respects viewport bounds) per the mockup's `Stat` component pattern. Test against both a roughly 380px-wide mobile viewport AND whatever the actual Pi display resolution is (check the existing scaleToFit() logic in oroboro.html for reference on how this codebase already handles different screen sizes, and apply consistent logic to anchor.html).

## What NOT to do
- Don't touch wind/nav/battery/electrical/solar/tank code in oroboro.html beyond the Priority 2 button change.
- Don't change Normal mode's (single radius) logic — it was correct.
- Don't add radar integration (see Priority 4).
- Don't introduce localStorage/sessionStorage.

## After fixing
1. Test the Priority 0 fix specifically by opening anchor.html in two different browser sessions/devices if at all possible during your own verification, confirming both converge on the same state.
2. Update CHANGELOG.md with a summary of this fix pass.
3. Commit with a clear message and push to main.
4. Summarize every file changed, flag any remaining assumptions (especially around shoreline/chart data availability and AIS data presence, since both depend on what's actually configured in this specific Signal K instance), and give exact Pi deployment steps (the three-file wget command already established this session).
