/**
 * ProfilSportifPage
 *
 * Gestion des références de performance d'un athlète :
 *   VMA, FCmax, FC seuil, FC repos, FTP, PMA, VO₂max, Poids
 *
 * Ces valeurs alimentent les calculs d'intensité dans SessionPreview
 * et les zones affichées sur le calendrier.
 *
 * Route : /coach/athletes/:athleteId/profil-sportif
 */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { C } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ── Metric definitions ────────────────────────────────────────────────────────

interface MetricDef {
  key: string;
  label: string;
  unit: string;
  description: string;
  min?: number;
  max?: number;
  step?: number;
  category: "cardio" | "puissance" | "vitesse" | "corpo";
}

const METRICS: MetricDef[] = [
  // Cardio
  { key: "FCmax",   label: "FC max",        unit: "bpm",       description: "Fréquence cardiaque maximale",     min: 100, max: 230, step: 1,   category: "cardio"    },
  { key: "FCseuil", label: "FC seuil",      unit: "bpm",       description: "FC au seuil lactique (~85% FCmax)", min: 80,  max: 220, step: 1,   category: "cardio"    },
  { key: "FCrepos", label: "FC repos",      unit: "bpm",       description: "Fréquence cardiaque de repos",     min: 30,  max: 100, step: 1,   category: "cardio"    },
  // Vitesse / Endurance
  { key: "VMA",     label: "VMA",           unit: "km/h",      description: "Vitesse Maximale Aérobie",          min: 8,   max: 25,  step: 0.1, category: "vitesse"   },
  { key: "VO2max",  label: "VO₂max",        unit: "mL/kg/min", description: "Consommation maximale d'oxygène",   min: 20,  max: 90,  step: 0.1, category: "vitesse"   },
  // Puissance
  { key: "FTP",     label: "FTP",           unit: "W",         description: "Functional Threshold Power (vélo)", min: 50,  max: 600, step: 5,   category: "puissance" },
  { key: "PMA",     label: "PMA",           unit: "W",         description: "Puissance Maximale Aérobie",        min: 50,  max: 900, step: 5,   category: "puissance" },
  // Corpo
  { key: "poids",   label: "Poids",         unit: "kg",        description: "Poids de référence",                min: 30,  max: 200, step: 0.1, category: "corpo"     },
];

const CATEGORY_LABEL: Record<MetricDef["category"], string> = {
  cardio:    "Cardiaque",
  vitesse:   "Vitesse / Endurance",
  puissance: "Puissance",
  corpo:     "Corporel",
};

const CATEGORY_COLOR: Record<MetricDef["category"], string> = {
  cardio:    "#EF4444",
  vitesse:   "#3B8DF0",
  puissance: "#F59E0B",
  corpo:     "#10B981",
};

// ── Zone computations ─────────────────────────────────────────────────────────

interface Zone { label: string; min: string; max: string; color: string }

function fcZones(fcmax: number, fcrep = 0): Zone[] {
  // Méthode Karvonen si FCrepos disponible, sinon % FCmax brut
  const fcr = fcrep || 0;
  const reserve = fcmax - fcr;

  function k(pct: number) {
    return fcrep ? Math.round(fcr + reserve * pct) : Math.round(fcmax * pct);
  }

  return [
    { label: "Z1 — Récupération",  min: `${k(0.50)}`, max: `${k(0.60)}`, color: "#22C55E" },
    { label: "Z2 — Endurance",     min: `${k(0.60)}`, max: `${k(0.70)}`, color: "#84CC16" },
    { label: "Z3 — Tempo",         min: `${k(0.70)}`, max: `${k(0.80)}`, color: "#EAB308" },
    { label: "Z4 — Seuil",         min: `${k(0.80)}`, max: `${k(0.90)}`, color: "#F97316" },
    { label: "Z5 — VO₂max",        min: `${k(0.90)}`, max: `${k(1.00)}`, color: "#EF4444" },
  ];
}

function vmaZones(vma: number): Zone[] {
  function kmhToPace(kmh: number) {
    if (kmh <= 0) return "—";
    const sPerKm = 3600 / kmh;
    const m = Math.floor(sPerKm / 60);
    const s = Math.round(sPerKm % 60).toString().padStart(2, "0");
    return `${m}:${s}/km`;
  }
  return [
    { label: "Z1 — Footing",      min: kmhToPace(vma * 0.65), max: kmhToPace(vma * 0.72), color: "#22C55E" },
    { label: "Z2 — Endurance",    min: kmhToPace(vma * 0.72), max: kmhToPace(vma * 0.82), color: "#84CC16" },
    { label: "Z3 — Tempo",        min: kmhToPace(vma * 0.82), max: kmhToPace(vma * 0.89), color: "#EAB308" },
    { label: "Z4 — Seuil",        min: kmhToPace(vma * 0.89), max: kmhToPace(vma * 0.95), color: "#F97316" },
    { label: "Z5 — VMA",          min: kmhToPace(vma * 0.95), max: kmhToPace(vma * 1.05), color: "#EF4444" },
  ];
}

