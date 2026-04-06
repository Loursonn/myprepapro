import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  getNutritionStrategy,
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
}

export default function NutritionView({ athleteId, bmr, nutritionStrategy, onLogSaved }: Props) {
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
      // Recalcul automatique des calories depuis les macros
      if (k === "glucides_consumed" || k === "lipides_consumed" || k === "proteines_consumed") {
        const g = k === "glucides_consumed" ? v : (prev.glucides_consumed ?? 0);
        const l = k === "lipides_consumed"  ? v : (prev.lipides_consumed  ?? 0);
        const p = k === "proteines_consumed"? v : (prev.proteines_consumed ?? 0);
        next.total_calories_consumed = (g ?? 0) * 4 + (l ?? 0) * 9 + (p ?? 0) * 4;
      }
      return next;
    });
  };

  const logAsComplete = log as NutritionDailyLog;

  async function handleSave() {
    setSaving(true);
    try {
      await upsertDailyLog(athleteId, today, logAsComplete);
      onLogSaved?.(today, logAsComplete);
      toast.success("Log enregistré !");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "1px solid " + C.brdL, background: C.s2, color: C.tx,
    fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: C.tx3,
    textTransform: "uppercase", letterSpacing: "0.5px",
    display: "block", marginBottom: 5,
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: C.tx3,
    textTransform: "uppercase", letterSpacing: "0.5px",
    marginBottom: 12,
  };

  const card: React.CSSProperties = {
    background: C.s1, borderRadius: 14, padding: "14px 16px",
    border: "1px solid " + C.brd, marginBottom: 12,
  };

  // ── No strategy defined ──────────────────────────────────────────────────────
  if (!nutritionStrategy) {
    return (
      <div style={{ padding: "16px 16px 40px" }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 16 }}>
          Alimentation
        </div>
        <div style={{ ...card, textAlign: "center", padding: "28px 20px" }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>🥗</div>
          <div style={{ fontSize: 14, color: C.tx2 }}>
            Aucune stratégie nutritionnelle n'a encore été définie par ton coach.
          </div>
        </div>
      </div>
    );
  }

  const strat = nutritionStrategy;
  const stratColor = STRATEGY_COLORS[strat.strategy] || C.ac;
  const stratLabel = STRATEGY_LABELS[strat.strategy] || strat.strategy;

  // Calories dépensées du jour
  const totalCalDepensees = strat.can_track_calories
    ? (bmr || 0) + (log.active_calories || 0)
    : (strat.total_calories_coach || 0);

  // Macros théoriques (coach)
  const theoreticalKcal =
    ((strat.macros_glucides || 0) * 4) +
    ((strat.macros_lipides || 0) * 9) +
    ((strat.macros_proteines || 0) * 4);

  // Feedback
  const consumed = log.total_calories_consumed || 0;
  const surplusPct = totalCalDepensees > 0 && consumed > 0
    ? ((consumed - totalCalDepensees) / totalCalDepensees) * 100
    : null;
  const surplusKcal = consumed > 0 && totalCalDepensees > 0
    ? consumed - totalCalDepensees
    : null;

  const inRange = surplusPct !== null &&
    strat.surplus_deficit_min != null &&
    strat.surplus_deficit_max != null &&
    surplusPct >= strat.surplus_deficit_min &&
    surplusPct <= strat.surplus_deficit_max;

  return (
    <div style={{ padding: "16px 16px 40px" }}>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 16 }}>
        Alimentation
      </div>

      {/* ── Bloc 1 — Résumé stratégie ─────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={sectionTitle}>Stratégie coach</div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
            background: stratColor + "20", border: "1px solid " + stratColor + "40",
            color: stratColor,
          }}>
            {stratLabel}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {strat.target_weight && (
            <div style={{ background: C.s2, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: C.tx3, marginBottom: 4 }}>Poids cible</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.ac }}>{strat.target_weight} <span style={{ fontSize: 11, color: C.tx3 }}>kg</span></div>
            </div>
          )}
          <div style={{ background: C.s2, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: C.tx3, marginBottom: 4 }}>
              {strat.can_track_calories ? "Dépenses estimées" : "Calories fixées"}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.o }}>
              {totalCalDepensees > 0 ? totalCalDepensees : "—"}
              <span style={{ fontSize: 11, color: C.tx3 }}> kcal</span>
            </div>
            {strat.can_track_calories && bmr && (
              <div style={{ fontSize: 9, color: C.tx3, marginTop: 2 }}>BMR {bmr} + activité {log.active_calories || 0}</div>
            )}
          </div>
        </div>

        {(strat.macros_glucides || strat.macros_lipides || strat.macros_proteines) && (
          <div style={{ background: C.s2, borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: C.tx3, marginBottom: 8 }}>Macros cibles</div>
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { label: "Glucides", value: strat.macros_glucides, color: C.b },
                { label: "Lipides", value: strat.macros_lipides, color: C.o },
                { label: "Protéines", value: strat.macros_proteines, color: C.g },
              ].map(m => (
                <div key={m.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: m.color }}>{m.value ?? "—"}</div>
                  <div style={{ fontSize: 9, color: C.tx3 }}>{m.label.slice(0, 4)}. (g)</div>
                </div>
              ))}
              {theoreticalKcal > 0 && (
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.tx2 }}>{theoreticalKcal}</div>
                  <div style={{ fontSize: 9, color: C.tx3 }}>kcal théor.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {(strat.surplus_deficit_min != null && strat.surplus_deficit_max != null) && (
          <div style={{ fontSize: 11, color: C.tx3 }}>
            Fourchette objectif :&nbsp;
            <span style={{ color: C.tx, fontWeight: 600 }}>
              {strat.surplus_deficit_min > 0 ? "+" : ""}{strat.surplus_deficit_min}%
              &nbsp;à&nbsp;
              {strat.surplus_deficit_max > 0 ? "+" : ""}{strat.surplus_deficit_max}%
            </span>
          </div>
        )}
      </div>

      {/* ── Bloc 2 — Saisie quotidienne ───────────────────────────────────── */}
      <div style={card}>
        <div style={{ ...sectionTitle, marginBottom: 14 }}>Log du jour — {today}</div>

        {logLoading ? (
          <div style={{ color: C.tx3, fontSize: 13, textAlign: "center", padding: "10px 0" }}>Chargement...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {strat.can_track_calories && (
              <div>
                <label style={labelStyle}>Calories actives (kcal brûlées — montre/app)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min={0}
                  max={5000}
                  placeholder="ex: 400"
                  value={log.active_calories ?? ""}
                  onChange={e => upd("active_calories", e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
            )}

            <div>
              <label style={labelStyle}>Total calories consommées (kcal)</label>
              <input
                style={inputStyle}
                type="number"
                min={0}
                max={10000}
                placeholder="ex: 2200"
                value={log.total_calories_consumed ?? ""}
                onChange={e => upd("total_calories_consumed", e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { key: "glucides_consumed" as const, label: "Glucides (g)", color: C.b },
                { key: "lipides_consumed" as const, label: "Lipides (g)", color: C.o },
                { key: "proteines_consumed" as const, label: "Protéines (g)", color: C.g },
              ].map(m => (
                <div key={m.key}>
                  <label style={{ ...labelStyle, color: m.color }}>{m.label}</label>
                  <input
                    style={{ ...inputStyle, borderColor: m.color + "40" }}
                    type="number"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={log[m.key] ?? ""}
                    onChange={e => upd(m.key, e.target.value ? parseInt(e.target.value) : null)}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
                background: saving ? C.s2 : C.ac, color: saving ? C.tx3 : "#fff",
                fontSize: 14, fontWeight: 700, cursor: saving ? "default" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        )}
      </div>

      {/* ── Bloc 3 — Feedback ─────────────────────────────────────────────── */}
      {consumed > 0 && surplusPct !== null && (
        <div style={{
          ...card,
          background: inRange ? C.gS : C.oS,
          border: "1px solid " + (inRange ? C.g : C.o) + "40",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: inRange ? C.g : C.o, marginBottom: 8 }}>
            {inRange
              ? `✅ Excellent ! Tu respectes ton plan ${stratLabel}. Continue comme ça !`
              : `⚠️ Tu es à ${surplusPct.toFixed(1)}% aujourd'hui. Ton objectif est entre ${strat.surplus_deficit_min}% et ${strat.surplus_deficit_max}%. Ajuste ton prochain repas, tu es sur la bonne voie !`
            }
          </div>
          <div style={{ fontSize: 11, color: C.tx2 }}>
            Surplus / Déficit du jour :&nbsp;
            <span style={{ fontWeight: 700, color: surplusPct > 0 ? C.g : C.r }}>
              {surplusPct > 0 ? "+" : ""}{surplusPct.toFixed(1)}%
              &nbsp;({surplusKcal != null && surplusKcal > 0 ? "+" : ""}{surplusKcal ?? 0} kcal)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
