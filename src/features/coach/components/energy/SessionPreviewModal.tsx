import { X, Zap } from "lucide-react";
import { C } from "@/lib/theme";
import SessionPreview from "./SessionPreview";
import { SchemaViewerWithZoom } from "./SchemaViewer";
import type { EnergySessionRow, EnergyStep, EnergyGroup } from "@/types/energy";
import { formatTarget, formatS } from "@/lib/energy/formatTarget";

// ── Shared constants ──────────────────────────────────────────────────────────

export const KIND_LABEL: Record<string, string> = {
  vo2: "VO₂max", tempo: "Tempo", seuil: "Seuil",
  footing: "Footing", fartlek: "Fartlek", specifique: "Spécifique", autre: "Autre", custom: "Custom",
};
export const KIND_COLOR: Record<string, string> = {
  vo2: "#A855F7", tempo: "#3B8DF0", seuil: "#F59E0B",
  footing: "#10B981", fartlek: "#EF4444", specifique: "#F5A623", autre: "#6B7280", custom: "#6B7280",
};

export const ROLE_COLOR: Record<string, string> = {
  warmup:   "#F59E0B",
  work:     "#EF4444",
  recovery: "#3B8DF0",
  rest:     "#6B7280",
  cooldown: "#10B981",
  open:     "#A855F7",
};
export const ROLE_LABEL_FR: Record<string, string> = {
  warmup:   "Écho",
  work:     "Effort",
  recovery: "Récup",
  rest:     "Repos",
  cooldown: "Retour",
  open:     "Libre",
};

export function buildRootGroup(session: EnergySessionRow): EnergyGroup {
  return { type: "group", id: "__root__", role: "open", repeat: 1, children: session.intervals ?? [] };
}

// ── Equipment labels ─────────────────────────────────────────────────────────

const EQUIPMENT_LABEL: Record<string, string> = {
  rameur: "Rameur", skierg: "SkiErg", bikeerg: "BikeErg", velo: "Vélo",
  course: "Course", elliptique: "Elliptique", corde: "Corde", autre: "Autre",
};

// ── StepTree ──────────────────────────────────────────────────────────────────

