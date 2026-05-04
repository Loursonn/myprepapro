import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FlaskConical } from "lucide-react";
import { C } from "@/lib/theme";

interface TestRetourCardProps {
  test: {
    id: string;
    title: string;
    type: string;
    date: string;
    completed: boolean;
    results_note: string | null;
    coach_validated: boolean | null;
  };
}

export function TestRetourCard({ test }: TestRetourCardProps) {
  return (
    <div style={{ background: C.s1, border: "1px solid " + C.brd, borderRadius: 12, padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FlaskConical size={13} color="#A855F7" />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>{test.title}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 8,
            background: test.completed ? "rgba(34,201,147,0.15)" : "rgba(124,116,128,0.15)",
            color: test.completed ? "#22C993" : C.tx3,
          }}>
            {test.completed ? "Complété" : "En attente"}
          </span>
          {test.coach_validated && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 8, background: "rgba(123,111,255,0.15)", color: "#7B6FFF" }}>
              ✓ Validé
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: C.tx3 }}>
          {format(new Date(test.date), "EEE d MMM", { locale: fr })}
        </span>
      </div>

      <div style={{ fontSize: 11, color: C.tx2, marginBottom: test.results_note ? 8 : 0 }}>
        Type : <span style={{ fontWeight: 600, color: C.tx }}>{test.type}</span>
      </div>

      {test.results_note && (
        <div style={{ background: C.s2, borderRadius: 8, padding: "7px 10px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 3 }}>Notes des résultats</div>
          <div style={{ fontSize: 12, color: C.tx2 }}>{test.results_note}</div>
        </div>
      )}
    </div>
  );
}
