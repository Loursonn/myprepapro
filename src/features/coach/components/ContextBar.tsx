import { useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSelectedAthlete } from "@/features/coach/context/SelectedAthleteContext";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { C } from "@/lib/theme";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// ── Secondary tabs ─────────────────────────────────────────────────────────────

const TABS = [
  { key: "planning",      label: "Planning"      },
  { key: "programmation", label: "Programmation" },
  { key: "stats",         label: "Stats"         },
  { key: "donnees",       label: "Données"       },
  { key: "retours",       label: "Retours"       },
  { key: "tests",         label: "Tests"         },
] as const;

// ── Component ──────────────────────────────────────────────────────────────────

export default function ContextBar() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { athletes, user, profile } = useAuth();
  const { selectedAthlete } = useSelectedAthlete();
  const { blockConfig, currentWeek, tw } = useAthleteContext();
  const [comboOpen, setComboOpen] = useState(false);

  // Active tab derived from URL segment
  const segments = location.pathname.split("/");
  const activeTab = TABS.find((t) => segments.includes(t.key))?.key ?? "planning";

  function goTab(key: string) {
    navigate(`/coach/athletes/${athleteId}/${key}`);
  }

  // Initials from name
  const fullName =
    selectedAthlete
      ? ([selectedAthlete.first_name, selectedAthlete.last_name].filter(Boolean).join(" ") ||
         selectedAthlete.full_name || "?")
      : "Athlète";
  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Athlete list for combobox (own profile + athletes)
  const isCoachAthlete = profile?.role === "coach" || profile?.role === "coach_athlete";
  const allOptions = [
    ...(isCoachAthlete && profile ? [profile] : []),
    ...athletes,
  ];

  return (
    <div
      style={{
        position: "sticky",
        top: 45, // below the topbar (45px height)
        zIndex: 9,
        background: "rgba(29,28,30,0.9)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid " + C.brd,
        flexShrink: 0,
      }}
    >
      {/* Athlete info row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 20px",
          borderBottom: "1px solid " + C.brd,
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 34, height: 34, borderRadius: "50%",
            background: C.coach + "25", border: "1px solid " + C.coach + "40",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800, color: C.coach, flexShrink: 0,
          }}
        >
          {initials}
        </div>

        {/* Name + bloc info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13, fontWeight: 700, color: C.tx,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {fullName}
            {selectedAthlete?.id === user?.id && (
              <span style={{ fontSize: 10, color: C.ac, marginLeft: 6, fontWeight: 500 }}>(moi)</span>
            )}
          </div>
          {blockConfig?.blockName && (
            <div style={{ fontSize: 10, color: C.tx3, marginTop: 1 }}>
              {blockConfig.blockName} · S{currentWeek}/{tw}
            </div>
          )}
        </div>

        {/* Changer d'athlète — combobox */}
        <Popover open={comboOpen} onOpenChange={setComboOpen}>
          <PopoverTrigger asChild>
            <button
              style={{
                padding: "5px 12px", borderRadius: 8,
                border: "1px solid " + C.brdL, background: "transparent",
                color: C.tx2, fontSize: 11, fontWeight: 500,
                cursor: "pointer", fontFamily: "inherit",
                transition: "border-color 150ms, color 150ms",
                flexShrink: 0,
              }}
            >
              Changer ›
            </button>
          </PopoverTrigger>
          <PopoverContent
            style={{
              width: 260, padding: 0,
              background: C.s1, border: "1px solid " + C.brdL,
              borderRadius: 12, overflow: "hidden",
            }}
          >
            <Command style={{ background: "transparent" }}>
              <CommandInput
                placeholder="Rechercher un athlète…"
                style={{ color: C.tx, fontSize: 12 }}
              />
              <CommandList>
                <CommandEmpty style={{ color: C.tx3, fontSize: 12, padding: "12px 16px" }}>
                  Aucun athlète trouvé.
                </CommandEmpty>
                <CommandGroup>
                  {allOptions.map((a) => (
                    <CommandItem
                      key={a.id}
                      value={a.full_name}
                      onSelect={() => {
                        setComboOpen(false);
                        navigate(`/coach/athletes/${a.id}/planning`);
                      }}
                      style={{
                        cursor: "pointer",
                        background: a.id === athleteId ? "rgba(168,85,247,0.12)" : "transparent",
                        color: a.id === athleteId ? C.ac : C.tx,
                        fontSize: 12,
                        padding: "8px 12px",
                      }}
                    >
                      <span
                        style={{
                          width: 24, height: 24, borderRadius: "50%",
                          background: C.coach + "25",
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 700, color: C.coach,
                          marginRight: 8, flexShrink: 0,
                        }}
                      >
                        {a.full_name.charAt(0).toUpperCase()}
                      </span>
                      {a.full_name}
                      {a.id === athleteId && (
                        <span style={{ marginLeft: "auto", color: C.ac, fontSize: 11 }}>✓</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Secondary tabs */}
      <div
        style={{
          display: "flex",
          padding: "0 20px",
          gap: 0,
          overflowX: "auto",
        }}
      >
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              onClick={() => goTab(tab.key)}
              style={{
                padding: "10px 14px",
                border: "none",
                borderBottom: "2px solid " + (active ? C.coach : "transparent"),
                background: "transparent",
                color: active ? C.tx : C.tx3,
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                transition: "color 150ms, border-color 150ms",
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.color = "#e0e0e0";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.color = C.tx3;
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
