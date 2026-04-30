import { useState, useRef, useLayoutEffect, useCallback } from "react";
import { startOfMonth, addMonths, subMonths, format, parseISO, startOfISOWeek, endOfISOWeek, addWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X, Plus, Eye } from "lucide-react";
import { C } from "@/lib/theme";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

import { useTimelineData }      from "./hooks/useTimelineData";
import { useCalculatePosition } from "./hooks/useCalculatePosition";
import { useDragCycle }         from "./hooks/useDragCycle";
import { useResizeCycle }       from "./hooks/useResizeCycle";
import type {
  Macrocycle, Mesocycle, Cycle, Microcycle, Competition,
} from "./hooks/useTimelineData";

import { TimeAxis }            from "./TimeAxis";
import { TimelineRow }         from "./TimelineRow";
import type { TLRowItem }      from "./TimelineRow";
import { CompetitionMarkers }  from "./CompetitionMarkers";
import { TestMarkers }         from "./TestMarkers";

import { MacrocycleDrawer }    from "./drawers/MacrocycleDrawer";
import { MesocycleDrawer }     from "./drawers/MesocycleDrawer";
import { CycleDrawer }         from "./drawers/CycleDrawer";
import { MicrocycleDrawer }    from "./drawers/MicrocycleDrawer";
import { CompetitionDrawer }   from "./drawers/CompetitionDrawer";

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_WIDTH    = 600;
const ROW_H        = 52;
const ROWS_COUNT   = 4;
const TOTAL_ROW_H  = ROW_H * ROWS_COUNT;

const LEVEL_COLORS = {
  macrocycle: C.ac,
  mesocycle:  C.coach,
  cycle:      C.o,
  microcycle: C.tx3,
} as const;

// ── Drawer host ───────────────────────────────────────────────────────────────

type DrawerType = "macrocycle" | "mesocycle" | "cycle" | "microcycle" | "competition";

interface DrawerState {
  type:  DrawerType;
  id:    string;
}

