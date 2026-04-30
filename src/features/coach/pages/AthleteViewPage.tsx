import { useState } from "react";
import { C } from "@/lib/theme";
import TodayPage from "@/features/athlete/pages/TodayPage";
import ProgramPage from "@/features/athlete/pages/ProgramPage";
import ProfilPage from "@/features/athlete/pages/ProfilPage";

const INNER_TABS = [
  { key: "today",   label: "Aujourd'hui" },
  { key: "program", label: "Programme"   },
  { key: "profil",  label: "Profil"      },
] as const;

type InnerTab = typeof INNER_TABS[number]["key"];

export default function AthleteViewPage() {
  const [tab, setTab] = useState<InnerTab>("today");

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      {/* Preview banner */}
      <div style={{
        padding: "6px 16px", background: C.acS,
        borderBottom: "1px solid " + C.ac + "30",
        fontSize: 11, color: C.ac, textAlign: "center", fontWeight: 600,
      }}>
        Aperçu — vue de l'athlète (lecture seule)
      </div>

      {/* Inner tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid " + C.brd, padding: "0 16px", overflowX: "auto" }}>
        {INNER_TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "10px 16px", border: "none", background: "transparent",
                borderBottom: "2px solid " + (active ? C.ac : "transparent"),
                color: active ? C.ac : C.tx3,
                fontSize: 12, fontWeight: active ? 600 : 400,
                cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                transition: "color 150ms, border-color 150ms",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "today"   && <TodayPage />}
      {tab === "program" && <ProgramPage />}
      {tab === "profil"  && <ProfilPage />}
    </div>
  );
}
