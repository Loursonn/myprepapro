import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { C } from "@/lib/theme";

/**
 * Home coach — vue agrégée tous athlètes.
 * Les KPI cards, alertes et timeline seront implémentés en PROMPT 3.
 */
export default function CoachHomePage() {
  const { profile, athletes, user } = useAuth();
  const navigate = useNavigate();
  const isCoachAthlete = profile?.role === "coach" || profile?.role === "coach_athlete";

  return (
    <div style={{ padding: "24px 24px 40px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.tx, letterSpacing: "-0.5px" }}>
          Bonjour, {profile?.full_name?.split(" ")[0] ?? "Coach"} 👋
        </div>
        <div style={{ fontSize: 13, color: C.tx3, marginTop: 4 }}>
          {athletes.length} athlète{athletes.length > 1 ? "s" : ""}
          {isCoachAthlete ? " + ton programme personnel" : ""}
        </div>
      </div>

      {/* Quick access — athlètes */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 10, fontWeight: 600, color: C.tx3,
            textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12,
          }}
        >
          Accès rapide
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {athletes.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate(`/coach/athletes/${a.id}/planning`)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 16px", borderRadius: 12,
                border: "1px solid " + C.brdL, background: C.s1,
                cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                transition: "border-color 150ms, background 150ms",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = C.coach + "60";
                (e.currentTarget as HTMLElement).style.background = C.coachS;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = C.brdL;
                (e.currentTarget as HTMLElement).style.background = C.s1;
              }}
            >
              <div
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: C.coach + "25", border: "1px solid " + C.coach + "40",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: C.coach, flexShrink: 0,
                }}
              >
                {a.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.tx }}>{a.full_name}</div>
                <div style={{ fontSize: 10, color: C.tx3 }}>
                  {a.age ? `${a.age} ans` : ""}
                  {a.age && a.height_cm ? " · " : ""}
                  {a.height_cm ? `${a.height_cm} cm` : ""}
                  {!a.age && !a.height_cm ? "Profil non renseigné" : ""}
                </div>
              </div>
            </button>
          ))}

          {isCoachAthlete && user && (
            <button
              onClick={() => navigate(`/coach/athletes/${user.id}/planning`)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 16px", borderRadius: 12,
                border: "1px solid " + C.ac + "40", background: C.acS,
                cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: C.ac + "25",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: C.ac, flexShrink: 0,
                }}
              >
                {(profile?.full_name || "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.tx }}>
                  Moi — {profile?.full_name}
                </div>
                <div style={{ fontSize: 10, color: C.ac }}>Mon programme personnel</div>
              </div>
            </button>
          )}

          {athletes.length === 0 && !isCoachAthlete && (
            <div
              style={{
                padding: "20px 24px", borderRadius: 12,
                border: "1px dashed " + C.brdL, color: C.tx3,
                fontSize: 13, textAlign: "center", width: "100%",
              }}
            >
              Aucun athlète pour l'instant.
              <br />
              <span style={{ fontSize: 11 }}>
                Code coach : <strong style={{ color: C.coach }}>{profile?.coach_code}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Placeholder for PROMPT 3 KPI cards */}
      <div
        style={{
          padding: "20px 24px", borderRadius: 14,
          border: "1px dashed " + C.brdL, color: C.tx3,
          fontSize: 12, textAlign: "center",
        }}
      >
        📊 Dashboard KPI — implémenté en PROMPT 3
      </div>
    </div>
  );
}
