import { useState } from "react";
import { Rnd } from "react-rnd";
import { Plus } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { C } from "@/lib/theme";
import type { useCalculatePosition } from "./hooks/useCalculatePosition";

const LABEL_W   = 88;
const ROW_H     = 52;
const ITEM_H    = 36;
const ITEM_Y    = (ROW_H - ITEM_H) / 2;
const MIN_W_PX  = 32;

export type TLLevel = "macrocycle" | "mesocycle" | "cycle" | "microcycle";

const LEVEL_COLOR: Record<TLLevel, string> = {
  macrocycle: C.ac,
  mesocycle:  C.coach,
  cycle:      C.o,
  microcycle: C.tx3,
};

const LEVEL_BG: Record<TLLevel, string> = {
  macrocycle: C.acS,
  mesocycle:  C.coachS,
  cycle:      C.oS,
  microcycle: "rgba(124,116,128,0.08)",
};

const LEVEL_LABEL: Record<TLLevel, string> = {
  macrocycle: "Macro",
  mesocycle:  "Méso",
  cycle:      "Cycle",
  microcycle: "Micro",
};

// ── Single item ───────────────────────────────────────────────────────────────

interface TLItemProps {
  id:         string;
  label:      string;
  isDeload?:  boolean;
  x:          number;
  width:      number;
  color:      string;
  bg:         string;
  onOpen:     () => void;
  onDragStop: (newX: number) => void;
  onResizeStop: (newX: number, newWidth: number) => void;
}

