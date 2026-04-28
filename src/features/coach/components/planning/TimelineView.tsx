import { useState, useRef, useLayoutEffect, useCallback } from "react";
import { addYears, subYears, startOfYear, endOfYear, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { C } from "@/lib/theme";

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
import { MicrocycleDrawer }    from "./drawers/MicrocycleDrawer";
import { CompetitionDrawer }   from "./drawers/CompetitionDrawer";

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_WIDTH    = 1400;
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
      title    = c.name;
      subtitle = `${format(parseISO(c.start_date), "d MMM", { locale: fr })} → ${format(parseISO(c.end_date), "d MMM", { locale: fr })}`;
      content  = (
        <div style={{ textAlign: "center", padding: "20px 0", color: C.tx3, fontSize: 12 }}>
          Voir ce mois dans le calendrier pour les détails.
          <div style={{ marginTop: 12 }}>
            <a
              href={`?view=month&month=${c.start_date.slice(0, 7)}`}
              style={{ color: C.ac, fontWeight: 600, fontSize: 13 }}
            >
              → Ouvrir Mois {format(parseISO(c.start_date), "MMMM yyyy", { locale: fr })}
            </a>
          </div>
        </div>
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

// ── TimelineView ──────────────────────────────────────────────────────────────

interface TimelineViewProps { athleteId: string }

export function TimelineView({ athleteId }: TimelineViewProps) {
  const [year,       setYear]       = useState(new Date().getFullYear());
  const [drawer,     setDrawer]     = useState<DrawerState | null>(null);

  const rangeStart = startOfYear(new Date(year, 0, 1));
  const rangeEnd   = endOfYear(new Date(year, 0, 1));
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
            <button onClick={() => setYear((y) => y - 1)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft size={16} />
            </button>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.tx, minWidth: 44, textAlign: "center" }}>{year}</div>
            <button onClick={() => setYear((y) => y + 1)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronRight size={16} />
            </button>
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
          <div ref={containerRef} style={{ width: "100%", minWidth: MIN_WIDTH }}>
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
                <div style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>Aucun macrocycle en {year}</div>
                <div style={{ fontSize: 12, color: C.tx3, marginTop: 4 }}>Crée un macrocycle pour visualiser la frise.</div>
              </div>
            ) : (
              /* Relative container for absolute markers */
              <div style={{ position: "relative" }}>
                <TimelineRow level="macrocycle" items={macroRows} {...sharedRowProps}
                  onOpen={(id) => open("macrocycle", id)}
                  onDrag={makeDragHandler("macrocycles")}
                  onResize={makeResizeHandler("macrocycles")}
                />
                <TimelineRow level="mesocycle" items={mesoRows} {...sharedRowProps}
                  onOpen={(id) => open("mesocycle", id)}
                  onDrag={makeDragHandler("mesocycles")}
                  onResize={makeResizeHandler("mesocycles")}
                />
                <TimelineRow level="cycle" items={cycleRows} {...sharedRowProps}
                  onOpen={(id) => open("cycle", id)}
                  onDrag={makeDragHandler("cycles")}
                  onResize={makeResizeHandler("cycles")}
                />
                <TimelineRow level="microcycle" items={microRows} {...sharedRowProps}
                  onOpen={(id) => open("microcycle", id)}
                  onDrag={makeDragHandler("microcycles")}
                  onResize={makeResizeHandler("microcycles")}
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
