/**
 * SessionPreview — visualisation d'une séance énergétique structurée.
 *
 * Props:
 *   intervals  EnergyGroup racine de la séance
 *   compact    mode compact (hauteur réduite, sans zone bar)
 */
import { useRef, useState, useLayoutEffect } from "react";
import { C } from "@/lib/theme";
import {
  expandIntervals,
  computeTotals,
  targetToIntensityPct,
  intensityToColor,
  computeZoneDistribution,
  estimateIntervalDuration,
} from "@/lib/energy";
import type { EnergyGroup } from "@/types/energy";
import HatchPattern from "./HatchPattern";
import { formatTarget, formatS, formatSLong } from "@/lib/energy/formatTarget";
import { useAthleteReferences } from "@/features/shared/hooks/useAthleteReferences";

// ── Zone colors (anchors) ─────────────────────────────────────────────────────
const ZONE_COLORS = {
  z1: intensityToColor(10),
  z2: intensityToColor(40),
  z3: intensityToColor(60),
  z4: intensityToColor(82),
  z5: intensityToColor(95),
  unc: "#3A383C",
} as const;

// ── Tick computation ──────────────────────────────────────────────────────────
function computeTicks(totalS: number, maxTicks = 8): number[] {
  if (totalS === 0) return [0];
  const raw = totalS / maxTicks;
  const steps = [10, 15, 20, 30, 60, 120, 180, 300, 600, 900, 1200, 1800, 3600];
  const step = steps.find((s) => s >= raw) ?? 3600;
  const ticks: number[] = [];
  for (let t = 0; t <= totalS; t += step) ticks.push(t);
  return ticks;
}

// ── Tooltip state ─────────────────────────────────────────────────────────────
interface TooltipState {
  x: number;
  y: number;
  role: string;
  duration: string;
  target: string;
  notes?: string;
}

// ── Role label ────────────────────────────────────────────────────────────────
const ROLE_LABEL: Record<string, string> = {
  warmup:   "Échauffement",
  work:     "Effort",
  recovery: "Récupération",
  rest:     "Repos",
  cooldown: "Retour calme",
  open:     "Libre",
};

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  intervals: EnergyGroup;
  athleteId?: string;
  compact?: boolean;
}

