import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Zap } from "lucide-react";
import { C } from "@/lib/theme";
import type { EnergySessionDetail } from "@/features/shared/types/retours.types";

interface EnergyRetourCardProps {
  session: EnergySessionDetail;
}

function kindLabel(kind: string | null): string {
  if (!kind) return "Inconnu";
  const map: Record<string, string> = {
    intermittent: "Intermittent",
    continu:      "Continu",
    seuil:        "Seuil",
    coupures:     "Coupures",
    sprint:       "Sprint",
    circuit:      "Circuit",
  };
  return map[kind] ?? kind;
}

export function EnergyRetourCard({ session }: EnergyRetourCardProps) {
  return (
    <div style={{ background: C.s1, border: "1px solid " + C.brd, borderRadius: 12, padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={13} color="#F5A623" />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>{session.session_label}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 8,
            background: session.completed ? "rgba(34,201,147,0.15)" : "rgba(251,146,60,0.15)",
            color: session.completed ? "#22C993" : "#FB923C",
          }}>
            {session.completed ? "Complétée" : "Non faite"}
          </span>
        </div>
        <span style={{ fontSize: 10, color: C.tx3 }}>
          {format(new Date(session.date + "T12:00:00"), "EEE d MMM", { locale: fr })}
        </span>
      </div>

      {session.session_kind && (
        <div style={{ fontSize: 11, color: C.tx2, marginBottom: 8 }}>
          Type : <span style={{ fontWeight: 600, color: C.tx }}>{kindLabel(session.session_kind)}</span>
        </div>
      )}

      {(session.duration_min != null || session.distance_m != null) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: session.note ? 8 : 0 }}>
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

      {session.note && (
        <div style={{ background: C.acS, borderRadius: 8, padding: "7px 10px" }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: C.ac, textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 3 }}>Note</div>
          <div style={{ fontSize: 12, color: C.tx2 }}>{session.note}</div>
        </div>
      )}
    </div>
  );
}
