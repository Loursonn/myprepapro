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

// ── Navigation items ──────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: "🏠", label: "Home",       path: "/coach",          exact: true  },
  { icon: "👥", label: "Athlètes",   path: "/coach/athletes", exact: false },
  { icon: "📚", label: "Banque",     path: "/coach/library",  exact: false },
  { icon: "🧪", label: "Tests",      path: "/coach/tests",    exact: false },
  { icon: "⚙️", label: "Paramètres", path: "/coach/settings", exact: false },
] as const;

// ── Sidebar styles (CSS vars overridden via inline style on provider) ─────────

const SIDEBAR_STYLE: React.CSSProperties = {
  "--sidebar-width": "240px",
  "--sidebar-width-icon": "64px",
  "--sidebar-background": "#0A0B0F",
  "--sidebar-foreground": "#9194A0",
  "--sidebar-border": "#1A1B22",
  "--sidebar-accent": "rgba(123,111,255,0.1)",
  "--sidebar-accent-foreground": "#7B6FFF",
  "--sidebar-ring": "#7B6FFF",
} as React.CSSProperties;

// ── CoachShell ────────────────────────────────────────────────────────────────

export default function CoachShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, logout } = useAuth();

  function isActive(path: string, exact: boolean) {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  }

  return (
    <SidebarProvider style={SIDEBAR_STYLE}>
      {/* ── Sidebar ── */}
      <Sidebar
        collapsible="icon"
        style={{ background: "#0A0B0F", borderRight: "1px solid #1A1B22" }}
      >
        {/* Logo */}
        <SidebarHeader style={{ padding: "16px 14px 12px", borderBottom: "1px solid #1A1B22" }}>
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
              className="coach-sidebar-label"
              style={{ fontSize: 13, fontWeight: 700, color: C.tx, letterSpacing: "-0.3px" }}
            >
              MyPrepaPro
            </span>
          </div>
        </SidebarHeader>

        {/* Nav items */}
        <SidebarContent style={{ padding: "8px 0" }}>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => {
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
                      background: active ? "rgba(123,111,255,0.1)" : "transparent",
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
                    <span className="coach-sidebar-label">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        {/* Footer — coach profile */}
        <SidebarFooter style={{ padding: "12px 14px", borderTop: "1px solid #1A1B22" }}>
          <SidebarSeparator style={{ marginBottom: 10, background: "#1A1B22" }} />
          <div
            className="coach-sidebar-label"
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
            background: C.bg, borderBottom: "1px solid " + C.brd,
            padding: "8px 16px", display: "flex", alignItems: "center", gap: 8,
            flexShrink: 0,
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
          {/* Breadcrumb filled by outlet pages via portal or passed via context — kept simple */}
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <Outlet />
        </div>
      </SidebarInset>

      {/* Responsive sidebar label hiding */}
      <style>{`
        @media (max-width: 1024px) { .coach-sidebar-label { display: none; } }
        @media (max-width: 1024px) { [data-sidebar="sidebar"] { width: var(--sidebar-width-icon) !important; } }
      `}</style>
    </SidebarProvider>
  );
}
