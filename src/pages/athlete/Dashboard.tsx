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

export default function AthleteDashboard() {
  const { user, profile, linkToCoach } = useAuth();
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

      <WeightliftingTracker
        athleteId={user.id}
        defaultMode="athlete"
        canToggleMode={false}
        userName={profile?.full_name}
        athleteProfile={profile}
      />
    </div>
  );
}
