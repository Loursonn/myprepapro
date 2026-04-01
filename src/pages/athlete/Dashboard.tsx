import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import WeightliftingTracker from "@/components/WeightliftingTracker.jsx";
import ProfileView from "@/components/athlete/ProfileView";

const C = {
  bg: "#08090C", s1: "#111318", s2: "#181B24",
  brd: "rgba(255,255,255,0.06)", brdL: "rgba(255,255,255,0.1)",
  tx: "#F2F2F4", tx2: "#9194A0", tx3: "#555866",
  ac: "#7B6FFF", acS: "rgba(123,111,255,0.12)",
  g: "#22C993", r: "#EF4B4B", o: "#F5A623",
};

export default function AthleteDashboard() {
  const { user, profile, linkToCoach } = useAuth();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

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
    <div>
      {/* Bandeau "pas de coach" */}
      {profile && !profile.coach_id && (
        <div style={{ background: C.s1, borderBottom: "1px solid " + C.brd, padding: "12px 16px" }}>
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

      {/* Header profil */}
      <div
        onClick={() => setShowProfile(true)}
        style={{ background: C.s1, borderBottom: "1px solid " + C.brd, padding: "16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
      >
        {/* Avatar */}
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.acS, border: "2px solid " + C.ac + "40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: C.ac, flexShrink: 0 }}>
          {initials}
        </div>

        {/* Infos */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.tx, marginBottom: 4 }}>{fullName}</div>
          {hasProfile ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {profile?.age && (
                <span style={{ fontSize: 12, color: C.tx3 }}>
                  <span style={{ color: C.tx2, fontWeight: 600 }}>{profile.age}</span> ans
                </span>
              )}
              {profile?.age && profile?.height_cm && <span style={{ fontSize: 12, color: C.brdL }}>·</span>}
              {profile?.height_cm && (
                <span style={{ fontSize: 12, color: C.tx3 }}>
                  <span style={{ color: C.tx2, fontWeight: 600 }}>{profile.height_cm}</span> cm
                </span>
              )}
              {profile?.height_cm && profile?.base_metabolism && <span style={{ fontSize: 12, color: C.brdL }}>·</span>}
              {profile?.base_metabolism && (
                <span style={{ fontSize: 12, color: C.tx3 }}>
                  MB <span style={{ color: C.ac, fontWeight: 600 }}>{profile.base_metabolism.toLocaleString("fr-FR")}</span> kcal
                </span>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: C.tx3 }}>Profil non renseigné</div>
          )}
        </div>

        {/* Flèche */}
        <div style={{ fontSize: 18, color: C.tx3, flexShrink: 0 }}>›</div>
      </div>

      {showProfile && profile && (
        <ProfileView profile={profile} onClose={() => setShowProfile(false)} />
      )}

      <WeightliftingTracker
        athleteId={user.id}
        defaultMode="athlete"
        canToggleMode={false}
        userName={profile?.full_name}
      />
    </div>
  );
}
