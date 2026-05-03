import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { C } from "@/lib/theme";
import { useAuth } from "@/hooks/useAuth";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ExerciseBank } from "@/components/coach/ExerciseBank";
import { useEnergySessions } from "@/features/shared/hooks/useEnergySessions";
import EnergySessionCard from "@/features/coach/components/energy/EnergySessionCard";
import type { SessionKind } from "@/types/energy";

// ── Sub-tab types ─────────────────────────────────────────────────────────────

type LibTab = "musculaire" | "energetique" | "specifique";

const TABS: { key: LibTab; label: string; icon: string }[] = [
  { key: "musculaire",  label: "Musculaire",  icon: "🏋️" },
  { key: "energetique", label: "Énergétique", icon: "⚡" },
  { key: "specifique",  label: "Spécifique",  icon: "🎯" },
];

// ── Energy sub-tab constants ──────────────────────────────────────────────────

type FilterTab = "all" | "mine" | "verified";

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all",      label: "Toutes" },
  { value: "mine",     label: "Mes séances" },
  { value: "verified", label: "Vérifiées" },
];

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "all",     label: "Tous les types" },
  { value: "vo2",     label: "VO₂max / VMA" },
  { value: "tempo",   label: "Tempo" },
  { value: "seuil",   label: "Seuil lactique" },
  { value: "footing", label: "Footing" },
  { value: "fartlek", label: "Fartlek" },
  { value: "autre",   label: "Autres" },
  { value: "custom",  label: "Personnalisé" },
];

// ── Energy skeleton ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ height: 3, background: C.s2 }} />
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ height: 13, width: "60%", background: C.s2, borderRadius: 4 }} />
        <div style={{ height: 9,  width: "30%", background: C.s2, borderRadius: 4 }} />
        <div style={{ height: 120, background: C.s2, borderRadius: 6 }} />
        <div style={{ height: 10, width: "40%", background: C.s2, borderRadius: 4 }} />
      </div>
    </div>
  );
}

// ── Energy tab ────────────────────────────────────────────────────────────────

function EnergyTab() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [kindFilter, setKind]     = useState("all");
  const [search, setSearch]       = useState("");

  const { data: sessions = [], isLoading } = useEnergySessions();
  const canVerify = !!(profile?.is_certified_coach || profile?.is_admin);

  const filtered = useMemo(() => {
    let list = sessions;
    if (filterTab === "mine" && profile?.id) {
      list = list.filter((s) => s.created_by === profile.id);
    } else if (filterTab === "verified") {
      list = list.filter((s) => s.is_verified);
    }
    if (kindFilter !== "all") list = list.filter((s) => s.session_kind === (kindFilter as SessionKind));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }
    return list;
  }, [sessions, filterTab, kindFilter, search, profile?.id]);

  return (
    <div>
      {/* Filters row */}
      <div style={{
        display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
        padding: "14px 0 16px",
        borderBottom: `1px solid ${C.brd}`,
        marginBottom: 20,
      }}>
        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 2, background: C.s2, borderRadius: 8, padding: 2 }}>
          {FILTER_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilterTab(t.value)}
              style={{
                padding: "5px 12px", borderRadius: 6, border: "none",
                background: filterTab === t.value ? C.ac : "transparent",
                color: filterTab === t.value ? "#fff" : C.tx3,
                fontSize: 12, fontWeight: filterTab === t.value ? 600 : 400,
                cursor: "pointer", fontFamily: "inherit", transition: "all 120ms",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Kind select */}
        <Select value={kindFilter} onValueChange={setKind}>
          <SelectTrigger style={{
            width: 160, background: C.s2, border: `1px solid ${C.brd}`,
            color: C.tx, fontSize: 12, height: 32,
          }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KIND_OPTIONS.map((k) => (
              <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…"
          style={{
            flex: 1, minWidth: 140, maxWidth: 260,
            background: C.s2, border: `1px solid ${C.brd}`,
            borderRadius: 6, color: C.tx, fontSize: 12,
            padding: "5px 10px", fontFamily: "inherit", outline: "none",
          }}
        />

        {!isLoading && (
          <span style={{ fontSize: 11, color: C.tx3, whiteSpace: "nowrap" }}>
            {filtered.length} séance{filtered.length !== 1 ? "s" : ""}
          </span>
        )}

        <button
          onClick={() => navigate("/coach/energy-library/new")}
          style={{
            marginLeft: "auto", padding: "7px 14px", borderRadius: 8, border: "none",
            background: C.ac, color: "#fff", fontSize: 12,
            fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
          }}
        >
          + Nouvelle séance
        </button>
      </div>

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 16,
        alignItems: "start",
      }}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : filtered.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 20px", color: C.tx3 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.tx2, marginBottom: 6 }}>Aucune séance</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>Créez la première séance de la banque énergétique.</div>
            <button
              onClick={() => navigate("/coach/energy-library/new")}
              style={{
                padding: "9px 20px", borderRadius: 8, border: "none",
                background: C.ac, color: "#fff", fontSize: 13,
                fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              + Nouvelle séance
            </button>
          </div>
        ) : (
          filtered.map((session) => {
            const isAuthor = session.created_by === profile?.id;
            const isAdmin  = !!profile?.is_admin;
            return (
              <EnergySessionCard
                key={session.id}
                session={session}
                canEdit={isAuthor || isAdmin}
                canVerify={canVerify}
                canDelete={isAuthor || isAdmin}
                canPublish={isAuthor || isAdmin || canVerify}
                userId={profile?.id}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Specific tab placeholder ──────────────────────────────────────────────────

function SpecifiqueTab() {
  return (
    <div style={{ textAlign: "center", padding: "80px 20px", color: C.tx3 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.tx2, marginBottom: 6 }}>
        Exercices spécifiques
      </div>
      <div style={{ fontSize: 13 }}>Bientôt disponible.</div>
    </div>
  );
}

// ── LibraryPage ───────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const tabParam = searchParams.get("tab") as LibTab | null;
  const activeTab: LibTab = TABS.some((t) => t.key === tabParam) ? (tabParam as LibTab) : "musculaire";

  function setTab(key: LibTab) {
    setSearchParams({ tab: key }, { replace: true });
  }

  if (!user) return null;

  return (
    <div style={{ padding: "0 24px 60px" }}>

      {/* Sub-tabs */}
      <div
        style={{
          display: "flex", gap: 0,
          borderBottom: `1px solid ${C.brd}`,
          marginBottom: 0,
          paddingTop: 16,
        }}
      >
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "8px 18px", border: "none", background: "transparent",
              color: activeTab === key ? C.ac : C.tx3,
              fontSize: 13, fontWeight: activeTab === key ? 700 : 400,
              cursor: "pointer", fontFamily: "inherit",
              borderBottom: "2px solid " + (activeTab === key ? C.ac : "transparent"),
              display: "flex", alignItems: "center", gap: 6,
              transition: "color 150ms",
            }}
          >
            <span style={{ fontSize: 15 }}>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ paddingTop: 20 }}>
        {activeTab === "musculaire"  && <ExerciseBank coachId={user.id} onAddToExos={undefined} />}
        {activeTab === "energetique" && <EnergyTab />}
        {activeTab === "specifique"  && <SpecifiqueTab />}
      </div>
    </div>
  );
}
