import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const MONTHS_FR = ["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"];

function todayShort(): string {
  const d = new Date();
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

export default function ProfilPage() {
  const { profile } = useAuth();
  const {
    athleteProfile, combinedData, wellnessHistory,
    prs, bodyWeight, weightLog,
  } = useAthleteContext();

  // ── Weight chart (last 30 days) ───────────────────────────────────────────
  const weightData = Object.entries(weightLog as Record<string, number>)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-30)
    .map(([date, kg]) => ({
      d: date.slice(5).replace("-", "/"),
      kg,
    }));

  // ── Wellness history chart (last 30 days) ─────────────────────────────────
  const wellnessTrend30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400000);
    const iso = d.toISOString().split("T")[0];
    const w = (wellnessHistory as Record<string, { score?: number }>)?.[iso];
    return { d: `${d.getDate()}/${d.getMonth() + 1}`, score: w?.score ?? null };
  });

  // ── Volume chart (all weeks from combinedData) ────────────────────────────
  const volData = (combinedData as Array<{ s: string; volProg: number; volReal: number | null }>)?.map(d => ({
    s: d.s,
    vol: d.volReal ?? d.volProg,
  })) ?? [];

  // ── PRs ───────────────────────────────────────────────────────────────────
  const prEntries = Object.entries(prs as Record<string, { est?: string; date?: string }>)
    .filter(([, v]) => v?.est)
    .slice(0, 10);

  const displayProfile = athleteProfile ?? profile;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 40px", scrollbarWidth: "none" }}>

      {/* ── Section infos ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
          Profil
        </div>
        <div style={{ background: "#0F1014", borderRadius: 16, padding: 16, border: "1px solid #1A1B22" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <div
              style={{
                width: 48, height: 48, borderRadius: "50%",
                background: C.coach + "25", border: "1px solid " + C.coach + "40",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, fontWeight: 800, color: C.coach, flexShrink: 0,
              }}
            >
              {(displayProfile?.full_name ?? "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.tx }}>{displayProfile?.full_name ?? "—"}</div>
              <div style={{ fontSize: 11, color: C.tx3 }}>{todayShort()}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { l: "Âge",    v: displayProfile?.age ? `${displayProfile.age} ans` : "—" },
              { l: "Taille", v: displayProfile?.height_cm ? `${displayProfile.height_cm} cm` : "—" },
              { l: "Poids",  v: bodyWeight?.current ? `${bodyWeight.current} kg` : "—" },
            ].map(({ l, v }) => (
              <div key={l} style={{ background: C.s2, borderRadius: 10, padding: "8px 12px", flex: 1, minWidth: 72 }}>
                <div style={{ fontSize: 9, color: C.tx3 }}>{l}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section stats — volume ── */}
      {volData.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
            Volume · programme
          </div>
          <div style={{ background: "#0F1014", borderRadius: 16, padding: 16, border: "1px solid #1A1B22" }}>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={volData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <Bar dataKey="vol" fill={C.ac} radius={[2, 2, 0, 0]} />
                <XAxis dataKey="s" tick={{ fontSize: 9, fill: C.tx3 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: C.s1, border: "none", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: C.tx3 }}
                  itemStyle={{ color: C.ac }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Section stats — wellness 30j ── */}
      {wellnessTrend30.some(d => d.score !== null) && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
            Wellness · 30 jours
          </div>
          <div style={{ background: "#0F1014", borderRadius: 16, padding: 16, border: "1px solid #1A1B22" }}>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={wellnessTrend30} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <Line type="monotone" dataKey="score" stroke={C.coach} strokeWidth={2} dot={false} connectNulls />
                <XAxis dataKey="d" tick={{ fontSize: 8, fill: C.tx3 }} axisLine={false} tickLine={false} interval={4} />
                <YAxis domain={[0, 100]} hide />
                <Tooltip
                  contentStyle={{ background: C.s1, border: "none", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: C.tx3 }}
                  itemStyle={{ color: C.coach }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Section stats — poids ── */}
      {weightData.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
            Poids de corps · 30 jours
          </div>
          <div style={{ background: "#0F1014", borderRadius: 16, padding: 16, border: "1px solid #1A1B22" }}>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={weightData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <Line type="monotone" dataKey="kg" stroke={C.b} strokeWidth={2} dot={false} />
                <XAxis dataKey="d" tick={{ fontSize: 8, fill: C.tx3 }} axisLine={false} tickLine={false} interval={4} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: C.s1, border: "none", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: C.tx3 }}
                  itemStyle={{ color: C.b }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Section PRs ── */}
      {prEntries.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
            Records personnels
          </div>
          <div style={{ background: "#0F1014", borderRadius: 16, border: "1px solid #1A1B22", overflow: "hidden" }}>
            {prEntries.map(([name, v], i) => (
              <div
                key={name}
                style={{
                  padding: "12px 16px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  borderBottom: i < prEntries.length - 1 ? "1px solid " + C.brd : "none",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.tx }}>{name}</div>
                  {v.date && <div style={{ fontSize: 10, color: C.tx3, marginTop: 1 }}>{v.date}</div>}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.o }}>{v.est} kg</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section paramètres ── */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
          Paramètres
        </div>
        <div style={{ background: "#0F1014", borderRadius: 16, border: "1px solid #1A1B22", overflow: "hidden" }}>
          {/* Weight input */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid " + C.brd }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.tx, marginBottom: 4 }}>Poids de corps actuel</div>
            <div style={{ fontSize: 11, color: C.tx3 }}>
              {bodyWeight?.current ? `${bodyWeight.current} kg` : "Non renseigné"} — modifiable dans la séance
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            style={{
              width: "100%", padding: "14px 16px", border: "none",
              background: "transparent", textAlign: "left",
              color: "#EF4B4B", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 8,
              minHeight: 44,
            }}
          >
            <span>⏻</span> Déconnexion
          </button>
        </div>
      </div>
    </div>
  );
}
