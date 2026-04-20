import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { EnergyConfig, EnergyBlock, IntensityTarget, IntensityUnit } from "@/components/coach/EnergySessionEditor";

// ── Constantes ────────────────────────────────────────────────────────────────

const METEO_OPTIONS = [
  { id: "soleil", label: "Soleil", emoji: "☀️" },
  { id: "nuageux", label: "Nuageux", emoji: "⛅" },
  { id: "pluie", label: "Pluie", emoji: "🌧️" },
  { id: "froid", label: "Froid", emoji: "❄️" },
  { id: "vent", label: "Vent", emoji: "💨" },
  { id: "chaleur", label: "Chaleur", emoji: "🌡️" },
];

const LIEU_OPTIONS = [
  { id: "piste", label: "Piste", emoji: "🏟️" },
  { id: "route", label: "Route", emoji: "🛣️" },
  { id: "trail", label: "Trail", emoji: "🌲" },
  { id: "salle", label: "Salle", emoji: "🏋️" },
  { id: "montagne", label: "Montagne", emoji: "⛰️" },
  { id: "piscine", label: "Piscine", emoji: "🏊" },
  { id: "eau_libre", label: "Eau libre", emoji: "🌊" },
  { id: "custom", label: "Autre", emoji: "📍" },
];

const APPAREIL_LABELS: Record<string, string> = {
  course: "Course à pied", skierg: "SkiErg", bikeerg: "BikeErg",
  wattbike: "WattBike", rameur: "Rameur", velo: "Vélo",
  natation: "Natation", corde: "Corde à sauter",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDuration = (s: number): string => {
  if (!s) return "—";
  if (s < 60) return `${s}''`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${m}'${String(sec).padStart(2, "0")}''` : `${m}'`;
};

const UNIT_LABELS: Record<IntensityUnit, { label: string; suffix: string }> = {
  pct_vma: { label: "% VMA", suffix: "%" },
  pct_fc: { label: "% FC max", suffix: "%" },
  pct_vc: { label: "% VC", suffix: "%" },
  kmh: { label: "km/h", suffix: "km/h" },
  min_km: { label: "min/km", suffix: "'/km" },
  watts: { label: "W", suffix: "W" },
  libre: { label: "", suffix: "" },
};

function fmtIntensity(i?: IntensityTarget, ref?: Record<string, number>): string {
  if (!i) return "—";
  const u = UNIT_LABELS[i.type];
  const base = i.value_max ? `${i.value}–${i.value_max}${u.suffix}` : `${i.value}${u.suffix}`;
  // Calcul automatique si référence active disponible
  if (ref && i.type !== "libre") {
    const refVal = ref[i.type];
    if (refVal) {
      const calc = Math.round((i.value / 100) * refVal * 10) / 10;
      const calcMax = i.value_max ? Math.round((i.value_max / 100) * refVal * 10) / 10 : null;
      const calcStr = calcMax ? `${calc}–${calcMax}${UNIT_LABELS[i.type === "pct_vma" ? "kmh" : "kmh"].suffix}` : `${calc} ${i.type === "pct_vma" || i.type === "pct_vc" ? "km/h" : i.type === "pct_fc" ? "bpm" : ""}`;
      return `${base} → ${calcStr}`;
    }
  }
  return base;
}

// ── Vue prescription d'un bloc ─────────────────────────────────────────────────

function BlockPrescriptionView({ block, refValues, C }: { block: EnergyBlock; refValues: Record<string, number>; C: Record<string, string> }) {
  return (
    <div style={{ border: "1px solid " + C.brdL, borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
      <div style={{ background: C.s2, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.tx }}>{block.name}</div>
        <div style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, background: C.acS, color: C.ac, fontWeight: 600 }}>
          {block.custom_modalite || (block.modalite.charAt(0).toUpperCase() + block.modalite.slice(1))}
        </div>
      </div>
      <div style={{ padding: 12, background: C.s1, display: "flex", flexDirection: "column", gap: 6 }}>
        {block.intervals.map((iv, idx) => (
          <div key={iv.id} style={{ background: C.s2, borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.ac, marginBottom: 4 }}>
              {iv.reps}×{iv.effort.distance_m ? iv.effort.distance_m + "m" : fmtDuration(iv.effort.duration_s || 0)}
            </div>
            <div style={{ fontSize: 11, color: C.tx, marginBottom: 2 }}>
              Effort : {fmtIntensity(iv.effort.intensity, refValues)}
            </div>
            <div style={{ fontSize: 11, color: C.tx3 }}>
              Récup : {fmtDuration(iv.recovery.duration_s)} {iv.recovery.type}
              {iv.recovery.intensity && ` @ ${fmtIntensity(iv.recovery.intensity, refValues)}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Props principales ─────────────────────────────────────────────────────────

interface Props {
  athleteId: string;
  viewOnly?: boolean;
  C: Record<string, string>;
}

interface EnergyLog {
  id?: string;
  session_key: string;
  date: string;
  completed: boolean;
  respected?: boolean;
  duration_min?: number;
  distance_m?: number;
  meteo: string[];
  lieu?: string;
  lieu_custom?: string;
  note?: string;
  garmin_url?: string;
}

// ── Composant principal ────────────────────────────────────────────────────────

export default function EnergySessionLog({ athleteId, viewOnly, C }: Props) {
  const [configs, setConfigs] = useState<EnergyConfig[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [config, setConfig] = useState<EnergyConfig | null>(null);
  const [log, setLog] = useState<EnergyLog>({
    session_key: "",
    date: new Date().toISOString().slice(0, 10),
    completed: false,
    meteo: [],
    respected: undefined,
  });
  const [step, setStep] = useState<"list" | "session" | "log">("list");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [garminUploading, setGarminUploading] = useState(false);
  const [refValues, setRefValues] = useState<Record<string, number>>({});
  const [showLieuCustom, setShowLieuCustom] = useState(false);

  // Charger les configs énergétiques de l'athlète
  useEffect(() => {
    supabase
      .from("energy_session_config")
      .select("*")
      .eq("athlete_id", athleteId)
      .then(({ data }) => {
        if (data) setConfigs(data as any);
      });
  }, [athleteId]);

  // Charger les références de performance actives
  useEffect(() => {
    supabase
      .from("performance_logs")
      .select("metric_type, metric_name, value, unit")
      .eq("athlete_id", athleteId)
      .eq("is_active_reference", true)
      .then(({ data }) => {
        if (!data) return;
        const refs: Record<string, number> = {};
        data.forEach(p => {
          if (p.metric_type === "vma") refs["pct_vma"] = p.value;
          else if (p.metric_type === "vitesse_critique") refs["pct_vc"] = p.value;
          else if (p.metric_type === "fc_max") refs["pct_fc"] = p.value;
        });
        setRefValues(refs);
      });
  }, [athleteId]);

  const selectSession = (cfg: EnergyConfig) => {
    setConfig(cfg);
    setSelectedKey(cfg.session_key);
    setLog({ session_key: cfg.session_key, date: new Date().toISOString().slice(0, 10), completed: false, meteo: [], respected: undefined });
    setStep("session");
  };

  const startLog = () => setStep("log");

  const toggleMeteo = (id: string) => {
    setLog(l => ({
      ...l,
      meteo: l.meteo.includes(id) ? l.meteo.filter(m => m !== id) : [...l.meteo, id],
    }));
  };

  const handleGarminUpload = async (file: File) => {
    if (!file) return;
    setGarminUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${athleteId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("garmin-screenshots").upload(path, file);
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("garmin-screenshots").createSignedUrl(path, 60 * 60 * 24 * 90);
      const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      setLog(l => ({ ...l, garmin_url: signed?.signedUrl, _garmin_path: path, _garmin_expires: expires } as any));
    } finally {
      setGarminUploading(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        athlete_id: athleteId,
        session_key: log.session_key,
        session_label: config?.session_label,
        date: log.date,
        completed: true,
        respected: log.respected,
        duration_min: log.duration_min || null,
        distance_m: log.distance_m || null,
        meteo: log.meteo,
        lieu: log.lieu || null,
        lieu_custom: log.lieu_custom || null,
        note: log.note || null,
        garmin_url: (log as any).garmin_url || null,
        garmin_expires_at: (log as any)._garmin_expires || null,
      };

      if (log.id) {
        await supabase.from("energy_workout_logs").update(payload).eq("id", log.id);
      } else {
        const { data } = await supabase.from("energy_workout_logs").insert(payload).select().single();
        if (data) setLog(l => ({ ...l, id: data.id, completed: true }));
      }
      setSaved(true);
      setStep("list");
    } finally {
      setSaving(false);
    }
  };

  // ── Vue liste des sessions disponibles ───────────────────────────────────────
  if (step === "list") {
    return (
      <div style={{ padding: "16px 16px 40px" }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 4 }}>Séances Énergétiques</div>
        <div style={{ fontSize: 12, color: C.tx3, marginBottom: 16 }}>Sélectionne ta séance du jour</div>

        {saved && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(34,201,147,0.12)", border: "1px solid rgba(34,201,147,0.3)", color: C.g, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
            Séance validée !
          </div>
        )}

        {configs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", background: C.s1, borderRadius: 14, border: "1px solid " + C.brd }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🏃</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 6 }}>Aucune séance programmée</div>
            <div style={{ fontSize: 12, color: C.tx3 }}>Ton coach n'a pas encore programmé de séances énergétiques.</div>
          </div>
        ) : (
          configs.map(cfg => {
            const appareils = [
              ...(cfg.appareil_types || []).map(a => APPAREIL_LABELS[a] || a),
              ...(cfg.custom_appareils || []),
            ].join(", ");
            return (
              <button
                key={cfg.session_key}
                onClick={() => !viewOnly && selectSession(cfg)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 12, border: "1px solid " + C.brdL, background: C.s1, marginBottom: 10, cursor: viewOnly ? "default" : "pointer", fontFamily: "inherit", textAlign: "left" }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: C.acS, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🏃</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>{cfg.session_label || cfg.session_key}</div>
                  <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>{appareils || "Sans appareil"}</div>
                  <div style={{ fontSize: 10, color: C.tx3, marginTop: 1 }}>{cfg.blocks?.length || 0} bloc{(cfg.blocks?.length || 0) > 1 ? "s" : ""}</div>
                </div>
                {!viewOnly && <div style={{ fontSize: 18, color: C.tx3 }}>›</div>}
              </button>
            );
          })
        )}
      </div>
    );
  }

  // ── Vue prescription de la séance ────────────────────────────────────────────
  if (step === "session" && config) {
    const appareils = [
      ...(config.appareil_types || []).map(a => APPAREIL_LABELS[a] || a),
      ...(config.custom_appareils || []),
    ];

    return (
      <div style={{ padding: "16px 16px 40px" }}>
        <button onClick={() => setStep("list")} style={{ background: "none", border: "none", color: C.tx3, fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 12 }}>
          ‹ Retour
        </button>

        <div style={{ fontSize: 18, fontWeight: 800, color: C.tx, marginBottom: 4 }}>
          {config.session_label || config.session_key}
        </div>

        {appareils.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {appareils.map((a, i) => (
              <span key={i} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: C.acS, color: C.ac, fontWeight: 600 }}>{a}</span>
            ))}
          </div>
        )}

        {/* Photo de référence */}
        {config.photo_url && (
          <img src={config.photo_url} alt="Référence" style={{ width: "100%", borderRadius: 10, border: "1px solid " + C.brdL, marginBottom: 12, objectFit: "cover", maxHeight: 200 }} />
        )}

        {/* Références actives */}
        {Object.keys(refValues).length > 0 && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(59,141,240,0.1)", border: "1px solid rgba(59,141,240,0.2)", marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#3B8DF0", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Références actives</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {refValues["pct_vma"] && <span style={{ fontSize: 11, color: C.tx }}>VMA = <strong>{refValues["pct_vma"]} km/h</strong></span>}
              {refValues["pct_vc"] && <span style={{ fontSize: 11, color: C.tx }}>VC = <strong>{refValues["pct_vc"]} km/h</strong></span>}
              {refValues["pct_fc"] && <span style={{ fontSize: 11, color: C.tx }}>FC max = <strong>{refValues["pct_fc"]} bpm</strong></span>}
            </div>
          </div>
        )}

        {/* Note coach */}
        {config.note_coach && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: C.s1, border: "1px solid " + C.brdL, marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, marginBottom: 4 }}>Note du coach</div>
            <div style={{ fontSize: 12, color: C.tx2, lineHeight: 1.5 }}>{config.note_coach}</div>
          </div>
        )}

        {/* Blocs de prescription */}
        {(config.blocks || []).map(block => (
          <BlockPrescriptionView key={block.id} block={block} refValues={refValues} C={C} />
        ))}

        {!viewOnly && (
          <button onClick={startLog}
            style={{ width: "100%", padding: "15px 0", borderRadius: 14, border: "none", background: C.ac, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", marginTop: 8 }}>
            ▶ Débuter & Logger la séance
          </button>
        )}
      </div>
    );
  }

  // ── Vue log de la séance ──────────────────────────────────────────────────────
  if (step === "log") {
    return (
      <div style={{ padding: "16px 16px 40px" }}>
        <button onClick={() => setStep("session")} style={{ background: "none", border: "none", color: C.tx3, fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 12 }}>
          ‹ Retour
        </button>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.tx, marginBottom: 16 }}>Bilan de séance</div>

        {/* Séance respectée */}
        <div style={{ background: C.s1, borderRadius: 14, padding: 16, border: "1px solid " + C.brd, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Séance respectée ?</div>
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { v: true, label: "Oui, 100%", c: C.g },
              { v: false, label: "Allégé / Adapté", c: C.o },
            ].map(opt => (
              <button key={String(opt.v)} onClick={() => setLog(l => ({ ...l, respected: opt.v }))}
                style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid " + (log.respected === opt.v ? opt.c : C.brdL), background: log.respected === opt.v ? opt.c + "20" : "transparent", color: log.respected === opt.v ? opt.c : C.tx3, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Durée + Distance */}
        <div style={{ background: C.s1, borderRadius: 14, padding: 16, border: "1px solid " + C.brd, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Durée (min)</div>
              <input type="number" value={log.duration_min || ""} onChange={e => setLog(l => ({ ...l, duration_min: parseInt(e.target.value) || undefined }))}
                placeholder="Ex: 45"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 14, fontWeight: 700, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Distance (m)</div>
              <input type="number" value={log.distance_m || ""} onChange={e => setLog(l => ({ ...l, distance_m: parseInt(e.target.value) || undefined }))}
                placeholder="Ex: 6000"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 14, fontWeight: 700, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
        </div>

        {/* Météo (multi-select) */}
        <div style={{ background: C.s1, borderRadius: 14, padding: 16, border: "1px solid " + C.brd, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Météo</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {METEO_OPTIONS.map(m => (
              <button key={m.id} onClick={() => toggleMeteo(m.id)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid " + (log.meteo.includes(m.id) ? C.ac : C.brdL), background: log.meteo.includes(m.id) ? C.acS : "transparent", color: log.meteo.includes(m.id) ? C.ac : C.tx3, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                <span>{m.emoji}</span> {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lieu */}
        <div style={{ background: C.s1, borderRadius: 14, padding: 16, border: "1px solid " + C.brd, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Lieu</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {LIEU_OPTIONS.map(l => (
              <button key={l.id} onClick={() => { setLog(prev => ({ ...prev, lieu: l.id })); setShowLieuCustom(l.id === "custom"); }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid " + (log.lieu === l.id ? C.ac : C.brdL), background: log.lieu === l.id ? C.acS : "transparent", color: log.lieu === l.id ? C.ac : C.tx3, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                <span>{l.emoji}</span> {l.label}
              </button>
            ))}
          </div>
          {showLieuCustom && (
            <input value={log.lieu_custom || ""} onChange={e => setLog(l => ({ ...l, lieu_custom: e.target.value }))}
              placeholder="Précise le lieu…"
              style={{ marginTop: 10, width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
          )}
        </div>

        {/* Note libre */}
        <div style={{ background: C.s1, borderRadius: 14, padding: 16, border: "1px solid " + C.brd, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Note / Ressenti</div>
          <textarea value={log.note || ""} onChange={e => setLog(l => ({ ...l, note: e.target.value }))}
            placeholder="Comment s'est passée la séance ? Sensations, difficultés, commentaires…"
            rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
        </div>

        {/* Screenshot Garmin */}
        <div style={{ background: C.s1, borderRadius: 14, padding: 16, border: "1px solid " + C.brd, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Screenshot Garmin / Koros</div>
          <div style={{ fontSize: 10, color: C.tx3, marginBottom: 10 }}>L'image sera conservée 90 jours</div>

          {(log as any).garmin_url ? (
            <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
              <img src={(log as any).garmin_url} alt="Garmin" style={{ width: "100%", borderRadius: 10, border: "1px solid " + C.brdL, maxHeight: 240, objectFit: "cover" }} />
              <button onClick={() => setLog(l => ({ ...l, garmin_url: undefined, _garmin_path: undefined } as any))}
                style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(239,75,75,0.9)", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>
          ) : (
            <label style={{ display: "block", padding: "20px", borderRadius: 10, border: "1px dashed " + C.brdL, background: C.s2, textAlign: "center", cursor: garminUploading ? "default" : "pointer" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>📱</div>
              <div style={{ fontSize: 12, color: C.tx3 }}>{garminUploading ? "Upload en cours…" : "Partager un screen de ta montre"}</div>
              <div style={{ fontSize: 10, color: C.tx3, marginTop: 3 }}>JPG, PNG, HEIC · max 10 Mo</div>
              <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleGarminUpload(e.target.files[0])} style={{ display: "none" }} />
            </label>
          )}
        </div>

        {/* Valider */}
        <button onClick={handleSave} disabled={saving}
          style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: "none", background: saving ? C.s2 : C.g, color: saving ? C.tx3 : "#fff", fontSize: 15, fontWeight: 800, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}>
          {saving ? "Enregistrement…" : "Valider la séance"}
        </button>
      </div>
    );
  }

  return null;
}
