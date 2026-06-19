import { useState, useEffect, useRef } from "react";

// Oroboro dashboard visual language: Rajdhani type, near-black panels,
// cyan/amber/red instrument accents. This mirrors oroboro.html's tokens.

const COL = {
  bg: "#0a0e14",
  panel: "#111820",
  panelDeep: "#0d1520",
  divider: "#1e2a38",
  muted: "#7a9abf",
  white: "#e2e8f0",
  cyan: "#22d3ee",
  amber: "#f59e0b",
  red: "#f87171",
  blue: "#60a5fa",
  green: "#5db832",
};

function Screen({ children }) {
  return (
    <div
      style={{
        width: 360,
        height: 700,
        background: COL.bg,
        color: COL.white,
        fontFamily: "'Rajdhani', system-ui, sans-serif",
        borderRadius: 28,
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 0 0 1px #1e2a38, 0 30px 60px -20px rgba(0,0,0,0.6)",
      }}
    >
      {/* status bar */}
      <div
        style={{
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
          fontSize: 12,
          color: COL.white,
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600 }}>21:14</span>
        <span style={{ display: "flex", gap: 6, color: COL.muted }}>
          <span>5G</span>
          <span>67%</span>
        </span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function TopBar({ title, onBack }) {
  return (
    <div
      style={{
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexShrink: 0,
        borderBottom: `0.5px solid ${COL.divider}`,
      }}
    >
      {onBack ? (
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: COL.cyan,
            fontSize: 20,
            cursor: "pointer",
            padding: 0,
            lineHeight: 1,
            fontFamily: "inherit",
          }}
        >
          ‹
        </button>
      ) : (
        <div style={{ width: 20 }} />
      )}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: COL.white,
        }}
      >
        {title}
      </div>
    </div>
  );
}

