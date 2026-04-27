import { eachMonthOfInterval, format, isToday, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { C } from "@/lib/theme";

const LABEL_W = 88;

interface TimeAxisProps {
  rangeStart:     Date;
  rangeEnd:       Date;
  containerWidth: number;
}

export function TimeAxis({ rangeStart, rangeEnd, containerWidth }: TimeAxisProps) {
  const months     = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });
  const trackWidth = containerWidth - LABEL_W;
  const colW       = trackWidth / months.length;

  const todayMs  = Date.now();
  const rangeMs  = rangeEnd.getTime() - rangeStart.getTime();
  const elapsedMs = todayMs - rangeStart.getTime();
  const todayX   = Math.max(0, Math.min(1, elapsedMs / rangeMs)) * trackWidth;
  const isInRange = todayMs >= rangeStart.getTime() && todayMs <= rangeEnd.getTime();

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        borderBottom: "1px solid " + C.brd,
        paddingBottom: 6,
        marginBottom: 0,
      }}
    >
      {/* Left label spacer */}
      <div style={{ width: LABEL_W, flexShrink: 0 }} />

      {/* Month cols */}
      <div style={{ flex: 1, display: "flex", position: "relative" }}>
        {months.map((month) => {
          const isCurrentMonth = isToday(startOfMonth(month)) ||
            (month <= new Date() && new Date() < new Date(month.getFullYear(), month.getMonth() + 1));
          return (
            <div
              key={month.toISOString()}
              style={{
                width: colW, flexShrink: 0, textAlign: "center",
                fontSize: 9, fontWeight: isCurrentMonth ? 700 : 500,
                color: isCurrentMonth ? C.ac : C.tx3,
                textTransform: "uppercase", letterSpacing: "0.5px",
                paddingTop: 4,
              }}
            >
              {format(month, "MMM", { locale: fr })}
            </div>
          );
        })}

        {/* Today marker */}
        {isInRange && (
          <div
            style={{
              position: "absolute",
              left: todayX,
              top: 0, bottom: -6,
              width: 2,
              background: C.ac,
              borderRadius: 1,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute", top: -12, left: "50%",
                transform: "translateX(-50%)",
                fontSize: 7, fontWeight: 800, color: C.ac,
                background: C.acS, borderRadius: 3, padding: "1px 4px",
                whiteSpace: "nowrap",
              }}
            >
              Auj.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
