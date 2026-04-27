import { C } from "@/lib/theme";

/**
 * Banque globale de tests — catalogue de protocoles de test.
 * Implémentation complète prévue en PROMPT 3.
 */
export default function CoachTestsBankPage() {
  return (
    <div
      style={{
        padding: "40px 24px", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", minHeight: 320, gap: 12,
      }}
    >
      <div style={{ fontSize: 36 }}>🧪</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.tx }}>Banque de tests</div>
      <div style={{ fontSize: 13, color: C.tx3, textAlign: "center", maxWidth: 320 }}>
        Catalogue global de protocoles de test (VMA, RM, endurance…).
        <br />
        <span style={{ fontSize: 11 }}>Implémenté en PROMPT 3.</span>
      </div>
    </div>
  );
}
