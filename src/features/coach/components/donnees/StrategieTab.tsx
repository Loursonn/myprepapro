import { useState } from "react";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import type { Goals, Habit } from "@/features/shared/types/athlete";

// ── Habit adherence ───────────────────────────────────────────────────────────

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function HabitRow({ habit, dates }: { habit: Habit; dates: string[] }) {
  const done = new Set(dates);
  const today = new Date();

  // Adhérence sur 30 derniers jours
  let count30 = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    if (done.has(localISO(d))) count30++;
  }
  const pct = Math.round((count30 / 30) * 100);
  const pctColor = pct >= 70 ? C.g : pct >= 40 ? C.o : C.r;

  // 7 derniers jours (du plus ancien au plus récent)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (6 - i));
    return { iso: localISO(d), done: done.has(localISO(d)), label: d.toLocaleDateString("fr-FR", { weekday: "narrow" }) };
  });

  return (
    <div style={{ background: C.s2, borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ fontSize: 18, flexShrink: 0 }}>{habit.icon || "✅"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{habit.name}</div>
        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          {last7.map((d) => (
            <div key={d.iso} title={d.iso} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, background: d.done ? C.g : C.s1, border: "1px solid " + (d.done ? C.g : C.brdL) }} />
              <span style={{ fontSize: 8, color: C.tx3 }}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: pctColor }}>{pct}%</div>
        <div style={{ fontSize: 9, color: C.tx3 }}>30 jours</div>
      </div>
    </div>
  );
}

// ── Sleep goals ───────────────────────────────────────────────────────────────