function ftpZones(ftp: number): Zone[] {
  return [
    { label: "Z1 — Récupération", min: "< 55%",    max: `< ${Math.round(ftp * 0.55)} W`, color: "#22C55E" },
    { label: "Z2 — Endurance",    min: "55–75%",   max: `${Math.round(ftp * 0.55)}–${Math.round(ftp * 0.75)} W`, color: "#84CC16" },
    { label: "Z3 — Tempo",        min: "75–90%",   max: `${Math.round(ftp * 0.75)}–${Math.round(ftp * 0.90)} W`, color: "#EAB308" },
    { label: "Z4 — Seuil",        min: "90–105%",  max: `${Math.round(ftp * 0.90)}–${Math.round(ftp * 1.05)} W`, color: "#F97316" },
    { label: "Z5 — VO₂max",       min: "105–120%", max: `${Math.round(ftp * 1.05)}–${Math.round(ftp * 1.20)} W`, color: "#EF4444" },
  ];
}

// ── DB hook ───────────────────────────────────────────────────────────────────

type RefsMap = Record<string, { value: number; date: string; id: string }>;

function useAthleteRefs(athleteId: string) {
  return useQuery<RefsMap>({
    queryKey: ["athlete-refs-full", athleteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_logs")
        .select("id, metric_name, value, unit, date")
        .eq("athlete_id", athleteId)
        .eq("is_active_reference", true);
      if (error) throw error;
      const map: RefsMap = {};
      for (const row of data ?? []) {
        map[row.metric_name] = { value: row.value, date: row.date, id: row.id };
      }
      return map;
    },
    staleTime: 30_000,
  });
}

function useUpsertRef(athleteId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ metricName, value, unit }: { metricName: string; value: number; unit: string }) => {
      // Désactive les anciennes références actives pour cette métrique
      await supabase
        .from("performance_logs")
        .update({ is_active_reference: false })
        .eq("athlete_id", athleteId)
        .eq("metric_name", metricName)
        .eq("is_active_reference", true);

      // Insère la nouvelle valeur de référence
      const { error } = await supabase.from("performance_logs").insert({
        athlete_id: athleteId,
        metric_name: metricName,
        metric_type: "reference",
        value,
        unit,
        date: new Date().toISOString().slice(0, 10),
        is_active_reference: true,
        created_by: user?.id ?? null,
        coach_validated: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["athlete-refs-full", athleteId] });
      qc.invalidateQueries({ queryKey: ["athlete-references", athleteId] });
      toast.success("Référence mise à jour");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });
}

// ── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({
  metric,
  currentValue,
  currentDate,
  onSave,
  saving,
}: {
  metric: MetricDef;
  currentValue?: number;
  currentDate?: string;
  onSave: (value: number) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const color = CATEGORY_COLOR[metric.category];

  function handleSave() {
    const v = parseFloat(draft);
    if (isNaN(v) || v <= 0) { toast.error("Valeur invalide"); return; }
    onSave(v);
    setEditing(false);
  }

  return (
    <div style={{
      background: C.s1, border: "1px solid " + C.brd, borderRadius: 12,
      padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8,
      transition: "border-color 150ms",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = color + "50")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.brd)}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
            {metric.label}
          </div>
          <div style={{ fontSize: 10, color: C.tx3 }}>{metric.description}</div>
        </div>
        {!editing && (
          <button
            onClick={() => { setDraft(currentValue?.toString() ?? ""); setEditing(true); }}
            style={{
              padding: "3px 10px", borderRadius: 6, border: "1px solid " + C.brdL,
              background: "transparent", color: C.tx3, fontSize: 11,
              cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
            }}
          >
            {currentValue != null ? "Modifier" : "+ Saisir"}
          </button>
        )}
      </div>

      {/* Value display / edit */}
      {editing ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="number"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            min={metric.min}
            max={metric.max}
            step={metric.step ?? 1}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            style={{
              flex: 1, padding: "7px 10px", borderRadius: 8,
              border: "1px solid " + color + "60", background: C.s2,
              color: C.tx, fontSize: 14, fontWeight: 700, fontFamily: "inherit", outline: "none",
            }}
          />
          <span style={{ fontSize: 12, color: C.tx3, flexShrink: 0 }}>{metric.unit}</span>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "7px 14px", borderRadius: 8, border: "none",
              background: color, color: "#fff", fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
            }}
          >
            {saving ? "…" : "OK"}
          </button>
          <button
            onClick={() => setEditing(false)}
            style={{
              padding: "7px 10px", borderRadius: 8,
              border: "1px solid " + C.brdL, background: "transparent",
              color: C.tx3, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            ✕
          </button>
        </div>
      ) : currentValue != null ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: C.tx }}>{currentValue}</span>
          <span style={{ fontSize: 12, color: C.tx3 }}>{metric.unit}</span>
          {currentDate && (
            <span style={{ fontSize: 10, color: C.tx3, marginLeft: "auto" }}>
              Mis à jour le {new Date(currentDate + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: C.tx3, fontStyle: "italic" }}>
          Non renseigné
        </div>
      )}
    </div>
  );
}

