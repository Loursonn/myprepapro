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
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { C } from "@/lib/theme";
import { makeRootGroup, genId } from "@/lib/energy/treeUtils";
import { expandIntervals, computeTotals } from "@/lib/energy";
import { formatSLong } from "@/lib/energy/formatTarget";
import type { EnergyGroup, EnergyStep, SessionKind, StructureType } from "@/types/energy";
import { useAuth } from "@/hooks/useAuth";
import IntervalBuilder from "../components/energy/IntervalBuilder";
import SessionPreview from "../components/energy/SessionPreview";
import {
  useEnergySession,
  useEnergySessions,
  useCreateEnergySession,
  useUpdateEnergySession,
} from "@/features/shared/hooks/useEnergySessions";
import { useAssignEnergySession } from "@/features/shared/hooks/useEnergyAssignments";
import type { EnergySessionRow } from "@/types/energy";

// ── Constants ─────────────────────────────────────────────────────────────────

const SESSION_KINDS: { value: SessionKind; label: string }[] = [
  { value: "vo2",        label: "VO₂max / VMA" },
  { value: "tempo",      label: "Tempo" },
  { value: "seuil",      label: "Seuil lactique" },
  { value: "footing",    label: "Footing / Endurance" },
  { value: "fartlek",    label: "Fartlek" },
  { value: "autre",      label: "Autres" },
  { value: "custom",     label: "Type personnalisé…" },
];

