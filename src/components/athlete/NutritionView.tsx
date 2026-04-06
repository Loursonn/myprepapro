import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  getDailyLog,
  upsertDailyLog,
  NutritionStrategy,
  NutritionDailyLog,
} from "@/lib/nutrition";

const C = {
  bg: "#08090C", s1: "#111318", s2: "#181B24",
  brd: "rgba(255,255,255,0.04)", brdL: "rgba(255,255,255,0.08)",
  tx: "#F2F2F4", tx2: "#9194A0", tx3: "#555866",
  ac: "#7B6FFF", acS: "rgba(123,111,255,0.12)",
  g: "#22C993", gS: "rgba(34,201,147,0.1)",
  o: "#F5A623", oS: "rgba(245,166,35,0.1)",
  r: "#EF4B4B", rS: "rgba(239,75,75,0.1)",
  b: "#3B8DF0",
};

const STRATEGY_LABELS: Record<string, string> = {
  maintenance: "Maintenance",
  seche: "Sèche",
  prise_de_masse: "Prise de masse",
};
const STRATEGY_COLORS: Record<string, string> = {
  maintenance: C.b,
  seche: C.r,
  prise_de_masse: C.g,
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  athleteId: string;
  bmr: number | null;
  nutritionStrategy: NutritionStrategy | null;
  onLogSaved?: (date: string, log: NutritionDailyLog) => void;
  viewOnly?: boolean;
}

