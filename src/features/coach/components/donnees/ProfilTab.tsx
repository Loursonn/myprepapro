import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import PerformanceProfile from "@/components/athlete/PerformanceProfile";
import CoachPerfNotification from "@/components/coach/CoachPerfNotification";
import type { Profile } from "@/hooks/useAuth";
import { useMedicalHistory } from "@/features/shared/hooks/useMedicalHistory";
import { MedicalReadOnly } from "@/features/athlete/pages/ProfilPage";

export function ProfilTab() {
  const { athleteId, athleteProfile, onEditProfile } = useAthleteContext();
  const ap = athleteProfile as Profile | null;
  const { data: medicalData } = useMedicalHistory(athleteId);

  const initials = ap
    ? ([ap.first_name, ap.last_name].filter(Boolean).join(" ") || ap.full_name || "?")
        .split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div>
      {/* Athlete profile card */}
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Profil athlète</div>
      <div style={{ fontSize: 12, color: C.tx2, marginBottom: 12 }}>Informations personnelles</div>
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

      {/* Performances sportives */}
      <div style={{ marginBottom: 20 }}><PerformanceProfile athleteId={athleteId} viewOnly={false} isCoach={true} C={C} /></div>

      {/* Validations de performances */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.tx3, textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 10 }}>Validations de performances</div>
        <CoachPerfNotification coachId={athleteId} C={C} />
      </div>
    </div>
  );
}