function DrawerShell({
  state, onClose, data, athleteId, rangeStart, rangeEnd,
}: {
  state:      DrawerState;
  onClose:    () => void;
  data:       ReturnType<typeof useTimelineData>["data"];
  athleteId:  string;
  rangeStart: string;
  rangeEnd:   string;
}) {
  if (!data) return null;

  const LEVEL_COLOR: Record<DrawerType, string> = {
    macrocycle:  C.ac,
    mesocycle:   C.coach,
    cycle:       C.o,
    microcycle:  C.tx3,
    competition: C.coach,
  };
  const color = LEVEL_COLOR[state.type];

  let title    = "";
  let subtitle = "";
  let content: React.ReactNode = null;

  switch (state.type) {
    case "macrocycle": {
      const m = data.macrocycles.find((x) => x.id === state.id);
      if (!m) return null;
      title    = m.name;
      subtitle = `${format(parseISO(m.start_date), "d MMM yyyy", { locale: fr })} → ${format(parseISO(m.end_date), "d MMM yyyy", { locale: fr })}`;
      content  = <MacrocycleDrawer macro={m} athleteId={athleteId} rangeStart={rangeStart} rangeEnd={rangeEnd} onClose={onClose} />;
      break;
    }
    case "mesocycle": {
      const m = data.mesocycles.find((x) => x.id === state.id);
      if (!m) return null;
      title    = m.name;
      subtitle = `${format(parseISO(m.start_date), "d MMM", { locale: fr })} → ${format(parseISO(m.end_date), "d MMM", { locale: fr })}`;
      content  = <MesocycleDrawer meso={m} athleteId={athleteId} rangeStart={rangeStart} rangeEnd={rangeEnd} />;
      break;
    }
    case "cycle": {
      const c = data.cycles.find((x) => x.id === state.id);
      if (!c) return null;
      const parentMeso = data.mesocycles.find((m) => m.id === c.mesocycle_id);
      title    = c.name;
      subtitle = `${format(parseISO(c.start_date), "d MMM", { locale: fr })} → ${format(parseISO(c.end_date), "d MMM", { locale: fr })}`;
      content  = (
        <CycleDrawer
          cycle={c}
          parentMeso={parentMeso}
          athleteId={athleteId}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onClose={onClose}
        />
      );
      break;
    }
    case "microcycle": {
      const mi = data.microcycles.find((x) => x.id === state.id);
      if (!mi) return null;
      // Find siblings for S-1
      const siblings = data.microcycles
        .filter((m) => m.cycle_id === mi.cycle_id)
        .sort((a, b) => a.week_number - b.week_number);
      const idx       = siblings.findIndex((m) => m.id === mi.id);
      const prevMicro = idx > 0 ? siblings[idx - 1] : undefined;
      title    = `Semaine ${mi.week_number}`;
      subtitle = `${format(parseISO(mi.start_date), "d MMM", { locale: fr })} → ${format(parseISO(mi.end_date), "d MMM", { locale: fr })}`;
      content  = <MicrocycleDrawer micro={mi} prevMicro={prevMicro} athleteId={athleteId} />;
      break;
    }
    case "competition": {
      const c = data.competitions.find((x) => x.id === state.id);
      if (!c) return null;
      title    = c.name;
      subtitle = format(parseISO(c.date), "d MMMM yyyy", { locale: fr });
      content  = <CompetitionDrawer comp={c} />;
      break;
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.5)" }} />
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50,
          width: 480, maxWidth: "92vw",
          background: C.s1, borderLeft: "1px solid " + C.brd,
          display: "flex", flexDirection: "column",
          animation: "tlDrawerIn 200ms ease-out",
        }}
      >
        <style>{`@keyframes tlDrawerIn { from { transform:translateX(100%); opacity:0 } to { transform:translateX(0); opacity:1 } }`}</style>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid " + C.brd, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 6, height: 36, borderRadius: 4, background: color, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {state.type === "competition" ? "Compétition" : state.type.charAt(0).toUpperCase() + state.type.slice(1)}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {title}
            </div>
            <div style={{ fontSize: 10, color: C.tx3 }}>{subtitle}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", scrollbarWidth: "none" }}>
          {content}
        </div>
      </div>
    </>
  );
}

// ── Microcycle auto-generation helper ─────────────────────────────────────────

// Generates one microcycle per ISO week (Mon→Sun) covering the cycle range.
// First week = Monday of the week containing startDate.
// Last week = week whose Monday is still ≤ endDate.
function buildMicrocycles(cycleId: string, startDate: string, endDate: string) {
  const rows: { cycle_id: string; week_number: number; start_date: string; end_date: string; is_deload: boolean }[] = [];
  const ed = parseISO(endDate);
  let weekMon = startOfISOWeek(parseISO(startDate)); // always Monday
  let week = 1;
  while (weekMon <= ed) {
    rows.push({
      cycle_id:    cycleId,
      week_number: week,
      start_date:  format(weekMon,                 "yyyy-MM-dd"),
      end_date:    format(endOfISOWeek(weekMon),   "yyyy-MM-dd"), // always Sunday
      is_deload:   false,
    });
    weekMon = addWeeks(weekMon, 1);
    week++;
  }
  return rows;
}

// ── Create modal ──────────────────────────────────────────────────────────────

type CreateLevel = "macrocycle" | "mesocycle" | "cycle" | "microcycle";

interface CreateState {
  level:        CreateLevel;
  parentId?:    string;
  defaultStart: string;
  defaultEnd:   string;
}