function HMPicker({
  label, value, onChange,
}: {
  label: string;
  value?: { h: number; m: number };
  onChange: (v: { h: number; m: number }) => void;
}) {
  const h = value?.h ?? 22;
  const m = value?.m ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <select
          value={h}
          onChange={(e) => onChange({ h: Number(e.target.value), m })}
          style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", outline: "none" }}
        >
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={i}>{String(i).padStart(2, "0")}h</option>
          ))}
        </select>
        <select
          value={m}
          onChange={(e) => onChange({ h, m: Number(e.target.value) })}
          style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", outline: "none" }}
        >
          {[0, 15, 30, 45].map((min) => (
            <option key={min} value={min}>{String(min).padStart(2, "0")}min</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function SleepGoalsEditor({ goals, setGoals }: { goals: Goals; setGoals: (v: Goals) => void }) {
  const [saved, setSaved] = useState(false);

  /** Auto-compute sleepTarget (hours) from bedtime + wakeup */
  const autoTarget = (bed?: { h: number; m: number }, up?: { h: number; m: number }): number | undefined => {
    if (!bed || !up) return undefined;
    const bedDec = bed.h + bed.m / 60;
    const upDec  = up.h  + up.m  / 60;
    // wakeup < 12 → next day
    const upNorm = upDec < 12 ? upDec + 24 : upDec;
    const bedNorm = bedDec < 12 ? bedDec + 24 : bedDec;
    const dur = upNorm - bedNorm;
    return dur > 0 ? Math.round(dur * 10) / 10 : undefined;
  };

  const handleChange = (patch: { sleepBedtime?: { h: number; m: number }; sleepWakeup?: { h: number; m: number } }) => {
    const next = { ...goals, ...patch };
    next.sleepTarget = autoTarget(next.sleepBedtime, next.sleepWakeup) ?? next.sleepTarget;
    setGoals(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const durTarget = autoTarget(goals.sleepBedtime, goals.sleepWakeup);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Objectifs de sommeil</div>
      <div style={{ fontSize: 12, color: C.tx2, marginBottom: 12 }}>Visibles dans le tunnel de sommeil (retours)</div>
      <div style={{ background: C.s1, borderRadius: 14, border: "1px solid " + C.brd, padding: "14px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "end", marginBottom: 14 }}>
          <HMPicker
            label="🌙 Heure de coucher"
            value={goals.sleepBedtime}
            onChange={(v) => handleChange({ sleepBedtime: v })}
          />
          <HMPicker
            label="☀️ Heure de lever"
            value={goals.sleepWakeup}
            onChange={(v) => handleChange({ sleepWakeup: v })}
          />
          {/* Auto-computed duration */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px" }}>⏱ Durée calculée</div>
            <div style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid " + C.brdL, background: C.s2, fontSize: 15, fontWeight: 800, color: durTarget != null ? C.b : C.tx3 }}>
              {durTarget != null
                ? `${Math.floor(durTarget)}h${Math.round((durTarget % 1) * 60) > 0 ? String(Math.round((durTarget % 1) * 60)).padStart(2, "0") : ""}`
                : "—"}
            </div>
          </div>
        </div>
        {saved && (
          <div style={{ fontSize: 11, color: C.g, fontWeight: 600 }}>✓ Objectifs enregistrés</div>
        )}
      </div>
    </div>
  );
}

// ── StrategieTab ──────────────────────────────────────────────────────────────

export function StrategieTab() {
  const {
    nutritionStrategy, onEditProfile, goals, setGoals,
    habits, habitLogs, habitEnabled, habitToggling, habitToggleErr, toggleHabitEnabled,
  } = useAthleteContext();

  const ns = nutritionStrategy;
  const SC: Record<string, string> = { maintenance: C.b, seche: C.r, prise_de_masse: C.g };
  const SL: Record<string, string> = { maintenance: "Maintenance", seche: "Sèche", prise_de_masse: "Prise de masse" };

  return (
    <div>
      {/* ── Tracker d'habitudes ── */}
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Tracker d'habitudes</div>
      <div style={{ fontSize: 12, color: C.tx2, marginBottom: 12 }}>Habitudes de l'athlète et adhérence</div>
      <div style={{ background: C.s1, borderRadius: 14, border: "1px solid " + C.brd, padding: "12px 14px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>Suivi activé</div>
            <div style={{ fontSize: 11, color: habitToggleErr ? C.r : C.tx3, marginTop: 2 }}>{habitToggleErr || "Activer le suivi d'habitudes pour cet athlète"}</div>
          </div>
          <button disabled={habitToggling} onClick={toggleHabitEnabled} style={{ width: 46, height: 26, borderRadius: 13, background: habitEnabled ? C.g : C.s2, border: `2px solid ${habitEnabled ? C.g : C.brdL}`, cursor: habitToggling ? "default" : "pointer", position: "relative", transition: "all 0.2s", flexShrink: 0, outline: "none", opacity: habitToggling ? 0.6 : 1 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: habitEnabled ? 24 : 2, transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
          </button>
        </div>

        {habitEnabled && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {habits.length === 0 ? (
              <div style={{ fontSize: 12, color: C.tx3, padding: "8px 0" }}>Aucune habitude créée par l'athlète pour l'instant.</div>
            ) : (
              habits.map((h) => <HabitRow key={h.id} habit={h} dates={habitLogs[h.id] ?? []} />)
            )}
          </div>
        )}
      </div>

      {/* ── Stratégie alimentaire ── */}
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Stratégie alimentaire</div>
      <div style={{ fontSize: 12, color: C.tx2, marginBottom: 12 }}>Plan nutritionnel défini</div>
      {ns ? (() => {
        const sc = SC[ns.strategy] || C.ac; const sl = SL[ns.strategy] || ns.strategy;
        const theorKcal = ((ns.macros_glucides || 0) * 4) + ((ns.macros_lipides || 0) * 9) + ((ns.macros_proteines || 0) * 4);
        const NAP_L: Record<number, string> = { 1.2: "Sédentaire", 1.375: "Légère", 1.55: "Modérée", 1.725: "Intense", 1.9: "Très intense" };
        return (
          <div style={{ background: C.s1, borderRadius: 14, border: "1px solid " + C.brd, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid " + C.brd }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: sc }}>{sl}</span>
              {ns.target_weight && <span style={{ fontSize: 12, color: C.tx3 }}>Cible : <span style={{ color: C.ac, fontWeight: 700 }}>{ns.target_weight} kg</span></span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: C.brd }}>
              <div style={{ background: C.s2, padding: "10px 12px" }}><div style={{ fontSize: 9, color: C.tx3, textTransform: "uppercase" as const, marginBottom: 3 }}>Calories cibles</div><div style={{ fontSize: 16, fontWeight: 800, color: C.o }}>{ns.total_calories_coach ? ns.total_calories_coach.toLocaleString("fr-FR") + " kcal" : "—"}</div>{ns.nap && <div style={{ fontSize: 10, color: C.tx3, marginTop: 2 }}>NAP {NAP_L[ns.nap] || ns.nap} (×{ns.nap})</div>}</div>
              <div style={{ background: C.s2, padding: "10px 12px" }}><div style={{ fontSize: 9, color: C.tx3, textTransform: "uppercase" as const, marginBottom: 3 }}>{ns.strategy === "seche" ? "Déficit cible" : ns.strategy === "prise_de_masse" ? "Surplus cible" : "Tolérance"}</div>{ns.surplus_deficit_min != null && ns.surplus_deficit_max != null ? <div style={{ fontSize: 16, fontWeight: 800, color: sc }}>{ns.strategy === "seche" ? Math.abs(ns.surplus_deficit_min) + "%" : ns.strategy === "prise_de_masse" ? "+" + ns.surplus_deficit_max + "%" : "±" + ns.surplus_deficit_max + "%"}</div> : <div style={{ fontSize: 13, color: C.tx3 }}>—</div>}</div>
            </div>
            {(ns.macros_glucides || ns.macros_lipides || ns.macros_proteines) && (
              <div style={{ padding: "10px 16px", borderTop: "1px solid " + C.brd }}>
                <div style={{ fontSize: 9, color: C.tx3, textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 8 }}>Macros cibles</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {[{ label: "Glucides", pct: ns.macros_glucides_pct, g: ns.macros_glucides, color: C.b }, { label: "Lipides", pct: ns.macros_lipides_pct, g: ns.macros_lipides, color: C.o }, { label: "Protéines", pct: ns.macros_proteines_pct, g: ns.macros_proteines, color: C.g }].map(m => (
                    <div key={m.label} style={{ background: C.s2, borderRadius: 8, padding: "8px", textAlign: "center" as const, border: "1px solid " + m.color + "20" }}>
                      <div style={{ fontSize: 9, color: m.color, fontWeight: 700, marginBottom: 3 }}>{m.label}</div>
                      {m.pct != null && <div style={{ fontSize: 18, fontWeight: 900, color: m.color, lineHeight: 1 }}>{m.pct}<span style={{ fontSize: 10 }}>%</span></div>}
                      {m.g != null && <div style={{ fontSize: 12, fontWeight: 600, color: C.tx2, marginTop: 1 }}>{m.g} g</div>}
                    </div>
                  ))}
                </div>
                {theorKcal > 0 && <div style={{ marginTop: 8, fontSize: 11, color: C.tx3, textAlign: "right" as const }}>Total macros : <span style={{ fontWeight: 700, color: C.tx }}>{theorKcal} kcal</span></div>}
              </div>
            )}
            <div style={{ padding: "8px 16px", borderTop: "1px solid " + C.brd, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: C.tx3 }}>{ns.calorie_mode === "active" ? "Mode : BMR + calories actives (athlète)" : ns.calorie_mode === "hybrid" ? "Mode : Hybride" : "Mode : BMR × NAP (calories fixes)"}</span>
              {onEditProfile && <button onClick={onEditProfile} style={{ padding: "4px 12px", borderRadius: 7, border: "1px solid " + C.coach + "50", background: C.coachS, color: C.coach, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Modifier</button>}
            </div>
          </div>
        );
      })() : (
        <div style={{ background: C.s1, borderRadius: 14, padding: "14px 16px", border: "1px solid " + C.brd, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, color: C.tx3 }}>Aucune stratégie définie</div>
          {onEditProfile && <button onClick={onEditProfile} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid " + C.coach + "50", background: C.coachS, color: C.coach, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Définir</button>}
        </div>
      )}

      {/* ── Objectifs de sommeil ── */}
      <SleepGoalsEditor goals={goals} setGoals={setGoals} />
    </div>
  );
}
