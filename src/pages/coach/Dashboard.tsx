import { useState } from "react";
import { useAuth, Profile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import WeightliftingTracker from "@/components/WeightliftingTracker.jsx";
import AthleteProfileForm from "@/components/coach/AthleteProfileForm";

const C = {
  bg: "#08090C", s1: "#111318", s2: "#181B24",
  brd: "rgba(255,255,255,0.06)", brdL: "rgba(255,255,255,0.1)",
  tx: "#F2F2F4", tx2: "#9194A0", tx3: "#555866",
  ac: "#7B6FFF", acS: "rgba(123,111,255,0.12)",
  coach: "#D4538E", coachS: "rgba(212,83,142,0.12)",
  g: "#22C993", r: "#EF4B4B",
};

export default function CoachDashboard() {
  const { user, profile, athletes, activeAthleteId, setActiveAthleteId, logout, createInviteLink } = useAuth();
  const [showPanel, setShowPanel] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copyMsg, setCopyMsg] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [profileAthlete, setProfileAthlete] = useState<Profile | null>(null);

  async function handleRemoveAthlete(athleteId: string) {
    if (removing) return;
    setRemoving(true);
    await supabase.rpc("unlink_athlete", { athlete_id: athleteId });
    window.location.reload();
  }

  const isCoachAthlete = profile?.role === "coach" || profile?.role === "coach_athlete";

  // If no athlete selected yet, show selection screen
  const hasAthletes = athletes.length > 0 || isCoachAthlete;
  const selectedAthlete = athletes.find(a => a.id === activeAthleteId);
  const isOwnAthleteView = activeAthleteId === user?.id;

  async function handleCopyLink() {
    try {
      const link = await createInviteLink();
      setInviteLink(link);
      await navigator.clipboard.writeText(link);
      setCopyMsg("Lien copié !");
      setTimeout(() => setCopyMsg(""), 2500);
    } catch {
      setCopyMsg("Erreur");
    }
  }

  async function handleCopyCode() {
    if (!profile?.coach_code) return;
    await navigator.clipboard.writeText(profile.coach_code);
    setCopyMsg("Code copié !");
    setTimeout(() => setCopyMsg(""), 2500);
  }

  // No athlete selected — show selection screen
  if (!activeAthleteId) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
        <div style={{ width: "100%", maxWidth: 440 }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.tx, letterSpacing: "-0.5px" }}>
                Bonjour, {profile?.full_name?.split(" ")[0]} 👋
              </div>
              <div style={{ fontSize: 13, color: C.tx3, marginTop: 2 }}>Vue coach</div>
            </div>
            <button onClick={logout}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              Déconnexion
            </button>
          </div>

          {/* Code coach */}
          <div style={{ background: C.s1, borderRadius: 14, padding: 16, border: "1px solid " + C.brd, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
              Ton code coach
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: C.coach, letterSpacing: "0.2em", flex: 1 }}>
                {profile?.coach_code || "------"}
              </div>
              <button onClick={handleCopyCode}
                style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid " + C.coach + "50", background: C.coachS, color: C.coach, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Copier
              </button>
            </div>
            <div style={{ fontSize: 11, color: C.tx3, marginTop: 6 }}>
              Donne ce code à tes athlètes lors de leur inscription
            </div>
            {copyMsg && <div style={{ fontSize: 12, color: C.g, marginTop: 6 }}>{copyMsg}</div>}
          </div>

          {/* Athlètes */}
          <div style={{ background: C.s1, borderRadius: 14, padding: 16, border: "1px solid " + C.brd, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
              Mes athlètes ({athletes.length + (isCoachAthlete ? 1 : 0)})
            </div>

            {athletes.length === 0 && !isCoachAthlete && (
              <div style={{ textAlign: "center", padding: "20px 0", color: C.tx3, fontSize: 13 }}>
                Aucun athlète pour l'instant.<br />
                <span style={{ fontSize: 12 }}>Partage ton code pour qu'ils s'inscrivent.</span>
              </div>
            )}

            {athletes.map(a => (
              <div key={a.id} style={{ marginBottom: 8 }}>
                {confirmRemove === a.id ? (
                  <div style={{ padding: "12px", borderRadius: 10, border: "1px solid " + C.r + "50", background: C.r + "0a" }}>
                    <div style={{ fontSize: 12, color: C.tx, marginBottom: 10 }}>Retirer <b>{a.full_name}</b> de tes athlètes ?</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setConfirmRemove(null)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
                      <button onClick={() => handleRemoveAthlete(a.id)} disabled={removing} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: removing ? C.tx3 : C.r, color: "#fff", fontSize: 12, fontWeight: 700, cursor: removing ? "default" : "pointer", fontFamily: "inherit" }}>{removing ? "Suppression..." : "Confirmer"}</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => setActiveAthleteId(a.id)}
                      style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, padding: "12px", borderRadius: 10, border: "1px solid " + C.brdL, background: C.s2, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                      <div style={{ width: 38, height: 38, borderRadius: "50%", background: C.coach + "25", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: C.coach, flexShrink: 0 }}>
                        {a.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.tx }}>{a.full_name}</div>
                        <div style={{ fontSize: 11, color: a.first_name || a.age ? C.g : C.tx3 }}>
                          {a.first_name || a.age ? `${a.age ? a.age + " ans" : ""}${a.age && a.height_cm ? " · " : ""}${a.height_cm ? a.height_cm + " cm" : ""}` : "Profil incomplet"}
                        </div>
                      </div>
                      <div style={{ fontSize: 18, color: C.tx3 }}>›</div>
                    </button>
                    <button
                      onClick={() => setProfileAthlete(a)}
                      title="Éditer le profil"
                      style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid " + C.coach + "40", background: C.coachS, color: C.coach, fontSize: 14, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      ✎
                    </button>
                    <button onClick={() => setConfirmRemove(a.id)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid " + C.r + "40", background: C.r + "12", color: C.r, fontSize: 16, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                )}
              </div>
            ))}

            {/* Coach-athlète : accès à sa propre vue athlète */}
            {isCoachAthlete && (
              <button onClick={() => setActiveAthleteId(user!.id)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px", borderRadius: 10, border: "1px solid " + C.ac + "40", background: C.acS, marginBottom: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: C.ac + "25", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: C.ac, flexShrink: 0 }}>
                  {profile?.full_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.tx }}>Moi — {profile?.full_name}</div>
                  <div style={{ fontSize: 11, color: C.ac }}>Mon programme personnel</div>
                </div>
                <div style={{ fontSize: 18, color: C.tx3 }}>›</div>
              </button>
            )}
          </div>

          {/* Modal profil athlète */}
          {profileAthlete && (
            <AthleteProfileForm
              athlete={profileAthlete}
              onClose={() => setProfileAthlete(null)}
            />
          )}

          {/* Lien invitation */}
          <button onClick={handleCopyLink}
            style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1px solid " + C.brdL, background: C.s1, color: C.tx2, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            🔗 Générer un lien d'invitation
          </button>
          {inviteLink && (
            <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: C.s2, border: "1px solid " + C.brdL, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, fontSize: 11, color: C.tx3, wordBreak: "break-all" }}>{inviteLink}</div>
              <button onClick={async () => { await navigator.clipboard.writeText(inviteLink); setCopyMsg("Lien copié !"); setTimeout(() => setCopyMsg(""), 2500); }}
                style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 8, border: "1px solid " + (copyMsg ? C.g : C.brdL), background: copyMsg ? "rgba(34,201,147,0.12)" : C.s1, color: copyMsg ? C.g : C.tx2, fontSize: 11, fontWeight: 600, cursor: copyMsg ? "default" : "pointer", fontFamily: "inherit", transition: "all 0.2s" }}>
                {copyMsg ? "✓ Copié !" : "Copier"}
              </button>
            </div>
          )}

        </div>
      </div>
    );
  }

  // Athlete selected — show tracker
  return (
    <div style={{ position: "relative" }}>
      {/* Top bar : athlete switcher */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: C.bg, borderBottom: "1px solid " + C.brd, padding: "8px 16px", display: "flex", alignItems: "center", gap: 12 }}>

        <button onClick={() => setActiveAthleteId(null)}
          style={{ background: "none", border: "none", color: C.tx3, fontSize: 18, cursor: "pointer", fontFamily: "inherit", padding: "0 4px" }}>
          ‹
        </button>

        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: isOwnAthleteView ? C.ac + "25" : C.coach + "25", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: isOwnAthleteView ? C.ac : C.coach, flexShrink: 0 }}>
            {isOwnAthleteView ? profile?.full_name.charAt(0).toUpperCase() : selectedAthlete?.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>
              {isOwnAthleteView ? profile?.full_name + " (moi)" : selectedAthlete?.full_name}
            </div>
            <div style={{ fontSize: 10, color: C.tx3 }}>
              {isOwnAthleteView ? "Mon programme" : "Athlète"}
            </div>
          </div>
        </div>

        {!isOwnAthleteView && selectedAthlete && (
          <button
            onClick={() => setProfileAthlete(selectedAthlete)}
            title="Profil de l'athlète"
            style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid " + C.coach + "40", background: C.coachS, color: C.coach, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
          >
            Profil
          </button>
        )}
        {athletes.length > 0 && (
          <button onClick={() => setShowPanel(!showPanel)}
            style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid " + C.brdL, background: C.s1, color: C.tx2, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
            Changer
          </button>
        )}

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: C.tx3 }}>Connecté</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.coach }}>{profile?.full_name?.split(" ")[0]}</div>
        </div>

      </div>

      {/* Athlete quick-switch panel */}
      {showPanel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }}
          onClick={() => setShowPanel(false)}>
          <div style={{ width: "100%", maxWidth: 960, margin: "0 auto", background: C.s1, borderRadius: "16px 16px 0 0", padding: 20, maxHeight: "60vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.tx2, marginBottom: 14 }}>Choisir un athlète</div>
            {athletes.map(a => (
              <button key={a.id} onClick={() => { setActiveAthleteId(a.id); setShowPanel(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px", borderRadius: 10, border: "1px solid " + (a.id === activeAthleteId ? C.coach : C.brdL), background: a.id === activeAthleteId ? C.coachS : C.s2, marginBottom: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.coach + "25", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: C.coach }}>
                  {a.full_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.tx }}>{a.full_name}</div>
                {a.id === activeAthleteId && <div style={{ marginLeft: "auto", fontSize: 12, color: C.coach }}>✓</div>}
              </button>
            ))}
            {isCoachAthlete && (
              <button onClick={() => { setActiveAthleteId(user!.id); setShowPanel(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px", borderRadius: 10, border: "1px solid " + (isOwnAthleteView ? C.ac : C.brdL), background: isOwnAthleteView ? C.acS : C.s2, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.ac + "25", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: C.ac }}>
                  {profile?.full_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.tx }}>Moi — {profile?.full_name}</div>
                {isOwnAthleteView && <div style={{ marginLeft: "auto", fontSize: 12, color: C.ac }}>✓</div>}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal profil athlète (vue tracker) */}
      {profileAthlete && (
        <AthleteProfileForm
          athlete={profileAthlete}
          onClose={() => setProfileAthlete(null)}
        />
      )}

      {/* Main tracker — key= athleteId forces remount on switch */}
      <WeightliftingTracker
        key={activeAthleteId}
        athleteId={activeAthleteId}
        defaultMode="coach"
        canToggleMode={true}
        userName={profile?.full_name}
      />
    </div>
  );
}