// ── ZoneTable ─────────────────────────────────────────────────────────────────

function ZoneTable({ title, zones, unit }: { title: string; zones: Zone[]; unit: string }) {
  return (
    <div style={{ background: C.s1, border: "1px solid " + C.brd, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid " + C.brd, fontSize: 12, fontWeight: 700, color: C.tx }}>
        {title}
      </div>
      <div>
        {zones.map((z, i) => (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "9px 14px",
              borderBottom: i < zones.length - 1 ? "1px solid " + C.brd : "none",
            }}
          >
            <div style={{
              width: 4, height: 20, borderRadius: 2, background: z.color, flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, color: C.tx, fontWeight: 600, flex: 1 }}>{z.label}</span>
            <span style={{ fontSize: 11, color: C.tx3 }}>{z.min}</span>
            <span style={{ fontSize: 11, color: C.tx3 }}>→</span>
            <span style={{ fontSize: 11, color: C.tx2, fontWeight: 600, minWidth: 80, textAlign: "right" }}>
              {z.max} {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilSportifPage() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const { data: refs = {}, isLoading } = useAthleteRefs(athleteId!);
  const upsert = useUpsertRef(athleteId!);

  const categories = (["cardio", "vitesse", "puissance", "corpo"] as const);

  const fcmax  = refs["FCmax"]?.value;
  const fcrep  = refs["FCrepos"]?.value;
  const vma    = refs["VMA"]?.value;
  const ftp    = refs["FTP"]?.value;

  const hasZones = fcmax || vma || ftp;

  return (
    <div style={{ padding: "0 24px 60px", maxWidth: 900, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.tx }}>Profil sportif</div>
        <div style={{ fontSize: 12, color: C.tx3, marginTop: 4 }}>
          Références de performance actives — alimentent les calculs de zones et de l'éditeur de séances.
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ height: 90, background: C.s1, borderRadius: 12, border: "1px solid " + C.brd }} />
          ))}
        </div>
      ) : (
        <>
          {/* ── Metrics grid by category ── */}
          {categories.map((cat) => {
            const metricsInCat = METRICS.filter((m) => m.category === cat);
            return (
              <div key={cat} style={{ marginBottom: 28 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: CATEGORY_COLOR[cat],
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  marginBottom: 10, display: "flex", alignItems: "center", gap: 8,
                }}>
                  <div style={{ width: 24, height: 2, background: CATEGORY_COLOR[cat], borderRadius: 1 }} />
                  {CATEGORY_LABEL[cat]}
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 10,
                }}>
                  {metricsInCat.map((metric) => (
                    <MetricCard
                      key={metric.key}
                      metric={metric}
                      currentValue={refs[metric.key]?.value}
                      currentDate={refs[metric.key]?.date}
                      onSave={(value) => upsert.mutate({ metricName: metric.key, value, unit: metric.unit })}
                      saving={upsert.isPending}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* ── Zones calculées ── */}
          {hasZones && (
            <div style={{ marginTop: 8 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: C.tx3,
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <div style={{ width: 24, height: 2, background: C.tx3, borderRadius: 1 }} />
                Zones calculées
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12,
              }}>
                {fcmax && (
                  <ZoneTable
                    title={`Zones FC — FCmax ${fcmax} bpm${fcrep ? ` · repos ${fcrep} bpm` : ""}`}
                    zones={fcZones(fcmax, fcrep)}
                    unit="bpm"
                  />
                )}
                {vma && (
                  <ZoneTable
                    title={`Zones allure — VMA ${vma} km/h`}
                    zones={vmaZones(vma)}
                    unit=""
                  />
                )}
                {ftp && (
                  <ZoneTable
                    title={`Zones puissance — FTP ${ftp} W`}
                    zones={ftpZones(ftp)}
                    unit=""
                  />
                )}
              </div>

              <div style={{
                marginTop: 12, padding: "10px 14px", borderRadius: 10,
                background: C.ac + "10", border: "1px solid " + C.ac + "30",
                fontSize: 11, color: C.tx2,
              }}>
                💡 Ces zones s'appliquent automatiquement dans l'aperçu des séances énergétiques
                et dans le calendrier de planification.
              </div>
            </div>
          )}

          {/* Empty state */}
          {!hasZones && Object.keys(refs).length === 0 && (
            <div style={{
              textAlign: "center", padding: "40px 20px", color: C.tx3,
              background: C.s1, borderRadius: 14, border: "1px solid " + C.brd, marginTop: 8,
            }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.tx2, marginBottom: 6 }}>
                Aucune donnée de référence
              </div>
              <div style={{ fontSize: 12 }}>
                Renseigne les valeurs ci-dessus pour activer les calculs de zones.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
