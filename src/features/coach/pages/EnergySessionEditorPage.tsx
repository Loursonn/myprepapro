/**
 * EnergySessionEditorPage
 *
 * Routes :
 *   /coach/athletes/:athleteId/energy/new
 *   /coach/athletes/:athleteId/energy/:sessionId/edit
 *   /coach/energy-library/new
 *   /coach/energy-library/:sessionId/edit
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { C } from "@/lib/theme";
import { makeRootGroup } from "@/lib/energy/treeUtils";
import { expandIntervals, computeTotals } from "@/lib/energy";
import { formatSLong } from "@/lib/energy/formatTarget";
import type { EnergyGroup, SessionKind, StructureType } from "@/types/energy";
import IntervalBuilder from "../components/energy/IntervalBuilder";
import SessionPreview from "../components/energy/SessionPreview";
import {
  useEnergySession,
  useCreateEnergySession,
  useUpdateEnergySession,
} from "@/features/shared/hooks/useEnergySessions";
import { useAssignEnergySession } from "@/features/shared/hooks/useEnergyAssignments";

// ── Constants ─────────────────────────────────────────────────────────────────

const SESSION_KINDS: { value: SessionKind; label: string }[] = [
  { value: "vo2",     label: "VO₂max / VMA" },
  { value: "tempo",   label: "Tempo" },
  { value: "seuil",   label: "Seuil lactique" },
  { value: "footing", label: "Footing / Endurance" },
  { value: "fartlek", label: "Fartlek" },
  { value: "autre",   label: "Autres" },
  { value: "custom",  label: "Type personnalisé…" },
];

// ── Assign modal (simple) ─────────────────────────────────────────────────────

function AssignModal({
  sessionId, athleteId, onClose,
}: { sessionId: string; athleteId: string; onClose: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const assign = useAssignEnergySession();

  async function handleAssign() {
    await assign.mutateAsync({ energy_session_id: sessionId, athlete_id: athleteId, scheduled_date: date, status: "planned" });
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ background: C.s1, borderRadius: 12, padding: 24, width: 320, border: `1px solid ${C.brd}` }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.tx, marginBottom: 16 }}>Planifier la séance</div>
        <div style={{ fontSize: 11, color: C.tx3, marginBottom: 6 }}>Date</div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{
            width: "100%", background: C.s2, border: `1px solid ${C.brd}`,
            borderRadius: 6, color: C.tx, fontSize: 13, padding: "6px 10px", fontFamily: "inherit",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.brd}`, background: "transparent", color: C.tx2, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
          >
            Annuler
          </button>
          <button
            onClick={handleAssign}
            disabled={assign.isPending}
            style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: C.g, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            {assign.isPending ? "…" : "Planifier"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EnergySessionEditorPage() {
  const { athleteId, sessionId } = useParams<{ athleteId?: string; sessionId?: string }>();
  const navigate = useNavigate();
  const isEdit = !!sessionId;

  // Load existing session when editing
  const { data: existingSession, isLoading } = useEnergySession(sessionId);

  const createMutation = useCreateEnergySession();
  const updateMutation = useUpdateEnergySession();

  // Form state
  const [name, setName] = useState("");
  const [sessionKind, setSessionKind] = useState<SessionKind>("vo2");
  const [customKind, setCustomKind] = useState("");
  const [structureType, setStructureType] = useState<StructureType>("fractionne");
  const [root, setRoot] = useState<EnergyGroup>(makeRootGroup);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);

  // Hydrate from existing session
  useEffect(() => {
    if (existingSession) {
      setName(existingSession.name);
      setSessionKind(existingSession.session_kind);
      setCustomKind(existingSession.custom_kind ?? "");
      setStructureType(existingSession.structure_type);
      // Wrap intervals in a root group
      const rootG: EnergyGroup = {
        type: "group",
        id: "__root__",
        role: "open",
        repeat: 1,
        children: existingSession.intervals ?? [],
      };
      setRoot(rootG);
    }
  }, [existingSession]);

  // Computed preview totals
  const flat = expandIntervals(root);
  const totals = computeTotals(flat);

  async function handleSave(andPlan = false) {
    const effectiveKind = sessionKind === "custom" ? "custom" : sessionKind;
    const payload = {
      name: name.trim() || "Séance sans titre",
      session_kind: effectiveKind,
      custom_kind: sessionKind === "custom" ? customKind : null,
      structure_type: structureType,
      intervals: root.children,
    };

    if (isEdit && sessionId) {
      await updateMutation.mutateAsync({ id: sessionId, ...payload });
      if (andPlan && athleteId) {
        setSavedSessionId(sessionId);
        setShowAssignModal(true);
      } else {
        navigateBack();
      }
    } else {
      const created = await createMutation.mutateAsync(payload as Parameters<typeof createMutation.mutateAsync>[0]);
      if (andPlan && athleteId && created?.id) {
        setSavedSessionId(created.id);
        setShowAssignModal(true);
      } else {
        navigateBack();
      }
    }
  }

  function navigateBack() {
    if (athleteId) {
      navigate(`/coach/athletes/${athleteId}/programmation`);
    } else {
      navigate("/coach/energy-library");
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading && isEdit) {
    return (
      <div style={{ padding: 32, color: C.tx3, fontSize: 13 }}>Chargement…</div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      {/* ── Header ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 20,
        background: C.s1, borderBottom: `1px solid ${C.brd}`,
        padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <button
          onClick={navigateBack}
          style={{ background: "none", border: "none", color: C.tx3, fontSize: 18, cursor: "pointer", lineHeight: 1 }}
        >
          ←
        </button>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom de la séance…"
          style={{
            flex: 1, minWidth: 180,
            background: "transparent", border: "none",
            borderBottom: `1px solid ${C.brdL}`,
            color: C.tx, fontSize: 18, fontWeight: 700,
            fontFamily: "inherit", outline: "none", padding: "2px 0",
          }}
        />

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Session kind */}
          <Select value={sessionKind} onValueChange={(v) => setSessionKind(v as SessionKind)}>
            <SelectTrigger style={{ width: 170, background: C.s2, border: `1px solid ${C.brd}`, color: C.tx, fontSize: 12 }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SESSION_KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Custom kind input */}
          {sessionKind === "custom" && (
            <input
              value={customKind}
              onChange={(e) => setCustomKind(e.target.value)}
              placeholder="Nom du type…"
              style={{
                width: 140, background: C.s2, border: `1px solid ${C.brd}`,
                borderRadius: 6, color: C.tx, fontSize: 12,
                padding: "6px 10px", fontFamily: "inherit", outline: "none",
              }}
            />
          )}

          {/* Structure type */}
          <ToggleGroup
            type="single"
            value={structureType}
            onValueChange={(v) => { if (v) setStructureType(v as StructureType); }}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="continu" style={{ fontSize: 11 }}>Continu</ToggleGroupItem>
            <ToggleGroupItem value="fractionne" style={{ fontSize: 11 }}>Fractionné</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button
            onClick={navigateBack}
            style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.brd}`, background: "transparent", color: C.tx2, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
          >
            Annuler
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={isSaving}
            style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: C.ac, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: isSaving ? 0.7 : 1 }}
          >
            {isSaving ? "Enregistrement…" : "Enregistrer"}
          </button>
          {athleteId && (
            <button
              onClick={() => handleSave(true)}
              disabled={isSaving}
              style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${C.g}50`, background: C.g + "15", color: C.g, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              Enregistrer & planifier
            </button>
          )}
        </div>
      </div>

      {/* ── Main layout ── */}
      <div style={{
        display: "flex", gap: 0,
        // Desktop: side by side; mobile: stacked (via media query not available inline — use flex-wrap)
        flexWrap: "wrap",
        minHeight: "calc(100vh - 61px)",
      }}>

        {/* ── Builder col (2/3) ── */}
        <div style={{
          flex: "2 1 420px", padding: "20px 20px 40px",
          borderRight: `1px solid ${C.brd}`,
          minWidth: 0,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
            Structure
          </div>
          <IntervalBuilder root={root} onChange={setRoot} athleteId={athleteId} />
        </div>

        {/* ── Preview col (1/3) ── */}
        <div style={{
          flex: "1 1 280px",
          position: "sticky",
          top: 61,
          alignSelf: "flex-start",
          padding: "20px 16px",
          maxHeight: "calc(100vh - 61px)",
          overflowY: "auto",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
            Aperçu
          </div>

          {root.children.length === 0 ? (
            <div style={{ color: C.tx3, fontSize: 12, textAlign: "center", paddingTop: 40 }}>
              Ajoute des intervalles pour voir l'aperçu
            </div>
          ) : (
            <div style={{ background: C.s1, borderRadius: 10, padding: "14px 14px 10px", border: `1px solid ${C.brd}` }}>
              <SessionPreview intervals={root} />
            </div>
          )}

          {/* Mini totals recap */}
          {totals.durationS > 0 && (
            <div style={{ marginTop: 16, fontSize: 12, color: C.tx2, display: "flex", flexDirection: "column", gap: 4 }}>
              <div>
                <span style={{ color: C.tx3 }}>Durée estimée</span>{" "}
                <strong style={{ color: C.tx }}>{formatSLong(totals.durationS)}</strong>
              </div>
              {totals.distanceM > 0 && (
                <div>
                  <span style={{ color: C.tx3 }}>Distance</span>{" "}
                  <strong style={{ color: C.tx }}>{(totals.distanceM / 1000).toFixed(1)} km</strong>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Assign modal ── */}
      {showAssignModal && savedSessionId && athleteId && (
        <AssignModal
          sessionId={savedSessionId}
          athleteId={athleteId}
          onClose={() => { setShowAssignModal(false); navigateBack(); }}
        />
      )}
    </div>
  );
}
