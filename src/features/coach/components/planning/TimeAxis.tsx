import { eachMonthOfInterval, format, getMonth } from "date-fns";
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

  const todayMs    = Date.now();
  const rangeMs    = rangeEnd.getTime() - rangeStart.getTime();
  const elapsedMs  = todayMs - rangeStart.getTime();
  const todayX     = Math.max(0, Math.min(1, elapsedMs / rangeMs)) * trackWidth;
  const isInRange  = todayMs >= rangeStart.getTime() && todayMs <= rangeEnd.getTime();

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        borderBottom: "1px solid " + C.brd,
        paddingBottom: 6,
      }}
    >
      {/* Left label spacer */}
      <div style={{ width: LABEL_W, flexShrink: 0 }} />

      {/* Month cols */}
      <div style={{ flex: 1, display: "flex", position: "relative" }}>
        {months.map((month, i) => {
          const isJan = getMonth(month) === 0;
          const now = new Date();
          const isCurrentMonth =
            month.getFullYear() === now.getFullYear() &&
            month.getMonth() === now.getMonth();

          return (
            <div
              key={month.toISOString()}
              style={{
                width: colW, flexShrink: 0,
                textAlign: "center", position: "relative",
                paddingTop: isJan ? 2 : 4,
              }}
            >
              {/* Year label on January (or first month) */}
              {(isJan || i === 0) && (
                <div
                  style={{
                    fontSize: 8, fontWeight: 800, color: C.tx2,
                    textTransform: "uppercase", letterSpacing: "0.3px",
                    lineHeight: 1, marginBottom: 2,
                  }}
                >
                  {format(month, "yyyy")}
                </div>
              )}
              <div
                style={{
                  fontSize: 9,
                  fontWeight: isCurrentMonth ? 700 : isJan ? 600 : 500,
                  color: isCurrentMonth ? C.ac : isJan ? C.tx2 : C.tx3,
                  textTransform: "uppercase", letterSpacing: "0.5px",
                }}
              >
                {format(month, "MMM", { locale: fr })}
              </div>
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
