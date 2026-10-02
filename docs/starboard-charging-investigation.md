# Starboard Charging Investigation — S/V Oroboro

*Investigated 2026-10. Follow-up correction added 2026-10-02.*

## The problem

At the same RPM, the helm ammeters showed the starboard alternator producing far
less current than port:

| Condition | Port gauge | Starboard gauge |
|---|---|---|
| Cold | 80 A | 26 A |
| After 30 min | 98 A | 50 A |

**Ruled out before testing:**
- Alternators: swapping them between engines gave the same result.
- Belts, tension, pulleys: identical, no slipping.
- Orions: all four with identical settings, all showing 13.1 V in and 13.4 V out.

## Tests and readings

### 1. Orion input current (clamp meter)

| | Orion 1 | Orion 2 | Total | Input voltage | Helm gauge |
|---|---|---|---|---|---|
| Port | 29.9 A | 32.6 A | 62.5 A | ~13.95 V | 115 A |
| Starboard | 35.9 A | 33.1 A | 69 A | ~14.0 V | 48 A |

All four Orions near full output, healthy input voltage on both sides.

### 2. Alternator output (clamp on the B cable, 1,000 RPM)

| | Clamp |
|---|---|
| Port | 67.8 A |
| Starboard | 70 A |

Both alternators deliver essentially the same current.

### 3. Port KUS current sensor (HCS-HV ±150)

| Condition | Sensor output | Sensor reports | Clamp | Helm gauge |
|---|---|---|---|---|
| Engine off, key off | (unpowered) | — | 0.04 A | — |
| Key on, engine off | 2.5 V | 0 A ✓ | — | 51 A |
| Running, 1,000 RPM | 3.3 V | ~60 A ✓ | 61.8 A | 106 A |

Disconnecting the sensor's ground wire changed the gauge reading — confirms this
sensor feeds the port helm gauge.

### 4. Starboard KUS current sensor

| Condition | Sensor output | Supply | Sensor reports | Clamp | Helm gauge |
|---|---|---|---|---|---|
| Key on, engine off | 2.5 V | 12.1 V | 0 A ✓ | — | 4.8 A |
| Running, 1,000 RPM | 3.4 V | 13.8 V | ~68 A | 96 A | 58.8 A |

## Original conclusions (later partly corrected — see below)

- No charging fault. Both alternators healthy.
- Port: sensor accurate; helm gauge reads ~50 A too high (faulty gauge or a
  ground/wiring problem at the helm).
- Starboard: sensor appeared ~30 % low; gauge a small +5 A offset.
- The apparent difference came from measurement errors on both sides, in opposite
  directions — which is why it stayed with the engine when the alternators were swapped.

---

## Follow-up correction (2026-10-02)

The starboard **96 A** clamp reading in Test 4 was **spurious** — it exceeded the
alternator's own B-cable output (70 A), which is physically impossible on a series
path (nothing downstream can carry more than the source). It also disagreed with the
Orion inputs (69 A), which *did* agree with the B cable (70 A).

**Simultaneous re-measurement, starboard, same moment/temperature, 1,000 RPM:**

| Measurement | Reading |
|---|---|
| Alternator B cable (clamp) | 54 A |
| KUS sensor cable (clamp) | 54 A |
| Starboard helm gauge | 49.6 A |

B cable and sensor cable match exactly (54 A) → same current path, and the earlier
96 A was a bad clamp reading (DC-clamp drift / non-simultaneous warm-up moment).
The helm gauge at 49.6 A vs 54 A true is only **~8 % low — i.e. accurate, within
normal tolerance.**

### Revised conclusion

- **No charging fault — both alternators healthy** (54 A here, ~70 A warm; port and
  starboard essentially identical).
- **Starboard is accurate end-to-end** — sensor and gauge both good (gauge ~8 % low,
  negligible). The original "sensor 30 % low" was an artifact of the bad 96 A clamp.
- **The sole real fault is the PORT helm gauge**, reading **~70 % high** (106 A shown
  vs ~62 A true). The port reading also shifted when the sensor ground was disturbed.
- The entire "port ≫ starboard" mystery was just the **port helm gauge over-reading.**

### Open item / next step

Chase the **port helm gauge circuit** — grounding/wiring at the port helm, or a faulty
gauge. Nothing to fix on the charging system itself.

### Note for future accurate monitoring

Both the KUS sensors and helm gauges proved hard to trust (one gauge ~70 % high). A
Victron **SmartShunt (VE.Direct)** per side on the Orion (or alternator) output would
give calibrated, reliable charge current that also flows straight into Signal K and the
Oroboro dashboard — retiring the KUS-sensor-plus-helm-gauge guesswork.