export default function NutritionView({ athleteId, bmr, nutritionStrategy, onLogSaved, viewOnly = false }: Props) {
  const today = todayISO();
  const [log, setLog] = useState<Partial<NutritionDailyLog>>({});
  const [logLoading, setLogLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDailyLog(athleteId, today)
      .then(existing => { if (existing) setLog(existing); })
      .catch(err => console.error("getDailyLog:", err))
      .finally(() => setLogLoading(false));
  }, [athleteId, today]);

  const upd = (k: keyof NutritionDailyLog, v: number | null) => {
    setLog(prev => {
      const next = { ...prev, [k]: v };
      if (k === "glucides_consumed" || k === "lipides_consumed" || k === "proteines_consumed") {
        const g = k === "glucides_consumed" ? v : (prev.glucides_consumed ?? 0);
        const l = k === "lipides_consumed"  ? v : (prev.lipides_consumed  ?? 0);
        const p = k === "proteines_consumed"? v : (prev.proteines_consumed ?? 0);
        next.total_calories_consumed = (g ?? 0) * 4 + (l ?? 0) * 9 + (p ?? 0) * 4;
      }
      return next;
    });
  };

  async function handleSave() {
    setSaving(true);
    try {
      const logToSave = log as NutritionDailyLog;
      await upsertDailyLog(athleteId, today, logToSave);
      onLogSaved?.(today, logToSave);
      toast.success("Log enregistré !");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  const card: React.CSSProperties = {
    background: C.s1, borderRadius: 14, padding: "14px 16px",
    border: "1px solid " + C.brd, marginBottom: 12,
  };

  if (!nutritionStrategy) {
    return (
      <div style={{ padding: "16px 16px 40px" }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 16 }}>Alimentation</div>
        <div style={{ ...card, textAlign: "center", padding: "28px 20px" }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>🥗</div>
          <div style={{ fontSize: 14, color: C.tx2 }}>Aucune stratégie nutritionnelle n'a encore été définie par ton coach.</div>
        </div>
      </div>
    );
  }

  const strat = nutritionStrategy;
  const stratColor = STRATEGY_COLORS[strat.strategy] || C.ac;
  const stratLabel = STRATEGY_LABELS[strat.strategy] || strat.strategy;

  // Calories cibles du jour selon le mode
  const mode = strat.calorie_mode ?? (strat.can_track_calories ? "active" : "nap");
  const hasActiveCal = (log.active_calories ?? 0) > 0;
  // Si l'athlète n'a rien saisi en calories actives → toujours fallback sur NAP (total_calories_coach)
  const targetCal = (mode !== "nap" && hasActiveCal)
    ? (bmr || 0) + (log.active_calories || 0)
    : (strat.total_calories_coach || 0);
  const showActiveCal = mode === "active" || mode === "hybrid";

  // Macros cibles
  const macroTargets = [
    { key: "glucides_consumed" as const,  label: "Glucides",  targetG: strat.macros_glucides,  targetPct: strat.macros_glucides_pct,  color: C.b,  factor: 4 },
    { key: "lipides_consumed"  as const,  label: "Lipides",   targetG: strat.macros_lipides,   targetPct: strat.macros_lipides_pct,   color: C.o,  factor: 9 },
    { key: "proteines_consumed" as const, label: "Protéines", targetG: strat.macros_proteines, targetPct: strat.macros_proteines_pct, color: C.g,  factor: 4 },
  ];

  // Calories consommées (auto depuis macros)
  const calConsumed = log.total_calories_consumed || 0;

  // Écart par rapport à la cible
  const calDiff = calConsumed > 0 && targetCal > 0 ? calConsumed - targetCal : null;
  const calDiffPct = calDiff !== null && targetCal > 0 ? (calDiff / targetCal) * 100 : null;
  const inRange = calDiffPct !== null
    && strat.surplus_deficit_min != null && strat.surplus_deficit_max != null
    && calDiffPct >= strat.surplus_deficit_min && calDiffPct <= strat.surplus_deficit_max;

  return (
    <div style={{ padding: "16px 16px 40px" }}>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 16 }}>Alimentation</div>

      {/* ── Objectif du jour ── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px" }}>Objectif du jour</div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: stratColor + "20", border: "1px solid " + stratColor + "40", color: stratColor }}>{stratLabel}</span>
        </div>

        {/* Calories cibles */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: C.s2, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.tx3, marginBottom: 2 }}>
              {(mode !== "nap" && hasActiveCal) ? "Dépenses estimées (BMR + activité)" : "Calories cibles (BMR × NAP)"}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.o, lineHeight: 1 }}>
              {targetCal > 0 ? targetCal.toLocaleString("fr-FR") : "—"}
              <span style={{ fontSize: 12, color: C.tx3, fontWeight: 400 }}> kcal</span>
            </div>
            {mode !== "nap" && bmr && hasActiveCal && (
              <div style={{ fontSize: 10, color: C.tx3, marginTop: 2 }}>BMR {bmr} + activité {log.active_calories || 0} kcal</div>
            )}
          </div>
          {strat.target_weight && (
            <div style={{ textAlign: "center", paddingLeft: 12, borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 10, color: C.tx3, marginBottom: 2 }}>Poids cible</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.ac }}>{strat.target_weight}<span style={{ fontSize: 11, color: C.tx3 }}> kg</span></div>
            </div>
          )}
        </div>

        {/* Macros cibles */}
        {macroTargets.some(m => m.targetG || m.targetPct) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {macroTargets.map(m => (
              <div key={m.key} style={{ background: C.s2, borderRadius: 10, padding: "8px 10px", border: "1px solid " + m.color + "25", textAlign: "center" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: m.color, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{m.label}</div>
                {m.targetPct != null && <div style={{ fontSize: 20, fontWeight: 900, color: m.color, lineHeight: 1 }}>{m.targetPct}<span style={{ fontSize: 11 }}>%</span></div>}
                {m.targetG != null && <div style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginTop: m.targetPct != null ? 1 : 0 }}>{m.targetG} g</div>}
                {m.targetG == null && m.targetPct == null && <div style={{ fontSize: 13, color: C.tx3 }}>—</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Log du jour ── */}
      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>
          Mon suivi — {today}
        </div>

        {logLoading ? (
          <div style={{ color: C.tx3, fontSize: 13, textAlign: "center", padding: "10px 0" }}>Chargement...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Calories actives si mode active ou hybrid */}
            {showActiveCal && (
              <div style={{ padding: "10px 12px", borderRadius: 10, background: C.s2, border: "1px solid " + C.brdL }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                  Calories actives (montre/app){mode === "hybrid" && <span style={{ fontWeight: 400, color: C.tx3 }}> — optionnel</span>}
                </div>
                <input
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.brdL, background: C.s1, color: C.tx, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const }}
                  type="number" min={0} max={5000} placeholder="ex: 400"
                  value={log.active_calories ?? ""}
                  onChange={viewOnly ? undefined : (e => upd("active_calories", e.target.value ? parseInt(e.target.value) : null))}
                  readOnly={viewOnly}
                />
              </div>
            )}

            {/* Macros individuelles */}
            {macroTargets.map(m => {
              const consumed = log[m.key] ?? null;
              const target = m.targetG;
              const pct = consumed != null && target ? Math.min(Math.round((consumed / target) * 100), 100) : null;
              const over = consumed != null && target ? consumed > target : false;
              const barColor = over ? C.o : m.color;

              return (
                <div key={m.key} style={{ background: C.s2, borderRadius: 12, padding: "12px 14px", border: "1px solid " + m.color + "20" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.tx3 }}>
                      {target != null
                        ? <><span style={{ fontWeight: 700, color: consumed != null ? (over ? C.o : C.tx) : C.tx3 }}>{consumed ?? "—"}</span><span> / {target} g</span></>
                        : <span style={{ fontWeight: 700, color: C.tx3 }}>{consumed ?? "—"} g</span>
                      }
                    </div>
                  </div>

                  {/* Barre progression */}
                  {target != null && (
                    <div style={{ height: 4, background: C.s1, borderRadius: 2, marginBottom: 8, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: (pct ?? 0) + "%", background: barColor, borderRadius: 2, transition: "width 0.3s" }} />
                    </div>
                  )}

                  <input
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid " + m.color + "40", background: C.s1, color: C.tx, fontSize: 15, fontWeight: 700, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const, textAlign: "center" as const }}
                    type="number" min={0} max={1000} placeholder="0 g"
                    value={log[m.key] ?? ""}
                    onChange={viewOnly ? undefined : (e => upd(m.key, e.target.value ? parseInt(e.target.value) : null))}
                    readOnly={viewOnly}
                  />
                </div>
              );
            })}

            {/* Récap calories calculées */}
            {calConsumed > 0 && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: C.s2, border: "1px solid " + (calDiff !== null ? (inRange ? C.g : C.o) + "40" : C.brdL), display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, color: C.tx3, marginBottom: 2 }}>Calories calculées</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: calDiff !== null ? (inRange ? C.g : C.o) : C.tx }}>
                    {calConsumed.toLocaleString("fr-FR")}
                    <span style={{ fontSize: 11, color: C.tx3, fontWeight: 400 }}> kcal</span>
                  </div>
                </div>
                {calDiff !== null && targetCal > 0 && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: calDiff > 0 ? C.g : C.r }}>
                      {calDiff > 0 ? "+" : ""}{calDiff} kcal
                    </div>
                    <div style={{ fontSize: 10, color: C.tx3 }}>
                      {calDiffPct != null ? (calDiffPct > 0 ? "+" : "") + calDiffPct.toFixed(1) + "%" : ""}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!viewOnly && (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none", background: saving ? C.s2 : C.ac, color: saving ? C.tx3 : "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Feedback ── */}
      {calDiffPct !== null && (
        <div style={{ ...card, background: inRange ? C.gS : C.oS, border: "1px solid " + (inRange ? C.g : C.o) + "40" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: inRange ? C.g : C.o, marginBottom: 6 }}>
            {inRange
              ? `✅ Dans l'objectif ${stratLabel} aujourd'hui !`
              : `⚠️ ${calDiffPct > 0 ? "+" : ""}${calDiffPct.toFixed(1)}% par rapport à la cible`
            }
          </div>
          <div style={{ fontSize: 11, color: C.tx2 }}>
            {calConsumed} kcal consommées · cible {targetCal} kcal
            {strat.surplus_deficit_min != null && strat.surplus_deficit_max != null && (
              <span style={{ color: C.tx3 }}> · fenêtre {strat.surplus_deficit_min > 0 ? "+" : ""}{strat.surplus_deficit_min}% à {strat.surplus_deficit_max > 0 ? "+" : ""}{strat.surplus_deficit_max}%</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