function CreateModal({
  state, athleteId, coachId, rangeStart, rangeEnd, onClose,
}: {
  state:      CreateState;
  athleteId:  string;
  coachId:    string;
  rangeStart: string;
  rangeEnd:   string;
  onClose:    () => void;
}) {
  const qc = useQueryClient();

  const [name,      setName]      = useState(state.level === "microcycle" ? "" : "");
  const [weekNum,   setWeekNum]   = useState(1);
  const [isDeload,  setIsDeload]  = useState(false);
  const [startDate, setStartDate] = useState(state.defaultStart);
  const [endDate,   setEndDate]   = useState(state.defaultEnd);
  const [saving,    setSaving]    = useState(false);

  const LEVEL_COLOR: Record<CreateLevel, string> = {
    macrocycle: C.ac, mesocycle: C.coach, cycle: C.o, microcycle: C.tx3,
  };
  const color = LEVEL_COLOR[state.level];

  const LEVEL_LABEL: Record<CreateLevel, string> = {
    macrocycle: "Macrocycle", mesocycle: "Mésocycle", cycle: "Cycle", microcycle: "Microcycle",
  };

  async function handleSubmit() {
    if (!startDate || !endDate) { toast.error("Dates requises"); return; }
    if (state.level !== "microcycle" && !name.trim()) { toast.error("Nom requis"); return; }
    setSaving(true);
    let error: unknown = null;
    switch (state.level) {
      case "macrocycle":
        ({ error } = await supabase.from("macrocycles").insert({
          athlete_id: athleteId, coach_id: coachId,
          name: name.trim(), start_date: startDate, end_date: endDate,
        }));
        break;
      case "mesocycle":
        ({ error } = await supabase.from("mesocycles").insert({
          macrocycle_id: state.parentId!, name: name.trim(),
          start_date: startDate, end_date: endDate,
        }));
        break;
      case "cycle": {
        const { data: newCycle, error: cycleErr } = await supabase
          .from("cycles")
          .insert({ mesocycle_id: state.parentId!, name: name.trim(), start_date: startDate, end_date: endDate })
          .select("id")
          .single();
        error = cycleErr;
        if (!cycleErr && newCycle) {
          const micros = buildMicrocycles(newCycle.id, startDate, endDate);
          if (micros.length > 0) {
            const { error: microErr } = await supabase.from("microcycles").insert(micros);
            if (microErr) console.error("[auto-microcycles]", microErr.message);
          }
        }
        break;
      }
      case "microcycle":
        ({ error } = await supabase.from("microcycles").insert({
          cycle_id: state.parentId!, week_number: weekNum,
          start_date: startDate, end_date: endDate, is_deload: isDeload,
        }));
        break;
    }
    setSaving(false);
    if (error) { toast.error("Erreur lors de la création"); return; }
    qc.invalidateQueries({ queryKey: ["timeline-data",    athleteId] });
    qc.invalidateQueries({ queryKey: ["planning-summary", athleteId] });
    toast.success(`${LEVEL_LABEL[state.level]} créé`);
    onClose();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", borderRadius: 8,
    border: "1px solid " + C.brdL, background: C.s2,
    color: C.tx, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)" }} />
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", zIndex: 61,
          transform: "translate(-50%, -50%)",
          width: 400, maxWidth: "92vw",
          background: C.s1, borderRadius: 16, border: "1px solid " + C.brd,
          padding: "20px 24px",
          animation: "fadeScaleIn 150ms ease-out",
        }}
      >
        <style>{`@keyframes fadeScaleIn { from { opacity:0; transform:translate(-50%,-50%) scale(0.95) } to { opacity:1; transform:translate(-50%,-50%) scale(1) } }`}</style>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 4, height: 28, borderRadius: 3, background: color, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Nouveau
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.tx }}>{LEVEL_LABEL[state.level]}</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {state.level === "microcycle" ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontSize: 11, color: C.tx3, flexShrink: 0 }}>Semaine n°</label>
              <input
                type="number" min={1} max={52}
                value={weekNum}
                onChange={(e) => setWeekNum(parseInt(e.target.value) || 1)}
                style={{ ...inputStyle, width: 80 }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.tx3, cursor: "pointer" }}>
                <input
                  type="checkbox" checked={isDeload}
                  onChange={(e) => setIsDeload(e.target.checked)}
                  style={{ accentColor: C.b }}
                />
                Deload
              </label>
            </div>
          ) : (
            <div>
              <label style={{ fontSize: 11, color: C.tx3, display: "block", marginBottom: 4 }}>Nom</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder={`Nom du ${LEVEL_LABEL[state.level].toLowerCase()}…`}
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: C.tx3, display: "block", marginBottom: 4 }}>Début</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: C.tx3, display: "block", marginBottom: 4 }}>Fin</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid " + C.brdL, background: "transparent", color: C.tx2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: color, color: "#fff", fontSize: 12, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "…" : "Créer"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── TimelineView ──────────────────────────────────────────────────────────────

