/** Status pill for workout/session states. */

export type SessionStatus = "planned" | "in-progress" | "completed" | "missed" | "skipped";

const CONFIG: Record<
  SessionStatus,
  { label: string; bg: string; color: string; dot: string }
> = {
  planned: {
    label: "Planifiée",
    bg: "rgba(145,148,160,0.12)",
    color: "#9194A0",
    dot: "#9194A0",
  },
  "in-progress": {
    label: "En cours",
    bg: "rgba(123,111,255,0.14)",
    color: "#7B6FFF",
    dot: "#7B6FFF",
  },
  completed: {
    label: "Terminée",
    bg: "rgba(34,201,147,0.12)",
    color: "#22C993",
    dot: "#22C993",
  },
  missed: {
    label: "Manquée",
    bg: "rgba(239,75,75,0.12)",
    color: "#EF4B4B",
    dot: "#EF4B4B",
  },
  skipped: {
    label: "Ignorée",
    bg: "rgba(249,115,22,0.12)",
    color: "#F97316",
    dot: "#F97316",
  },
};

interface StatusPillProps {
  status: SessionStatus;
  /** Override label (defaults to French label from CONFIG) */
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
