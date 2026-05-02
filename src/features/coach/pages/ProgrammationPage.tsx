import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Zap, Plus, Library, X, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import { CoachExoParams } from "@/components/coach/CoachProgramEditor";
import { NewBlockModal } from "@/components/coach/CoachComponents";
import { useEnergySessions, useCreateEnergySession } from "@/features/shared/hooks/useEnergySessions";
import SessionPreview from "@/features/coach/components/energy/SessionPreview";
import type { EnergySessionRow, EnergyStep, EnergyGroup } from "@/types/energy";
import { formatTarget, formatS } from "@/lib/energy/formatTarget";
import BlockHistoryViewer from "@/features/coach/components/BlockHistoryViewer";
import { TierConfigModal } from "@/components/coach/CoachComponents";
import { useCreateCycleFromBloc } from "@/features/shared/hooks/useCreateCycleFromBloc";
import { SessionWeekDrawer } from "@/features/coach/components/SessionWeekDrawer";

const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const KIND_LABEL: Record<string, string> = {
  vo2: "VO₂max", tempo: "Tempo", seuil: "Seuil",
  footing: "Footing", fartlek: "Fartlek", autre: "Autre", custom: "Custom",
};
const KIND_COLOR: Record<string, string> = {
  vo2: "#A855F7", tempo: "#3B8DF0", seuil: "#F59E0B",
  footing: "#10B981", fartlek: "#EF4444", autre: "#6B7280", custom: "#6B7280",
};

// ── SessionPreviewModal ────────────────────────────────────────────────────────

function buildRootGroup(session: EnergySessionRow): EnergyGroup {
  return { type: "group", id: "__root__", role: "open", repeat: 1, children: session.intervals ?? [] };
}

const ROLE_COLOR: Record<string, string> = {
  warmup:   "#F59E0B",
  work:     "#EF4444",
  recovery: "#3B8DF0",
  rest:     "#6B7280",
  cooldown: "#10B981",
  open:     "#A855F7",
};
const ROLE_LABEL_FR: Record<string, string> = {
  warmup:   "Écho",
  work:     "Effort",
  recovery: "Récup",
  rest:     "Repos",
  cooldown: "Retour",
  open:     "Libre",
};