interface TimelineViewProps { athleteId: string }

const MONTHS_SHOWN = 18;

export function TimelineView({ athleteId }: TimelineViewProps) {
  const [windowStart, setWindowStart] = useState(() => startOfMonth(new Date()));
  const [drawer,      setDrawer]      = useState<DrawerState | null>(null);
  const [createModal, setCreateModal] = useState<CreateState | null>(null);
  const [zoomMacro,   setZoomMacro]   = useState<{ start: Date; end: Date; label: string } | null>(null);

  const { user } = useAuth();

  const rangeStart = zoomMacro ? zoomMacro.start : windowStart;
  const rangeEnd   = zoomMacro ? zoomMacro.end   : addMonths(windowStart, MONTHS_SHOWN);
  const rsStr      = format(rangeStart, "yyyy-MM-dd");
  const reStr      = format(rangeEnd,   "yyyy-MM-dd");

  const containerRef    = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(MIN_WIDTH);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      setWidth(Math.max(MIN_WIDTH, entry.contentRect.width));
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const { data, isLoading } = useTimelineData(athleteId, { start: rangeStart, end: rangeEnd });
  const calc = useCalculatePosition(rangeStart, rangeEnd, width - 88); // subtract label col

  const { mutate: drag }   = useDragCycle();
  const { mutate: resize } = useResizeCycle();

  const open = useCallback((type: DrawerType, id: string) => setDrawer({ type, id }), []);

  function openCreate(level: CreateLevel, parentId?: string, defaultStart?: string, defaultEnd?: string) {
    setCreateModal({
      level, parentId,
      defaultStart: defaultStart ?? rsStr,
      defaultEnd:   defaultEnd   ?? reStr,
    });
  }

  function makeAddHandler(
    childLevel: CreateLevel,
    parentArr: "macrocycles" | "mesocycles" | "cycles",
  ) {
    return (parentId: string) => {
      const parent = (data?.[parentArr] as Array<{ id: string; start_date: string; end_date: string }>)
        ?.find((i) => i.id === parentId);
      openCreate(childLevel, parentId, parent?.start_date, parent?.end_date);
    };
  }

  function makeDragHandler(level: "macrocycles" | "mesocycles" | "cycles" | "microcycles") {
    return (id: string, ns: string, ne: string, ps?: string, pe?: string) => {
      const item = (data?.[level] as Array<{ id: string }>)?.find((i) => i.id === id);
      if (!item) return;
      drag({ level, item: item as never, newStart: parseISO(ns), newEnd: parseISO(ne), parentStart: ps, parentEnd: pe, athleteId, rangeStart: rsStr, rangeEnd: reStr });
    };
  }

  function makeResizeHandler(level: "macrocycles" | "mesocycles" | "cycles" | "microcycles") {
    return (id: string, ns: string, ne: string, ps?: string, pe?: string) => {
      const item = (data?.[level] as Array<{ id: string }>)?.find((i) => i.id === id);
      if (!item) return;
      resize({ level, item: item as never, newStart: parseISO(ns), newEnd: parseISO(ne), parentStart: ps, parentEnd: pe, athleteId, rangeStart: rsStr, rangeEnd: reStr });
    };
  }

  // ── Map data → TLRowItem ──────────────────────────────────────────────────

  const macroRows: TLRowItem[] = (data?.macrocycles ?? []).map((m) => ({
    id: m.id, label: m.name, startDate: m.start_date, endDate: m.end_date,
  }));

  const mesoRows: TLRowItem[] = (data?.mesocycles ?? []).map((m) => {
    const parent = data?.macrocycles.find((ma) => ma.id === m.macrocycle_id);
    return { id: m.id, label: m.name, startDate: m.start_date, endDate: m.end_date, parentStart: parent?.start_date, parentEnd: parent?.end_date };
  });

  const cycleRows: TLRowItem[] = (data?.cycles ?? []).map((c) => {
    const parent = data?.mesocycles.find((m) => m.id === c.mesocycle_id);
    return { id: c.id, label: c.name, startDate: c.start_date, endDate: c.end_date, parentStart: parent?.start_date, parentEnd: parent?.end_date };
  });

  const microRows: TLRowItem[] = (data?.microcycles ?? []).map((mi) => {
    const parent = data?.cycles.find((c) => c.id === mi.cycle_id);
    return { id: mi.id, label: `S${mi.week_number}`, startDate: mi.start_date, endDate: mi.end_date, isDeload: mi.is_deload, parentStart: parent?.start_date, parentEnd: parent?.end_date };
  });

  const sharedRowProps = { calc, athleteId, rangeStart: rsStr, rangeEnd: reStr };

  return (
    <>
      <div style={{ background: C.s1, borderRadius: 16, border: "1px solid " + C.brd, overflow: "hidden" }}>
        {/* ── Header ── */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid " + C.brd, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {zoomMacro ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, background: C.acS, border: "1px solid " + C.ac + "50" }}>
                  <Eye size={12} color={C.ac} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.ac }}>MACROCYCLE EN COURS</span>
                  <span style={{ fontSize: 11, color: C.tx3 }}>·</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.tx }}>{zoomMacro.label}</span>
                </div>
                <button
                  onClick={() => setZoomMacro(null)}
                  title="Quitter le zoom"
                  style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <X size={13} />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setWindowStart((d) => subMonths(d, 6))} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ChevronLeft size={16} />
                </button>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.tx, minWidth: 160, textAlign: "center" }}>
                  {format(rangeStart, "MMM yyyy", { locale: fr })} — {format(rangeEnd, "MMM yyyy", { locale: fr })}
                </div>
                <button onClick={() => setWindowStart((d) => addMonths(d, 6))} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => setWindowStart(startOfMonth(new Date()))}
                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Auj.
                </button>
                <button
                  onClick={() => openCreate("macrocycle", undefined, rsStr, reStr)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "5px 12px", borderRadius: 8,
                    border: "1px solid " + C.ac + "50", background: C.acS,
                    color: C.ac, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <Plus size={11} /> Macrocycle
                </button>
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {(["macrocycle", "mesocycle", "cycle", "microcycle"] as const).map((lvl) => (
              <div key={lvl} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: LEVEL_COLORS[lvl] }} />
                <span style={{ fontSize: 9, color: C.tx3, textTransform: "capitalize" }}>{lvl}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Scrollable area ── */}
        <div style={{ overflowX: "auto", paddingBottom: 40 }}>
          <div ref={containerRef} style={{ width: "100%" }}>
            {/* TimeAxis */}
            <div style={{ padding: "10px 0 0" }}>
              <TimeAxis rangeStart={rangeStart} rangeEnd={rangeEnd} containerWidth={width} />
            </div>

            {isLoading ? (
              <div style={{ padding: "60px 0", textAlign: "center" }}>
                <div style={{ width: 24, height: 24, border: "2px solid " + C.brdL, borderTopColor: C.ac, borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto" }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (data?.macrocycles ?? []).length === 0 ? (
              <div style={{ padding: "60px 0", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📅</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>Aucun macrocycle sur cette période</div>
                <div style={{ fontSize: 12, color: C.tx3, marginTop: 4, marginBottom: 16 }}>Crée un macrocycle pour visualiser la frise.</div>
                <button
                  onClick={() => openCreate("macrocycle", undefined, rsStr, reStr)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "9px 18px", borderRadius: 10,
                    border: "none", background: C.ac,
                    color: "#fff", fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <Plus size={13} /> Créer un macrocycle
                </button>
              </div>
            ) : (
              /* Relative container for absolute markers */
              <div style={{ position: "relative" }}>
                <TimelineRow level="macrocycle" items={macroRows} {...sharedRowProps}
                  onOpen={(id) => open("macrocycle", id)}
                  onAdd={makeAddHandler("mesocycle", "macrocycles")}
                  onZoom={(id) => {
                    const macro = data?.macrocycles.find((m) => m.id === id);
                    if (macro) setZoomMacro({ start: parseISO(macro.start_date), end: parseISO(macro.end_date), label: macro.name });
                  }}
                  onNewRow={() => openCreate("macrocycle", undefined, rsStr, reStr)}
                  onDrag={makeDragHandler("macrocycles")}
                  onResize={makeResizeHandler("macrocycles")}
                />
                <TimelineRow level="mesocycle" items={mesoRows} {...sharedRowProps}
                  onOpen={(id) => open("mesocycle", id)}
                  onAdd={makeAddHandler("cycle", "mesocycles")}
                  onNewRow={() => openCreate("mesocycle", data?.macrocycles[0]?.id, data?.macrocycles[0]?.start_date, data?.macrocycles[0]?.end_date)}
                  onDrag={makeDragHandler("mesocycles")}
                  onResize={makeResizeHandler("mesocycles")}
                />
                <TimelineRow level="cycle" items={cycleRows} {...sharedRowProps}
                  onOpen={(id) => open("cycle", id)}
                  onNewRow={() => openCreate("cycle", data?.mesocycles[0]?.id, data?.mesocycles[0]?.start_date, data?.mesocycles[0]?.end_date)}
                  onDrag={makeDragHandler("cycles")}
                  onResize={makeResizeHandler("cycles")}
                />
                <TimelineRow level="microcycle" items={microRows} {...sharedRowProps}
                  readOnly
                  onOpen={(id) => open("microcycle", id)}
                />

                {/* Vertical markers (position absolute over all rows) */}
                <CompetitionMarkers
                  competitions={data?.competitions ?? []}
                  calc={calc}
                  totalRowHeight={TOTAL_ROW_H}
                  onSelect={(c: Competition) => open("competition", c.id)}
                />
                <TestMarkers
                  tests={data?.tests ?? []}
                  calc={calc}
                  totalRowHeight={TOTAL_ROW_H}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <div style={{ padding: "8px 20px", borderTop: "1px solid " + C.brd, fontSize: 9, color: C.tx3, textAlign: "center" }}>
          Drag axe X pour déplacer · Poignées colorées pour redimensionner · + pour détails · Compétitions: 🏆 rose(A) violet(B) gris(C)
        </div>
      </div>

      {/* Create modal */}
      {createModal && (
        <CreateModal
          state={createModal}
          athleteId={athleteId}
          coachId={user?.id ?? ""}
          rangeStart={rsStr}
          rangeEnd={reStr}
          onClose={() => setCreateModal(null)}
        />
      )}

      {/* Drawer */}
      {drawer && data && (
        <DrawerShell
          state={drawer}
          onClose={() => setDrawer(null)}
          data={data}
          athleteId={athleteId}
          rangeStart={rsStr}
          rangeEnd={reStr}
        />
      )}
    </>
  );
}
