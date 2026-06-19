This is Stage 3 of a staged fix pass on the Anchor Watch feature. Stages 1 (cross-device reliability via Signal K read) and 2 (navigation, square dashboard button, layout fixes) are already deployed and working. The anchor-api proxy (anchor-api.js on port 3001) is running and handles authenticated writes. Do NOT touch any of these.

The attached file `anchor-flow-redesign-mockup.jsx` is the authoritative visual and interaction reference for everything below. Match its layout, flow, and visual treatment, translating from React/JSX into the existing vanilla JS/DOM architecture of anchor.html.

## Overview of changes

The current anchor.html has a confusing two-button flow ("Set Anchor" and "Set Allowed Distance" as separate actions on the main screen). This caused a real bug: the anchor position gets written to Signal K before any radius is configured, and the server-side plugin immediately fires a false "dragging" alarm because it sees a position with no valid radius yet.

The fix is a redesigned flow that eliminates this timing problem entirely: configure the zone FIRST, then set the anchor position as the final step — one unified action, not two separate ones.

## The new flow

### 1. Dashboard → tap Anchor button
- If no anchor is currently set (read from Signal K, per Stage 1's fetchAnchorState): open the **zone configuration screen** directly. No intermediate "what do you want to do?" screen with two confusing buttons.
- If anchor IS currently set: open the **armed/monitoring screen** (showing status, live map, distance, Adjust/Raise buttons).

### 2. Zone configuration screen ("Set Allowed Radius")
Top bar: "‹ Back" (returns to dashboard) on the left, "← Dashboard" on the right — same persistent pattern from Stage 2.

Below the top bar: a Normal / Advanced toggle, same as before but with the following changes:

**Normal tab:**
- A slider (input type="range", min 10, max 100, step 1) that controls the allowed radius.
- Quick-pick buttons for common values (20m, 30m, 50m, 75m).
- A map (stylized SVG with shore context, same as mockup's MapBackground) showing a live circle centered on the anchor point, whose radius updates IN REAL TIME as the slider moves — not after releasing the slider, during the drag itself. The current radius value is displayed as a label on the map.

**Advanced tab:**
- Sliders (not typed number inputs) for all four values:
  - Small distance (inner radius): range 5–95m
  - Big distance (outer radius): range 10–150m
  - Start angle: range 0–359°
  - End angle: range 0–359°
- The map (same MapBackground) showing the live curved sector between small and big distance, within the start/end angle wedge, updating in real time as any slider moves.
- Draggable "S" and "E" handle indicators on the map at the start/end angle positions (see mockup) — in the real build, making these truly touch-draggable on the SVG would be ideal, but slider-driven positioning (where the handles move as you adjust the angle sliders) is acceptable if true SVG drag is too complex for this pass.
- Validation: if small ≥ big, show red-colored slider values, an inline error message ("Small distance must be less than Big distance"), and disable the Set Anchor button. Do NOT silently clamp or swap the values.

**Bottom of both tabs:** a single prominent button: **"⚓ Set Anchor"**
- This button does TWO things in one action, in this order:
  1. First: writes the allowed distance configuration (radius for Normal, or small/big/startAngle/endAngle for Advanced) — store this however the existing code stores it (likely in the page's own state and/or via the proxy to Signal K if there's a path for it).
  2. Second: writes the anchor position (current GPS lat/lon from Signal K) via the proxy (`POST /api/anchor/set`).
- This ordering is critical — the radius/zone must be configured BEFORE the position is written, so the server-side plugin never sees "position set but no radius" and fires a false alarm.
- The button is disabled (greyed out, non-clickable) if Advanced mode validation fails (small ≥ big).

### 3. Armed/monitoring screen
Shown after setting, or when tapping the Anchor button while anchor is already set. Contains:
- Green "ANCHOR SET" status banner (already exists from Stage 1 — keep it exactly as-is).
- A map showing the configured zone shape (circle or sector) and the boat's current position.
- Stats: current distance to anchor, allowed distance.
- "Adjust Distance" button → returns to zone configuration screen (pre-filled with current values).
- "Raise Anchor" button → calls proxy's POST /api/anchor/raise, then returns to dashboard on success.

### 4. Alarm logic for Advanced mode (corrected and confirmed with the user)

The alarm condition for Advanced mode is strictly: the boat is "in bounds" ONLY if BOTH of the following are true simultaneously:
1. Distance from anchor is ≥ small AND ≤ big
2. Bearing from anchor to boat falls within the [startAngle, endAngle] wedge

If EITHER condition fails — too close (< small), too far (> big), or bearing outside the angular wedge — that is a dragging/alarm condition. There is NO exception for "distance is fine but direction is wrong."

Handle angle wrap-around correctly: e.g. startAngle=345°, endAngle=20° is a 35° wedge crossing through north, not a 325° wedge going the long way around.

Normal mode alarm logic (distance > radius = alarm) is unchanged.

### 5. Geometry rendering (corrected, confirmed against reference screenshots)

The Advanced mode shape is a TRUE CURVED SECTOR — the outer boundary follows the arc of the big-distance circle, the inner boundary follows the arc of the small-distance circle, and both are connected by the start/end angle radial lines. This is NOT a straight-line trapezoid and NOT two independent full circles. Use 32-step curve interpolation for smooth arcs (see mockup's implementation). Fill it with semi-transparent cyan to clearly read as "the safe zone."

## What NOT to do
- Do not touch Stage 1 functions (fetchAnchorState, _applySkAnchorState, putAnchorPosition, renderAnchorBanner).
- Do not touch Stage 2 code (the ← Dashboard link logic, the square button in oroboro.html, the layout fixes).
- Do not touch the anchor-api proxy (anchor-api.js, anchor-api-config.json, anchor-api.service).
- Do not touch the Map/Swing screen (that's Stage 4, separate).
- Do not introduce localStorage or any browser storage.
- Do not store any credentials in any browser-accessible file.

## After building
1. Show me the diff before committing — confirm it's scoped to the flow/geometry/alarm changes only, not touching Stage 1 or 2 code.
2. Commit with a clear message.
3. Push to main.
4. In your summary, confirm:
   - The Set Anchor button writes radius/zone BEFORE position (critical ordering).
   - The alarm logic implements the strict distance-AND-bearing rule for Advanced mode.
   - Normal mode logic is unchanged.
   - No Stage 1 or Stage 2 functions were modified.
   - Give exact deployment steps (the standard three-file wget command).
