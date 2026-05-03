/**
 * EnergySessionCard — card de la banque de séances énergétiques.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "@/lib/theme";
import SessionPreview from "./SessionPreview";
import type { EnergySessionRow, EnergyGroup, SessionKind } from "@/types/energy";
import { useVerifyEnergySession, useDeleteEnergySession, useCreateEnergySession, usePublishEnergySession } from "@/features/shared/hooks/useEnergySessions";
import { formatSLong } from "@/lib/energy/formatTarget";
import { expandIntervals, computeTotals } from "@/lib/energy";
import { makeRootGroup } from "@/lib/energy/treeUtils";

// ── Kind badge colors ─────────────────────────────────────────────────────────

const KIND_COLOR: Record<SessionKind | string, string> = {
  vo2:     "#A855F7",
  tempo:   "#3B8DF0",
  seuil:   "#FB923C",
  footing: "#22C993",
  fartlek: "#E8C93A",
  autre:   "#7C7480",
  custom:  "#F472B6",
};

const KIND_LABEL: Record<SessionKind | string, string> = {
  vo2:     "VO₂max",
  tempo:   "Tempo",
  seuil:   "Seuil",
  footing: "Footing",
  fartlek: "Fartlek",
  autre:   "Autres",
  custom:  "Custom",
};

// ── Dot menu ──────────────────────────────────────────────────────────────────

interface DotMenuItem {
  label: string;
  action: () => void;
  color?: string;
}

function DotMenu({ items }: { items: DotMenuItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{
          background: "none", border: `1px solid ${C.brd}`, borderRadius: 6,
          color: C.tx3, fontSize: 14, cursor: "pointer", padding: "2px 7px",
          lineHeight: 1, fontFamily: "inherit",
        }}
      >
        •••
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 50,
          background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 8,
          minWidth: 160, boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}>
          {items.map(({ label, action, color }) => (
            <button
              key={label}
              onClick={(e) => { e.stopPropagation(); action(); setOpen(false); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "9px 14px", background: "none", border: "none",
                color: color ?? C.tx, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface Props {
  session: EnergySessionRow;
  canEdit: boolean;
  canVerify: boolean;
  canDelete: boolean;
  canPublish?: boolean;
  userId?: string;
}

type ConfirmState = { message: string; onConfirm: () => void } | null;

export default function EnergySessionCard({ session, canEdit, canVerify, canDelete, canPublish, userId }: Props) {
  const navigate = useNavigate();
  const verifyMutation  = useVerifyEnergySession();
  const deleteMutation  = useDeleteEnergySession();
  const createMutation  = useCreateEnergySession();
  const publishMutation = usePublishEnergySession();

  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const isOwn = !!userId && session.created_by === userId;

  function askConfirm(message: string, onConfirm: () => void) {
    setConfirm({ message, onConfirm });
  }

  // Build root group for preview
  const root: EnergyGroup = {
    type: "group",
    id: "__root__",
    role: "open",
    repeat: 1,
    children: session.intervals ?? [],
  };

  const flat   = expandIntervals(root);
  const totals = computeTotals(flat);
  const kindColor = KIND_COLOR[session.session_kind] ?? C.tx3;
  const kindLabel = session.session_kind === "custom" && session.custom_kind
    ? session.custom_kind
    : KIND_LABEL[session.session_kind] ?? session.session_kind;

  function handleClick() {
    if (canEdit) {
      navigate(`/coach/energy-library/${session.id}/edit`);
    }
    // TODO: readonly view when not editor
  }

  async function handleDuplicate() {
    void makeRootGroup(); // unused but kept to avoid tree-shaking side effects
    await createMutation.mutateAsync({
      name: `${session.name} (copie)`,
      session_kind: session.session_kind,
      custom_kind: session.custom_kind,
      structure_type: session.structure_type,
      intervals: session.intervals,
      notes: session.notes,
      created_by: userId ?? null,
    });
  }

  async function handleCopyToPersonal() {
    if (!userId) return;
    await createMutation.mutateAsync({
      name: session.name,
      session_kind: session.session_kind,
      custom_kind: session.custom_kind,
      structure_type: session.structure_type,
      intervals: session.intervals,
      notes: session.notes,
      created_by: userId,
    });
  }

  return (
    <div
      onClick={handleClick}
      style={{
        background: C.s1,
        border: `1px solid ${C.brd}`,
        borderRadius: 12,
        overflow: "hidden",
        cursor: canEdit ? "pointer" : "default",
        transition: "border-color 150ms, box-shadow 150ms",
        display: "flex",
        flexDirection: "column",
      }}
      onMouseEnter={(e) => {
        if (canEdit) {
          (e.currentTarget as HTMLElement).style.borderColor = kindColor + "60";
          (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 1px ${kindColor}20`;
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = C.brd;
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Top bar — kind color accent */}
      <div style={{ height: 3, background: kindColor, opacity: 0.7 }} />

      <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>

        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: C.tx,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              marginBottom: 4,
            }}>
              {session.name || "Sans titre"}
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {/* Kind badge */}
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                background: kindColor + "20", color: kindColor,
              }}>
                {kindLabel}
              </span>
              {/* Public badge */}
              {session.is_public && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                  background: "#3B8DF020", color: "#3B8DF0",
                }}>
                  🌐 Publique
                </span>
              )}
              {/* Verified badge — cliquable pour dé-vérifier (coach certifié seulement) */}
              {session.is_verified && (
                <span
                  onClick={canVerify ? (e) => {
                    e.stopPropagation();
                    askConfirm("Retirer la vérification de cette séance ?", () =>
                      verifyMutation.mutate({ id: session.id, verify: false })
                    );
                  } : undefined}
                  title={canVerify ? "Cliquer pour retirer la vérification" : undefined}
                  style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                    background: C.g + "20", color: C.g,
                    cursor: canVerify ? "pointer" : "default",
                    userSelect: "none",
                  }}
                >
                  ✓ Vérifiée
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            {/* Copier dans ma banque — séance d'un autre coach */}
            {userId && !isOwn && (
              <button
                onClick={handleCopyToPersonal}
                disabled={createMutation.isPending}
                title="Copier dans mes séances"
                style={{
                  padding: "4px 8px", borderRadius: 6,
                  border: `1px solid ${C.ac}50`, background: C.ac + "12",
                  color: C.ac, fontSize: 10, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                {createMutation.isPending ? "…" : "+ Mes séances"}
              </button>
            )}
            {/* Vérifier — coach certifié, séance non vérifiée */}
            {canVerify && !session.is_verified && (
              <button
                onClick={() => verifyMutation.mutate({ id: session.id, verify: true })}
                disabled={verifyMutation.isPending}
                style={{
                  padding: "4px 8px", borderRadius: 6,
                  border: `1px solid ${C.g}50`, background: C.g + "12",
                  color: C.g, fontSize: 10, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Vérifier
              </button>
            )}
            {/* Dot menu — dupliquer, publier/dépublier, supprimer */}
            {(canDelete || canPublish) && (
              <DotMenu
                items={[
                  { label: "Dupliquer", action: handleDuplicate },
                  ...(canPublish ? [{
                    label: session.is_public
                      ? "🔒 Retirer de la banque"
                      : "🌐 Publier dans la banque",
                    action: () => publishMutation.mutate({ id: session.id, publish: !session.is_public }),
                    color: "#3B8DF0",
                  }] : []),
                  ...(canDelete ? [{
                    label: "Supprimer",
                    action: () => deleteMutation.mutate(session.id),
                    color: C.r,
                  }] : []),
                ]}
              />
            )}
          </div>
        </div>

        {/* Mini preview */}
        {root.children.length > 0 ? (
          <div style={{ pointerEvents: "none" }}>
            <SessionPreview intervals={root} compact />
          </div>
        ) : (
          <div style={{ height: 40, background: C.s2, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 10, color: C.tx3 }}>Aucun intervalle</span>
          </div>
        )}

        {/* Metadata footer */}
        <div style={{ display: "flex", gap: 12, fontSize: 10, color: C.tx3, marginTop: 2 }}>
          {totals.durationS > 0 && (
            <span>⏱ {formatSLong(totals.durationS)}</span>
          )}
          {totals.workCount > 0 && (
            <span>⚡ {totals.workCount} eff.</span>
          )}
          {totals.distanceM > 0 && (
            <span>📏 {(totals.distanceM / 1000).toFixed(1)} km</span>
          )}
        </div>

        {/* Confirmation inline */}
        {confirm && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              marginTop: 4,
              padding: "10px 12px",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${C.brd}`,
              borderRadius: 8,
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <span style={{ flex: 1, fontSize: 11, color: C.tx2 }}>{confirm.message}</span>
            <button
              onClick={() => { confirm.onConfirm(); setConfirm(null); }}
              style={{
                padding: "4px 10px", borderRadius: 6, border: "none",
                background: C.r, color: "#fff", fontSize: 11,
                fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Confirmer
            </button>
            <button
              onClick={() => setConfirm(null)}
              style={{
                padding: "4px 10px", borderRadius: 6,
                border: `1px solid ${C.brd}`, background: "none",
                color: C.tx3, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
