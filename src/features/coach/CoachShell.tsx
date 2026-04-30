import { useLocation, useNavigate, Outlet } from "react-router-dom";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { C } from "@/lib/theme";
import { CommandPaletteProvider } from "./context/CommandPaletteContext";
import { CommandPalette } from "./components/CommandPalette";
import { useCommandPalette } from "./context/CommandPaletteContext";
import { Search } from "lucide-react";

// ── Navigation items ──────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: "🏠", label: "Home",       path: "/coach",          exact: true,  certified: false },
  { icon: "👥", label: "Athlètes",   path: "/coach/athletes", exact: false, certified: false },
  { icon: "📚", label: "Banque",     path: "/coach/library",  exact: false, certified: false },
  { icon: "🧪", label: "Tests",      path: "/coach/tests",    exact: false, certified: false },
  { icon: "🎖️", label: "Coachs",    path: "/coach/coaches",  exact: false, certified: true  },
  { icon: "⚙️", label: "Paramètres", path: "/coach/settings", exact: false, certified: false },
] as const;

// ── Sidebar styles (CSS vars overridden via inline style on provider) ─────────

const SIDEBAR_STYLE: React.CSSProperties = {
  "--sidebar-width": "240px",
  "--sidebar-width-icon": "64px",
  "--sidebar-background": "#1D1C1E",
  "--sidebar-foreground": "#7C7480",
  "--sidebar-border": "rgba(124,116,128,0.2)",
  "--sidebar-accent": "rgba(168,85,247,0.1)",
  "--sidebar-accent-foreground": "#A855F7",
  "--sidebar-ring": "#A855F7",
} as React.CSSProperties;

// ── CoachShell ────────────────────────────────────────────────────────────────

function CoachShellInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, logout } = useAuth();
  const { toggle } = useCommandPalette();

  function isActive(path: string, exact: boolean) {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  }

  return (
    <SidebarProvider defaultOpen={typeof window !== "undefined" ? window.innerWidth > 1024 : true} style={SIDEBAR_STYLE}>
      {/* ── Sidebar ── */}
      <Sidebar
        collapsible="icon"
        style={{ background: "#1D1C1E", borderRight: "1px solid rgba(124,116,128,0.2)" }}
      >
        {/* Logo */}
        <SidebarHeader style={{ padding: "16px 14px 12px", borderBottom: "1px solid rgba(124,116,128,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: C.ac + "20", border: "1px solid " + C.ac + "40",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 800, color: C.ac, flexShrink: 0,
              }}
            >
              M
            </div>
            <span
              className="group-data-[collapsible=icon]:hidden"
              style={{ fontSize: 13, fontWeight: 700, color: C.tx, letterSpacing: "-0.3px" }}
            >
              MyPrepaPro
            </span>
          </div>
        </SidebarHeader>

        {/* Search button — opens command palette */}
        <div className="group-data-[collapsible=icon]:hidden" style={{ padding: "8px 10px 4px" }}>
          <button
            onClick={toggle}
            className="coach-sidebar-search"
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8,
              padding: "7px 10px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: C.tx3, fontSize: 12, cursor: "pointer",
              fontFamily: "inherit", transition: "border-color 150ms ease-out",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = C.ac + "60")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)")}
          >
            <Search size={13} style={{ flexShrink: 0 }} />
            <span className="coach-sidebar-label" style={{ flex: 1, textAlign: "left" }}>
              Rechercher…
            </span>
            <span className="coach-sidebar-label" style={{ fontSize: 10, opacity: 0.5, letterSpacing: "0.02em" }}>
              ⌘K
            </span>
          </button>
        </div>

        {/* Nav items */}
        <SidebarContent style={{ padding: "8px 0" }}>
          <SidebarMenu>
            {NAV_ITEMS.filter(item => !item.certified || profile?.is_certified_coach).map((item) => {
              const active = isActive(item.path, item.exact);
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={active}
                    onClick={() => navigate(item.path)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 14px",
                      borderRadius: 0,
                      borderLeft: "2px solid " + (active ? C.ac : "transparent"),
                      background: active ? "rgba(168,85,247,0.1)" : "transparent",
                      color: active ? C.ac : C.tx2,
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      cursor: "pointer",
                      width: "100%",
                      transition: "all 150ms",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.color = C.tx;
                    }}
                    onMouseLeave={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.color = C.tx2;
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                    <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        {/* Footer — coach profile */}
        <SidebarFooter style={{ padding: "12px 14px", borderTop: "1px solid rgba(124,116,128,0.2)" }}>
          <SidebarSeparator style={{ marginBottom: 10, background: C.brd }} />

          <div
            className="group-data-[collapsible=icon]:hidden"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <div
              style={{
                width: 28, height: 28, borderRadius: "50%",
                background: C.coach + "25", border: "1px solid " + C.coach + "40",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: C.coach, flexShrink: 0,
              }}
            >
              {(profile?.full_name || "?").charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12, fontWeight: 600, color: C.tx,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {profile?.full_name || "Coach"}
              </div>
              <button
                onClick={logout}
                style={{
                  fontSize: 10, color: C.tx3, background: "none", border: "none",
                  cursor: "pointer", fontFamily: "inherit", padding: 0,
                  transition: "color 150ms",
                }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.color = C.r)}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.color = C.tx3)}
              >
                Déconnexion
              </button>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* ── Main content ── */}
      <SidebarInset style={{ background: C.bg, display: "flex", flexDirection: "column" }}>
        {/* Topbar with trigger */}
        <div
          style={{
            position: "sticky", top: 0, zIndex: 10,
            background: C.s1, borderBottom: "1px solid " + C.brd,
            padding: "8px 16px", display: "flex", alignItems: "center", gap: 8,
            flexShrink: 0, minHeight: 45,
          }}
        >
          <SidebarTrigger
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: "1px solid " + C.brdL, background: "transparent",
              color: C.tx3, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 14,
            }}
          />
          {/* Cmd+K button in topbar */}
          <button
            onClick={toggle}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: C.tx3, fontSize: 12, cursor: "pointer",
              fontFamily: "inherit", transition: "border-color 150ms ease-out",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = C.ac + "60")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)")}
          >
            <Search size={12} />
            <span>Rechercher</span>
            <kbd style={{ fontSize: 10, opacity: 0.5, marginLeft: 2, fontFamily: "inherit" }}>⌘K</kbd>
          </button>
          {/* Mode switch — visible pour coach et coach_athlete */}
          {(profile?.role === "coach_athlete" || profile?.role === "coach") && (
            <button
              onClick={() => navigate("/athlete")}
              style={{
                marginLeft: "auto",
                padding: "5px 12px", borderRadius: 20,
                border: "1px solid " + C.coach + "40",
                background: C.coach + "15", color: C.coach,
                fontSize: 11, fontWeight: 700, cursor: "pointer",
                fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5,
                transition: "background 150ms", whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = C.coach + "28")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = C.coach + "15")}
            >
              🏃 Mode Athlète
            </button>
          )}
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <Outlet />
        </div>
      </SidebarInset>

      {/* Command palette (coach-only) */}
      <CommandPalette />

    </SidebarProvider>
  );
}

export default function CoachShell() {
  return (
    <CommandPaletteProvider>
      <CoachShellInner />
    </CommandPaletteProvider>
  );
}
