import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import ProfileDrawer from "./components/ProfileDrawer";
import AppFbForm from "./components/AppFbForm";
import { WellnessFlow } from "@/components/athlete/WellnessFlow";
import { NewBlockModal } from "@/components/coach/CoachComponents";
import { CombinedStatsChart } from "@/components/athlete/StatsCharts";
import BlockHistoryViewer from "@/features/coach/components/BlockHistoryViewer";
import { getBig3 } from "@/lib/calculations";

const ATH_TABS = [
  { k: "",        l: "Aujourd'hui", icon: "🏠" },
  { k: "program", l: "Programme",   icon: "📅" },
  { k: "test",    l: "Tests",       icon: "🧪" },
  { k: "alim",    l: "Nutrition",   icon: "🥗" },
  { k: "profil",  l: "Profil",      icon: "👤" },
];

interface AthleteLayoutProps {
  onSwitchMode?: () => void;
  userName?: string;
}

export default function AthleteLayout({ onSwitchMode, userName }: AthleteLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const {
    viewOnly, saveStatus, activeInjuries,
    showWellness, setShowWellness, showAppFeedback, setShowAppFeedback,
    showBilan, setShowBilan, showNewBlock, setShowNewBlock,
    weekJustCompleted, tw, milestoneNotif,
    timerActive, timerFinished, timerLeft, timerDur, timerStop,
    showBlockHistory, setShowBlockHistory, blockHistory, setBlockHistory,
    exos, sessions, prs, combinedData, totalDone,
    saveWellness, addInjury, goals, wellness, weightLog, archiveAndNewBlock,
    freeSessions,
  } = useAthleteContext();

  // Derive active tab from pathname
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1] || "";
  const activeTab = ATH_TABS.some(t => t.k === lastSegment) ? lastSegment : "";

  // Active free session for "reprendre" button
  const activeFreeSess = sessions.find(s => {
    const k = `freeSession_${s.id}`;
    return (freeSessions as Array<{ sessionKey: string; active: boolean }>).some(fs => fs.sessionKey === k && fs.active);
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* ── Sticky header ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: C.bg, borderBottom: "1px solid " + C.brd }}>
        <div style={{ padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.3px" }}>MyPrepaPro</div>
            {saveStatus && (
              <div style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: saveStatus === "saved" ? C.gS : C.rS, color: saveStatus === "saved" ? C.g : C.r }}>
                {saveStatus === "saved" ? "OK" : "Err"}
              </div>
            )}
            {activeInjuries.length > 0 && (
              <div style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: C.rS, color: C.r }}>{activeInjuries.length} bless.</div>
            )}
            {viewOnly && (
              <div style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: C.coachS, color: C.coach, border: "1px solid " + C.coach + "40" }}>Observation</div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {onSwitchMode && (
              <div style={{ display: "flex", background: C.s1, borderRadius: 8, padding: 2, border: "1px solid " + C.brdL }}>
                <button onClick={onSwitchMode} style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "transparent", color: C.tx3, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Coach</button>
                <button style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: C.ac, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", pointerEvents: "none" }}>Athlète</button>
              </div>
            )}
            <button onClick={() => setDrawerOpen(true)} title="Mon profil" style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>☰</button>
            {userName && (
              <div style={{ fontSize: 11, color: C.tx3, fontWeight: 500, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Page content (bottom-pad for fixed tabs + optional timer) ── */}
      <div style={{ flex: 1, paddingBottom: (timerActive || timerFinished) ? 120 : 64 }}>
        <Outlet />
      </div>

      {/* ── Bottom tabs ── */}
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30,
          background: C.bg, borderTop: "1px solid " + C.brd,
          display: "flex", height: 64,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {ATH_TABS.map(t => {
          const isActive = activeTab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => navigate(t.k || ".")}
              style={{
                flex: 1, border: "none", background: "transparent",
                color: isActive ? C.ac : C.tx3,
                fontSize: 9, fontWeight: isActive ? 700 : 400,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 3, minHeight: 44,
                transition: "color 150ms",
              }}
            >
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <span style={{ letterSpacing: "0.2px" }}>{t.l}</span>
            </button>
          );
        })}
      </div>

      {/* ── Timer overlay (above bottom tabs) ── */}
      {(timerActive || timerFinished) && (
        <div style={{ position: "fixed", bottom: 64, left: "50%", transform: "translateX(-50%)", zIndex: 150, background: timerFinished ? "rgba(34,201,147,0.15)" : C.s1, border: "1px solid " + (timerFinished ? C.g : timerActive && timerLeft <= 10 ? C.r : C.ac) + "70", borderRadius: 50, padding: "9px 18px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
          {timerFinished ? <span style={{ fontSize: 16 }}>🔔</span> : (
            <div style={{ width: 24, height: 24, position: "relative" }}>
              <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, transform: "rotate(-90deg)" }}>
                <circle cx="12" cy="12" r="9" fill="none" stroke={C.s2} strokeWidth="2.5" />
                <circle cx="12" cy="12" r="9" fill="none" stroke={timerLeft <= 10 ? C.r : C.ac} strokeWidth="2.5"
                  strokeDasharray={String(2 * Math.PI * 9)}
                  strokeDashoffset={String(2 * Math.PI * 9 * (1 - Math.min((timerDur - timerLeft) / timerDur, 1)))}
                  strokeLinecap="round" />
              </svg>
            </div>
          )}
          <span style={{ fontSize: 13, fontWeight: 700, color: timerFinished ? C.g : timerLeft <= 10 ? C.r : C.tx, fontFamily: "monospace", minWidth: 42 }}>
            {timerFinished ? "Repos OK !" : Math.floor(timerLeft / 60) + ":" + String(timerLeft % 60).padStart(2, "0")}
          </span>
          <button onClick={timerStop} style={{ width: 22, height: 22, borderRadius: "50%", border: "none", background: (timerFinished ? C.g : C.r) + "25", color: timerFinished ? C.g : C.r, fontSize: 14, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* ── "Reprendre" floating button ── */}
      {activeFreeSess && (
        <div style={{ position: "fixed", bottom: 64, right: 16, zIndex: 140 }}>
          <button
            onClick={() => navigate("log", { state: { initialSess: activeFreeSess } })}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 50, border: "none", background: C.coach, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}
          >
            <span style={{ fontSize: 16 }}>▶</span><span>Reprendre — {activeFreeSess.name}</span>
          </button>
        </div>
      )}

      {/* ── Milestone notif ── */}
      {milestoneNotif && (
        <div style={{ position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 250, background: C.s1, border: "1px solid " + C.g + "50", borderRadius: 14, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.g }}>Nouveau palier validé !</div>
            <div style={{ fontSize: 11, color: C.tx2 }}>Poids mis à jour : {milestoneNotif} kg</div>
          </div>
        </div>
      )}


      {/* ── Week completed overlay ── */}
      {weekJustCompleted && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.9)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.g }}>Semaine {weekJustCompleted} validée !</div>
          <div style={{ fontSize: 14, color: C.tx2 }}>{weekJustCompleted < tw ? "En route pour S" + (weekJustCompleted + 1) : "Bloc terminé !"}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {[...Array(tw)].map((_, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: i < weekJustCompleted ? C.g : C.s2 }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Bilan overlay ── */}
      {showBilan && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: C.bg, overflowY: "auto" }}>
          <div style={{ padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 800, textAlign: "center" }}>Bloc terminé !</div>
            <div style={{ fontSize: 14, color: C.tx2 }}>{totalDone} séances réalisées</div>
            <div style={{ display: "flex", gap: 12, width: "100%" }}>
              {getBig3(exos).map(({ name, label, c }: { name: string; label: string; c: string }) => {
                const pr = (prs as Record<string, { est?: string }>)[name];
                return (
                  <div key={label} style={{ flex: 1, background: C.s1, borderRadius: 14, padding: "14px 10px", textAlign: "center", border: "1px solid " + c + "30" }}>
                    <div style={{ fontSize: 11, color: C.tx3, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{pr?.est || "--"}</div>
                    <div style={{ fontSize: 9, color: C.tx3 }}>kg est.</div>
                  </div>
                );
              })}
            </div>
            <div style={{ width: "100%", background: C.s1, borderRadius: 14, padding: 16, border: "1px solid " + C.brd }}>
              <CombinedStatsChart data={combinedData as unknown[]} />
            </div>
            <button onClick={() => { setShowBilan(false); setShowNewBlock(true); }} style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "none", background: C.coach, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Nouveau bloc</button>
            <button onClick={() => setShowBilan(false)} style={{ background: "none", border: "none", color: C.tx3, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Fermer</button>
          </div>
        </div>
      )}

      {/* ── New block modal ── */}
      {showNewBlock && (
        <NewBlockModal
          onStart={archiveAndNewBlock}
          onClose={() => setShowNewBlock(false)}
          onResume={() => setShowNewBlock(false)}
          hasCurrentData={sessions.length > 0 && Object.values(exos).flat().length > 0}
          blockHistory={blockHistory}
          onDelete={idx => setBlockHistory(blockHistory.filter((_, i) => i !== idx))}
        />
      )}

      {/* ── Block history ── */}
      {showBlockHistory && (
        <BlockHistoryViewer
          blockHistory={blockHistory}
          onClose={() => setShowBlockHistory(false)}
          onDelete={idx => setBlockHistory(blockHistory.filter((_, i) => i !== idx))}
        />
      )}

      {/* ── Wellness modal ── */}
      {showWellness && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: C.bg, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid " + C.brd }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Wellness du jour</div>
            <button onClick={() => setShowWellness(false)} style={{ background: "none", border: "none", color: C.tx3, fontSize: 20, cursor: "pointer", fontFamily: "inherit" }}>×</button>
          </div>
          <WellnessFlow
            existing={wellness}
            onSave={(data) => { saveWellness(data); setShowWellness(false); }}
            sleepTarget={goals.sleepTarget}
            onAddInjury={addInjury}
            weightLog={weightLog}
          />
        </div>
      )}

      {/* ── App feedback modal ── */}
      {showAppFeedback && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: C.bg, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid " + C.brd, flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Avis sur l'app</div>
            <button onClick={() => setShowAppFeedback(false)} style={{ background: "none", border: "none", color: C.tx3, fontSize: 20, cursor: "pointer", fontFamily: "inherit" }}>×</button>
          </div>
          <AppFbForm onClose={() => setShowAppFeedback(false)} />
        </div>
      )}

      {/* ── Profile drawer ── */}
      {drawerOpen && <ProfileDrawer onClose={() => setDrawerOpen(false)} />}

      {/* ── Logout confirm ── */}
      {showLogoutConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setShowLogoutConfirm(false)}>
          <div style={{ background: C.s1, borderRadius: 16, padding: 24, maxWidth: 320, width: "100%", border: "1px solid " + C.brd }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.tx, marginBottom: 8 }}>Se déconnecter ?</div>
            <div style={{ fontSize: 13, color: C.tx3, marginBottom: 20 }}>Êtes-vous sûr de vouloir vous déconnecter ?</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowLogoutConfirm(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid " + C.brdL, background: "transparent", color: C.tx2, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
              <button onClick={async () => { const { supabase } = await import("@/integrations/supabase/client"); await supabase.auth.signOut(); window.location.href = "/login"; }} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", background: C.r, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Déconnecter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
