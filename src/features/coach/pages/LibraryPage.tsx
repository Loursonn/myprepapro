import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { C } from "@/lib/theme";
import { ExerciseBank } from "@/components/coach/ExerciseBank";
import EnergyExerciseBank from "@/components/coach/EnergyExerciseBank";

/**
 * Banque globale d'exercices — non liée à un athlète spécifique.
 * Sert à découvrir et gérer le catalogue d'exercices du coach.
 */
export default function LibraryPage() {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<"muscu" | "energie">("muscu");

  if (!user) return null;

  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* Sub-tabs */}
      <div
        style={{
          display: "flex", borderBottom: "1px solid " + C.brd,
          padding: "0 24px", gap: 0,
        }}
      >
        {([
          { k: "muscu",   l: "Musculation" },
          { k: "energie", l: "Énergétique" },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setSubTab(t.k)}
            style={{
              padding: "12px 16px", border: "none",
              borderBottom: "2px solid " + (subTab === t.k ? C.ac : "transparent"),
              background: "transparent",
              color: subTab === t.k ? C.ac : C.tx3,
              fontSize: 12, fontWeight: subTab === t.k ? 600 : 400,
              cursor: "pointer", fontFamily: "inherit",
              textTransform: "uppercase", letterSpacing: "0.3px",
              transition: "color 150ms, border-color 150ms",
            }}
          >
            {t.l}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px 24px" }}>
        {subTab === "muscu" && (
          <ExerciseBank coachId={user.id} onAddToExos={undefined} />
        )}
        {subTab === "energie" && (
          <EnergyExerciseBank coachId={user.id} C={C} />
        )}
      </div>
    </div>
  );
}
