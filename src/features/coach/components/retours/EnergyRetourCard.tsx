import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Zap, Check } from "lucide-react";
import { C } from "@/lib/theme";
import type { EnergySessionDetail } from "@/features/shared/types/retours.types";

interface EnergyRetourCardProps {
  session: EnergySessionDetail;
}

const KIND_LABELS: Record<string, string> = {
  vo2: "VO₂max", tempo: "Tempo", seuil: "Seuil", footing: "Footing",
  fartlek: "Fartlek", autre: "Autre", custom: "Custom",
  intermittent: "Intermittent", continu: "Continu",
  coupures: "Coupures", sprint: "Sprint", circuit: "Circuit",
};

function rpeColor(v: number) { return v <= 4 ? C.g : v <= 7 ? C.o : C.r; }
function rpeBg(v: number)    { return v <= 4 ? C.gS : v <= 7 ? C.oS : C.rS; }

export function EnergyRetourCard({ session }: EnergyRetourCardProps) {
  const blVals     = session.block_logs ? Object.values(session.block_logs) : [];
  const doneCount  = blVals.filter((b) => b.done).length;
  const totalCount = blVals.length;
  const statusColor = session.partial ? "#3B8DF0" : session.completed ? "#22C993" : "#FB923C";
  const statusLabel = session.partial
    ? `✓ Partielle ${doneCount}/${totalCount}`
    : session.completed ? "✓ Complétée" : "Non faite";

  const blockEntries = session.block_logs
    ? Object.entries(session.block_logs).filter(([, b]) => b.note)
    : [];

  return (
    <div style={{ background: C.s1, border: "1px solid " + C.brd, borderRadius: 12, padding: "10px 14px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Zap size={13} color="#F5A623" />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>{session.session_label}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 8,
            background: statusColor + "25", color: statusColor,
          }}>
            {statusLabel}
          </span>
          {session.rpe_score != null && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 8,
              background: rpeBg(session.rpe_score), color: rpeColor(session.rpe_score),
            }}>
              RPE {session.rpe_score}/10
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: C.tx3, flexShrink: 0 }}>
          {format(new Date(session.date + "T12:00:00"), "EEE d MMM", { locale: fr })}
        </span>
      </div>

      {session.session_kind && (
        <div style={{ fontSize: 11, color: C.tx2, marginBottom: 8 }}>
          Type : <span style={{ fontWeight: 600, color: C.tx }}>{KIND_LABELS[session.session_kind] ?? session.session_kind}</span>
        </div>
      )}

      {(session.duration_min != null || session.distance_m != null) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 8 }}>
          {session.duration_min != null && (
            <div style={{ background: C.s2, borderRadius: 8, padding: "6px 8px" }}>
              <div style={{ fontSize: 9, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 2 }}>Durée</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.tx }}>{session.duration_min} min</div>
            </div>
          )}
          {session.distance_m != null && (
            <div style={{ background: C.s2, borderRadius: 8, padding: "6px 8px" }}>
              <div style={{ fontSize: 9, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 2 }}>Distance</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.tx }}>{(session.distance_m / 1000).toFixed(2)} km</div>
            </div>
          )}
        </div>
      )}

      {/* Block completion summary */}
      {session.block_logs && Object.keys(session.block_logs).length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {Object.entries(session.block_logs).map(([id, b], i) => (
            <span key={id} style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 6,
              background: b.done ? C.g + "20" : C.s2,
              color: b.done ? C.g : C.tx3,
              display: "flex", alignItems: "center", gap: 4,
            }}>
              {b.done && <Check size={9} />}
              Bloc {i + 1}
            </span>
          ))}
        </div>
      )}

      {/* Block notes */}
      {blockEntries.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {blockEntries.map(([id, b], i) => (
            <div key={id} style={{ fontSize: 11, color: C.tx2, marginBottom: 3 }}>
              <span style={{ color: C.tx3 }}>Bloc {i + 1} : </span>{b.note}
            </div>
          ))}
        </div>
      )}

      {session.note && (
        <div style={{ background: C.acS, borderRadius: 8, padding: "7px 10px" }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: C.ac, textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 3 }}>Note</div>
          <div style={{ fontSize: 12, color: C.tx2 }}>{session.note}</div>
        </div>
      )}
    </div>
  );
}
