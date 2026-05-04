import { X, Moon, Sunrise, CheckCircle2, Zap } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { C } from "@/lib/theme";
import type { WellnessDay, WorkoutDetail, EnergySessionDetail } from "@/features/shared/types/retours.types";

interface DayDetailPanelProps {
  date: string;           // "yyyy-MM-dd"
  wellness: WellnessDay | null;
  workouts?: WorkoutDetail[];
  energySessions?: EnergySessionDetail[];
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtHour(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}h${m === 0 ? "00" : String(m).padStart(2, "0")}`;
}

function decimalHour(h: number, m: number): number {
  return h + m / 60;
}

/** Simulate bedtime/wakeup from sommeil score 0-10 when no real data */
function simulateSleep(sommeil: number): { bedH: number; bedM: number; upH: number; upM: number } {
  const bedDec = 22 + (10 - sommeil) * 0.35;  // 22h–25.5h
  const upDec  = 6.5 + (10 - sommeil) * 0.15; // 6.5h–8h
  const toHM = (dec: number) => {
    const norm = dec >= 24 ? dec - 24 : dec;
    return { h: Math.floor(norm), m: Math.round((norm - Math.floor(norm)) * 60) };
  };
  const bed = toHM(bedDec);
  const up  = toHM(upDec);
  return { bedH: bed.h, bedM: bed.m, upH: up.h, upM: up.m };
}

function scoreColor(v: number, max = 10): string {
  const pct = v / max;
  if (pct >= 0.7) return C.g;
  if (pct >= 0.5) return C.o;
  return C.r;
}

// ── Component bars ────────────────────────────────────────────────────────────

function ComponentBar({ label, value, max = 10, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: C.tx3 }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>
          {value}<span style={{ fontSize: 9, color: C.tx3 }}>/{max}</span>
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: C.s2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, background: color, transition: "width 400ms ease" }} />
      </div>
    </div>
  );
}

// ── Sleep tunnel visualization ────────────────────────────────────────────────

function SleepTunnel({ wellness }: { wellness: WellnessDay }) {
  const hasReal = !!(wellness.coucher && wellness.reveil);

  let bedH: number, bedM: number, upH: number, upM: number;
  if (hasReal) {
    bedH = wellness.coucher!.h; bedM = wellness.coucher!.m;
    upH  = wellness.reveil!.h;  upM  = wellness.reveil!.m;
  } else {
    const sim = simulateSleep(wellness.sommeil);
    bedH = sim.bedH; bedM = sim.bedM; upH = sim.upH; upM = sim.upM;
  }

  const bedDec = decimalHour(bedH, bedM);
  const upDec  = decimalHour(upH,  upM);

  // Sleep duration
  let durH: number, durM: number;
  if (wellness.sleepDur != null) {
    durH = Math.floor(wellness.sleepDur);
    durM = Math.round((wellness.sleepDur - durH) * 60);
  } else {
    // compute from times: wakeup is next day if < bedtime
    const upAdjusted = upDec < bedDec ? upDec + 24 : upDec;
    const durDec = upAdjusted - bedDec;
    durH = Math.floor(durDec);
    durM = Math.round((durDec - durH) * 60);
  }

  // Tunnel bar: 20h to 10h(+1) = 14h span
  const RANGE_START = 20;
  const RANGE_END   = 34; // 10h next day
  const RANGE       = RANGE_END - RANGE_START;
  const bedAdj  = bedDec < 12 ? bedDec + 24 : bedDec;  // if ~00h, push to 24h+
  const upAdjusted = upDec  < 12 ? upDec + 24  : upDec;

  const sleepStart = Math.max(RANGE_START, bedAdj);
  const sleepEnd   = Math.min(RANGE_END,   upAdjusted);
  const leftPct    = ((sleepStart - RANGE_START) / RANGE) * 100;
  const widthPct   = Math.max(0, ((sleepEnd - sleepStart) / RANGE) * 100);

  return (
    <div>
      {/* Meta row */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Moon size={11} color={C.b} />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.tx }}>{fmtHour(bedH, bedM)}</span>
          <span style={{ fontSize: 10, color: C.tx3 }}>coucher</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Sunrise size={11} color={C.y} />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.tx }}>{fmtHour(upH, upM)}</span>
          <span style={{ fontSize: 10, color: C.tx3 }}>lever</span>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: C.b }}>
          {durH}h{durM > 0 ? String(durM).padStart(2, "0") : "00"}
          <span style={{ fontSize: 9, color: C.tx3, fontWeight: 400, marginLeft: 2 }}>de sommeil</span>
        </div>
      </div>

      {/* Bar */}
      <div style={{ position: "relative", height: 20, borderRadius: 10, background: C.s1, overflow: "hidden" }}>
        <div style={{
          position: "absolute",
          left: `${leftPct}%`, width: `${widthPct}%`,
          height: "100%", borderRadius: 10,
          background: `linear-gradient(90deg, ${C.b}, ${C.ac})`,
          opacity: 0.85,
        }} />
      </div>

      {/* Ticks */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        {["20h", "22h", "00h", "02h", "04h", "06h", "08h", "10h"].map((t) => (
          <span key={t} style={{ fontSize: 8, color: C.tx3 }}>{t}</span>
        ))}
      </div>

      {!hasReal && (
        <div style={{ marginTop: 6, fontSize: 9, color: C.tx3, fontStyle: "italic" }}>
          * Horaires estimés — athlète n'a pas renseigné les heures exactes
        </div>
      )}
    </div>
  );
}

// ── DOMS ──────────────────────────────────────────────────────────────────────

function DomsDisplay({ wellness }: { wellness: WellnessDay }) {
  const zones = wellness.domsZones;
  if (!zones?.length) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>
        Courbatures
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {zones.map((zone) => (
          <span key={zone} style={{
            padding: "3px 9px", borderRadius: 20, fontSize: 10,
            background: C.oS, border: "1px solid " + C.o + "40", color: C.o,
          }}>
            {zone}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Workout section ───────────────────────────────────────────────────────────

function fmtDuration(s: number | null): string | null {
  if (s == null) return null;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h${m % 60 > 0 ? String(m % 60).padStart(2, "0") : ""}`;
}

