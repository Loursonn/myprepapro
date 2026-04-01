import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import WeightliftingTracker from "@/components/WeightliftingTracker.jsx";

const C = {
  bg: "#08090C", s1: "#111318", s2: "#181B24",
  brd: "rgba(255,255,255,0.06)", brdL: "rgba(255,255,255,0.1)",
  tx: "#F2F2F4", tx2: "#9194A0", tx3: "#555866",
  ac: "#7B6FFF", acS: "rgba(123,111,255,0.12)",
  g: "#22C993", r: "#EF4B4B",
};

type Tab = "seances" | "profil";

function StatCard({ label, value, unit }: { label: string; value?: string | number | null; unit?: string }) {
  return (
    <div style={{ background: C.s2, borderRadius: 12, padding: "14px 16px", border: "1px solid " + C.brd, textAlign: "center" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: value ? C.tx : C.tx3 }}>
        {value ?? "—"}
      </div>
      {unit && value && <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>{unit}</div>}
    </div>
  );
}

export default function AthleteDashboard() {
  const { user, profile, linkToCoach } = useAuth();
  const [tab, setTab] = useState<Tab>("seances");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  async function handleLink() {
    if (!code.trim() || loading) return;
    setLoading(true);
    setMsg("");
    try {
      await linkToCoach(code.trim());
      setMsg("Coach rejoint !");
    } catch (e: any) {
      setMsg(e.message || "Code invalide");
    } finally {
      setLoading(false);
    }
  }

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.full_name || "";
  const initials = fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
  const hasProfile = !!(profile?.first_name || profile?.age || profile?.height_cm);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>

      {/* Bandeau "pas de coach" */}
      {profile && !profile.coach_id && (
        <div style={{ background: C.s1, borderBottom: "1px solid " + C.brd, padding: "12px 16px", flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: C.tx3, marginBottom: 8 }}>Tu n'as pas encore de coach assigné</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="Code coach (ex: R4BL7M)"
              maxLength={6}
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none", letterSpacing: "0.1em" }}
            />
            <button
              onClick={handleLink}
              disabled={loading || !code.trim()}
              style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: code.trim() ? C.ac : C.s2, color: code.trim() ? "#fff" : C.tx3, fontSize: 13, fontWeight: 600, cursor: code.trim() ? "pointer" : "default", fontFamily: "inherit" }}
            >
              {loading ? "..." : "Rejoindre"}
            </button>
          </div>
          {msg && <div style={{ fontSize: 12, marginTop: 6, color: msg === "Coach rejoint !" ? C.g : C.r }}>{msg}</div>}
        </div>
      )}

      {/* Contenu principal */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 64 }}>
        {tab === "seances" && (
          <WeightliftingTracker
            athleteId={user.id}
            defaultMode="athlete"
            canToggleMode={false}
            userName={profile?.full_name}
          />
        )}

        {tab === "profil" && (
          <div style={{ padding: "24px 16px", maxWidth: 480, margin: "0 auto" }}>

            {/* Avatar + nom */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: C.acS, border: "3px solid " + C.ac + "50", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: C.ac, marginBottom: 12 }}>
                {initials}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.tx }}>{fullName}</div>
              <div style={{ fontSize: 13, color: C.tx3, marginTop: 4 }}>
                {profile?.coach_id ? "Athlète suivi" : "Athlète"} · {profile?.gender === "male" ? "Homme" : profile?.gender === "female" ? "Femme" : ""}
              </div>
            </div>

            {hasProfile ? (
              <>
                {/* Stats rapides */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                  <StatCard label="Âge" value={profile?.age} unit="ans" />
                  <StatCard label="Taille" value={profile?.height_cm} unit="cm" />
                  <StatCard label="Poids réf." value={profile?.weight_kg} unit="kg" />
                </div>

                {/* Métabolisme */}
                <div style={{ background: C.s1, borderRadius: 14, padding: 20, border: "1px solid " + C.brd, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>
                    Métabolisme de base
                  </div>
                  {profile?.base_metabolism ? (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <div style={{ fontSize: 32, fontWeight: 900, color: C.ac }}>{profile.base_metabolism.toLocaleString("fr-FR")}</div>
                      <div style={{ fontSize: 14, color: C.tx3 }}>kcal / jour</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: C.tx3 }}>Non renseigné par ton coach</div>
                  )}
                </div>

                {/* Détail complet */}
                <div style={{ background: C.s1, borderRadius: 14, border: "1px solid " + C.brd, overflow: "hidden" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", padding: "14px 16px", borderBottom: "1px solid " + C.brd }}>
                    Informations complètes
                  </div>
                  {[
                    { label: "Prénom", value: profile?.first_name },
                    { label: "Nom", value: profile?.last_name },
                    { label: "Âge", value: profile?.age ? `${profile.age} ans` : null },
                    { label: "Taille", value: profile?.height_cm ? `${profile.height_cm} cm` : null },
                    { label: "Genre", value: profile?.gender === "male" ? "Homme" : profile?.gender === "female" ? "Femme" : null },
                    { label: "Poids de référence", value: profile?.weight_kg ? `${profile.weight_kg} kg` : null },
                    { label: "Masse grasse", value: profile?.body_fat_pct ? `${profile.body_fat_pct} %` : null },
                    { label: "Métabolisme de base", value: profile?.base_metabolism ? `${profile.base_metabolism.toLocaleString("fr-FR")} kcal/j` : null },
                  ].map((row, i, arr) => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: i < arr.length - 1 ? "1px solid " + C.brd : "none" }}>
                      <div style={{ fontSize: 13, color: C.tx3 }}>{row.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: row.value ? C.tx : C.tx3 }}>{row.value ?? "—"}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ background: C.s1, borderRadius: 14, padding: 28, border: "1px solid " + C.brd, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.tx, marginBottom: 8 }}>Profil non renseigné</div>
                <div style={{ fontSize: 13, color: C.tx3 }}>Ton coach n'a pas encore complété ton profil.</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation bas */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.s1, borderTop: "1px solid " + C.brd, display: "flex", zIndex: 50 }}>
        {([["seances", "Séances"], ["profil", "Profil"]] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "12px 0", border: "none", background: "transparent",
              color: tab === t ? C.ac : C.tx3,
              fontSize: 12, fontWeight: tab === t ? 700 : 400,
              cursor: "pointer", fontFamily: "inherit",
              borderTop: "2px solid " + (tab === t ? C.ac : "transparent"),
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
