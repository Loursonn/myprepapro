/**
 * Page de démo temporaire — SessionPreview
 * Route : /coach/energy-demo (à retirer en fin de prompt 8)
 */
import SessionPreview from "../components/energy/SessionPreview";
import { C } from "@/lib/theme";
import type { EnergyGroup } from "@/types/energy";

// ── Séance démo : warmup + 2×5×400m + cooldown ───────────────────────────────
const DEMO_SESSION: EnergyGroup = {
  type: "group",
  id: "root",
  role: "open",
  repeat: 1,
  children: [
    // Échauffement 15 min
    {
      type: "interval",
      id: "wu",
      role: "warmup",
      duration: { kind: "time", value: 900 },
      target: { kind: "hr_zone", zone: 2 },
      notes: "Footing progressif",
    },
    // Bloc principal : 2 séries de 5×400m
    {
      type: "group",
      id: "main-block",
      role: "work",
      repeat: 2,
      children: [
        // 5×400m@VMA avec 90s récup
        {
          type: "group",
          id: "reps",
          role: "work",
          repeat: 5,
          children: [
            {
              type: "interval",
              id: "rep-400",
              role: "work",
              duration: { kind: "distance", value: 400 },
              target: { kind: "pace_test_pct", test_metric: "VMA", min: 95, max: 100 },
            },
          ],
          rest_between: {
            type: "interval",
            id: "recup-90",
            role: "recovery",
            duration: { kind: "time", value: 90 },
            target: { kind: "hr_zone", zone: 1 },
          },
        },
      ],
      rest_between: {
        type: "interval",
        id: "inter-serie",
        role: "rest",
        duration: { kind: "time", value: 300 },
        target: { kind: "none" },
        notes: "Repos 5 min entre les 2 séries",
      },
    },
    // Retour au calme 10 min
    {
      type: "interval",
      id: "cd",
      role: "cooldown",
      duration: { kind: "time", value: 600 },
      target: { kind: "hr_zone", zone: 1 },
    },
  ],
};

// ── Séance démo 2 : tempo simple ─────────────────────────────────────────────
const DEMO_TEMPO: EnergyGroup = {
  type: "group",
  id: "root-tempo",
  role: "open",
  repeat: 1,
  children: [
    {
      type: "interval",
      id: "wu2",
      role: "warmup",
      duration: { kind: "time", value: 600 },
      target: { kind: "hr_zone", zone: 2 },
    },
    {
      type: "interval",
      id: "tempo-block",
      role: "work",
      duration: { kind: "time", value: 2400 },
      target: { kind: "pace", min: 4.5, max: 5.0, unit: "min_per_km" },
      notes: "Allure seuil",
    },
    {
      type: "interval",
      id: "cd2",
      role: "cooldown",
      duration: { kind: "time", value: 600 },
      target: { kind: "hr_zone", zone: 1 },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────

export default function EnergyPreviewDemoPage() {
  return (
    <div style={{ padding: "24px 20px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{
        padding: "6px 14px", marginBottom: 24,
        background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.3)",
        borderRadius: 8, fontSize: 11, color: C.o,
      }}>
        Page de démo temporaire — à retirer en fin de prompt 8
      </div>

      {/* Séance 1 — pleine */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 4 }}>
          2×5×400m@VMA — VO₂max
        </div>
        <div style={{ fontSize: 11, color: C.tx3, marginBottom: 16 }}>
          Mode normal · warmup + 2 blocs de 5×400m + cooldown
        </div>
        <div style={{
          background: C.s1, border: `1px solid ${C.brd}`,
          borderRadius: 12, padding: "16px 16px 12px",
        }}>
          <SessionPreview intervals={DEMO_SESSION} />
        </div>
      </div>

      {/* Séance 1 — compact */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 4 }}>
          2×5×400m@VMA — compact
        </div>
        <div style={{ fontSize: 11, color: C.tx3, marginBottom: 16 }}>
          Mode compact · hauteur réduite, sans zone bar
        </div>
        <div style={{
          background: C.s1, border: `1px solid ${C.brd}`,
          borderRadius: 12, padding: "12px 16px",
        }}>
          <SessionPreview intervals={DEMO_SESSION} compact />
        </div>
      </div>

      {/* Séance 2 — tempo */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 4 }}>
          Tempo 40 min — allure seuil
        </div>
        <div style={{ fontSize: 11, color: C.tx3, marginBottom: 16 }}>
          Mode normal · target pace (min/km)
        </div>
        <div style={{
          background: C.s1, border: `1px solid ${C.brd}`,
          borderRadius: 12, padding: "16px 16px 12px",
        }}>
          <SessionPreview intervals={DEMO_TEMPO} />
        </div>
      </div>
    </div>
  );
}
