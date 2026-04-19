import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type IntensityUnit = "pct_vma" | "pct_fc" | "pct_vc" | "kmh" | "min_km" | "watts" | "libre";
export type RecoveryType = "actif" | "passif";
export type ModaliteType = "continu" | "intermittent" | "fartleck" | "tabata" | "tempo" | "custom";

export interface IntensityTarget {
  type: IntensityUnit;
  value: number;
  value_max?: number; // pour les fourchettes ex: 65-75%FC
}

export interface EnergyInterval {
  id: string;
  reps: number;
  effort: {
    distance_m?: number;
    duration_s?: number;
    intensity: IntensityTarget;
  };
  recovery: {
    type: RecoveryType;
    duration_s: number;
    intensity?: IntensityTarget;
  };
}

export interface EnergyBlock {
  id: string;
  name: string;
  sets?: number; // nombre de passages du bloc entier
  modalite: ModaliteType;
  custom_modalite?: string;
  intervals: EnergyInterval[];
}

export interface EnergyConfig {
  id?: string;
  session_key: string;
  session_label?: string;
  appareil_types: string[];
  custom_appareils: string[];
  blocks: EnergyBlock[];
  photo_url?: string;
  note_coach?: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const APPAREILS = [
  { id: "course", label: "Course à pied", emoji: "🏃" },
  { id: "skierg", label: "SkiErg", emoji: "⛷️" },
  { id: "bikeerg", label: "BikeErg", emoji: "🚴" },
  { id: "wattbike", label: "WattBike", emoji: "⚡" },
  { id: "rameur", label: "Rameur", emoji: "🚣" },
  { id: "velo", label: "Vélo", emoji: "🚲" },
  { id: "natation", label: "Natation", emoji: "🏊" },
  { id: "corde", label: "Corde à sauter", emoji: "🪢" },
  { id: "custom", label: "Autre", emoji: "➕" },
];

const MODALITES: { id: ModaliteType; label: string }[] = [
  { id: "continu", label: "Continu" },
  { id: "intermittent", label: "Intermittent" },
  { id: "fartleck", label: "Fartleck" },
  { id: "tabata", label: "Tabata" },
  { id: "tempo", label: "Tempo" },
  { id: "custom", label: "Autre" },
];

const INTENSITY_UNITS: { id: IntensityUnit; label: string; suffix: string }[] = [
  { id: "pct_vma", label: "% VMA", suffix: "%" },
  { id: "pct_fc", label: "% FC max", suffix: "%" },
  { id: "pct_vc", label: "% Vitesse Critique", suffix: "%" },
  { id: "kmh", label: "km/h", suffix: "km/h" },
  { id: "min_km", label: "min/km", suffix: "'/km" },
  { id: "watts", label: "Watts", suffix: "W" },
  { id: "libre", label: "Libre / Zone", suffix: "" },
];

const newId = () => "blk_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);

const defaultInterval = (): EnergyInterval => ({
  id: newId(),
  reps: 4,
  effort: { distance_m: 400, intensity: { type: "pct_vma", value: 90 } },
  recovery: { type: "passif", duration_s: 120, intensity: { type: "pct_vma", value: 60 } },
});

const defaultBlock = (): EnergyBlock => ({
  id: newId(),
  name: "Travail principal",
  modalite: "intermittent",
  intervals: [defaultInterval()],
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDuration = (s: number): string => {
  if (s < 60) return `${s}''`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${m}'${String(sec).padStart(2, "0")}''` : `${m}'`;
};

const fmtIntensity = (i?: IntensityTarget): string => {
  if (!i) return "—";
  const unit = INTENSITY_UNITS.find(u => u.id === i.type);
  if (i.type === "libre") return String(i.value || "");
  const base = `${i.value}${unit?.suffix || ""}`;
  return i.value_max ? `${i.value}-${i.value_max}${unit?.suffix || ""}` : base;
};

// ── Sub-composants ─────────────────────────────────────────────────────────────

function IntensityPicker({
  value,
  onChange,
  C,
  label,
}: {
  value: IntensityTarget;
  onChange: (v: IntensityTarget) => void;
  C: Record<string, string>;
  label?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <div style={{ fontSize: 10, color: C.tx3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {INTENSITY_UNITS.map(u => (
          <button
            key={u.id}
            onClick={() => onChange({ ...value, type: u.id })}
            style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid " + (value.type === u.id ? C.ac : C.brdL), background: value.type === u.id ? C.acS : "transparent", color: value.type === u.id ? C.ac : C.tx3, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            {u.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type={value.type === "libre" ? "text" : "number"}
          value={value.value || ""}
          onChange={e => onChange({ ...value, value: value.type === "libre" ? (e.target.value as any) : parseFloat(e.target.value) || 0 })}
          placeholder={value.type === "libre" ? "Ex: Zone 2" : "Valeur"}
          style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none" }}
        />
        {value.type !== "libre" && (
          <>
            <span style={{ fontSize: 11, color: C.tx3 }}>à</span>
            <input
              type="number"
              value={value.value_max || ""}
              onChange={e => onChange({ ...value, value_max: parseFloat(e.target.value) || undefined })}
              placeholder="Max (opt.)"
              style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none" }}
            />
          </>
        )}
      </div>
    </div>
  );
}

function IntervalRow({
  interval,
  idx,
  onChange,
  onDelete,
  C,
}: {
  interval: EnergyInterval;
  idx: number;
  onChange: (v: EnergyInterval) => void;
  onDelete: () => void;
  C: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(idx === 0);

  const preview = `${interval.reps}×${interval.effort.distance_m ? interval.effort.distance_m + "m" : fmtDuration(interval.effort.duration_s || 0)} @ ${fmtIntensity(interval.effort.intensity)} / Récup ${fmtDuration(interval.recovery.duration_s)} ${interval.recovery.type}`;

  return (
    <div style={{ border: "1px solid " + C.brdL, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: C.s2, cursor: "pointer" }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.tx }}>Intervalle {idx + 1}</div>
          <div style={{ fontSize: 10, color: C.tx3, marginTop: 2 }}>{preview}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "rgba(239,75,75,0.12)", color: "#EF4B4B", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >×</button>
          <span style={{ fontSize: 14, color: C.tx3 }}>{expanded ? "∧" : "∨"}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: 14, background: C.s1, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Répétitions */}
          <div>
            <div style={{ fontSize: 10, color: C.tx3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Répétitions</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                <button key={n} onClick={() => onChange({ ...interval, reps: n })}
                  style={{ width: 36, height: 32, borderRadius: 7, border: "1px solid " + (interval.reps === n ? C.ac : C.brdL), background: interval.reps === n ? C.acS : "transparent", color: interval.reps === n ? C.ac : C.tx3, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {n}
                </button>
              ))}
              <input type="number" value={interval.reps} onChange={e => onChange({ ...interval, reps: parseInt(e.target.value) || 1 })}
                style={{ width: 48, padding: "6px 8px", borderRadius: 7, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", textAlign: "center" }} />
            </div>
          </div>

          {/* Effort */}
          <div>
            <div style={{ fontSize: 10, color: C.tx3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Effort — Distance ou Durée</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: C.tx3, marginBottom: 4 }}>Distance (m)</div>
                <input type="number" value={interval.effort.distance_m || ""} onChange={e => onChange({ ...interval, effort: { ...interval.effort, distance_m: parseInt(e.target.value) || undefined, duration_s: undefined } })}
                  placeholder="ex: 400"
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 8, fontSize: 11, color: C.tx3 }}>ou</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: C.tx3, marginBottom: 4 }}>Durée (sec)</div>
                <input type="number" value={interval.effort.duration_s || ""} onChange={e => onChange({ ...interval, effort: { ...interval.effort, duration_s: parseInt(e.target.value) || undefined, distance_m: undefined } })}
                  placeholder="ex: 180"
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            <IntensityPicker value={interval.effort.intensity} onChange={v => onChange({ ...interval, effort: { ...interval.effort, intensity: v } })} C={C} label="Intensité effort" />
          </div>

          {/* Récupération */}
          <div>
            <div style={{ fontSize: 10, color: C.tx3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Récupération</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: C.tx3, marginBottom: 4 }}>Type</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["actif", "passif"] as RecoveryType[]).map(t => (
                    <button key={t} onClick={() => onChange({ ...interval, recovery: { ...interval.recovery, type: t } })}
                      style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "1px solid " + (interval.recovery.type === t ? C.g : C.brdL), background: interval.recovery.type === t ? "rgba(34,201,147,0.12)" : "transparent", color: interval.recovery.type === t ? C.g : C.tx3, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: C.tx3, marginBottom: 4 }}>Durée (sec)</div>
                <input type="number" value={interval.recovery.duration_s} onChange={e => onChange({ ...interval, recovery: { ...interval.recovery, duration_s: parseInt(e.target.value) || 0 } })}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            {interval.recovery.type === "actif" && (
              <IntensityPicker
                value={interval.recovery.intensity || { type: "pct_fc", value: 60 }}
                onChange={v => onChange({ ...interval, recovery: { ...interval.recovery, intensity: v } })}
                C={C}
                label="Intensité récupération active"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BlockEditor({
  block,
  onChange,
  onDelete,
  canDelete,
  C,
}: {
  block: EnergyBlock;
  onChange: (b: EnergyBlock) => void;
  onDelete: () => void;
  canDelete: boolean;
  C: Record<string, string>;
}) {
  return (
    <div style={{ border: "1px solid " + C.brdL, borderRadius: 12, marginBottom: 12, overflow: "hidden" }}>
      {/* Header bloc */}
      <div style={{ background: C.s2, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <input
          value={block.name}
          onChange={e => onChange({ ...block, name: e.target.value })}
          style={{ flex: 1, background: "transparent", border: "none", color: C.tx, fontSize: 13, fontWeight: 700, fontFamily: "inherit", outline: "none" }}
          placeholder="Nom du bloc (ex: Échauffement)"
        />
        {(block.sets ?? 1) > 1 && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: C.acS, color: C.ac, flexShrink: 0 }}>
            × {block.sets} séries
          </span>
        )}
        {canDelete && (
          <button onClick={onDelete} style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "rgba(239,75,75,0.12)", color: "#EF4B4B", fontSize: 14, cursor: "pointer" }}>×</button>
        )}
      </div>

      <div style={{ padding: 14, background: C.s1, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Séries du bloc */}
        <div>
          <div style={{ fontSize: 10, color: C.tx3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
            Séries du bloc complet
            {(block.sets ?? 1) > 1 && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: C.ac }}>× {block.sets ?? 1}</span>}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {[1, 2, 3, 4, 5, 6].map(n => (
              <button key={n} onClick={() => onChange({ ...block, sets: n })}
                style={{ width: 36, height: 32, borderRadius: 7, border: "1px solid " + ((block.sets ?? 1) === n ? C.ac : C.brdL), background: (block.sets ?? 1) === n ? C.acS : "transparent", color: (block.sets ?? 1) === n ? C.ac : C.tx3, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {n}
              </button>
            ))}
            <input type="number" min={1} max={20} value={block.sets ?? 1} onChange={e => onChange({ ...block, sets: Math.max(1, parseInt(e.target.value) || 1) })}
              style={{ width: 48, padding: "6px 8px", borderRadius: 7, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", textAlign: "center" }} />
          </div>
        </div>

        {/* Modalité */}
        <div>
          <div style={{ fontSize: 10, color: C.tx3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Modalité</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {MODALITES.map(m => (
              <button key={m.id} onClick={() => onChange({ ...block, modalite: m.id })}
                style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid " + (block.modalite === m.id ? C.ac : C.brdL), background: block.modalite === m.id ? C.acS : "transparent", color: block.modalite === m.id ? C.ac : C.tx3, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {m.label}
              </button>
            ))}
          </div>
          {block.modalite === "custom" && (
            <input value={block.custom_modalite || ""} onChange={e => onChange({ ...block, custom_modalite: e.target.value })}
              placeholder="Décris la modalité…"
              style={{ marginTop: 8, width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
          )}
        </div>

        {/* Intervalles */}
        <div>
          <div style={{ fontSize: 10, color: C.tx3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Intervalles ({block.intervals.length})</div>
          {block.intervals.map((interval, idx) => (
            <IntervalRow
              key={interval.id}
              interval={interval}
              idx={idx}
              onChange={updated => onChange({ ...block, intervals: block.intervals.map((iv, i) => i === idx ? updated : iv) })}
              onDelete={() => onChange({ ...block, intervals: block.intervals.filter((_, i) => i !== idx) })}
              C={C}
            />
          ))}
          <button
            onClick={() => onChange({ ...block, intervals: [...block.intervals, defaultInterval()] })}
            style={{ width: "100%", padding: "9px 0", borderRadius: 9, border: "1px dashed " + C.brdL, background: "transparent", color: C.tx3, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
          >
            + Ajouter un intervalle
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────

interface Props {
  athleteId: string;
  sessionKey: string;
  sessionLabel?: string;
  onClose: () => void;
  C: Record<string, string>;
}

export default function EnergySessionEditor({ athleteId, sessionKey, sessionLabel, onClose, C }: Props) {
  const [config, setConfig] = useState<EnergyConfig>({
    session_key: sessionKey,
    session_label: sessionLabel,
    appareil_types: [],
    custom_appareils: [],
    blocks: [defaultBlock()],
    note_coach: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [customAppareil, setCustomAppareil] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => {
    supabase
      .from("energy_session_config")
      .select("*")
      .eq("athlete_id", athleteId)
      .eq("session_key", sessionKey)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setConfig({
            id: data.id,
            session_key: data.session_key,
            session_label: data.session_label,
            appareil_types: data.appareil_types || [],
            custom_appareils: data.custom_appareils || [],
            blocks: (data.blocks as EnergyBlock[]) || [defaultBlock()],
            photo_url: data.photo_url,
            note_coach: data.note_coach || "",
          });
        }
      });
  }, [athleteId, sessionKey]);

  const toggleAppareil = (id: string) => {
    setConfig(c => ({
      ...c,
      appareil_types: c.appareil_types.includes(id)
        ? c.appareil_types.filter(a => a !== id)
        : [...c.appareil_types, id],
    }));
  };

  const addCustomAppareil = () => {
    const v = customAppareil.trim();
    if (!v) return;
    setConfig(c => ({ ...c, custom_appareils: [...(c.custom_appareils || []), v] }));
    setCustomAppareil("");
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;
    setPhotoUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${athleteId}/${sessionKey}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("energy-exercise-photos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("energy-exercise-photos").getPublicUrl(path);
      setConfig(c => ({ ...c, photo_url: urlData.publicUrl }));
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        athlete_id: athleteId,
        session_key: config.session_key,
        session_label: config.session_label,
        appareil_types: config.appareil_types,
        custom_appareils: config.custom_appareils,
        blocks: config.blocks as any,
        photo_url: config.photo_url || null,
        note_coach: config.note_coach || null,
        updated_at: new Date().toISOString(),
      };

      if (config.id) {
        await supabase.from("energy_session_config").update(payload).eq("id", config.id);
      } else {
        const { data } = await supabase.from("energy_session_config").insert(payload).select().single();
        if (data) setConfig(c => ({ ...c, id: data.id }));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div
        style={{ width: "100%", maxWidth: 680, background: C.s1, borderRadius: "16px 16px 0 0", maxHeight: "92vh", overflowY: "auto", padding: "0 0 32px" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ position: "sticky", top: 0, background: C.s1, padding: "16px 20px", borderBottom: "1px solid " + C.brd, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.tx }}>Séance Énergétique</div>
            {config.session_label && <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>{config.session_label}</div>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: "8px 18px", borderRadius: 9, border: "none", background: saved ? C.g : C.coach, color: "#fff", fontSize: 12, fontWeight: 700, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}>
              {saving ? "…" : saved ? "Sauvegardé ✓" : "Sauvegarder"}
            </button>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, fontSize: 16, cursor: "pointer" }}>×</button>
          </div>
        </div>

        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Appareils */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Type(s) d'appareil</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {APPAREILS.filter(a => a.id !== "custom").map(a => (
                <button key={a.id} onClick={() => toggleAppareil(a.id)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid " + (config.appareil_types.includes(a.id) ? C.ac : C.brdL), background: config.appareil_types.includes(a.id) ? C.acS : "transparent", color: config.appareil_types.includes(a.id) ? C.ac : C.tx3, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  <span>{a.emoji}</span> {a.label}
                </button>
              ))}
            </div>
            {/* Custom appareil */}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input value={customAppareil} onChange={e => setCustomAppareil(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustomAppareil()}
                placeholder="Ajouter un appareil custom…"
                style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
              <button onClick={addCustomAppareil} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: C.ac, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+</button>
            </div>
            {(config.custom_appareils || []).map((ca, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, margin: "4px 4px 0 0", padding: "3px 10px", borderRadius: 6, background: C.acS, color: C.ac, fontSize: 11, fontWeight: 600 }}>
                {ca}
                <button onClick={() => setConfig(c => ({ ...c, custom_appareils: c.custom_appareils.filter((_, j) => j !== i) }))}
                  style={{ background: "none", border: "none", color: C.ac, cursor: "pointer", fontSize: 12, padding: 0, marginLeft: 2 }}>×</button>
              </span>
            ))}
          </div>

          {/* Blocs d'entraînement */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
              Blocs ({config.blocks.length})
            </div>
            {config.blocks.map((block, idx) => (
              <BlockEditor
                key={block.id}
                block={block}
                onChange={updated => setConfig(c => ({ ...c, blocks: c.blocks.map((b, i) => i === idx ? updated : b) }))}
                onDelete={() => setConfig(c => ({ ...c, blocks: c.blocks.filter((_, i) => i !== idx) }))}
                canDelete={config.blocks.length > 1}
                C={C}
              />
            ))}
            <button
              onClick={() => setConfig(c => ({ ...c, blocks: [...c.blocks, { ...defaultBlock(), name: "Bloc " + (c.blocks.length + 1) }] }))}
              style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "1px dashed " + C.brdL, background: "transparent", color: C.tx3, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              + Ajouter un bloc
            </button>
          </div>

          {/* Photo de référence */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Photo de référence (optionnel)</div>
            {config.photo_url ? (
              <div style={{ position: "relative", display: "inline-block" }}>
                <img src={config.photo_url} alt="Référence" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 10, border: "1px solid " + C.brdL, objectFit: "cover" }} />
                <button onClick={() => setConfig(c => ({ ...c, photo_url: undefined }))}
                  style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(239,75,75,0.9)", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              </div>
            ) : (
              <label style={{ display: "block", padding: "20px", borderRadius: 10, border: "1px dashed " + C.brdL, background: C.s2, textAlign: "center", cursor: photoUploading ? "default" : "pointer" }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📸</div>
                <div style={{ fontSize: 12, color: C.tx3 }}>{photoUploading ? "Upload en cours…" : "Cliquer pour ajouter une photo"}</div>
                <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} style={{ display: "none" }} />
              </label>
            )}
          </div>

          {/* Note coach */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Note pour l'athlète</div>
            <textarea
              value={config.note_coach || ""}
              onChange={e => setConfig(c => ({ ...c, note_coach: e.target.value }))}
              placeholder="Instructions, consignes particulières…"
              rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