export default function SessionPreview({ intervals, athleteId, compact = false }: Props) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [svgW, setSvgW] = useState(600);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { data: refs } = useAthleteReferences(athleteId);
  const calcOptions = refs && Object.keys(refs).length > 0 ? { athleteReferences: refs } : undefined;

  // Measure container width (ResizeObserver)
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSvgW(entry.contentRect.width || 600);
    });
    ro.observe(el);
    setSvgW(el.offsetWidth || 600);
    return () => ro.disconnect();
  }, []);

  // ── Compute data ────────────────────────────────────────────────────────────
  const flat     = expandIntervals(intervals);
  const totals   = computeTotals(flat, calcOptions);
  const zones    = computeZoneDistribution(flat, calcOptions);
  const totalDur = totals.durationS;

  // Build bar list with cumulative start times
  let cumul = 0;
  const bars = flat.map((fi) => {
    const dur   = estimateIntervalDuration(fi.interval, calcOptions);
    const pct   = targetToIntensityPct(fi.interval.target, refs);
    const start = cumul;
    cumul += dur;
    return { fi, dur, pct, start };
  });

  // ── SVG layout constants ────────────────────────────────────────────────────
  const CHART_H   = compact ? 120 : 200;
  const AXIS_H    = 20;
  const BAR_AREA  = CHART_H - AXIS_H;
  const PAD_LEFT  = 0;
  const ticks     = computeTicks(totalDur);

  function xOf(t: number) {
    if (totalDur === 0) return PAD_LEFT;
    return PAD_LEFT + (t / totalDur) * (svgW - PAD_LEFT);
  }

  // ── Zone bar data ───────────────────────────────────────────────────────────
  const zoneSegments = [
    { key: "z1", label: "Z1", color: ZONE_COLORS.z1, secs: zones.z1 },
    { key: "z2", label: "Z2", color: ZONE_COLORS.z2, secs: zones.z2 },
    { key: "z3", label: "Z3", color: ZONE_COLORS.z3, secs: zones.z3 },
    { key: "z4", label: "Z4", color: ZONE_COLORS.z4, secs: zones.z4 },
    { key: "z5", label: "Z5", color: ZONE_COLORS.z5, secs: zones.z5 },
    { key: "unc", label: "?", color: ZONE_COLORS.unc, secs: zones.uncategorized },
  ].filter((s) => s.secs > 0);

  return (
    <div ref={wrapRef} style={{ width: "100%", userSelect: "none", position: "relative" }}>

      {/* ── Main interval chart ── */}
      <svg
        ref={svgRef}
        width="100%"
        height={CHART_H}
        style={{ display: "block", overflow: "visible" }}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <HatchPattern id="hatch-gray" />
        </defs>

        {/* Background */}
        <rect x={0} y={0} width={svgW} height={BAR_AREA} fill="rgba(255,255,255,0.03)" rx={4} />

        {/* Intensity bars */}
        {bars.map(({ fi, dur, pct, start }, i) => {
          if (dur === 0) return null;
          const x      = xOf(start);
          const x2     = xOf(start + dur);
          const w      = Math.max(1, x2 - x);
          const intPct = pct ?? 30;
          const barH   = Math.max(2, (intPct / 100) * BAR_AREA);
          const fill   = pct !== null ? intensityToColor(pct) : "url(#hatch-gray)";
          const barY   = BAR_AREA - barH;

          return (
            <g key={i}>
              <rect
                x={x}
                y={barY}
                width={w}
                height={barH}
                fill={fill}
                opacity={0.85}
                rx={1}
                style={{ cursor: "crosshair" }}
                onMouseEnter={(e) => {
                  const svgRect = svgRef.current?.getBoundingClientRect();
                  if (!svgRect) return;
                  const p = pct;
                  const zone = p === null ? null
                    : p <= 30 ? "Zone 1"
                    : p <= 50 ? "Zone 2"
                    : p <= 70 ? "Zone 3"
                    : p <= 85 ? "Zone 4"
                    : "Zone 5";
                  const targetStr = formatTarget(fi.interval.target);
                  const pctLabel = p !== null ? ` ${Math.round(p)}%` : "";
                  setTooltip({
                    x: e.clientX - svgRect.left,
                    y: barY,
                    role: ROLE_LABEL[fi.interval.role] ?? fi.interval.role,
                    duration: formatS(dur),
                    target: zone
                      ? `${zone}${pctLabel}${targetStr && targetStr !== "Libre" ? ` · ${targetStr}` : ""}`
                      : (targetStr || "Libre"),
                    notes: fi.interval.notes,
                  });
                }}
              />
              {/* Subtle gap between bars */}
              <rect x={x + w - 0.5} y={barY} width={1} height={barH} fill={C.bg} opacity={0.4} />
            </g>
          );
        })}

        {/* X axis ticks + labels */}
        {ticks.map((t) => {
          const x = xOf(t);
          return (
            <g key={t}>
              <line x1={x} y1={BAR_AREA} x2={x} y2={BAR_AREA + 5} stroke={C.tx3} strokeWidth={0.5} />
              <text
                x={x}
                y={CHART_H - 2}
                textAnchor="middle"
                fontSize={9}
                fill={C.tx3}
                fontFamily="inherit"
              >
                {formatS(t)}
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line x1={0} y1={BAR_AREA} x2={svgW} y2={BAR_AREA} stroke={C.brd} strokeWidth={1} />

        {/* Zone reference lines at intensity thresholds */}
        {[
          { pct: 30, label: "Z2" },
          { pct: 50, label: "Z3" },
          { pct: 70, label: "Z4" },
          { pct: 85, label: "Z5" },
        ].map(({ pct, label: zLabel }) => {
          const y = BAR_AREA - (pct / 100) * BAR_AREA;
          return (
            <g key={pct}>
              <line
                x1={0} y1={y} x2={svgW - 24} y2={y}
                stroke="rgba(255,255,255,0.10)" strokeWidth={0.8}
                strokeDasharray="3 3"
              />
              <text
                x={svgW - 20} y={y + 3}
                fontSize={8} fill="rgba(255,255,255,0.30)"
                fontFamily="inherit" fontWeight={600}
              >
                {zLabel}
              </text>
            </g>
          );
        })}

        {/* Tooltip pin line */}
        {tooltip && (
          <line
            x1={tooltip.x}
            y1={0}
            x2={tooltip.x}
            y2={BAR_AREA}
            stroke={C.ac}
            strokeWidth={1}
            strokeDasharray="3 2"
            pointerEvents="none"
          />
        )}
      </svg>

      {/* ── Floating tooltip ── */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            top: Math.max(0, tooltip.y - 8),
            left: Math.min(tooltip.x + 10, svgW - 160),
            background: C.s1,
            border: `1px solid ${C.brdL}`,
            borderRadius: 8,
            padding: "7px 10px",
            fontSize: 11,
            color: C.tx,
            pointerEvents: "none",
            zIndex: 20,
            minWidth: 130,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ fontWeight: 700, color: C.ac, marginBottom: 2 }}>{tooltip.role}</div>
          <div style={{ color: C.tx2 }}>Durée : <strong style={{ color: C.tx }}>{tooltip.duration}</strong></div>
          {tooltip.target && tooltip.target !== "Libre" && (
            <div style={{ color: C.tx2 }}>Cible : <strong style={{ color: C.tx }}>{tooltip.target}</strong></div>
          )}
          {tooltip.notes && (
            <div style={{ color: C.tx3, marginTop: 4, fontStyle: "italic", fontSize: 10 }}>{tooltip.notes}</div>
          )}
        </div>
      )}

      {/* ── Zone distribution bar ── */}
      {!compact && totalDur > 0 && (
        <div style={{ marginTop: 12 }}>
          {/* Stacked bar */}
          <div style={{ display: "flex", height: 20, borderRadius: 4, overflow: "hidden", gap: 1 }}>
            {zoneSegments.map((seg) => (
              <div
                key={seg.key}
                style={{
                  flex: seg.secs,
                  background: seg.color,
                  minWidth: 2,
                  position: "relative",
                }}
                title={`${seg.label} · ${formatS(seg.secs)}`}
              />
            ))}
          </div>
          {/* Labels */}
          <div style={{ display: "flex", gap: 1, marginTop: 3 }}>
            {zoneSegments.map((seg) => (
              <div
                key={seg.key}
                style={{
                  flex: seg.secs,
                  textAlign: "center",
                  fontSize: 9,
                  color: C.tx3,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  minWidth: 0,
                }}
              >
                {(seg.secs / totalDur) > 0.05 ? `${seg.label} · ${formatS(seg.secs)}` : ""}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Totals ── */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: compact ? 6 : 10,
          fontSize: 11,
          color: C.tx2,
          flexWrap: "wrap",
        }}
      >
        <span>
          <span style={{ color: C.tx3 }}>Durée totale</span>{" "}
          <strong style={{ color: C.tx }}>{formatSLong(totalDur)}</strong>
        </span>
        {!compact && totals.distanceM > 0 && (
          <span>
            <span style={{ color: C.tx3 }}>Distance</span>{" "}
            <strong style={{ color: C.tx }}>{(totals.distanceM / 1000).toFixed(1)} km</strong>
          </span>
        )}
        {!compact && (
          <span>
            <span style={{ color: C.tx3 }}>Intervalles d'effort</span>{" "}
            <strong style={{ color: C.tx }}>{totals.workCount}</strong>
          </span>
        )}
      </div>
    </div>
  );
}