/** Rendu récursif des steps (intervalles + groupes). */
function StepTree({ steps, depth = 0 }: { steps: EnergyStep[]; depth?: number }) {
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

function SessionPreviewModal({
  session, athleteId, onEdit, onClose,
}: {
  session: EnergySessionRow;
  athleteId?: string;
  onEdit: () => void;
  onClose: () => void;
}) {
  const kc = KIND_COLOR[session.session_kind] ?? "#6B7280";
  const rootGroup = buildRootGroup(session);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.65)" }} />
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", zIndex: 61,
          transform: "translate(-50%, -50%)",
          width: 780, maxWidth: "96vw", maxHeight: "88vh",
          background: C.s1, borderRadius: 16, border: "1px solid " + C.brd,
          display: "flex", flexDirection: "column",
          animation: "fadeScaleIn 150ms ease-out",
        }}
      >
        <style>{`@keyframes fadeScaleIn { from { opacity:0; transform:translate(-50%,-50%) scale(0.96) } to { opacity:1; transform:translate(-50%,-50%) scale(1) } }`}</style>

        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid " + C.brd, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
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

        {/* Body — 2 colonnes */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

          {/* Gauche : graphe SessionPreview */}
          <div style={{ flex: "0 0 55%", padding: "16px 18px", borderRight: "1px solid " + C.brd, overflowY: "auto", scrollbarWidth: "none" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              Aperçu
            </div>
            <SessionPreview intervals={rootGroup} athleteId={athleteId} />
            {session.notes && (
              <div style={{ marginTop: 14, padding: "9px 12px", borderRadius: 9, background: C.s2, border: "1px solid " + C.brd, fontSize: 11, color: C.tx2, lineHeight: 1.6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 3 }}>Notes</span>
                {session.notes}
              </div>
            )}
          </div>

          {/* Droite : déroulé */}
          <div style={{ flex: 1, padding: "16px 16px", overflowY: "auto", scrollbarWidth: "none" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              Déroulé
            </div>
            <StepTree steps={session.intervals ?? []} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 18px", borderTop: "1px solid " + C.brd, display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid " + C.brdL, background: "transparent", color: C.tx2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Fermer
          </button>
          <button onClick={onEdit} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: C.coach, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Modifier la séance
          </button>
        </div>
      </div>
    </>
  );
}

// ── BankPickerModal ────────────────────────────────────────────────────────────
// Modale pour piocher une séance de la banque générale et la copier dans sa banque perso.

function BankPickerModal({ coachId, onClose }: { coachId: string; onClose: () => void }) {
  const { data: allSessions = [], isLoading } = useEnergySessions();
  const createMutation = useCreateEnergySession();
  const [search, setSearch] = useState("");
  const [copying, setCopying] = useState<string | null>(null);

  // Exclure les séances déjà créées par ce coach
  const generalSessions = allSessions.filter((s) => s.created_by !== coachId);

  const filtered = generalSessions.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCopy(s: (typeof allSessions)[0]) {
    if (copying) return;
    setCopying(s.id);
    try {
      await createMutation.mutateAsync({
        name:           s.name + " (copie)",
        session_kind:   s.session_kind,
        custom_kind:    s.custom_kind ?? null,
        structure_type: s.structure_type,
        intervals:      s.intervals,
        notes:          s.notes ?? null,
        created_by:     coachId,
      });
      toast.success(`"${s.name}" ajoutée à ta banque`);
      onClose();
    } catch {
      toast.error("Erreur lors de la copie");
    } finally {
      setCopying(null);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)" }} />
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", zIndex: 61,
          transform: "translate(-50%, -50%)",
          width: 520, maxWidth: "94vw", maxHeight: "80vh",
          background: C.s1, borderRadius: 16, border: "1px solid " + C.brd,
          display: "flex", flexDirection: "column",
          animation: "fadeScaleIn 150ms ease-out",
        }}
      >
        <style>{`@keyframes fadeScaleIn { from { opacity:0; transform:translate(-50%,-50%) scale(0.96) } to { opacity:1; transform:translate(-50%,-50%) scale(1) } }`}</style>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid " + C.brd, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <Library size={16} color={C.coach} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.tx }}>Banque générale</div>
            <div style={{ fontSize: 11, color: C.tx3 }}>Clique sur une séance pour la copier dans ta banque</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "10px 20px", borderBottom: "1px solid " + C.brd, flexShrink: 0 }}>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une séance…"
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 8,
              border: "1px solid " + C.brdL, background: C.s2,
              color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* List */}
        <div style={{ overflowY: "auto", padding: "12px 20px", flex: 1, scrollbarWidth: "none" }}>
          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1, 2, 3].map((i) => <div key={i} style={{ height: 58, borderRadius: 10, background: C.s2 }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: C.tx3, fontSize: 13 }}>
              {search ? "Aucun résultat" : "Banque générale vide"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filtered.map((s) => {
                const kc = KIND_COLOR[s.session_kind] ?? "#6B7280";
                const isCopying = copying === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => handleCopy(s)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 10,
                      border: "1px solid " + C.brdL, background: C.s2,
                      cursor: copying ? "not-allowed" : "pointer",
                      opacity: copying && !isCopying ? 0.5 : 1,
                      transition: "border-color 120ms",
                    }}
                    onMouseEnter={(e) => { if (!copying) e.currentTarget.style.borderColor = kc + "60"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.brdL; }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: kc + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {isCopying ? <Check size={13} color={kc} /> : <Zap size={13} color={kc} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 1 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: kc + "20", color: kc }}>
                          {KIND_LABEL[s.session_kind] ?? s.session_kind}
                        </span>
                        {s.total_duration_s != null && (
                          <span style={{ fontSize: 10, color: C.tx3 }}>{Math.round(s.total_duration_s / 60)} min</span>
                        )}
                        {s.is_verified && (
                          <span style={{ fontSize: 9, color: C.g, fontWeight: 700 }}>✓ vérifiée</span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: C.tx3, flexShrink: 0 }}>
                      {isCopying ? "Copie…" : "+ Ma banque"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── EnergyPanel ────────────────────────────────────────────────────────────────
// Banque de séances énergétiques personnelle du coach.
// Pas d'assignation ici — les assignations se font depuis Planning > Mois.

interface EnergyPanelProps {
  coachId: string;
  athleteId?: string;
  onNew: () => void;
  onEdit: (sessionId: string) => void;
}

function EnergyPanel({ coachId, athleteId, onNew, onEdit }: EnergyPanelProps) {
  const { data: sessions = [], isLoading } = useEnergySessions({ created_by: coachId });
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [previewSession, setPreviewSession] = useState<EnergySessionRow | null>(null);

  const filtered = sessions.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.tx }}>
          Ma banque énergétique
          {sessions.length > 0 && (
            <span style={{ fontSize: 11, color: C.tx3, fontWeight: 400, marginLeft: 8 }}>
              {sessions.length} séance{sessions.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowPicker(true)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "7px 12px", borderRadius: 9,
              border: "1px solid " + C.brdL, background: "transparent", color: C.tx2,
              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <Library size={13} />
            Choisir une séance existante
          </button>
          <button
            onClick={onNew}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "7px 14px", borderRadius: 9,
              border: "none", background: C.coach, color: "#fff",
              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <Plus size={13} />
            Créer une séance
          </button>
        </div>
      </div>

      {showPicker && <BankPickerModal coachId={coachId} onClose={() => setShowPicker(false)} />}

      {previewSession && (
        <SessionPreviewModal
          session={previewSession}
          athleteId={athleteId}
          onEdit={() => { setPreviewSession(null); onEdit(previewSession.id); }}
          onClose={() => setPreviewSession(null)}
        />
      )}

      {/* Info banner */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "10px 14px", borderRadius: 10, marginBottom: 16,
        background: C.ac + "10", border: "1px solid " + C.ac + "30",
        fontSize: 11, color: C.tx2, lineHeight: 1.5,
      }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>📅</span>
        <span>
          Pour planifier une séance sur un athlète, glisse-la depuis{" "}
          <strong style={{ color: C.ac }}>Planning → Mois → Banque Énergie</strong> vers le jour voulu.
        </span>
      </div>

      {/* Search */}
      {sessions.length > 4 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…"
          style={{
            width: "100%", padding: "8px 10px", borderRadius: 8,
            border: "1px solid " + C.brdL, background: C.s2,
            color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none",
            boxSizing: "border-box", marginBottom: 12,
          }}
        />
      )}

      {/* ── Session list ── */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: 64, borderRadius: 12, background: C.s1 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <Zap size={36} style={{ color: C.tx3, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 4 }}>
            {search ? "Aucun résultat" : "Banque vide"}
          </div>
          <div style={{ fontSize: 12, color: C.tx3, marginBottom: 16 }}>
            {search
              ? "Modifie ta recherche."
              : "Crée ta première séance énergétique ou copie-en une depuis la banque générale."}
          </div>
          {!search && (
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                onClick={() => setShowPicker(true)}
                style={{
                  padding: "10px 16px", borderRadius: 10,
                  border: "1px solid " + C.brdL, background: "transparent", color: C.tx2,
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <Library size={14} /> Choisir une séance existante
              </button>
              <button
                onClick={onNew}
                style={{
                  padding: "10px 20px", borderRadius: 10, border: "none",
                  background: C.coach, color: "#fff",
                  fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Créer une séance
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((s) => {
            const kc = KIND_COLOR[s.session_kind] ?? "#6B7280";
            return (
              <div
                key={s.id}
                onClick={() => setPreviewSession(s)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 12,
                  border: "1px solid " + C.brdL, background: C.s1,
                  cursor: "pointer", transition: "border-color 120ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = kc + "50")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.brdL)}
              >
                {/* Icon */}
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: kc + "20", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Zap size={16} color={kc} />
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: kc + "20", color: kc }}>
                      {KIND_LABEL[s.session_kind] ?? s.session_kind}
                    </span>
                    {s.total_duration_s != null && (
                      <span style={{ fontSize: 10, color: C.tx3 }}>
                        {Math.round(s.total_duration_s / 60)} min
                      </span>
                    )}
                    {s.is_verified && (
                      <span style={{ fontSize: 9, color: C.g, fontWeight: 700 }}>✓ vérifiée</span>
                    )}
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: C.tx3, flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProgrammationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    athleteId, loaded, viewOnly,
    exos, setExos, sessions, setSessions, blockConfig, setBlockConfig,
    completedSessions, currentWeek, tw, dw, allMethods,
    customMethods, setCustomMethods, exMeta, setExMeta, sets,
    athleteNotes, weekSchedule, setWeekSchedule,
    showNewBlock, setShowNewBlock, showBlockHistory, setShowBlockHistory,
    showTierModal, setShowTierModal, blockHistory, setBlockHistory,
    archiveAndNewBlock, updateSessionDay,
  } = useAthleteContext();

  const [subTab, setSubTab] = useState("muscu");
  const [showExoParams, setShowExoParams] = useState(false);
  const [openDrawer, setOpenDrawer] = useState<{ sessId: string; sessName: string } | null>(null);
  const [dayPicker, setDayPicker] = useState<{ sessId: string; sessName: string; currentDay: number } | null>(null);
  const autoCreateAttempted = useRef(false);
  const qc = useQueryClient();

  // Cherche le cycle standalone le plus récent (pas forcément actif aujourd'hui)
  const { data: activeCycle, isLoading: cycleLoading } = useQuery({
    queryKey: ["active-cycle", athleteId],
    enabled: !!athleteId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("cycles")
        .select("id, name, start_date, end_date")
        .eq("athlete_id", athleteId)
        .is("mesocycle_id", null)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });

  const createCycle = useCreateCycleFromBloc();

  // Auto-transformation bloc → cycle au premier chargement
  useEffect(() => {
    if (autoCreateAttempted.current) return;
    if (cycleLoading || activeCycle || !loaded) return;
    if (!user || !blockConfig?.startDate || sessions.length === 0) return;
    if (createCycle.isPending) return;
    autoCreateAttempted.current = true;
    createCycle.mutate({ blockConfig, sessions, athleteId, coachId: user.id });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleLoading, activeCycle, loaded]);

  const formatDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

  const sortedSessions = [...sessions].sort((a, b) => (a.day_of_week ?? 7) - (b.day_of_week ?? 7));

  async function rescheduleWorkoutLogs(sessId: string, newDay: number) {
    const today = new Date().toISOString().split("T")[0];
    const { data: logs } = await supabase
      .from("workout_logs")
      .select("id, microcycle_id, microcycles(start_date)")
      .eq("session_id", sessId)
      .gte("scheduled_date", today);

    if (!logs?.length) return;

    const updates = (logs as Array<{ id: string; microcycles: { start_date: string } | null }>)
      .filter(l => l.microcycles?.start_date)
      .map(l => {
        const monday = new Date(l.microcycles!.start_date + "T12:00:00");
        monday.setDate(monday.getDate() + newDay);
        return { id: l.id, scheduled_date: monday.toISOString().split("T")[0] };
      });

    await Promise.all(updates.map(u =>
      supabase.from("workout_logs").update({ scheduled_date: u.scheduled_date }).eq("id", u.id)
    ));

    qc.invalidateQueries({ queryKey: ["cal-range"] });
    qc.invalidateQueries({ queryKey: ["timeline-data"] });
    qc.invalidateQueries({ queryKey: ["micro-days"] });
    toast.success("Jour modifié — calendrier mis à jour");
  }

  if (!loaded) {
    return (
      <div style={{ padding: "16px 24px" }}>
        <Skeleton style={{ height: 80, borderRadius: 14, background: C.s1, marginBottom: 12 }} />
        <Skeleton style={{ height: 300, borderRadius: 14, background: C.s1 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 24px 60px" }}>

      {/* ── Bannière cycle ── */}
      <div style={{
        background: C.s1, borderRadius: 14, padding: "12px 16px",
        border: "1px solid " + C.b + "30", marginBottom: 16,
      }}>
        {(cycleLoading || createCycle.isPending) ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 16, height: 16, borderRadius: "50%",
              border: "2px solid " + C.coach, borderTopColor: "transparent",
              animation: "spin 0.7s linear infinite",
            }} />
            <span style={{ fontSize: 12, color: C.tx3 }}>Création du cycle…</span>
          </div>
        ) : activeCycle ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: C.b,
                textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 4,
              }}>Cycle en cours</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.tx }}>{activeCycle.name}</div>
              <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>
                {formatDate(activeCycle.start_date)} → {formatDate(activeCycle.end_date)} · S{currentWeek}/{tw}
              </div>
            </div>
            {dw > 0 && (
              <span style={{
                padding: "4px 8px", borderRadius: 6,
                background: C.bS, color: C.b, fontSize: 10, fontWeight: 700,
              }}>Deload S{dw}</span>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>
                {blockConfig?.blockName || "Cycle sans nom"}
              </div>
              {blockConfig?.startDate
                ? <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>
                    Début {formatDate(blockConfig.startDate)} · {tw} semaines
                  </div>
                : <div style={{ fontSize: 11, color: C.o, marginTop: 2 }}>Date de début manquante</div>
              }
            </div>
            {!viewOnly && (
              <button
                onClick={() => {
                  if (user && blockConfig && sessions.length > 0) {
                    createCycle.mutate({ blockConfig, sessions, athleteId, coachId: user.id });
                  }
                }}
                disabled={!blockConfig?.startDate || sessions.length === 0}
                style={{
                  padding: "8px 14px", borderRadius: 10,
                  border: "1px solid " + C.coach + "40",
                  background: C.coachS, color: C.coach,
                  fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  flexShrink: 0,
                  opacity: (!blockConfig?.startDate || sessions.length === 0) ? 0.5 : 1,
                }}
              >Créer le cycle</button>
            )}
          </div>
        )}
      </div>

      {/* ── Sub-tabs ── */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid " + C.brd, marginBottom: 16 }}>
        {[
          { k: "muscu",      l: "Musculation" },
          { k: "energie",    l: "Énergétique" },
          { k: "specifique", l: "Spécifique"  },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setSubTab(t.k)}
            style={{
              padding: "9px 18px", border: "none",
              borderBottom: "2px solid " + (subTab === t.k ? C.coach : "transparent"),
              background: "transparent",
              color: subTab === t.k ? C.coach : C.tx3,
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit", textTransform: "uppercase" as const,
              letterSpacing: "0.3px", flexShrink: 0,
              transition: "color 150ms, border-color 150ms",
            }}
          >
            {t.l}
          </button>
        ))}
      </div>

      {/* ── Musculation ── */}
      {subTab === "muscu" && (
        sortedSessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 4 }}>Aucun cycle actif</div>
            <div style={{ fontSize: 12, color: C.tx3, marginBottom: 16 }}>Crée un nouveau cycle pour commencer.</div>
            {!viewOnly && (
              <button
                onClick={() => setShowNewBlock(true)}
                style={{
                  padding: "12px 24px", borderRadius: 12, border: "none",
                  background: C.coach, color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >Créer un cycle</button>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 }}>
              {sortedSessions.map(sess => {
                const exoCount = ((exos as Record<string, unknown[]>)[sess.id] || []).length;
                return (
                  <button
                    key={sess.id}
                    onClick={() => setOpenDrawer({ sessId: sess.id, sessName: sess.name || sess.short || "Séance" })}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      setDayPicker({ sessId: sess.id, sessName: sess.name || sess.short || "Séance", currentDay: sess.day_of_week ?? 0 });
                    }}
                    style={{
                      padding: "12px 14px", borderRadius: 12,
                      border: "1px solid " + C.brdL, background: C.s1,
                      cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const,
                      display: "flex", flexDirection: "column" as const, gap: 6,
                      position: "relative" as const,
                    }}
                  >
                    {sess.day_of_week != null ? (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: C.coach,
                        background: C.coachS, padding: "2px 7px", borderRadius: 5,
                        alignSelf: "flex-start",
                      }}>{DOW[sess.day_of_week]}</span>
                    ) : (
                      <span
                        title="Double-clic pour assigner un jour"
                        style={{
                          fontSize: 10, fontWeight: 700, color: C.o,
                          background: C.oS, padding: "2px 7px", borderRadius: 5,
                          alignSelf: "flex-start",
                        }}
                      >⚠ Jour non défini</span>
                    )}
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, paddingRight: 20 }}>
                      {sess.name || sess.short || "Séance"}
                    </div>
                    <div style={{ fontSize: 10, color: C.tx3 }}>
                      {exoCount} exercice{exoCount !== 1 ? "s" : ""}
                    </div>
                    <ChevronRight
                      size={14}
                      style={{
                        position: "absolute", right: 12,
                        top: "50%", transform: "translateY(-50%)", color: C.tx3,
                      }}
                    />
                  </button>
                );
              })}
            </div>

            <div style={{ paddingTop: 14, borderTop: "1px solid " + C.brd }}>
              <button
                onClick={() => setShowExoParams((p) => !p)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 10,
                  border: "1px solid " + C.brdL,
                  background: showExoParams ? C.acS : "transparent",
                  color: showExoParams ? C.ac : C.tx2,
                  fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  marginBottom: showExoParams ? 12 : 0,
                }}
              >
                ⚙ Paramètres exercices{showExoParams ? " ∧" : " ∨"}
              </button>
              {showExoParams && (
                <CoachExoParams
                  exMeta={exMeta} setExMeta={setExMeta}
                  exos={exos} setExos={setExos}
                  blockConfig={blockConfig}
                />
              )}
            </div>
          </>
        )
      )}

      {/* ── Énergétique ── */}
      {subTab === "energie" && (
        <EnergyPanel
          coachId={user?.id ?? ""}
          athleteId={athleteId ?? undefined}
          onNew={() => navigate("/coach/library?tab=energetique")}
          onEdit={(sessionId: string) => navigate(`/coach/energy-library/${sessionId}/edit`)}
        />
      )}

      {/* ── Spécifique ── */}
      {subTab === "specifique" && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎯</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>Séances Spécifiques</div>
          <div style={{ fontSize: 12, color: C.tx3, marginTop: 4 }}>Disponible prochainement.</div>
        </div>
      )}

      {/* ── Modals ── */}
      {showNewBlock && (
        <NewBlockModal
          onStart={archiveAndNewBlock}
          onClose={() => setShowNewBlock(false)}
          onResume={() => setShowNewBlock(false)}
          hasCurrentData={sessions.length > 0 && Object.values(exos).flat().length > 0}
          blockHistory={blockHistory}
          onDelete={(idx) => setBlockHistory(blockHistory.filter((_, i) => i !== idx))}
        />
      )}
      {showBlockHistory && (
        <BlockHistoryViewer
          blockHistory={blockHistory}
          onClose={() => setShowBlockHistory(false)}
          onDelete={(idx) => setBlockHistory(blockHistory.filter((_, i) => i !== idx))}
        />
      )}
      {showTierModal && (
        <TierConfigModal
          blockConfig={blockConfig}
          setBlockConfig={setBlockConfig}
          onClose={() => setShowTierModal(false)}
        />
      )}

      {/* ── Drawer séance ── */}
      {openDrawer && (
        <SessionWeekDrawer
          sessId={openDrawer.sessId}
          sessName={openDrawer.sessName}
          currentWeek={currentWeek}
          tw={tw}
          dw={dw}
          blockConfig={blockConfig}
          exos={exos as Record<string, unknown[]>}
          setExos={setExos}
          sessions={sessions}
          setSessions={setSessions}
          sets={sets as Record<string, unknown[]>}
          completedSessions={completedSessions}
          athleteNotes={athleteNotes as Record<string, string>}
          allMethods={allMethods as Record<string, unknown>}
          customMethods={customMethods as unknown[]}
          setCustomMethods={setCustomMethods}
          exMeta={exMeta as Record<string, unknown>}
          setExMeta={setExMeta}
          weekSchedule={weekSchedule as Record<string, unknown>}
          setWeekSchedule={setWeekSchedule}
          onDayChange={async (newDay) => {
            updateSessionDay(openDrawer.sessId, newDay);
            await rescheduleWorkoutLogs(openDrawer.sessId, newDay);
          }}
          onClose={() => setOpenDrawer(null)}
        />
      )}

      {/* ── Modal choix de jour (double-clic) ── */}
      {dayPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "flex-end" }}>
          <div
            onClick={() => setDayPicker(null)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }}
          />
          <div style={{
            position: "relative", width: "100%",
            background: C.bg, borderRadius: "20px 20px 0 0",
            padding: "20px 16px 36px",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.4)",
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.tx, marginBottom: 4 }}>
              {dayPicker.sessName}
            </div>
            <div style={{ fontSize: 11, color: C.tx3, marginBottom: 16 }}>
              Choisir le jour — reprogramme toutes les séances à partir d'aujourd'hui
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {DOW.map((label, idx) => (
                <button
                  key={idx}
                  onClick={async () => {
                    const prev = dayPicker;
                    setDayPicker(null);
                    updateSessionDay(prev.sessId, idx);
                    await rescheduleWorkoutLogs(prev.sessId, idx);
                  }}
                  style={{
                    padding: "10px 4px", borderRadius: 10,
                    border: "1px solid " + (dayPicker.currentDay === idx ? C.coach : C.brdL),
                    background: dayPicker.currentDay === idx ? C.coachS : "transparent",
                    color: dayPicker.currentDay === idx ? C.coach : C.tx2,
                    fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