function TLItem({ id, label, isDeload, x, width, color, bg, onOpen, onDragStop, onResizeStop }: TLItemProps) {
  const [dragging, setDragging] = useState(false);

  return (
    <Rnd
      key={id}
      position={{ x, y: ITEM_Y }}
      size={{ width: Math.max(width, MIN_W_PX), height: ITEM_H }}
      dragAxis="x"
      bounds="parent"
      minWidth={MIN_W_PX}
      enableResizing={{
        left: true, right: true,
        top: false, bottom: false,
        topLeft: false, topRight: false, bottomLeft: false, bottomRight: false,
      }}
      resizeHandleComponent={{
        left: (
          <div
            style={{
              width: 6, height: "100%", cursor: "ew-resize",
              background: color, opacity: 0.5, borderRadius: "4px 0 0 4px",
            }}
          />
        ),
        right: (
          <div
            style={{
              width: 6, height: "100%", cursor: "ew-resize",
              background: color, opacity: 0.5, borderRadius: "0 4px 4px 0",
            }}
          />
        ),
      }}
      onDragStart={() => setDragging(true)}
      onDragStop={(_e, d) => { setDragging(false); onDragStop(d.x); }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        onResizeStop(pos.x, ref.offsetWidth);
      }}
      style={{ zIndex: dragging ? 10 : 2 }}
    >
      <div
        onClick={(e) => { if (!dragging) { e.stopPropagation(); onOpen(); } }}
        style={{
          width: "100%", height: "100%",
          background: bg,
          border: `1.5px solid ${color}`,
          borderLeft: `4px solid ${color}`,
          borderRadius: 8,
          display: "flex", alignItems: "center",
          paddingLeft: 8, paddingRight: 4,
          cursor: "grab",
          userSelect: "none",
          overflow: "hidden",
          opacity: dragging ? 0.75 : 1,
          boxShadow: dragging ? `0 4px 16px ${color}40` : "none",
          transition: "opacity 100ms, box-shadow 100ms",
          position: "relative",
        }}
      >
        {/* Deload hatching */}
        {isDeload && (
          <div
            style={{
              position: "absolute", inset: 0, borderRadius: 6,
              background: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${C.b}18 5px, ${C.b}18 10px)`,
              pointerEvents: "none",
            }}
          />
        )}
        <span
          style={{
            fontSize: 10, fontWeight: 700, color: "#fff",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            flex: 1, lineHeight: 1.2,
          }}
        >
          {isDeload && <span style={{ color: C.b, marginRight: 3 }}>⟳</span>}
          {label}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          style={{
            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
            border: `1px solid ${color}60`, background: "transparent",
            color, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginLeft: 4,
          }}
        >
          <Plus size={10} />
        </button>
      </div>
    </Rnd>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

export interface TLRowItem {
  id:         string;
  label:      string;
  startDate:  string;
  endDate:    string;
  isDeload?:  boolean;
  parentStart?: string;
  parentEnd?:   string;
}

type CalcPos = ReturnType<typeof useCalculatePosition>;

interface TimelineRowProps {
  level:    TLLevel;
  items:    TLRowItem[];
  calc:     CalcPos;
  // Shared range strings for optimistic update query key
  rangeStart: string;
  rangeEnd:   string;
  athleteId:  string;
  onOpen:   (id: string) => void;
  onDrag:   (id: string, newStart: string, newEnd: string, parentStart?: string, parentEnd?: string) => void;
  onResize: (id: string, newStart: string, newEnd: string, parentStart?: string, parentEnd?: string) => void;
}

export function TimelineRow({
  level, items, calc, athleteId, onOpen, onDrag, onResize,
}: TimelineRowProps) {
  const color = LEVEL_COLOR[level];
  const bg    = LEVEL_BG[level];
  const trackW = (calc as unknown as { totalDays: number; pixPerDay: number }).pixPerDay *
                 (calc as unknown as { totalDays: number }).totalDays;

  return (
    <div style={{ display: "flex", borderBottom: "1px solid " + C.brd + "50" }}>
      {/* Label */}
      <div
        style={{
          width: LABEL_W, flexShrink: 0, height: ROW_H,
          display: "flex", alignItems: "center", paddingLeft: 8, paddingRight: 8,
        }}
      >
        <span
          style={{
            fontSize: 9, fontWeight: 700, color,
            textTransform: "uppercase", letterSpacing: "0.5px",
          }}
        >
          {LEVEL_LABEL[level]}
        </span>
      </div>

      {/* Track */}
      <div
        style={{
          flex: 1, height: ROW_H, position: "relative",
          background: level === "macrocycle" ? C.ac + "04" : "transparent",
        }}
      >
        {/* Month grid lines */}
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${(i / 12) * 100}%`,
              top: 0, bottom: 0, width: 1,
              background: C.brd, opacity: 0.5, pointerEvents: "none",
            }}
          />
        ))}

        {items.map((item) => {
          const { x, width } = calc.position(item.startDate, item.endDate);
          const dur = differenceInDays(parseISO(item.endDate), parseISO(item.startDate));

          return (
            <TLItem
              key={item.id}
              id={item.id}
              label={item.label}
              isDeload={item.isDeload}
              x={x}
              width={width}
              color={color}
              bg={bg}
              onOpen={() => onOpen(item.id)}
              onDragStop={(newX) => {
                // Snap to parent if out of bounds
                let fx = newX;
                if (item.parentStart && item.parentEnd) {
                  const { x: px, width: pw } = calc.position(item.parentStart, item.parentEnd);
                  fx = Math.max(px, Math.min(newX, px + pw - width));
                }
                const newStart = calc.xToDateStr(fx);
                const newEnd   = format(
                  new Date(parseISO(newStart).getTime() + dur * 86400000),
                  "yyyy-MM-dd",
                );
                onDrag(item.id, newStart, newEnd, item.parentStart, item.parentEnd);
              }}
              onResizeStop={(newX, newW) => {
                let fx = newX, fw = newW;
                if (item.parentStart && item.parentEnd) {
                  const clamped = calc.clampToParent(newX, newW, item.parentStart, item.parentEnd);
                  fx = clamped.x; fw = clamped.width;
                }
                const newStart = calc.xToDateStr(fx);
                const newEnd   = calc.xToDateStr(fx + fw);
                onResize(item.id, newStart, newEnd, item.parentStart, item.parentEnd);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