function Stat({ label, value, unit, color = COL.white, big = false }) {
  return (
    <div style={{ background: COL.panelDeep, borderRadius: 6, padding: "8px 10px" }}>
      <div
        style={{
          fontSize: 8,
          color: COL.muted,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: big ? 22 : 16,
          fontWeight: 600,
          color,
          marginTop: 3,
          lineHeight: 1,
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: 10, color: COL.muted, marginLeft: 3, fontWeight: 500 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", style }) {
  const base = {
    border: "none",
    borderRadius: 8,
    padding: "13px 16px",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "inherit",
    width: "100%",
  };
  const variants = {
    primary: { background: COL.cyan, color: "#0a0e14" },
    secondary: { background: "transparent", color: COL.cyan, border: `1px solid ${COL.cyan}` },
    ghost: { background: COL.panel, color: COL.white, border: `1px solid ${COL.divider}` },
    danger: { background: "transparent", color: COL.red, border: `1px solid ${COL.red}` },
  };
  return (
    <button onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

function BottomNav({ active, onNav }) {
  const items = [
    { id: "main", label: "Anchor" },
    { id: "map", label: "Swing" },
    { id: "history", label: "History" },
    { id: "settings", label: "Settings" },
  ];
  return (
    <div
      style={{
        display: "flex",
        borderTop: `0.5px solid ${COL.divider}`,
        background: COL.panel,
        flexShrink: 0,
      }}
    >
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onNav(it.id)}
          style={{
            flex: 1,
            background: "none",
            border: "none",
            padding: "10px 0 12px",
            color: active === it.id ? COL.cyan : COL.muted,
            fontFamily: "inherit",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Anchor compass/radius widget ----------
function AnchorRadiusDial({ radius = 30, distance = 6, size = 168 }) {
  const c = size / 2;
  const r = size / 2 - 14;
  const pct = Math.min(distance / radius, 1);
  const angle = -90 + pct * 360 * 0.5; // boat sits somewhere inside, illustrative
  const bx = c + Math.cos((angle * Math.PI) / 180) * r * 0.35;
  const by = c + Math.sin((angle * Math.PI) / 180) * r * 0.35;

  return (
    <svg width={size} height={size}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={COL.cyan} strokeOpacity={0.35} strokeWidth={1.5} />
      <circle cx={c} cy={c} r={r * 0.5} fill="none" stroke={COL.divider} strokeWidth={1} strokeDasharray="3 4" />
      {/* anchor at center */}
      <circle cx={c} cy={c} r={3.5} fill={COL.amber} />
      {/* boat position */}
      <circle cx={bx} cy={by} r={5} fill={COL.cyan} />
      <line x1={c} y1={c} x2={bx} y2={by} stroke={COL.cyan} strokeWidth={1} strokeOpacity={0.5} />
    </svg>
  );
}

// ---------- Screens ----------

function MainScreen({ anchorSet, radius, arc, distance, onSetAnchor, onSetDistance, onRaise }) {
  return (
    <>
      <TopBar title="Anchor Watch" />
      <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 14, overflow: "auto" }}>
        {!anchorSet && (
          <div
            style={{
              background: COL.panel,
              border: `1px solid ${COL.divider}`,
              borderRadius: 8,
              padding: 14,
              fontSize: 12,
              color: COL.muted,
              lineHeight: 1.5,
            }}
          >
            No anchor set. Drop anchor, then tap <strong style={{ color: COL.white }}>Set Anchor</strong> below to start the watch.
          </div>
        )}

        {anchorSet && (
          <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
            <AnchorRadiusDial radius={radius} distance={distance} />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Stat label="Current Lat" value="36.7642" />
          <Stat label="Current Lon" value="24.4053" />
          <Stat
            label="Distance to Anchor"
            value={anchorSet ? distance : "—"}
            unit={anchorSet ? "m" : ""}
            color={anchorSet && distance > radius * 0.8 ? COL.amber : COL.cyan}
            big
          />
          <Stat
            label="Allowed Distance"
            value={anchorSet ? (arc ? `${arc.small}–${arc.big}` : radius) : "—"}
            unit={anchorSet ? "m" : ""}
            big
          />
        </div>

        {anchorSet && arc && (
          <div style={{ fontSize: 10, color: COL.muted, padding: "0 2px" }}>
            Directional sector {arc.startAngle}°–{arc.endAngle}°
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!anchorSet ? (
            <>
              <Btn onClick={onSetAnchor}>Set Anchor</Btn>
              <Btn variant="secondary" onClick={onSetDistance}>
                Set Allowed Distance
              </Btn>
            </>
          ) : (
            <>
              <Btn variant="secondary" onClick={onSetDistance}>
                Adjust Distance
              </Btn>
              <Btn variant="danger" onClick={onRaise}>
                Raise Anchor
              </Btn>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function RelativeAnchorDial({ bearing, size = 168 }) {
  const c = size / 2;
  const r = size / 2 - 14;
  const rad = ((bearing - 90) * Math.PI) / 180;
  const ax = c + Math.cos(rad) * r * 0.72;
  const ay = c + Math.sin(rad) * r * 0.72;
  return (
    <svg width={size} height={size}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={COL.divider} strokeWidth={1} />
      {[0, 90, 180, 270].map((a) => {
        const rr = ((a - 90) * Math.PI) / 180;
        return (
          <line
            key={a}
            x1={c + Math.cos(rr) * (r - 6)}
            y1={c + Math.sin(rr) * (r - 6)}
            x2={c + Math.cos(rr) * r}
            y2={c + Math.sin(rr) * r}
            stroke={COL.muted}
            strokeWidth={1.5}
          />
        );
      })}
      <text x={c} y={c - r - 4} textAnchor="middle" fontSize={9} fill={COL.muted}>N</text>
      {/* boat at center */}
      <circle cx={c} cy={c} r={5} fill={COL.cyan} />
      {/* line + anchor at bearing */}
      <line x1={c} y1={c} x2={ax} y2={ay} stroke={COL.amber} strokeWidth={1.5} strokeDasharray="4 3" />
      <circle cx={ax} cy={ay} r={4.5} fill={COL.amber} />
    </svg>
  );
}

function SetAnchorScreen({ onBack, onConfirm }) {
  const [method, setMethod] = useState(null);
  const [dist, setDist] = useState("18");
  const [bearing, setBearing] = useState("305");

  if (!method) {
    return (
      <>
        <TopBar title="Set Anchor" onBack={onBack} />
        <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: COL.muted, marginBottom: 4 }}>
            How do you want to set the anchor position?
          </div>
          <Btn variant="ghost" onClick={() => setMethod("current")}>
            Current Location
          </Btn>
          <Btn variant="ghost" onClick={() => setMethod("relative")}>
            Relative Location
          </Btn>
          <div style={{ fontSize: 10, color: COL.muted, lineHeight: 1.5, padding: "2px 2px 0" }}>
            Current Location marks the anchor where you're standing now. Relative Location lets you enter
            distance &amp; bearing to the anchor — use this once you've backed down and the anchor isn't directly
            below the boat.
          </div>
        </div>
      </>
    );
  }

  if (method === "current") {
    return (
      <>
        <TopBar title="Set Anchor" onBack={() => setMethod(null)} />
        <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Stat label="Latitude" value="36.7642" />
            <Stat label="Longitude" value="24.4053" />
            <Stat label="GPS Accuracy" value="6" unit="m" />
            <Stat label="Last Fix" value="0s ago" color={COL.green} />
          </div>
          <div style={{ fontSize: 11, color: COL.muted, lineHeight: 1.5 }}>
            This marks your current GPS position as the anchor point. Next, you'll set the allowed swing radius.
          </div>
          <div style={{ flex: 1 }} />
          <Btn onClick={() => onConfirm({ mode: "current" })}>Confirm &amp; Continue</Btn>
        </div>
      </>
    );
  }

  // relative
  return (
    <>
      <TopBar title="Set Anchor" onBack={() => setMethod(null)} />
      <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
          <RelativeAnchorDial bearing={Number(bearing) || 0} />
        </div>
        <Field label="Distance to anchor" value={dist} onChange={setDist} unit="m" />
        <Field label="Bearing to anchor" value={bearing} onChange={setBearing} unit="°" />
        <div style={{ fontSize: 10, color: COL.muted, lineHeight: 1.5 }}>
          Calculated from your current GPS position using the distance and bearing above. Bearing is true,
          0° = north.
        </div>
        <div style={{ flex: 1 }} />
        <Btn onClick={() => onConfirm({ mode: "relative", dist, bearing })}>Confirm &amp; Continue</Btn>
      </div>
    </>
  );
}

function Field({ label, value, onChange, unit }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: COL.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
        {label}
      </div>
      <div
        style={{
          background: COL.panelDeep,
          borderRadius: 6,
          border: `1px solid ${COL.divider}`,
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            background: "none",
            border: "none",
            color: COL.white,
            fontSize: 16,
            fontFamily: "inherit",
            fontWeight: 600,
            width: "100%",
            outline: "none",
          }}
        />
        {unit && <span style={{ fontSize: 11, color: COL.muted }}>{unit}</span>}
      </div>
    </div>
  );
}

function ArcWedgePreview({ small, big, startAngle, endAngle, size = 200 }) {
  const c = size / 2;
  const maxR = size / 2 - 18;
  const scale = maxR / Math.max(big, 1);
  const rSmall = small * scale;
  const rBig = big * scale;

  // normalize angle span, handle wrap (e.g. 345 -> 20)
  let span = endAngle - startAngle;
  if (span < 0) span += 360;
  if (span === 0) span = 360;

  const toXY = (angleDeg, radius) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return [c + Math.cos(rad) * radius, c + Math.sin(rad) * radius];
  };

  const steps = 24;
  const outerPts = [];
  const innerPts = [];
  for (let i = 0; i <= steps; i++) {
    const a = startAngle + (span * i) / steps;
    outerPts.push(toXY(a, rBig));
    innerPts.push(toXY(a, rSmall));
  }
  const pathPts = [...outerPts, ...innerPts.reverse()];
  const pathStr =
    "M " + pathPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ") + " Z";

  return (
    <svg width={size} height={size}>
      {/* full reference circle at big distance */}
      <circle cx={c} cy={c} r={maxR} fill="none" stroke={COL.divider} strokeWidth={1} />
      {/* small distance reference circle */}
      <circle cx={c} cy={c} r={rSmall} fill="none" stroke={COL.divider} strokeWidth={1} strokeDasharray="2 4" />
      {/* the wedge itself, live */}
      <path d={pathStr} fill={COL.cyan} fillOpacity={0.18} stroke={COL.cyan} strokeWidth={1.5} />
      {/* center anchor point */}
      <circle cx={c} cy={c} r={3.5} fill={COL.amber} />
      <text x={c} y={c - maxR - 4} textAnchor="middle" fontSize={9} fill={COL.muted}>
        N
      </text>
    </svg>
  );
}

function SetDistanceScreen({ onBack, onConfirm, initial = 30 }) {
  const [tab, setTab] = useState("normal"); // 'normal' | 'advanced'
  const [radius, setRadius] = useState(initial);
  const [small, setSmall] = useState("40");
  const [big, setBig] = useState("55");
  const [startAngle, setStartAngle] = useState("345");
  const [endAngle, setEndAngle] = useState("20");

  return (
    <>
      <TopBar title="Allowed Radius" onBack={onBack} />
      <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 14, overflow: "auto" }}>
        <div
          style={{
            display: "flex",
            background: COL.panelDeep,
            borderRadius: 8,
            padding: 3,
            border: `1px solid ${COL.divider}`,
          }}
        >
          {["normal", "advanced"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                background: tab === t ? COL.cyan : "transparent",
                color: tab === t ? "#0a0e14" : COL.muted,
                border: "none",
                borderRadius: 6,
                padding: "8px 0",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              {t === "normal" ? "Normal" : "Advanced"}
            </button>
          ))}
        </div>

        {tab === "normal" ? (
          <>
            <div
              style={{
                background: COL.panel,
                border: `1px solid ${COL.divider}`,
                borderRadius: 8,
                padding: 12,
                fontSize: 11,
                color: COL.muted,
                lineHeight: 1.5,
              }}
            >
              A single radius around the anchor. Use this when wind/current direction at the swing isn't a
              concern.
            </div>

            <div style={{ display: "flex", justifyContent: "center", padding: "6px 0" }}>
              <AnchorRadiusDial radius={radius} distance={radius * 0.18} />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 9, color: COL.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Radius
                </span>
                <span style={{ fontSize: 18, fontWeight: 700, color: COL.cyan }}>{radius} m</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: COL.muted, marginTop: 4 }}>
                <span>10 m</span>
                <span>100 m</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {[20, 30, 50, 75].map((v) => (
                <button
                  key={v}
                  onClick={() => setRadius(v)}
                  style={{
                    flex: 1,
                    background: radius === v ? COL.cyan : COL.panelDeep,
                    color: radius === v ? "#0a0e14" : COL.muted,
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 0",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  {v}m
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                background: COL.panel,
                border: `1px solid ${COL.divider}`,
                borderRadius: 8,
                padding: 12,
                fontSize: 11,
                color: COL.muted,
                lineHeight: 1.5,
              }}
            >
              A directional sector between two distances and two bearings — use this when the swing should
              only be watched on the side facing wind or current.
            </div>

            <Field label="Small distance" value={small} onChange={setSmall} unit="m" />
            <Field label="Big distance" value={big} onChange={setBig} unit="m" />
            <Field label="Start angle" value={startAngle} onChange={setStartAngle} unit="°" />
            <Field label="End angle" value={endAngle} onChange={setEndAngle} unit="°" />

            <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
              <ArcWedgePreview
                small={Number(small) || 0}
                big={Number(big) || 1}
                startAngle={Number(startAngle) || 0}
                endAngle={Number(endAngle) || 0}
              />
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />
        <Btn
          onClick={() =>
            onConfirm(
              tab === "normal"
                ? radius
                : { mode: "arc", small: Number(small), big: Number(big), startAngle: Number(startAngle), endAngle: Number(endAngle) }
            )
          }
        >
          {tab === "normal" ? "Set Radius & Arm Watch" : "Set Distance & Arm Watch"}
        </Btn>
      </div>
    </>
  );
}

function SwingMapScreen() {
  // illustrative swing trail points
  const trail = [
    [50, 5], [56, -10], [40, -20], [22, -8], [10, 12], [24, 28], [48, 22], [50, 5],
  ];
  const path = trail.map((p) => `${84 + p[0] * 0.9},${110 + p[1] * 0.9}`).join(" ");
  return (
    <>
      <TopBar title="Swing Track" />
      <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            background: COL.panelDeep,
            borderRadius: 10,
            border: `1px solid ${COL.divider}`,
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={220} height={220}>
            <circle cx={110} cy={110} r={95} fill="none" stroke={COL.cyan} strokeOpacity={0.25} strokeWidth={1.5} />
            <circle cx={110} cy={110} r={4} fill={COL.amber} />
            <polyline points={path} fill="none" stroke={COL.cyan} strokeWidth={1.5} strokeOpacity={0.85} />
            {trail.map((p, i) => (
              <circle key={i} cx={84 + p[0] * 0.9} cy={110 + p[1] * 0.9} r={2.2} fill={COL.cyan} opacity={0.6} />
            ))}
            <circle cx={84 + trail[trail.length - 1][0] * 0.9} cy={110 + trail[trail.length - 1][1] * 0.9} r={5} fill={COL.white} />
          </svg>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <Stat label="Max Swing" value="38" unit="m" color={COL.amber} />
          <Stat label="Avg Swing" value="22" unit="m" />
          <Stat label="Duration" value="2h 14m" />
        </div>
      </div>
    </>
  );
}

function HistoryScreen() {
  const stays = [
    { place: "Polyaigos, anchorage", date: "Jun 14", duration: "14h 02m", maxSwing: "31m" },
    { place: "Milos, Adamas Bay", date: "Jun 12", duration: "8h 40m", maxSwing: "19m" },
    { place: "Sifnos, Vathy", date: "Jun 9", duration: "1d 6h", maxSwing: "44m" },
  ];
  return (
    <>
      <TopBar title="Anchor History" />
      <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 8, overflow: "auto" }}>
        {stays.map((s, i) => (
          <div
            key={i}
            style={{
              background: COL.panel,
              border: `1px solid ${COL.divider}`,
              borderRadius: 8,
              padding: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{s.place}</span>
              <span style={{ fontSize: 10, color: COL.muted }}>{s.date}</span>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
              <span style={{ fontSize: 10, color: COL.muted }}>
                Duration <span style={{ color: COL.white, fontWeight: 600 }}>{s.duration}</span>
              </span>
              <span style={{ fontSize: 10, color: COL.muted }}>
                Max swing <span style={{ color: COL.amber, fontWeight: 600 }}>{s.maxSwing}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function SettingsScreen({ onOpenPushover }) {
  const rows = [
    { label: "Pushover Notifications", value: "5 events configured", onClick: onOpenPushover },
    { label: "Default radius", value: "30 m" },
    { label: "GPS accuracy filter", value: "10 m" },
    { label: "Units", value: "Meters" },
  ];
  return (
    <>
      <TopBar title="Settings" />
      <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 0 }}>
        {rows.map((r, i) => (
          <button
            key={i}
            onClick={r.onClick}
            disabled={!r.onClick}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "13px 2px",
              borderBottom: i < rows.length - 1 ? `0.5px solid ${COL.divider}` : "none",
              background: "none",
              border: "none",
              borderRadius: 0,
              width: "100%",
              fontFamily: "inherit",
              cursor: r.onClick ? "pointer" : "default",
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: 13, color: COL.white }}>{r.label}</span>
            <span style={{ fontSize: 13, color: COL.muted, display: "flex", alignItems: "center", gap: 6 }}>
              {r.value}
              {r.onClick && <span style={{ color: COL.cyan, fontSize: 15 }}>›</span>}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

const PRIORITIES = [
  { id: -1, label: "Low", desc: "Quiet, no sound" },
  { id: 0, label: "Normal", desc: "Standard notification" },
  { id: 2, label: "Emergency", desc: "Repeats until acknowledged" },
];

function PriorityPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {PRIORITIES.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          style={{
            flex: 1,
            background: value === p.id ? (p.id === 2 ? COL.red : COL.cyan) : COL.panelDeep,
            color: value === p.id ? "#0a0e14" : COL.muted,
            border: "none",
            borderRadius: 6,
            padding: "8px 4px",
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "inherit",
            letterSpacing: "0.02em",
            cursor: "pointer",
            textTransform: "uppercase",
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 38,
        height: 22,
        borderRadius: 11,
        border: "none",
        background: on ? COL.cyan : COL.divider,
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 0.15s ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: on ? "#0a0e14" : "#374a5e",
          transition: "left 0.15s ease",
        }}
      />
    </button>
  );
}

const DEFAULT_EVENTS = {
  dragging: { enabled: true, priority: 2, title: "⚠️ Anchor Dragging!", message: "S/V Oroboro is dragging anchor. Check position immediately." },
  gpsLost: { enabled: true, priority: 2, title: "⚠️ Anchor Alarm: GPS Lost", message: "No GPS position updates received." },
  anchorSet: { enabled: true, priority: 0, title: "Anchor Set", message: "Anchor alarm armed on S/V Oroboro." },
  anchorRaised: { enabled: true, priority: 0, title: "Anchor Raised", message: "Anchor alarm disarmed on S/V Oroboro." },
  okCheckin: { enabled: false, priority: -1, title: "Anchor OK", message: "Anchor holding, all normal." },
};

const EVENT_META = [
  { key: "dragging", label: "Anchor Dragging Detected", hint: "Fires when the boat moves outside the allowed distance." },
  { key: "gpsLost", label: "GPS Position Lost", hint: "Fires when no position update is received past the timeout." },
  { key: "anchorSet", label: "Anchor Set", hint: "Fires once when the watch is armed." },
  { key: "anchorRaised", label: "Anchor Raised", hint: "Fires once when the watch is disarmed." },
  { key: "okCheckin", label: "Periodic OK Check-in", hint: "Optional heartbeat while anchored normally. Off by default — avoid waking yourself up for no reason." },
];

function EventRow({ meta, data, onChange, expanded, onToggleExpand }) {
  return (
    <div style={{ background: COL.panel, border: `1px solid ${COL.divider}`, borderRadius: 8, overflow: "hidden" }}>
      <button
        onClick={onToggleExpand}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          padding: "12px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        <div style={{ flex: 1, paddingRight: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COL.white }}>{meta.label}</div>
          <div style={{ fontSize: 10, color: COL.muted, marginTop: 2, lineHeight: 1.4 }}>{meta.hint}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }} onClick={(e) => e.stopPropagation()}>
          <Toggle on={data.enabled} onChange={(v) => onChange({ ...data, enabled: v })} />
          <span style={{ color: COL.muted, fontSize: 14, transform: expanded ? "rotate(90deg)" : "none", display: "inline-block" }}>
            ›
          </span>
        </div>
      </button>
      {expanded && (
        <div style={{ padding: "0 12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontSize: 9, color: COL.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Priority
            </div>
            <PriorityPicker value={data.priority} onChange={(p) => onChange({ ...data, priority: p })} />
          </div>
          <Field label="Title" value={data.title} onChange={(v) => onChange({ ...data, title: v })} />
          <Field label="Message" value={data.message} onChange={(v) => onChange({ ...data, message: v })} />
        </div>
      )}
    </div>
  );
}

function PushoverConfigScreen({ onBack }) {
  const [userKey, setUserKey] = useState("uirif2gbor7m1jarpcrwhzgnntbxxq");
  const [apiToken, setApiToken] = useState("••••••••••••••••••••••••••••");
  const [showToken, setShowToken] = useState(false);
  const [events, setEvents] = useState(DEFAULT_EVENTS);
  const [expandedKey, setExpandedKey] = useState("dragging");
  const [testSent, setTestSent] = useState(false);

  return (
    <>
      <TopBar title="Pushover Notifications" onBack={onBack} />
      <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 14, overflow: "auto" }}>
        <div
          style={{
            background: COL.panel,
            border: `1px solid ${COL.divider}`,
            borderRadius: 8,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <Field label="Pushover User / Group Key" value={userKey} onChange={setUserKey} />
          <div>
            <div style={{ fontSize: 9, color: COL.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
              API Token
            </div>
            <div
              style={{
                background: COL.panelDeep,
                borderRadius: 6,
                border: `1px solid ${COL.divider}`,
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <input
                type={showToken ? "text" : "password"}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                style={{
                  background: "none",
                  border: "none",
                  color: COL.white,
                  fontSize: 14,
                  fontFamily: "inherit",
                  fontWeight: 600,
                  width: "100%",
                  outline: "none",
                }}
              />
              <button
                onClick={() => setShowToken((s) => !s)}
                style={{
                  background: "none",
                  border: "none",
                  color: COL.cyan,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textTransform: "uppercase",
                  flexShrink: 0,
                }}
              >
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 10, color: COL.muted, lineHeight: 1.4 }}>
            Find these at pushover.net under your dashboard and your registered Application.
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: COL.cyan, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Events
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {EVENT_META.map((meta) => (
              <EventRow
                key={meta.key}
                meta={meta}
                data={events[meta.key]}
                onChange={(d) => setEvents((e) => ({ ...e, [meta.key]: d }))}
                expanded={expandedKey === meta.key}
                onToggleExpand={() => setExpandedKey((k) => (k === meta.key ? null : meta.key))}
              />
            ))}
          </div>
        </div>

        <Btn
          variant="secondary"
          onClick={() => {
            setTestSent(true);
            setTimeout(() => setTestSent(false), 2200);
          }}
        >
          {testSent ? "Test Sent ✓" : "Send Test Notification"}
        </Btn>

        <Btn onClick={onBack}>Save Changes</Btn>
      </div>
    </>
  );
}

function DraggingAlertOverlay({ onAcknowledge }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(10,14,20,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 16,
        padding: 24,
        zIndex: 10,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          border: `2px solid ${COL.red}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          color: COL.red,
          animation: "pulse 1.2s infinite",
        }}
      >
        !
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: COL.red, letterSpacing: "0.03em" }}>
        ANCHOR DRAGGING
      </div>
      <div style={{ fontSize: 12, color: COL.muted, textAlign: "center", lineHeight: 1.5 }}>
        Vessel is 47m from anchor point — 17m past the 30m allowed radius. Pushover alert sent to all devices.
      </div>
      <Btn onClick={onAcknowledge} style={{ marginTop: 8 }}>
        Acknowledge
      </Btn>
      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}

// ---------- App ----------

export default function App() {
  const [screen, setScreen] = useState("main");
  const [anchorSet, setAnchorSet] = useState(false);
  const [radius, setRadius] = useState(30);
  const [arc, setArc] = useState(null);
  const [distance] = useState(6);
  const [showAlert, setShowAlert] = useState(false);

  const steps = [
    "1. Tap Set Anchor",
    "2. Choose Current Location (anchor is under the boat) or Relative Location (enter distance + bearing — typical after backing down)",
    "3. Confirm position",
    "4. Set the allowed radius (before dropping, so no premature alarm)",
    "5. Watch is armed — distance & swing track update live",
    "6. If dragging is detected, full-screen alert + Pushover push to both phones",
    "7. Settings → Pushover Notifications: edit keys, and per-event toggle/priority/message for all 5 alert types",
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#05070a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 16px 60px",
        gap: 28,
        fontFamily: "'Rajdhani', system-ui, sans-serif",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&display=swap"
        rel="stylesheet"
      />

      <div style={{ textAlign: "center", color: "#7a9abf", maxWidth: 360 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#22d3ee" }}>
          Oroboro Dashboard — Mockup
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", marginTop: 4 }}>
          Anchor Watch Flow
        </div>
        <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
          Click through the screen below. Use the nav buttons underneath to jump straight to Swing Track,
          History, or Settings, or follow the Set Anchor flow start to finish.
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <Screen>
          {screen === "main" && (
            <MainScreen
              anchorSet={anchorSet}
              radius={radius}
              arc={arc}
              distance={distance}
              onSetAnchor={() => setScreen("set-anchor")}
              onSetDistance={() => setScreen("set-distance")}
              onRaise={() => {
                setAnchorSet(false);
                setArc(null);
                setScreen("main");
              }}
            />
          )}
          {screen === "set-anchor" && (
            <SetAnchorScreen
              onBack={() => setScreen("main")}
              onConfirm={() => setScreen(anchorSet ? "main" : "set-distance")}
            />
          )}
          {screen === "set-distance" && (
            <SetDistanceScreen
              initial={radius}
              onBack={() => setScreen(anchorSet ? "main" : "set-anchor")}
              onConfirm={(r) => {
                if (typeof r === "number") {
                  setRadius(r);
                  setArc(null);
                } else {
                  setArc(r);
                  setRadius(r.big);
                }
                setAnchorSet(true);
                setScreen("main");
              }}
            />
          )}
          {screen === "map" && <SwingMapScreen />}
          {screen === "history" && <HistoryScreen />}
          {screen === "settings" && <SettingsScreen onOpenPushover={() => setScreen("pushover")} />}
          {screen === "pushover" && <PushoverConfigScreen onBack={() => setScreen("settings")} />}

          {["main", "map", "history", "settings"].includes(screen) && (
            <BottomNav active={screen} onNav={setScreen} />
          )}

          {showAlert && <DraggingAlertOverlay onAcknowledge={() => setShowAlert(false)} />}
        </Screen>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 360 }}>
        <button
          onClick={() => setShowAlert(true)}
          style={{
            background: "transparent",
            border: "1px solid #f87171",
            color: "#f87171",
            borderRadius: 6,
            padding: "8px 14px",
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "inherit",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Preview Dragging Alert
        </button>
        <button
          onClick={() => {
            setAnchorSet(false);
            setScreen("main");
          }}
          style={{
            background: "transparent",
            border: "1px solid #1e2a38",
            color: "#7a9abf",
            borderRadius: 6,
            padding: "8px 14px",
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "inherit",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>

      <div
        style={{
          background: "#111820",
          border: "1px solid #1e2a38",
          borderRadius: 10,
          padding: "16px 18px",
          maxWidth: 360,
          width: "100%",
        }}
      >
        <div style={{ fontSize: 11, color: "#22d3ee", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
          Flow Summary
        </div>
        {steps.map((s, i) => (
          <div key={i} style={{ fontSize: 12, color: "#cbd5e1", padding: "5px 0", lineHeight: 1.4 }}>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