export function StepTree({ steps, depth = 0 }: { steps: EnergyStep[]; depth?: number }) {
  return (
    <>
      {steps.map((step, i) => {
        if (step.type === "interval") {
          const rc = ROLE_COLOR[step.role] ?? "#6B7280";
          const dur = step.duration.kind === "time"
            ? formatS(step.duration.value ?? 0)
            : step.duration.kind === "distance"
            ? `${step.duration.value ?? 0} m`
            : step.duration.kind === "calories"
            ? `${step.duration.value ?? 0} kcal`
            : "Lap";
          const tgt = formatTarget(step.target);
          return (
            <div
              key={step.id ?? i}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "5px 8px",
                marginLeft: depth * 14,
                borderRadius: 6,
                background: depth > 0 ? "rgba(255,255,255,0.02)" : "transparent",
              }}
            >
              <div style={{ width: 3, height: 20, borderRadius: 2, background: rc, flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: rc, minWidth: 36 }}>
                {ROLE_LABEL_FR[step.role] ?? step.role}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.tx, minWidth: 40 }}>{dur}</span>
              {tgt && tgt !== "Libre" && (
                <span style={{ fontSize: 10, color: C.tx3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {tgt}
                </span>
              )}
              {step.equipment && step.equipment !== "none" && (
                <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(255,255,255,0.08)", color: C.tx2, flexShrink: 0 }}>
                  {EQUIPMENT_LABEL[step.equipment] ?? step.equipment}
                </span>
              )}
              {step.notes && (
                <span style={{ fontSize: 9, color: C.tx3, fontStyle: "italic", marginLeft: "auto", flexShrink: 0 }}>
                  {step.notes}
                </span>
              )}
            </div>
          );
        }
        // Exercise
        if (step.type === "exercise") {
          const exoColor = "#7B6FFF";
          const detail = [
            step.reps_min ? (step.reps_max && step.reps_max !== step.reps_min ? `${step.reps_min}-${step.reps_max} reps` : `${step.reps_min} reps`) : null,
            step.weight_kg ? `${step.weight_kg} ${step.weight_unit === "bw" ? "BW" : step.weight_unit === "pct_rm" ? "%RM" : "kg"}` : null,
          ].filter(Boolean).join(" · ");
          return (
            <div
              key={step.id ?? i}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "5px 8px",
                marginLeft: depth * 14,
                borderRadius: 6,
                background: depth > 0 ? "rgba(255,255,255,0.02)" : "transparent",
              }}
            >
              <div style={{ width: 3, height: 20, borderRadius: 2, background: exoColor, flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: exoColor, minWidth: 36 }}>Exo</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.tx }}>{step.exercise_name}</span>
              {detail && <span style={{ fontSize: 10, color: C.tx3 }}>{detail}</span>}
              {step.notes && (
                <span style={{ fontSize: 9, color: C.tx3, fontStyle: "italic", marginLeft: "auto", flexShrink: 0 }}>
                  {step.notes}
                </span>
              )}
            </div>
          );
        }
        // Group
        return (
          <div key={step.id ?? i} style={{ marginLeft: depth * 14, marginBottom: 2 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 8px", borderRadius: 6,
              background: "rgba(255,255,255,0.04)",
              borderLeft: "2px solid rgba(255,255,255,0.1)",
              marginBottom: 2,
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.ac }}>
                × {step.repeat}
              </span>
              {step.repeat > 1 && (
                <span style={{ fontSize: 9, color: C.tx3 }}>répétitions</span>
              )}
            </div>
            <StepTree steps={step.children} depth={depth + 1} />
            {step.rest_between && (
              <div style={{ marginLeft: (depth + 1) * 14 }}>
                <StepTree steps={[step.rest_between]} depth={depth + 1} />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ── SessionPreviewModal ───────────────────────────────────────────────────────

interface SessionPreviewModalProps {
  session: EnergySessionRow;
  athleteId?: string;
  /** If provided, shows "Modifier la séance" button */
  onEdit?: () => void;
  /** If provided (athlete context, not completed), shows action button */
  onStart?: () => void;
  /** Label for the onStart button. Default: "Faire la séance aujourd'hui" */
  startLabel?: string;
  /** If provided (athlete context, completed), shows "Annuler la séance" button */
  onCancel?: () => void;
  /** If provided (athlete view), shows "Valider la séance" button */
  onValidate?: () => void;
  /** If provided (athlete view, already completed), shows "Dévalider" button */
  onUnvalidate?: () => void;
  onClose: () => void;
}

export function SessionPreviewModal({ session, athleteId, onEdit, onStart, startLabel, onCancel, onValidate, onUnvalidate, onClose }: SessionPreviewModalProps) {
  const kc = KIND_COLOR[session.session_kind] ?? "#6B7280";
  const rootGroup = buildRootGroup(session);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.65)" }} />
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 61,
          maxHeight: "92vh",
          background: C.s1, borderRadius: "18px 18px 0 0", border: "1px solid " + C.brd,
          borderBottom: "none",
          display: "flex", flexDirection: "column",
          animation: "slideUp 200ms ease-out",
        }}
      >
        <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>

        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.brdL }} />
        </div>

        {/* Header */}
        <div style={{ padding: "10px 18px 12px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: kc + "25", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Zap size={16} color={kc} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {session.name}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: kc + "20", color: kc }}>
                {KIND_LABEL[session.session_kind] ?? session.session_kind}
              </span>
              {session.total_duration_s != null && (
                <span style={{ fontSize: 11, color: C.tx3 }}>{Math.round(session.total_duration_s / 60)} min</span>
              )}
              {session.is_verified && <span style={{ fontSize: 9, color: C.g, fontWeight: 700 }}>✓ vérifiée</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={13} />
          </button>
        </div>

        {/* Scrollable body — single column: chart then steps */}
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          {/* Chart */}
          <div style={{ padding: "0 18px 12px" }}>
            <SessionPreview intervals={rootGroup} athleteId={athleteId} />
          </div>

          {/* Notes */}
          {session.notes && (
            <div style={{ margin: "0 18px 12px", padding: "9px 12px", borderRadius: 9, background: C.s2, border: "1px solid " + C.brd, fontSize: 11, color: C.tx2, lineHeight: 1.6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 3 }}>Notes</span>
              {session.notes}
            </div>
          )}

          {/* Schema */}
          {session.schema && (
            <div style={{ margin: "0 18px 12px", borderRadius: 9, overflow: "hidden", border: "1px solid " + C.brd }}>
              <SchemaViewerWithZoom schema={session.schema} />
            </div>
          )}

          {/* Steps detail */}
          <div style={{ padding: "0 18px 20px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Déroulé de la séance
            </div>
            <StepTree steps={session.intervals ?? []} />
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding: "10px 18px", paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))", borderTop: "1px solid " + C.brd, display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {onUnvalidate && (
            <button onClick={onUnvalidate} style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid " + C.r + "50", background: "transparent", color: C.r, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Dévalider
            </button>
          )}
          {onCancel && (
            <button onClick={onCancel} style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", color: "#EF4444", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Annuler la séance
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit} style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: C.coach, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Modifier
            </button>
          )}
          {onStart && (
            <button onClick={onStart} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: C.ac, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              {startLabel ?? "Faire la séance ▶"}
            </button>
          )}
          {onValidate && (
            <button onClick={onValidate} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: "#22C993", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              Valider la séance ✓
            </button>
          )}
          {!onStart && !onValidate && !onEdit && !onCancel && !onUnvalidate && (
            <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid " + C.brdL, background: "transparent", color: C.tx2, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Fermer
            </button>
          )}
        </div>
      </div>
    </>
  );
}
