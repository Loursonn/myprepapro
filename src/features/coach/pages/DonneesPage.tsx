import { useState } from "react";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { CoachConfig } from "@/components/coach/CoachComponents";
import PerformanceProfile from "@/components/athlete/PerformanceProfile";
import CoachPerfNotification from "@/components/coach/CoachPerfNotification";
import DataManager from "@/features/coach/components/DataManager";
import type { Profile } from "@/hooks/useAuth";
import type { Goals } from "@/features/shared/types/athlete";
import { useMedicalHistory } from "@/features/shared/hooks/useMedicalHistory";
import { MedicalReadOnly } from "@/features/athlete/pages/ProfilPage";

export default function DonneesPage() {
  const {
    athleteId, athleteProfile, onEditProfile,
    nutritionStrategy, completedSessions, uncompleteSession,
    sessions, weeksArr, setShowNewBlock, setShowBlockHistory, blockHistory,
    habitEnabled, habitToggling, habitToggleErr, toggleHabitEnabled,
    appFeedbacks, goals, setGoals,
  } = useAthleteContext();
  const ap = athleteProfile as Profile | null;
  const { data: medicalData } = useMedicalHistory(athleteId);

  const initials = ap
    ? ([ap.first_name, ap.last_name].filter(Boolean).join(" ") || ap.full_name || "?")
        .split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const ns = nutritionStrategy;
  const SC: Record<string, string> = { maintenance: C.b, seche: C.r, prise_de_masse: C.g };
  const SL: Record<string, string> = { maintenance: "Maintenance", seche: "Sèche", prise_de_masse: "Prise de masse" };

  return (
    <div style={{ padding: "16px 16px 0" }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Profil athlète</div>
      <div style={{ fontSize: 12, color: C.tx2, marginBottom: 12 }}>Informations personnelles</div>

      {/* Habit tracker toggle */}
      <div style={{ padding: "12px 14px", borderRadius: 12, background: C.s1, border: `1px solid ${C.brd}`, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div><div style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>Tracker d'habitudes</div><div style={{ fontSize: 11, color: habitToggleErr ? C.r : C.tx3, marginTop: 2 }}>{habitToggleErr || "Activer le suivi d'habitudes pour cet athlète"}</div></div>
        <button disabled={habitToggling} onClick={toggleHabitEnabled} style={{ width: 46, height: 26, borderRadius: 13, background: habitEnabled ? C.g : C.s2, border: `2px solid ${habitEnabled ? C.g : C.brdL}`, cursor: habitToggling ? "default" : "pointer", position: "relative", transition: "all 0.2s", flexShrink: 0, outline: "none", opacity: habitToggling ? 0.6 : 1 }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: habitEnabled ? 24 : 2, transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
        </button>
      </div>

      {/* Athlete profile card */}
      {ap ? (
        <div style={{ background: C.s1, borderRadius: 14, border: "1px solid " + C.brd, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid " + C.brd }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.coach + "25", border: "2px solid " + C.coach + "40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: C.coach, flexShrink: 0 }}>{initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>{[ap.first_name, ap.last_name].filter(Boolean).join(" ") || ap.full_name}</div>
              <div style={{ fontSize: 11, color: C.tx3 }}>{ap.gender === "male" ? "Homme" : ap.gender === "female" ? "Femme" : "Genre non renseigné"}</div>
            </div>
            {onEditProfile && <button onClick={onEditProfile} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid " + C.coach + "50", background: C.coachS, color: C.coach, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✎ Modifier</button>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: C.brd }}>
            {[{ l: "Âge", v: ap.age ? ap.age + " ans" : null }, { l: "Taille", v: ap.height_cm ? ap.height_cm + " cm" : null }, { l: "MB", v: ap.base_metabolism ? ap.base_metabolism.toLocaleString("fr-FR") + " kcal" : null }].map(s => (
              <div key={s.l} style={{ background: C.s2, padding: "10px 8px", textAlign: "center" as const }}>
                <div style={{ fontSize: 10, color: C.tx3, textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 3 }}>{s.l}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: s.v ? C.tx : C.tx3 }}>{s.v || "—"}</div>
              </div>
            ))}
          </div>
          {(ap.weight_kg || ap.body_fat_pct) ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: C.brd, borderTop: "1px solid " + C.brd }}>
              {[{ l: "Poids réf.", v: ap.weight_kg ? ap.weight_kg + " kg" : null }, { l: "Masse grasse", v: ap.body_fat_pct ? ap.body_fat_pct + " %" : null }].map(s => (
                <div key={s.l} style={{ background: C.s2, padding: "10px 8px", textAlign: "center" as const }}>
                  <div style={{ fontSize: 10, color: C.tx3, textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 3 }}>{s.l}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: s.v ? C.tx : C.tx3 }}>{s.v || "—"}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ background: C.s1, borderRadius: 14, padding: "16px", border: "1px solid " + C.brd, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, color: C.tx3 }}>Profil non renseigné</div>
          {onEditProfile && <button onClick={onEditProfile} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid " + C.coach + "50", background: C.coachS, color: C.coach, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✎ Créer le profil</button>}
        </div>
      )}

      {/* Medical history (read-only) */}
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, marginTop: 4 }}>Antécédents médicaux</div>
      <div style={{ fontSize: 12, color: C.tx2, marginBottom: 12 }}>Renseignés par l'athlète</div>
      {medicalData && (medicalData.conditions || medicalData.allergies || medicalData.surgeries.length > 0 || medicalData.past_injuries.length > 0 || medicalData.current_treatments || medicalData.medical_notes) ? (
        <div style={{ background: C.s1, borderRadius: 14, border: "1px solid " + C.brd, padding: "14px 16px", marginBottom: 16 }}>
          <MedicalReadOnly medical={medicalData} />
        </div>
      ) : (
        <div style={{ background: C.s1, borderRadius: 14, padding: "14px 16px", border: "1px solid " + C.brd, marginBottom: 16, fontSize: 13, color: C.tx3 }}>
          Aucun antécédent renseigné par l'athlète
        </div>
      )}

      {/* Nutrition strategy */}
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, marginTop: 4 }}>Stratégie alimentaire</div>
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

      <div style={{ marginBottom: 20 }}><PerformanceProfile athleteId={athleteId} viewOnly={false} isCoach={true} C={C} /></div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.tx3, textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 10 }}>Validations de performances</div>
        <CoachPerfNotification coachId={athleteId} C={C} />
      </div>
      {/* Sleep goals */}
      <SleepGoalsEditor goals={goals} setGoals={setGoals} />

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Gestion du bloc</div>
        <CoachConfig completedSessions={completedSessions} uncompleteSession={uncompleteSession} sessions={sessions} weeksArr={weeksArr} onNewBlock={() => setShowNewBlock(true)} onShowHistory={() => setShowBlockHistory(true)} blockHistoryCount={blockHistory.length} />
      </div>

      {/* App feedbacks */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Avis sur l'app</div>
        <div style={{ fontSize: 12, color: C.tx2, marginBottom: 12 }}>Retours de cet athlète sur l'application</div>
        {appFeedbacks.length === 0 ? (
          <div style={{ background: C.s1, borderRadius: 12, padding: "14px 16px", border: "1px solid " + C.brd, fontSize: 12, color: C.tx3 }}>Aucun avis envoyé pour l'instant</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...appFeedbacks].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(fb => {
              const sc = fb.rating >= 4 ? C.g : fb.rating >= 3 ? C.o : C.r;
              return (
                <div key={fb.id} style={{ background: C.s1, borderRadius: 12, padding: "12px 14px", border: "1px solid " + C.brd }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: fb.text ? 8 : 0 }}>
                    <div style={{ display: "flex", gap: 2 }}>{[1, 2, 3, 4, 5].map(n => <span key={n} style={{ fontSize: 14, opacity: n <= fb.rating ? 1 : 0.2 }}>⭐</span>)}</div>
                    <span style={{ fontSize: 10, color: C.tx3 }}>{new Date(fb.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</span>
                  </div>
                  {fb.text && <div style={{ fontSize: 12, color: C.tx2, lineHeight: 1.55, fontStyle: "italic" }}>"{fb.text}"</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Gestion des données</div>
      <div style={{ fontSize: 12, color: C.tx2, marginBottom: 16 }}>Supprimer sélectivement des données</div>
      <DataManager />
    </div>
  );
}

// ── Sleep goals editor ────────────────────────────────────────────────────────

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