function WorkoutCard({ w }: { w: WorkoutDetail }) {
  const dur = fmtDuration(w.duration_s);
  const hasPerformed = w.performed_exercises.length > 0;

  return (
    <div style={{ background: C.s2, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: hasPerformed ? 10 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <CheckCircle2 size={13} color={w.status === "completed" ? C.g : C.tx3} />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.tx }}>{w.session_name}</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {dur && <span style={{ fontSize: 10, color: C.tx3 }}>{dur}</span>}
          {w.rpe_score != null && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 6, background: C.ac + "20", color: C.ac }}>
              RPE {w.rpe_score}
            </span>
          )}
        </div>
      </div>

      {/* Performed exercises */}
      {hasPerformed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {w.performed_exercises.map((ex) => (
            <div key={ex.exercise_id}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.tx2, marginBottom: 3 }}>{ex.exercise_name}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {ex.sets.map((s, i) => (
                  <span key={i} style={{
                    fontSize: 9, padding: "2px 7px", borderRadius: 5,
                    background: C.s1, border: "1px solid " + C.brdL, color: C.tx2,
                  }}>
                    {s.kg != null ? `${s.kg}kg` : "—"}
                    {s.reps != null ? ` × ${s.reps}` : ""}
                    {s.rir != null ? ` @${s.rir}` : ""}
                    {s.method ? ` (${s.method})` : ""}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Note */}
      {w.notes && (
        <div style={{ marginTop: 8, fontSize: 11, color: C.tx3, fontStyle: "italic" }}>"{w.notes}"</div>
      )}
    </div>
  );
}

function EnergyCard({ e }: { e: EnergySessionDetail }) {
  const dur = e.duration_min != null ? `${e.duration_min}min` : null;
  const dist = e.distance_m != null
    ? e.distance_m >= 1000 ? `${(e.distance_m / 1000).toFixed(1)}km` : `${e.distance_m}m`
    : null;

  return (
    <div style={{ background: C.s2, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Zap size={13} color={C.o} />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.tx }}>{e.session_label}</span>
          {e.session_kind && (
            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 5, background: C.o + "20", color: C.o, fontWeight: 700 }}>
              {e.session_kind}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {dur  && <span style={{ fontSize: 10, color: C.tx3 }}>{dur}</span>}
          {dist && <span style={{ fontSize: 10, color: C.tx3 }}>{dist}</span>}
        </div>
      </div>
      {e.note && <div style={{ marginTop: 6, fontSize: 11, color: C.tx3, fontStyle: "italic" }}>"{e.note}"</div>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function DayDetailPanel({ date, wellness, workouts = [], energySessions = [], onClose }: DayDetailPanelProps) {
  const dateLabel = format(parseISO(date), "EEEE d MMMM", { locale: fr });
  const titleCase = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  const scoreCol  = wellness ? scoreColor(wellness.score, 100) : C.tx3;

  const completedWorkouts = workouts.filter((w) => w.status === "completed");

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.tx }}>{titleCase}</div>
            <div style={{ fontSize: 11, color: C.tx3 }}>
              {[
                wellness ? "Forme" : null,
                completedWorkouts.length > 0 ? `${completedWorkouts.length} séance${completedWorkouts.length > 1 ? "s" : ""}` : null,
                energySessions.length > 0 ? `${energySessions.length} énergie` : null,
              ].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle}><X size={16} /></button>
        </div>

        {/* Wellness section */}
        {wellness && (
          <>
            {/* Score circle + summary */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                border: `3px solid ${scoreCol}`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                background: scoreCol + "15", flexShrink: 0,
              }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: scoreCol, lineHeight: 1 }}>{wellness.score}</span>
                <span style={{ fontSize: 9, color: C.tx3 }}>/100</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 4 }}>
                  {wellness.score >= 70 ? "Bonne forme" : wellness.score >= 50 ? "Forme correcte" : "Fatigue élevée"}
                </div>
                <div style={{ fontSize: 11, color: C.tx3 }}>
                  Fatigue {wellness.fatigue}/10 · Énergie {wellness.energie}/10
                </div>
              </div>
            </div>

            {/* Component bars */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 4 }}>
              <ComponentBar label="Fatigue" value={wellness.fatigue} color={C.o} />
              <ComponentBar label="Sommeil" value={wellness.sommeil} color={C.b} />
              <ComponentBar label="Stress"  value={wellness.stress}  color={C.r} />
              <ComponentBar label="Énergie" value={wellness.energie} color={C.g} />
            </div>

            {/* DOMS */}
            <DomsDisplay wellness={wellness} />

            {/* Sleep tunnel */}
            <div style={{ marginTop: 20, background: C.s2, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 10 }}>
                Tunnel de sommeil
              </div>
              <SleepTunnel wellness={wellness} />
            </div>
          </>
        )}

        {/* Workouts section */}
        {(completedWorkouts.length > 0 || energySessions.length > 0) && (
          <div style={{ marginTop: wellness ? 20 : 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 10 }}>
              Séances réalisées
            </div>
            {completedWorkouts.map((w) => <WorkoutCard key={w.id} w={w} />)}
            {energySessions.map((e) => <EnergyCard key={e.id} e={e} />)}
          </div>
        )}

      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
  zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center",
};

const panelStyle: React.CSSProperties = {
  background: C.s1, borderRadius: "16px 16px 0 0",
  width: "100%", maxWidth: 520,
  maxHeight: "80vh", overflowY: "auto",
  padding: "20px 20px 40px",
};

const closeBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 32, height: 32, borderRadius: 8,
  border: "1px solid " + C.brd, background: C.s2,
  color: C.tx3, cursor: "pointer", fontFamily: "inherit",
};
