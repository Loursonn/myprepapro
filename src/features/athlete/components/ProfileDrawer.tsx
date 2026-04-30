import { useState } from "react";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { useNavigate } from "react-router-dom";
import PerformanceProfile from "@/components/athlete/PerformanceProfile";
import { WeightChart, SleepTunnel, MiniChart } from "@/components/athlete/StatsCharts";
import { getWellnessChartData } from "@/lib/calculations";
import { getReco } from "@/lib/wellness";
import { ALL_BZ } from "@/lib/muscles";
import { stC } from "@/lib/muscles";
import { e1rm } from "@/lib/exercises";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { todayKey } from "@/lib/date";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/hooks/useAuth";

interface Props {
  onClose: () => void;
}

export default function ProfileDrawer({ onClose }: Props) {
  const { athleteId, athleteProfile, viewOnly, activeInjuries, injuries, wellness, wScore, wReco, weightLog, weightMilestones, bodyWeight, wellnessHistory, nutritionStrategy, sets, exos, tw, coachFeedbacks } = useAthleteContext();
  const navigate = useNavigate();
  const [drawerSportOpen, setDrawerSportOpen] = useState(false);
  const [drawerPrOpen, setDrawerPrOpen] = useState(false);
  const [drawerInjOpen, setDrawerInjOpen] = useState(false);
  const [drawerZoom, setDrawerZoom] = useState<string | null>(null);
  const [wellnessPeriod, setWellnessPeriod] = useState("month");
  const [prSearch, setPrSearch] = useState("");
  const [prExName, setPrExName] = useState<string | null>(null);
  const [prTab, setPrTab] = useState("est");

  const ap = athleteProfile as Profile | null;

  const weeks = Object.keys(coachFeedbacks).map(Number).filter(Boolean).sort((a, b) => b - a);
  const latestWeek = weeks[0];
  const latestFb = latestWeek ? coachFeedbacks[latestWeek] : null;

  // Zoom overlay
  if (drawerZoom) return (
    <div style={{ position: "fixed", inset: 0, zIndex: 103, background: C.bg, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid " + C.brd, position: "sticky", top: 0, background: C.bg, zIndex: 2 }}>
        <button onClick={() => setDrawerZoom(null)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid " + C.brdL, background: "transparent", color: C.tx2, fontSize: 18, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>←</button>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{drawerZoom === "weight" ? "Poids de corps" : drawerZoom === "wellness" ? "Forme du jour" : drawerZoom === "goals" ? "Objectifs" : "Score de santé"}</div>
      </div>
      <div style={{ padding: "16px" }}>
        {drawerZoom === "weight" && (
          <div style={{ background: C.s1, borderRadius: 14, padding: "16px", border: "1px solid " + C.brd }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Évolution du poids</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.ac }}>{bodyWeight.current || "—"}<span style={{ fontSize: 10, fontWeight: 400, color: C.tx3 }}> / {bodyWeight.target || "—"} kg</span></div>
            </div>
            {Object.keys(weightLog).length > 0 ? <WeightChart log={weightLog} milestones={weightMilestones} target={bodyWeight.target} nutritionStrategy={nutritionStrategy} /> : <div style={{ textAlign: "center", color: C.tx3, fontSize: 11, padding: "24px 0" }}>Aucune mesure enregistrée</div>}
          </div>
        )}
        {drawerZoom === "wellness" && wellness && (
          <WellnessZoomContent wellness={wellness} wScore={wScore} wReco={wReco} wellnessHistory={wellnessHistory} wellnessPeriod={wellnessPeriod} setWellnessPeriod={setWellnessPeriod} />
        )}
        {drawerZoom === "goals" && <GoalsZoomContent />}
        {drawerZoom === "health" && (
          <div style={{ background: C.s1, borderRadius: 14, padding: "16px", border: "1px solid " + C.brd }}>
            <WellnessChart wellnessHistory={wellnessHistory} period={wellnessPeriod} setPeriod={setWellnessPeriod} height={200} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(360px,92vw)", zIndex: 102, background: C.bg, overflowY: "auto", display: "flex", flexDirection: "column", boxShadow: "-4px 0 32px rgba(0,0,0,0.6)", borderLeft: "1px solid " + C.brd }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid " + C.brd, position: "sticky", top: 0, background: C.bg, zIndex: 2 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Mon profil</div>
        <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid " + C.brdL, background: "transparent", color: C.tx2, fontSize: 18, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
      </div>
      <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Profile card */}
        <div style={{ background: C.s1, borderRadius: 14, border: "1px solid " + C.brd, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.acS, border: "2px solid " + C.ac + "40", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: C.ac }}>
              {ap ? ([ap.first_name, ap.last_name].filter(Boolean).join(" ") || ap.full_name || "?").split(" ").filter((n: string) => n).map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "?"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>{ap ? ([ap.first_name, ap.last_name].filter(Boolean).join(" ") || ap.full_name || "Athlète") : "Athlète"}</div>
              {ap?.gender && <div style={{ fontSize: 11, color: C.tx3 }}>{ap.gender === "male" ? "Homme" : ap.gender === "female" ? "Femme" : ""}</div>}
            </div>
          </div>
        </div>

        {/* Données sportives */}
        <div style={{ background: C.s1, borderRadius: 14, border: "1px solid " + C.brd, overflow: "hidden" }}>
          <button onClick={() => setDrawerSportOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.tx3, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>Données sportives</div>
            <span style={{ fontSize: 12, color: C.tx3, display: "inline-block", transition: "transform 0.2s", transform: drawerSportOpen ? "rotate(180deg)" : "none" }}>∨</span>
          </button>
          {drawerSportOpen && <div style={{ borderTop: "1px solid " + C.brd, padding: "0 0 8px" }}><PerformanceProfile athleteId={athleteId} viewOnly={viewOnly} C={C} /></div>}
        </div>

        {/* Poids */}
        <button onClick={() => setDrawerZoom("weight")} style={{ width: "100%", background: C.s1, borderRadius: 14, padding: "14px 16px", border: "1px solid " + C.brd, textAlign: "left" as const, cursor: "pointer", fontFamily: "inherit" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>Poids de corps</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.ac }}>{(() => { const e = Object.entries(weightLog).sort((a, b) => b[0] > a[0] ? 1 : -1)[0]; return weightLog[todayKey()] || e?.[1] || bodyWeight.current || "—"; })()}<span style={{ fontSize: 10, fontWeight: 400, color: C.tx3 }}> kg</span></span>
              <span style={{ fontSize: 11, color: C.tx3 }}>→</span>
            </div>
          </div>
          {Object.keys(weightLog).length > 0 ? <WeightChart log={weightLog} milestones={weightMilestones} target={bodyWeight.target} nutritionStrategy={nutritionStrategy} /> : <div style={{ fontSize: 11, color: C.tx3, textAlign: "center" as const, padding: "8px 0" }}>Aucune mesure</div>}
        </button>

        {/* Forme du jour */}
        <button onClick={() => setDrawerZoom("wellness")} style={{ width: "100%", background: C.s1, borderRadius: 14, padding: "14px 16px", border: "1px solid " + (wellness ? wReco.c + "30" : C.brd), textAlign: "left" as const, cursor: "pointer", fontFamily: "inherit" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: wellness ? 10 : 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>Forme du jour</div>
            {wellness && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ fontSize: 10, fontWeight: 800, color: wReco.c }}>{wScore}</div><span style={{ fontSize: 11, color: C.tx3 }}>→</span></div>}
          </div>
          {wellness ? <div style={{ fontSize: 12, fontWeight: 600, color: wReco.c }}>{wReco.label}</div> : <div style={{ fontSize: 11, color: C.tx3 }}>Aucun bilan aujourd'hui</div>}
        </button>

        {/* Score santé */}
        <button onClick={() => setDrawerZoom("health")} style={{ width: "100%", background: C.s1, borderRadius: 14, padding: "14px 16px", border: "1px solid " + C.brd, textAlign: "left" as const, cursor: "pointer", fontFamily: "inherit" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>Score de santé</div>
            <span style={{ fontSize: 11, color: C.tx3 }}>→</span>
          </div>
          <WellnessChart wellnessHistory={wellnessHistory} period={wellnessPeriod} setPeriod={setWellnessPeriod} height={72} minimal />
        </button>

        {/* 1RM Record */}
        <div style={{ background: C.s1, borderRadius: 14, border: "1px solid " + C.brd, overflow: "hidden" }}>
          <button onClick={() => setDrawerPrOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.tx3, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>1RM Record</div>
            <span style={{ fontSize: 12, color: C.tx3, display: "inline-block", transition: "transform 0.2s", transform: drawerPrOpen ? "rotate(180deg)" : "none" }}>∨</span>
          </button>
          {drawerPrOpen && (
            <div style={{ borderTop: "1px solid " + C.brd, padding: "12px 16px" }}>
              {(() => {
                const seen = new Set<string>();
                const progExNames = Object.values(exos || {}).flat().map(ex => ex.name || "").filter(n => { if (!n || seen.has(n.toLowerCase())) return false; seen.add(n.toLowerCase()); return true; }).sort();
                const filtered = prSearch ? progExNames.filter(n => n.toLowerCase().includes(prSearch.toLowerCase())) : progExNames;
                const getActual1rm = (exName: string, w: number) => {
                  const exIds = Object.values(exos || {}).flat().filter(ex => (ex.name || "").toLowerCase() === exName.toLowerCase()).map(ex => ex.id);
                  let best: number | null = null;
                  exIds.forEach(id => { (sets[id + "_" + w] || []).filter(r => r.done && (r.kg || 0) > 0).forEach(r => { const est = e1rm(r.kg!, r.reps || 1); if (!best || est > best) best = est; }); });
                  return best;
                };
                const actual1rmByWeek = prExName ? Array.from({ length: tw }, (_, i) => ({ w: i + 1, week: "S" + (i + 1), val: getActual1rm(prExName, i + 1) })) : [];
                const bestActual = actual1rmByWeek.reduce((mx, d) => d.val && d.val > (mx.val || 0) ? d : mx, { val: 0, w: null as number | null });
                const showDropdown = prSearch && filtered.length > 0 && !progExNames.find(n => n.toLowerCase() === prSearch.toLowerCase());
                return (<>
                  <div style={{ position: "relative", marginBottom: 10 }}>
                    <input value={prSearch} onChange={e => { setPrSearch(e.target.value); setPrExName(null); }} placeholder={progExNames.length ? "Rechercher un exercice..." : "Aucun exercice"} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                    {showDropdown && (<div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: C.s1, border: "1px solid " + C.brdL, borderRadius: 8, zIndex: 50, maxHeight: 140, overflowY: "auto", marginTop: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                      {filtered.slice(0, 6).map(n => (<div key={n} onClick={() => { setPrExName(n); setPrSearch(n); }} style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", color: C.tx, borderBottom: "1px solid " + C.brd }}>{n}</div>))}
                    </div>)}
                  </div>
                  {prExName ? (<>
                    <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
                      {[{ k: "est", l: "1RM Estimé" }, { k: "evo", l: "Évolution" }].map(t => (<button key={t.k} onClick={() => setPrTab(t.k)} style={{ padding: "4px 12px", borderRadius: 7, border: "none", background: prTab === t.k ? C.acS : C.s2, color: prTab === t.k ? C.ac : C.tx3, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t.l}</button>))}
                    </div>
                    {prTab === "est" && <div style={{ textAlign: "center" as const }}><div style={{ fontSize: 44, fontWeight: 900, color: C.ac, letterSpacing: "-2px", lineHeight: 1 }}>{bestActual.val || "--"}</div><div style={{ fontSize: 10, color: C.tx3, marginTop: 3 }}>kg estimé 1RM</div>{bestActual.w && <div style={{ marginTop: 6, fontSize: 10, color: C.tx3, padding: "2px 8px", borderRadius: 5, background: C.s2, display: "inline-block" }}>Meilleure perf. S{bestActual.w}</div>}</div>}
                    {prTab === "evo" && (actual1rmByWeek.some(d => d.val) ? <MiniChart data={actual1rmByWeek} color={C.ac} h={70} /> : <div style={{ textAlign: "center" as const, color: C.tx3, fontSize: 11, padding: "16px 0" }}>Aucune série effectuée</div>)}
                  </>) : (<div style={{ fontSize: 11, color: C.tx3, textAlign: "center" as const, padding: "10px 0" }}>{progExNames.length ? "Recherche et sélectionne un exercice" : "Aucun exercice dans la programmation"}</div>)}
                </>);
              })()}
            </div>
          )}
        </div>

        {/* Blessures */}
        {activeInjuries.length > 0 && (
          <div style={{ background: C.s1, borderRadius: 14, border: "1px solid " + C.r + "30", overflow: "hidden" }}>
            <button onClick={() => setDrawerInjOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: C.r }} /><div style={{ fontSize: 12, fontWeight: 600, color: C.r, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>Blessures actives ({activeInjuries.length})</div></div>
              <span style={{ fontSize: 12, color: C.tx3, display: "inline-block", transition: "transform 0.2s", transform: drawerInjOpen ? "rotate(180deg)" : "none" }}>∨</span>
            </button>
            {drawerInjOpen && (<div style={{ borderTop: "1px solid " + C.r + "30", padding: "8px 16px" }}>
              {activeInjuries.map(inj => { const sc = stC(inj.status); const zn = ALL_BZ.filter((z: { id: string; label: string }) => inj.zones.includes(z.id)).map((z: { label: string }) => z.label).join(", ") || "Zone non précisée"; return (<div key={inj.id} style={{ padding: "8px 10px", borderRadius: 8, background: C.s2, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}><div><div style={{ fontSize: 12, fontWeight: 600, color: C.tx }}>{zn}</div><div style={{ fontSize: 10, color: C.tx3 }}>Intensité {inj.intensity}/10</div></div><span style={{ fontSize: 10, fontWeight: 700, color: sc, padding: "2px 8px", borderRadius: 5, background: sc + "15" }}>{inj.status}</span></div>); })}
            </div>)}
          </div>
        )}

        {/* Retour coach */}
        {latestFb?.note && (
          <div style={{ background: C.s1, borderRadius: 14, border: "1px solid " + C.coach + "40", overflow: "hidden" }}>
            <button onClick={() => { navigate("coach-feedback"); onClose(); }} style={{ width: "100%", padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 13 }}>💬</span><span style={{ fontSize: 11, fontWeight: 700, color: C.coach }}>Retour du coach</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 9, color: C.tx3 }}>S{latestWeek}</span><span style={{ fontSize: 11, color: C.coach }}>›</span></div>
              </div>
              <div style={{ fontSize: 11, color: C.tx2, lineHeight: 1.55, fontStyle: "italic", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>"{latestFb.note}"</div>
            </button>
          </div>
        )}

        {/* Objectifs */}
        <button onClick={() => setDrawerZoom("goals")} style={{ width: "100%", background: C.s1, borderRadius: 14, padding: "14px 16px", border: "1px solid " + C.brd, textAlign: "left" as const, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.tx3, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>Objectifs</div>
          <span style={{ fontSize: 11, color: C.tx3 }}>→</span>
        </button>

        {/* Déconnexion */}
        <div style={{ marginTop: "auto", paddingTop: 8 }}>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }} style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "1px solid " + C.r + "30", background: C.rS, color: C.r, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <span>⏻</span><span>Déconnexion</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WellnessChart({ wellnessHistory, period, setPeriod, height, minimal = false }: { wellnessHistory: Record<string, unknown>; period: string; setPeriod: (v: string) => void; height: number; minimal?: boolean }) {
  const wData = getWellnessChartData(wellnessHistory, period);
  const hasSomeData = wData.some((d: { score: number | null }) => d.score !== null);
  if (!hasSomeData) return <div style={{ textAlign: "center" as const, color: C.tx3, fontSize: 11, padding: "8px 0" }}>Aucune donnée</div>;
  return (
    <>
      {!minimal && (
        <div style={{ display: "flex", gap: 3, marginBottom: 8 }}>
          {[{ k: "week", l: "7j" }, { k: "month", l: "30j" }, { k: "year", l: "12m" }].map(t => (<button key={t.k} onClick={() => setPeriod(t.k)} style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: period === t.k ? C.acS : "transparent", color: period === t.k ? C.ac : C.tx3, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t.l}</button>))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={wData} margin={{ top: 2, right: 2, bottom: 0, left: -28 }}>
          <YAxis yAxisId="score" domain={[0, 100]} hide /><YAxis yAxisId="sleep" orientation="right" domain={[0, 12]} hide />
          <Bar yAxisId="sleep" dataKey="sleep" fill={C.b} opacity={0.3} radius={[2, 2, 0, 0]} maxBarSize={10} />
          <Line yAxisId="score" dataKey="score" stroke={C.g} strokeWidth={minimal ? 1.5 : 2} dot={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </>
  );
}

function WellnessZoomContent({ wellness, wScore, wReco, wellnessHistory, wellnessPeriod, setWellnessPeriod }: { wellness: ReturnType<typeof useAthleteContext>["wellness"]; wScore: number; wReco: { c: string; label: string; desc: string }; wellnessHistory: Record<string, unknown>; wellnessPeriod: string; setWellnessPeriod: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: C.s1, borderRadius: 14, padding: "16px", border: "1px solid " + C.brd }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.tx3, textTransform: "uppercase" as const, marginBottom: 12 }}>Forme du jour</div>
        {wellness ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
              <svg viewBox="0 0 64 64" style={{ width: 72, height: 72, transform: "rotate(-90deg)" }}><circle cx="32" cy="32" r="26" fill="none" stroke={C.s2} strokeWidth="5" /><circle cx="32" cy="32" r="26" fill="none" stroke={wReco.c} strokeWidth="5" strokeDasharray={String(2 * Math.PI * 26)} strokeDashoffset={String(2 * Math.PI * 26 * (1 - wScore / 100))} strokeLinecap="round" /></svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: wReco.c }}>{wScore}</div>
            </div>
            <div><div style={{ fontSize: 16, fontWeight: 700, color: wReco.c }}>{wReco.label}</div><div style={{ fontSize: 12, color: C.tx2, marginTop: 4 }}>{wReco.desc}</div></div>
          </div>
        ) : <div style={{ textAlign: "center" as const, color: C.tx3, fontSize: 12, padding: "20px 0" }}>Aucune donnée de forme aujourd'hui</div>}
      </div>
      <div style={{ background: C.s1, borderRadius: 14, padding: "16px", border: "1px solid " + C.brd }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.tx3, textTransform: "uppercase" as const }}>Score de santé</div>
          <div style={{ display: "flex", gap: 3 }}>{[{ k: "week", l: "7j" }, { k: "month", l: "30j" }, { k: "year", l: "12m" }].map(t => (<button key={t.k} onClick={() => setWellnessPeriod(t.k)} style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: wellnessPeriod === t.k ? C.acS : "transparent", color: wellnessPeriod === t.k ? C.ac : C.tx3, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t.l}</button>))}</div>
        </div>
        <WellnessChart wellnessHistory={wellnessHistory} period={wellnessPeriod} setPeriod={setWellnessPeriod} height={130} />
      </div>
      <div style={{ background: C.s1, borderRadius: 14, padding: "16px", border: "1px solid " + C.brd }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.tx3, textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 12 }}>Tunnel de sommeil — 14 jours</div>
        <SleepTunnel wellnessHistory={wellnessHistory} C={C} />
      </div>
    </div>
  );
}

function GoalsZoomContent() {
  const { totalDone, totalTarget, bodyWeight, weightLog, nutritionStrategy } = useAthleteContext();
  const todayW = weightLog[todayKey()] || Object.entries(weightLog).sort((a, b) => b[0] > a[0] ? 1 : -1)[0]?.[1] || bodyWeight.current || null;
  const tgt = nutritionStrategy?.target_weight || bodyWeight.target || null;
  const start = bodyWeight.current || null;
  const isGain = start && tgt ? tgt >= start : true;
  const delta = tgt && todayW ? +(tgt - todayW).toFixed(1) : null;
  const pct = start && tgt && start !== tgt && todayW ? Math.min(100, Math.max(0, isGain ? ((todayW - start) / (tgt - start)) * 100 : ((start - todayW) / (start - tgt)) * 100)) : 0;
  const reached = delta !== null && Math.abs(delta) < 0.3;
  const wC = reached ? C.g : C.ac;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: C.s1, borderRadius: 14, padding: "16px", border: "1px solid " + C.brd }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase" as const, marginBottom: 12 }}>Séances — Bloc en cours</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 10 }}><span style={{ fontSize: 36, fontWeight: 900, color: C.g, letterSpacing: "-1px" }}>{totalDone}</span><span style={{ fontSize: 16, color: C.tx3 }}>/ {totalTarget}</span></div>
        <div style={{ height: 6, background: C.s2, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}><div style={{ height: "100%", width: Math.min((totalDone / totalTarget) * 100, 100) + "%", background: C.g, borderRadius: 3 }} /></div>
        <div style={{ fontSize: 11, color: C.tx3 }}>{Math.max(0, totalTarget - totalDone)} séance(s) restante(s)</div>
      </div>
      {tgt && (
        <div style={{ background: C.s1, borderRadius: 14, padding: "16px", border: "1px solid " + C.brd }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase" as const }}>Objectif poids</div>
            {start && tgt && <span style={{ fontSize: 10, fontWeight: 700, color: isGain ? C.g : C.b, padding: "2px 8px", borderRadius: 5, background: (isGain ? C.g : C.b) + "18" }}>{isGain ? "▲ Prise" : "▼ Sèche"}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 10 }}><span style={{ fontSize: 36, fontWeight: 900, color: wC, letterSpacing: "-1px" }}>{todayW || "--"}</span><span style={{ fontSize: 16, color: C.tx3 }}>/ {tgt} kg</span></div>
          <div style={{ height: 6, background: C.s2, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}><div style={{ height: "100%", width: pct + "%", background: wC, borderRadius: 3, transition: "width 0.4s" }} /></div>
          <div style={{ fontSize: 11, color: reached ? C.g : C.tx3, fontWeight: reached ? 600 : 400 }}>{reached ? "Objectif atteint !" : delta !== null ? (Math.abs(delta) + " kg restants") : "—"}</div>
        </div>
      )}
    </div>
  );
}