const SPECIFIQUE_CATEGORIES: { value: string; label: string }[] = [
  { value: "vo2",        label: "VO₂max / VMA" },
  { value: "tempo",      label: "Tempo" },
  { value: "seuil",      label: "Seuil lactique" },
  { value: "footing",    label: "Footing / Endurance" },
  { value: "fartlek",    label: "Fartlek" },
  { value: "autre",      label: "Autres" },
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

// ── Import session modal ─────────────────────────────────────────────────────

const KIND_COLOR: Record<string, string> = {
  vo2: "#A855F7", tempo: "#3B8DF0", seuil: "#F59E0B",
  footing: "#22C55E", fartlek: "#EC4899", autre: "#6B7280", custom: "#14B8A6",
};

function deepCloneIntervals(steps: EnergyStep[]): EnergyStep[] {
  return steps.map((s): EnergyStep => {
    if (s.type === "interval" || s.type === "exercise") return { ...s, id: genId() };
    return {
      ...s,
      id: genId(),
      children: deepCloneIntervals(s.children),
      rest_between: s.rest_between ? { ...s.rest_between, id: genId() } : undefined,
    };
  });
}

function ImportSessionModal({ onImport, onClose }: {
  onImport: (session: EnergySessionRow) => void;
  onClose: () => void;
}) {
  const { data: sessions = [], isLoading } = useEnergySessions();
  const [search, setSearch] = useState("");

  const filtered = sessions.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)" }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", zIndex: 61,
        transform: "translate(-50%, -50%)",
        width: 520, maxWidth: "94vw", maxHeight: "80vh",
        background: C.s1, borderRadius: 16, border: `1px solid ${C.brd}`,
        display: "flex", flexDirection: "column",
        animation: "fadeScaleIn 150ms ease-out",
      }}>
        <style>{`@keyframes fadeScaleIn { from { opacity:0; transform:translate(-50%,-50%) scale(0.96) } to { opacity:1; transform:translate(-50%,-50%) scale(1) } }`}</style>

        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.brd}`, flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.tx }}>Importer une séance existante</div>
          <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>La structure sera copiée — l'original ne sera pas modifié</div>
        </div>

        <div style={{ padding: "10px 20px", borderBottom: `1px solid ${C.brd}`, flexShrink: 0 }}>
          <input
            autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.brdL}`, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ overflowY: "auto", padding: "12px 20px", flex: 1, scrollbarWidth: "none" }}>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: C.tx3, fontSize: 12 }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: C.tx3, fontSize: 13 }}>
              {search ? "Aucun résultat" : "Aucune séance disponible"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filtered.map((s) => {
                const kc = KIND_COLOR[s.session_kind] ?? "#6B7280";
                return (
                  <div
                    key={s.id}
                    onClick={() => onImport(s)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 10,
                      border: `1px solid ${C.brdL}`, background: C.s2,
                      cursor: "pointer", transition: "border-color 120ms",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = kc + "60")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.brdL)}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: kc + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>
                      ⚡
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                      <div style={{ fontSize: 10, color: C.tx3, marginTop: 1 }}>
                        {s.session_kind}{s.total_duration_s ? ` · ${Math.round(s.total_duration_s / 60)} min` : ""}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: C.ac, fontWeight: 600, flexShrink: 0 }}>Importer</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.brd}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.brdL}`, background: "transparent", color: C.tx2, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            Annuler
          </button>
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EnergySessionEditorPage() {
  const { athleteId, sessionId } = useParams<{ athleteId?: string; sessionId?: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEdit = !!sessionId;
  const kindFromUrl = searchParams.get("kind") as SessionKind | null;

  // Load existing session when editing
  const { data: existingSession, isLoading } = useEnergySession(sessionId);

  const createMutation = useCreateEnergySession();
  const updateMutation = useUpdateEnergySession();

  // Form state
  const [name, setName] = useState("");
  const [sessionKind, setSessionKind] = useState<SessionKind>(kindFromUrl ?? "vo2");
  const [customKind, setCustomKind] = useState("vo2");
  const [structureType, setStructureType] = useState<StructureType>("fractionne");
  const [root, setRoot] = useState<EnergyGroup>(makeRootGroup);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  // Hydrate from existing session
  useEffect(() => {
    if (existingSession) {
      setName(existingSession.name);
      setSessionKind(existingSession.session_kind);
      setCustomKind(existingSession.custom_kind || "vo2");
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

  function handleImportSession(session: EnergySessionRow) {
    setName(session.name + " (copie)");
    setSessionKind(session.session_kind);
    setCustomKind(session.custom_kind || "vo2");
    setStructureType(session.structure_type);
    const clonedChildren = deepCloneIntervals(session.intervals ?? []);
    setRoot({
      type: "group", id: "__root__", role: "open", repeat: 1,
      children: clonedChildren,
    });
    setShowImport(false);
  }

  // Computed preview totals
  const flat = expandIntervals(root);
  const totals = computeTotals(flat);

  async function handleSave(andPlan = false) {
    const effectiveKind = sessionKind === "custom" ? "custom" : sessionKind;
    const payload = {
      name: name.trim() || "Séance sans titre",
      session_kind: effectiveKind,
      custom_kind: sessionKind === "specifique" ? customKind : (sessionKind === "custom" ? customKind : null),
      modality: null,
      structure_type: structureType,
      intervals: root.children,
      created_by: user?.id ?? null,
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
    } else if (sessionKind === "specifique") {
      navigate("/coach/library");
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
          {sessionKind === "specifique" ? (
            <>
              {/* Spécifique badge */}
              <span style={{
                padding: "5px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: "#F5A623" + "20", color: "#F5A623",
              }}>
                Spécifique
              </span>
              {/* Category */}
              <Select value={customKind} onValueChange={setCustomKind}>
                <SelectTrigger style={{ width: 160, background: C.s2, border: `1px solid ${C.brd}`, color: C.tx, fontSize: 12 }}>
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {SPECIFIQUE_CATEGORIES.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <>
              {/* Energy session kind */}
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
            </>
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
          {!isEdit && (
            <button
              onClick={() => setShowImport(true)}
              style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.ac}40`, background: C.ac + "12", color: C.ac, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              Importer une séance
            </button>
          )}
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
          <IntervalBuilder root={root} onChange={setRoot} athleteId={athleteId} sessionKind={sessionKind} />
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

      {/* ── Import modal ── */}
      {showImport && (
        <ImportSessionModal
          onImport={handleImportSession}
          onClose={() => setShowImport(false)}
        />
      )}

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
