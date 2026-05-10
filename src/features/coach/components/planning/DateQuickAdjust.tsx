/**
 * DateQuickAdjust — §6.b
 * Boutons rapides pour ajuster end_date dans les drawers de périodisation.
 * Réutilisé dans Macrocycle / Mesocycle / CycleDrawer.
 */
import { format, parseISO, addWeeks, addMonths, addDays, startOfISOWeek, endOfISOWeek } from "date-fns";
import { C } from "@/lib/theme";

interface Props {
  endDate:     string;
  onEndChange: (newEnd: string) => void;
  /** If provided, shows a "coller à la précédente" button that sets start to day after prevEndDate */
  prevEndDate?:  string;
  onStartChange?: (newStart: string) => void;
}

function snapSun(d: Date): string {
  return format(endOfISOWeek(d), "yyyy-MM-dd");
}

function nextMonday(prevEnd: string): string {
  return format(startOfISOWeek(addDays(parseISO(prevEnd), 1)), "yyyy-MM-dd");
}

export function DateQuickAdjust({ endDate, onEndChange, prevEndDate, onStartChange }: Props) {
  const btnStyle: React.CSSProperties = {
    padding: "3px 8px", borderRadius: 6,
    border: "1px solid " + C.brdL, background: C.s2,
    color: C.tx3, fontSize: 10, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  };

  function adjustEnd(weeks?: number, months?: number) {
    if (!endDate) return;
    let next = parseISO(endDate);
    if (weeks  != null) next = addWeeks(next, weeks);
    if (months != null) next = addMonths(next, months);
    onEndChange(snapSun(next));
  }

  return (
    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
      {prevEndDate && onStartChange && (
        <button
          type="button"
          onClick={() => onStartChange(nextMonday(prevEndDate))}
          style={{ ...btnStyle, color: C.coach, borderColor: C.coach + "40", textAlign: "left" }}
        >
          ⬆ Coller à la précédente ({prevEndDate})
        </button>
      )}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 9, color: C.tx3 }}>Fin :</span>
        {([-4, -1, 1, 4, 13, 26, 52] as const).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => n % 13 === 0 ? adjustEnd(undefined, n / 4.33 | 0) : adjustEnd(n)}
            style={btnStyle}
          >
            {n > 0 ? "+" : ""}{n}s
          </button>
        ))}
        <button type="button" onClick={() => adjustEnd(undefined, 1)}  style={btnStyle}>+1m</button>
        <button type="button" onClick={() => adjustEnd(undefined, 3)}  style={btnStyle}>+3m</button>
        <button type="button" onClick={() => adjustEnd(undefined, 12)} style={btnStyle}>+1a</button>
      </div>
    </div>
  );
}
