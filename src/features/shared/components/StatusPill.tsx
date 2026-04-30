/** Status pill for workout/session states — palette v2 */

export type SessionStatus = "planned" | "in-progress" | "completed" | "missed" | "skipped";

const CONFIG: Record<
  SessionStatus,
  { label: string; bg: string; color: string; dot: string }
> = {
  planned: {
    label: "Planifiée",
    bg:    "rgba(124,116,128,0.18)",
    color: "#7C7480",
    dot:   "#7C7480",
  },
  "in-progress": {
    label: "En cours",
    bg:    "rgba(168,85,247,0.18)",
    color: "#A855F7",
    dot:   "#A855F7",
  },
  completed: {
    label: "Terminée",
    bg:    "rgba(34,201,147,0.15)",
    color: "#22C993",
    dot:   "#22C993",
  },
  missed: {
    label: "Manquée",
    bg:    "rgba(251,146,60,0.15)",
    color: "#FB923C",
    dot:   "#FB923C",
  },
  skipped: {
    label: "Ignorée",
    bg:    "rgba(244,114,182,0.15)",
    color: "#F472B6",
    dot:   "#F472B6",
  },
};

interface StatusPillProps {
  status: SessionStatus;
  label?: string;
  size?: "sm" | "md";
}

export function StatusPill({ status, label, size = "md" }: StatusPillProps) {
  const cfg = CONFIG[status];
  const fs = size === "sm" ? 10 : 11;
  const dotSize = size === "sm" ? 5 : 6;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: size === "sm" ? "2px 7px" : "3px 9px",
        borderRadius: 20,
        background: cfg.bg,
        color: cfg.color,
        fontSize: fs,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: "50%",
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {label ?? cfg.label}
    </span>
  );
}
