import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { MuscleVolumeCard } from "@/components/athlete/StatsViews";
import { PlanningOverview } from "@/components/coach/PlanningOverview";
import { MiniChart, WeightChart } from "@/components/athlete/StatsCharts";
import { getBig3, get1rmByWeek } from "@/lib/calculations";
import { stC } from "@/lib/muscles";
import { ALL_BZ } from "@/lib/muscles";

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function StatsPage() {
  const {
    athleteId, exos, sets, sessions, blockConfig, injuries, activeInjuries,
    prs, weeksArr, tw, currentWeek, weightLog, weightMilestones, bodyWeight,
    wellnessHistory, nutritionStrategy, exMeta,
    sessionLogs,
  } = useAthleteContext();

  const big3 = getBig3(exos);

  return (
    <>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Suivi athlète</div>
      <div style={{ fontSize: 12, color: C.tx2, marginBottom: 12 }}>
        {sessions.length > 0 ? (blockConfig?.blockName || "Programme") + " · S" + currentWeek + "/" + tw : "Aucun bloc actif"}
      </div>

      <PlanningOverview athleteId={athleteId} />

      {/* 1RM Progression */}
      <div style={{ background: C.s1, borderRadius: 14, padding: 14, border: "1px solid " + C.brd, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 12 }}>Progression 1RM</div>
        {big3.map(({ name, label, c }: { name: string; label: string; c: string }) => {
          const pr = (prs as Record<string, { est?: string }>)[name] || null;
          const data = get1rmByWeek(exos, name, tw);
          const filled = data.filter((d: { val: number | null }) => d.val != null);
          const prog = filled.length >= 2 ? filled[filled.length - 1].val - filled[0].val : null;
          return (
            <div key={name} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 3, height: 16, borderRadius: 2, background: c }} /><span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span></div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: c }}>{pr?.est || "--"}</span>
                  <span style={{ fontSize: 10, color: C.tx3 }}>kg</span>
                  {prog != null && <span style={{ fontSize: 11, fontWeight: 700, color: prog > 0 ? C.g : prog < 0 ? C.r : C.tx3, padding: "2px 6px", borderRadius: 5, background: (prog > 0 ? C.g : prog < 0 ? C.r : C.tx3) + "15" }}>{prog > 0 ? "+" : ""}{prog}</span>}
                </div>
              </div>
              <MiniChart data={data} color={c} h={44} />
            </div>
          );
        })}
      </div>

      {/* Poids de corps */}
      <div style={{ background: C.s1, borderRadius: 14, padding: 14, border: "1px solid " + C.brd, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>Poids de corps</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.ac }}>{bodyWeight.current} <span style={{ fontSize: 10, fontWeight: 400, color: C.tx3 }}>/ {bodyWeight.target} kg</span></div>
        </div>
        {Object.keys(weightLog).length > 0
          ? <WeightChart log={weightLog} milestones={weightMilestones} target={bodyWeight.target} nutritionStrategy={nutritionStrategy} />
          : <div style={{ textAlign: "center", color: C.tx3, fontSize: 11, padding: "14px 0" }}>Aucune mesure</div>}
      </div>

      <MuscleVolumeCard exos={exos} exMeta={exMeta} sets={sets} sessions={sessions} weeksArr={weeksArr} tw={tw} />

      {/* Blessures */}
      {injuries.length > 0 ? (
        <div style={{ background: C.s1, borderRadius: 14, padding: 14, border: "1px solid " + C.r + "30", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.r, textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 10 }}>Blessures ({activeInjuries.length} active{activeInjuries.length > 1 ? "s" : ""})</div>
          {injuries.map(inj => {
            const sc = stC(inj.status);
            const zn = ALL_BZ.filter((z: { id: string; label: string }) => inj.zones.includes(z.id)).map((z: { label: string }) => z.label).join(", ") || "Zone non précisée";
            return (
              <div key={inj.id} style={{ padding: "8px 12px", borderRadius: 8, background: C.s2, border: "1px solid " + sc + "30", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div><div style={{ fontSize: 12, fontWeight: 600, color: C.tx }}>{zn}</div><div style={{ fontSize: 10, color: C.tx3 }}>{inj.type || "Type non précisé"} - Intensité {inj.intensity}/10</div></div>
                <span style={{ fontSize: 10, fontWeight: 700, color: sc, padding: "2px 8px", borderRadius: 5, background: sc + "15" }}>{inj.status}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: C.s1, borderRadius: 14, padding: "14px", border: "1px solid " + C.g + "30", textAlign: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: C.g, fontWeight: 600 }}>Aucune blessure</span>
        </div>
      )}

      {/* Comptes rendus de séances */}
      {Object.keys(sessionLogs).filter(k => sessionLogs[k]?.note || sessionLogs[k]?.forme).length > 0 && (() => {
        const logs = Object.entries(sessionLogs).filter(([, l]) => l?.note || l?.forme).sort((a, b) => ((b[1].date || "") > (a[1].date || "") ? 1 : -1)).slice(0, 10);
        return (
          <div style={{ background: C.s1, borderRadius: 14, padding: 14, border: "1px solid " + C.brd, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 10 }}>Comptes rendus de séances</div>
            {logs.map(([key, log]) => {
              const parts = key.split("_"); const wkNum = parts[parts.length - 1]; const sessId = parts.slice(0, -1).join("_");
              const sess = sessions.find(s => s.id === sessId);
              return (
                <div key={key} style={{ padding: "8px 10px", borderRadius: 8, background: C.s2, marginBottom: 6, border: "1px solid " + C.brd }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: log.note ? 4 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.ac }}>{sess?.name || sessId}</span>
                      <span style={{ fontSize: 9, color: C.tx3, padding: "1px 6px", borderRadius: 4, background: C.acS }}>S{wkNum}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {log.forme && <span style={{ fontSize: 10, fontWeight: 600, color: log.forme >= 4 ? C.g : log.forme >= 3 ? C.o : C.r }}>Forme {log.forme}/5</span>}
                      {log.duration && <span style={{ fontSize: 10, color: C.tx3 }}>{fmtTime(log.duration)}</span>}
                      {log.date && <span style={{ fontSize: 9, color: C.tx3 }}>{new Date(log.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}</span>}
                    </div>
                  </div>
                  {log.note && <div style={{ fontSize: 11, color: C.tx2, lineHeight: 1.5, fontStyle: "italic" }}>"{log.note}"</div>}
                </div>
              );
            })}
          </div>
        );
      })()}
    </>
  );
}
