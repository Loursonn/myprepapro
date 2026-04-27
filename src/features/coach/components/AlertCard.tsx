import { C } from "@/lib/theme";
import { Skeleton } from "@/components/ui/skeleton";

export type AlertVariant = "danger" | "warning" | "success" | "coach";

const VARIANT_COLORS: Record<AlertVariant, string> = {
  danger:  "rgb(239,68,68)",   // surcharge / séance manquée
  warning: "#F5A623",          // attention
  success: "#22C993",          // positif
  coach:   "#D4538E",          // compétition priorité A
};

interface AlertRow {
  id: string;
  label: string;
  sublabel?: string;
  onClick?: () => void;
}

interface AlertCardProps {
  icon: string;
  title: string;
  rows: AlertRow[];
  variant?: AlertVariant;
  loading?: boolean;
  emptyMessage?: string;
  /** Action button shown at card level */
  action?: { label: string; onClick: () => void };
}

/**
 * Alert card for "À traiter" / "À venir" sections.
 * Border-left 3px colored by variant.
 */
export function AlertCard({
  icon, title, rows, variant = "warning", loading = false, emptyMessage, action,
}: AlertCardProps) {
  const accent = VARIANT_COLORS[variant];

  return (
    <div
      style={{
        background: "#0F1014",
        border: "1px solid #1A1B22",
        borderLeft: `3px solid ${accent}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid " + C.brd,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15 }}>{icon}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.tx }}>{title}</span>
          {!loading && rows.length > 0 && (
            <span
              style={{
                fontSize: 10, fontWeight: 700,
                background: accent + "25",
                color: accent,
                borderRadius: 20, padding: "1px 7px",
              }}
            >
              {rows.length}
            </span>
          )}
        </div>
        {action && (
          <button
            onClick={action.onClick}
            style={{
              fontSize: 11, fontWeight: 600, color: accent,
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "inherit", padding: 0,
              transition: "opacity 150ms",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.7")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
          >
            {action.label}
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "6px 0" }}>
        {loading ? (
          <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            <Skeleton style={{ height: 36, borderRadius: 6, background: C.s2 }} />
            <Skeleton style={{ height: 36, borderRadius: 6, background: C.s2 }} />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "16px", fontSize: 12, color: C.tx3, textAlign: "center" }}>
            {emptyMessage ?? "Rien à signaler 👌"}
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              onClick={row.onClick}
              style={{
                padding: "10px 16px",
                cursor: row.onClick ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                borderBottom: "1px solid " + C.brd,
                transition: "background 150ms",
              }}
              onMouseEnter={(e) => {
                if (row.onClick) (e.currentTarget as HTMLElement).style.background = C.s1;
              }}
              onMouseLeave={(e) => {
                if (row.onClick) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.label}
                </div>
                {row.sublabel && (
                  <div style={{ fontSize: 10, color: C.tx3, marginTop: 1 }}>{row.sublabel}</div>
                )}
              </div>
              {row.onClick && (
                <span style={{ fontSize: 14, color: C.tx3, flexShrink: 0 }}>›</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
