import { useState } from "react";
import { format, parseISO, differenceInWeeks, addWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { C } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Mesocycle } from "../hooks/useTimelineData";

// ── Volume chart helpers ───────────────────────────────────────────────────────

function buildVolumeData(meso: Mesocycle) {
  const numWeeks = Math.max(
    1,
    differenceInWeeks(parseISO(meso.end_date), parseISO(meso.start_date)) + 1,
  );
  const deload = meso.deload_week ?? 0;

  // If explicit weeks config from DB use it
  if (meso.volume_config?.weeks?.length) {
    return meso.volume_config.weeks.map((v, i) => ({
      week: `S${i + 1}`,
      volume: v,
      isDeload: i + 1 === deload,
    }));
  }

  // Otherwise generate from type
  const type = meso.volume_config?.type ?? "progressive";
  const base  = 65;
  return Array.from({ length: numWeeks }, (_, i) => {
    const w = i + 1;
    const isDeload = w === deload;
    let volume = base;
    if (type === "progressive")     volume = isDeload ? 50 : base + i * (30 / Math.max(numWeeks - 1, 1));
    else if (type === "ondulant")    volume = isDeload ? 50 : base + (i % 2 === 0 ? 0 : 15);
    else if (type === "constant")    volume = isDeload ? 50 : base;
    else if (type === "polarize")    volume = isDeload ? 50 : i % 2 === 0 ? 45 : 90;
    return { week: `S${w}`, volume: Math.round(volume), isDeload };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  meso:       Mesocycle;
  athleteId:  string;
  rangeStart: string;
  rangeEnd:   string;
}

const VOLUME_TYPES = [
  { value: "progressive", label: "Progressif" },
  { value: "ondulant",    label: "Ondulant"   },
  { value: "plateau",     label: "Plateau"    },
  { value: "polarize",    label: "Polarisé"   },
];
const ZONES = ["Z1", "Z2", "Z3", "Z4", "Z5"] as const;

export function MesocycleDrawer({ meso, athleteId, rangeStart, rangeEnd }: Props) {
  const qc = useQueryClient();

  const [volumeType,   setVolumeType]   = useState(meso.volume_config?.type ?? "progressive");
  const [zones,        setZones]        = useState<string[]>(meso.intensity_config?.zones ?? []);
  const [frequency,    setFrequency]    = useState(meso.frequency ?? 3);
  const [deloadWeek,   setDeloadWeek]   = useState(meso.deload_week ?? 4);
  const [saving,       setSaving]       = useState(false);
  const [editingDates, setEditingDates] = useState(false);
  const [startDate,    setStartDate]    = useState(meso.start_date);
  const [endDate,      setEndDate]      = useState(meso.end_date);
  const [savingDates,  setSavingDates]  = useState(false);

  const numWeeks = Math.max(1, differenceInWeeks(parseISO(meso.end_date), parseISO(meso.start_date)) + 1);

  // Build chart data with current local state
  const chartData = buildVolumeData({
    ...meso,
    volume_config: { type: volumeType },
    deload_week:   deloadWeek,
  });

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("mesocycles")
      .update({
        volume_config:    { type: volumeType },
        intensity_config: { zones },
        frequency,
        deload_week:      deloadWeek,
      })
      .eq("id", meso.id);
    setSaving(false);
    if (error) { toast.error("Erreur"); return; }
    qc.invalidateQueries({ queryKey: ["timeline-data",    athleteId] });
    qc.invalidateQueries({ queryKey: ["planning-summary", athleteId] });
    toast.success("Mésocycle mis à jour");
  }

  async function saveDates() {
    if (!startDate || !endDate || startDate >= endDate) { toast.error("Dates invalides"); return; }
    setSavingDates(true);
    const { error } = await supabase
      .from("mesocycles")
      .update({ start_date: startDate, end_date: endDate })
      .eq("id", meso.id);
    setSavingDates(false);
    if (error) { toast.error("Erreur"); return; }
    qc.invalidateQueries({ queryKey: ["timeline-data",    athleteId] });
    qc.invalidateQueries({ queryKey: ["planning-summary", athleteId] });
    setEditingDates(false);
    toast.success("Dates mises à jour");
  }

  const numWeeksLocal = Math.max(1, differenceInWeeks(parseISO(endDate), parseISO(startDate)) + 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Dates */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px" }}>Dates</span>
          <button
            onClick={() => editingDates ? saveDates() : setEditingDates(true)}
            disabled={savingDates}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, border: "1px solid " + (editingDates ? C.g + "60" : C.brdL), background: editingDates ? C.gS : "transparent", color: editingDates ? C.g : C.tx3, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            {editingDates ? <><Check size={11} />{savingDates ? "…" : "Enregistrer"}</> : <><Edit3 size={11} />Modifier</>}
          </button>
        </div>
        {editingDates ? (
          <div style={{ display: "flex", gap: 8 }}>
            {[{ label: "Début", val: startDate, set: setStartDate }, { label: "Fin", val: endDate, set: setEndDate }].map(({ label, val, set }) => (
              <div key={label} style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: C.tx3, marginBottom: 4 }}>{label}</div>
                <input type="date" value={val} onChange={(e) => set(e.target.value)} style={{ width: "100%", padding: "7px 9px", borderRadius: 8, border: "1px solid " + C.coach + "60", background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "Début", val: format(parseISO(startDate), "d MMM", { locale: fr }) },
              { label: "Fin",   val: format(parseISO(endDate),   "d MMM", { locale: fr }) },
              { label: "Durée", val: `${numWeeksLocal} sem.` },
            ].map(({ label, val }) => (
              <div key={label} style={{ flex: 1, background: C.s2, borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 9, color: C.tx3 }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.tx }}>{val}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Volume type */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>Volume</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {VOLUME_TYPES.map(({ value, label }) => (
            <button key={value} onClick={() => setVolumeType(value)} style={{ padding: "5px 11px", borderRadius: 8, border: "1px solid " + (volumeType === value ? C.coach + "60" : C.brdL), background: volumeType === value ? C.coachS : "transparent", color: volumeType === value ? C.coach : C.tx3, fontSize: 11, fontWeight: volumeType === value ? 700 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 120ms" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Volume preview chart */}
      <div style={{ height: 130 }}>
        <div style={{ fontSize: 9, color: C.tx3, marginBottom: 6 }}>Charge planifiée (%)</div>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 0, right: 4, left: -24, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke={C.brd} vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 8, fill: C.tx3 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: C.tx3 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: C.s2, border: "1px solid " + C.brd, borderRadius: 6, fontSize: 10 }}
              labelStyle={{ color: C.tx3 }}
              itemStyle={{ color: C.coach }}
              formatter={(v: number) => [`${v}%`, "Volume"]}
            />
            <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.isDeload ? C.b : C.coach} opacity={entry.isDeload ? 0.5 : 0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Intensity zones */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>Zones d'intensité</div>
        <div style={{ display: "flex", gap: 5 }}>
          {ZONES.map((z) => {
            const active = zones.includes(z);
            return (
              <button key={z} onClick={() => setZones((p) => active ? p.filter((x) => x !== z) : [...p, z])} style={{ width: 40, height: 34, borderRadius: 8, border: "1px solid " + (active ? C.ac + "60" : C.brdL), background: active ? C.acS : "transparent", color: active ? C.ac : C.tx3, fontSize: 11, fontWeight: active ? 700 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 120ms" }}>
                {z}
              </button>
            );
          })}
        </div>
      </div>

      {/* Frequency */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>
          Fréquence — {frequency} séances/sem
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button key={n} onClick={() => setFrequency(n)} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid " + (frequency === n ? C.ac + "60" : C.brdL), background: frequency === n ? C.acS : "transparent", color: frequency === n ? C.ac : C.tx3, fontSize: 12, fontWeight: frequency === n ? 700 : 400, cursor: "pointer", fontFamily: "inherit" }}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Deload */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>Semaine deload</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {Array.from({ length: numWeeks }, (_, i) => i + 1).map((w) => (
            <button key={w} onClick={() => setDeloadWeek(w === deloadWeek ? 0 : w)} style={{ width: 40, height: 34, borderRadius: 8, border: "1px solid " + (deloadWeek === w ? C.b + "60" : C.brdL), background: deloadWeek === w ? C.bS : "transparent", color: deloadWeek === w ? C.b : C.tx3, fontSize: 11, fontWeight: deloadWeek === w ? 700 : 400, cursor: "pointer", fontFamily: "inherit" }}>
              S{w}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={save} disabled={saving}
        style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: saving ? C.s2 : C.coach, color: saving ? C.tx3 : "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}
      >
        {saving ? "Enregistrement..." : "Enregistrer config"}
      </button>
    </div>
  );
}
