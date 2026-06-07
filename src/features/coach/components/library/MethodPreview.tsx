/**
 * MethodPreview — résumé textuel d'une configuration de méthode.
 * S'adapte au scope (set ou exercise) et se met à jour en temps réel.
 * Aucun nom de méthode inscrit en dur : purement paramétrique.
 */
import { C } from "@/lib/theme";
import type { MethodConfig, SetMethodConfig, ExerciseMethodConfig, ClassicMethodConfig } from "@/types/trainingMethods";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRepsSet(reps: SetMethodConfig["sub_sets"]["reps"]): string {
  switch (reps.type) {
    case "fixed":      return `${reps.value ?? "?"} reps`;
    case "decreasing": return "reps décroissantes";
    case "increasing": return "reps croissantes";
    case "amrap":      return "AMRAP";
    case "custom":
      return reps.pattern?.length
        ? reps.pattern.join(" → ") + " reps"
        : "pattern custom";
    default: return "reps";
  }
}

function formatCountSet(count: SetMethodConfig["sub_sets"]["count"]): string {
  if (count.type === "fixed") return `${count.value ?? "?"} sous-séries`;
  if (count.type === "range") return `${count.min ?? "?"}–${count.max ?? "?"} sous-séries`;
  return "? sous-séries";
}

function formatRestIntra(rest: SetMethodConfig["sub_sets"]["rest_intra"]): string {
  if (rest.type === "free") return "récup libre";
  return `${rest.seconds ?? "?"}s`;
}

function formatLoadSet(load: SetMethodConfig["load"]): string {
  const ref = load.reference ? ` @ ${load.reference}` : "";
  switch (load.type) {
    case "same":           return `charge identique${ref}`;
    case "free":           return "charge libre";
    case "decreasing_pct": return `charge -${load.pct_change ?? "?"}% par sous-série${ref}`;
    case "increasing_pct": return `charge +${load.pct_change ?? "?"}% par sous-série${ref}`;
    case "custom":
      return (load.values?.length
        ? `charge [${load.values.join(" → ")}]`
        : "charge custom") + ref;
    default: return "charge ?";
  }
}

function buildSetPreview(cfg: SetMethodConfig): string {
  const count = formatCountSet(cfg.sub_sets.count);
  const reps  = formatRepsSet(cfg.sub_sets.reps);
  const rest  = formatRestIntra(cfg.sub_sets.rest_intra);
  const load  = formatLoadSet(cfg.load);
  const rir   = cfg.rir_required ? " | RIR requis" : "";
  return `[${count} × ${reps} | ${rest}] | ${load}${rir}`;
}

// ── Exercise scope ──

function formatRepsEx(reps: ExerciseMethodConfig["reps"]): string {
  switch (reps.type) {
    case "fixed":      return `${reps.value ?? "?"} reps fixes`;
    case "ascending":  return "reps croissantes";
    case "descending": return "reps décroissantes";
    case "custom":
      return reps.pattern?.length
        ? `[${reps.pattern.join(",")}] reps`
        : "pattern custom";
    default: return "reps";
  }
}

function formatRestEx(rest: ExerciseMethodConfig["rest_between"]): string {
  switch (rest.type) {
    case "free":     return "récup libre";
    case "fixed":    return `récup ${rest.seconds ?? "?"}s`;
    case "variable": return `récup ${rest.min_s ?? "?"}–${rest.max_s ?? "?"}s`;
    default: return "récup ?";
  }
}

function formatLoadEx(load: ExerciseMethodConfig["load"]): string {
  switch (load.type) {
    case "same":       return "charge identique";
    case "ascending":  return "charge montante";
    case "descending": return "charge descendante";
    case "custom":
      if (load.mode === "pct_1rm") {
        const pct = load.pct_of_1rm ? `${load.pct_of_1rm}%` : "?%";
        const rm  = load.rm_kg      ? ` (1RM ${load.rm_kg}kg)` : "";
        return `charge ${pct} du 1RM${rm}`;
      }
      return "charge custom";
    default: return "charge ?";
  }
}

function formatTempoEx(tempo?: ExerciseMethodConfig["tempo"]): string {
  if (!tempo) return "";
  const parts = [
    tempo.eccentric_s  != null ? `${tempo.eccentric_s}s exc.`  : null,
    tempo.pause_s      != null ? `${tempo.pause_s}s pause`      : null,
    tempo.concentric_s != null ? `${tempo.concentric_s}s conc.` : null,
  ].filter(Boolean);
  return parts.length ? ` | tempo ${parts.join(" / ")}` : "";
}

function buildExercisePreview(cfg: ExerciseMethodConfig): string {
  const sets  = cfg.sets?.count ?? "?";
  const reps  = formatRepsEx(cfg.reps);
  const rest  = formatRestEx(cfg.rest_between);
  const load  = formatLoadEx(cfg.load);
  const tempo = formatTempoEx(cfg.tempo);
  const rir   = cfg.rir_required ? " | RIR requis" : "";
  return `${sets} × ${reps} | ${rest} | ${load}${tempo}${rir}`;
}

// ── Classic scope ──

function formatRepsClassic(reps: ClassicMethodConfig["reps"]): string {
  switch (reps.type) {
    case "fixed": return `${reps.value ?? "?"} reps`;
    case "range": return `${reps.min ?? "?"}-${reps.max ?? "?"} reps`;
    case "amrap":  return "AMRAP";
    default: return "reps";
  }
}

function formatLoadClassic(load: ClassicMethodConfig["load"]): string {
  const ref = load.reference ? ` @ ${load.reference}` : "";
  switch (load.type) {
    case "same":       return `charge identique${ref}`;
    case "ascending":  return `charge +${load.pct_change ?? "?"}% par série${ref}`;
    case "descending": return `charge -${load.pct_change ?? "?"}% par série${ref}`;
    case "custom":
      return (load.values?.length ? `charge [${load.values.join(" → ")}]` : "charge custom") + ref;
    default: return "charge ?";
  }
}

function buildClassicPreview(cfg: ClassicMethodConfig): string {
  const sets = cfg.sets?.count ?? "?";
  const reps = formatRepsClassic(cfg.reps);
  const rest = formatRestEx(cfg.rest_between);
  const load = formatLoadClassic(cfg.load);
  const rir  = cfg.rir_required ? " | RIR requis" : "";
  return `${sets} × ${reps} | ${rest} | ${load}${rir}`;
}

// ─── Public utility ──────────────────────────────────────────────────────────

/**
 * Génère une description textuelle de la prescription d'une méthode.
 * Utilisée pour afficher la prescription dans les vues coach et athlète.
 */
export function methodConfigToText(config: MethodConfig): string {
  try {
    if (config.scope === "set")      return buildSetPreview(config as SetMethodConfig);
    if (config.scope === "classic")  return buildClassicPreview(config as ClassicMethodConfig);
    return buildExercisePreview(config as ExerciseMethodConfig);
  } catch {
    return "Méthode";
  }
}

/**
 * Dérive les champs sets/repsRange depuis une config de méthode.
 * Utilisé pour pré-remplir la semaine d'exercice lors de l'attachement.
 */
export function methodConfigToWeekFields(config: MethodConfig): { sets?: number; repsRange?: string } {
  if (config.scope === "classic") {
    const sets = config.sets.count;
    const r = config.reps;
    const repsRange =
      r.type === "range"  ? `${r.min ?? "?"}–${r.max ?? "?"}` :
      r.type === "fixed"  ? String(r.value ?? "?") :
      r.type === "amrap"  ? "AMRAP" : undefined;
    return { sets, ...(repsRange ? { repsRange } : {}) };
  }
  if (config.scope === "exercise") {
    const sets = config.sets.count;
    const r = config.reps;
    const repsRange =
      r.type === "fixed"      ? String(r.value ?? "?") :
      r.type === "ascending"  ? "Pyramide ↑" :
      r.type === "descending" ? "Pyramide ↓" :
      r.type === "custom" && r.pattern?.length ? r.pattern.join("-") : undefined;
    return { sets, ...(repsRange ? { repsRange } : {}) };
  }
  // set scope — ne touche pas sets/repsRange globaux
  return {};
}

// ─── Component ───────────────────────────────────────────────────────────────

interface MethodPreviewProps {
  config: Partial<MethodConfig> | null;
  compact?: boolean;
}

export function MethodPreview({ config, compact = false }: MethodPreviewProps) {
  if (!config || !config.scope) {
    return (
      <div style={{ fontSize: 12, color: C.tx3, fontStyle: "italic" }}>
        Aperçu disponible après configuration
      </div>
    );
  }

  let preview: string;
  try {
    if (config.scope === "set") {
      preview = buildSetPreview(config as SetMethodConfig);
    } else if (config.scope === "classic") {
      preview = buildClassicPreview(config as ClassicMethodConfig);
    } else {
      preview = buildExercisePreview(config as ExerciseMethodConfig);
    }
  } catch {
    preview = "Configuration incomplète";
  }

  if (compact) {
    return (
      <div style={{
        fontSize: 11, color: C.tx3,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {preview}
      </div>
    );
  }

  return (
    <div style={{
      background: C.s2, borderRadius: 8, padding: "10px 14px",
      border: `1px solid ${C.brdL}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Aperçu
      </div>
      <div style={{ fontSize: 13, color: C.tx2, lineHeight: 1.5, fontFamily: "monospace" }}>
        {preview}
      </div>
    </div>
  );
}

// ─── Builder for partial form values → MethodConfig ──────────────────────────

/** Convertit les valeurs brutes du formulaire en MethodConfig partielle pour preview. */
export function formValuesToConfig(vals: Record<string, unknown>): Partial<MethodConfig> | null {
  const scope = vals.scope as "set" | "exercise" | undefined;
  if (!scope) return null;

  if (scope === "classic") {
    return {
      scope: "classic",
      sets:  { count: Number(vals.cl_sets_count) || 4 },
      reps: {
        type:  (vals.cl_reps_type as ClassicMethodConfig["reps"]["type"]) ?? "range",
        value: vals.cl_reps_type === "fixed" ? Number(vals.cl_reps_value) || undefined : undefined,
        min:   vals.cl_reps_type === "range" ? Number(vals.cl_reps_min)   || undefined : undefined,
        max:   vals.cl_reps_type === "range" ? Number(vals.cl_reps_max)   || undefined : undefined,
      },
      rest_between: {
        type:    (vals.cl_rest_type as "free" | "fixed" | "variable") ?? "free",
        seconds: vals.cl_rest_type === "fixed"    ? Number(vals.cl_rest_seconds) || undefined : undefined,
        min_s:   vals.cl_rest_type === "variable" ? Number(vals.cl_rest_min_s)   || undefined : undefined,
        max_s:   vals.cl_rest_type === "variable" ? Number(vals.cl_rest_max_s)   || undefined : undefined,
      },
      load: {
        type:       (vals.cl_load_type as ClassicMethodConfig["load"]["type"]) ?? "same",
        pct_change: (vals.cl_load_type === "ascending" || vals.cl_load_type === "descending")
          ? Number(vals.cl_load_pct_change) || undefined : undefined,
        values: vals.cl_load_type === "custom"
          ? String(vals.cl_load_custom_values ?? "").split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n) && n > 0)
          : undefined,
        reference: String(vals.cl_load_reference ?? "").trim() || undefined,
      },
      rir_required: Boolean(vals.cl_rir_required),
    } as ClassicMethodConfig;
  }

  if (scope === "set") {
    return {
      scope: "set",
      sub_sets: {
        count: {
          type:  (vals.set_sub_sets_count_type as "fixed" | "range") ?? "fixed",
          value: vals.set_sub_sets_count_type === "fixed"  ? Number(vals.set_sub_sets_count_value) || undefined : undefined,
          min:   vals.set_sub_sets_count_type === "range"  ? Number(vals.set_sub_sets_count_min)   || undefined : undefined,
          max:   vals.set_sub_sets_count_type === "range"  ? Number(vals.set_sub_sets_count_max)   || undefined : undefined,
        },
        reps: {
          type:    (vals.set_reps_type as SetMethodConfig["sub_sets"]["reps"]["type"]) ?? "fixed",
          value:   vals.set_reps_type === "fixed"  ? Number(vals.set_reps_value) || undefined : undefined,
          pattern: vals.set_reps_type === "custom"
            ? String(vals.set_reps_pattern ?? "").split(",").map(Number).filter(Boolean)
            : undefined,
        },
        rest_intra: {
          type:    (vals.set_rest_intra_type as "free" | "fixed") ?? "free",
          seconds: vals.set_rest_intra_type === "fixed" ? Number(vals.set_rest_intra_seconds) || undefined : undefined,
        },
      },
      load: {
        type:       (vals.set_load_type as SetMethodConfig["load"]["type"]) ?? "same",
        pct_change: (vals.set_load_type === "decreasing_pct" || vals.set_load_type === "increasing_pct")
          ? Number(vals.set_load_pct_change) || undefined
          : undefined,
        values: vals.set_load_type === "custom"
          ? String(vals.set_load_custom_values ?? "")
              .split(",")
              .map((s) => parseFloat(s.trim()))
              .filter((n) => !isNaN(n) && n > 0)
          : undefined,
        reference: String(vals.set_load_reference ?? "").trim() || undefined,
      },
      rir_required: Boolean(vals.set_rir_required),
    } as SetMethodConfig;
  }

  // exercise
  const tempoEnabled = Boolean(vals.ex_tempo_enabled);
  return {
    scope: "exercise",
    sets:  { count: Number(vals.ex_sets_count) || 3 },
    reps: {
      type:    (vals.ex_reps_type as ExerciseMethodConfig["reps"]["type"]) ?? "fixed",
      value:   vals.ex_reps_type === "fixed"  ? Number(vals.ex_reps_value)   || undefined : undefined,
      pattern: vals.ex_reps_type === "custom"
        ? String(vals.ex_reps_pattern ?? "").split(",").map(Number).filter(Boolean)
        : undefined,
    },
    rest_between: {
      type:    (vals.ex_rest_type as "free" | "fixed" | "variable") ?? "free",
      seconds: vals.ex_rest_type === "fixed"    ? Number(vals.ex_rest_seconds) || undefined : undefined,
      min_s:   vals.ex_rest_type === "variable" ? Number(vals.ex_rest_min_s)   || undefined : undefined,
      max_s:   vals.ex_rest_type === "variable" ? Number(vals.ex_rest_max_s)   || undefined : undefined,
    },
    load: {
      type:       (vals.ex_load_type as ExerciseMethodConfig["load"]["type"]) ?? "same",
      ...(vals.ex_load_type === "custom" && vals.ex_load_1rm_mode ? {
        mode:       "pct_1rm" as const,
        rm_kg:      Number(vals.ex_load_rm_kg)  || undefined,
        pct_of_1rm: Number(vals.ex_load_pct_1rm) || undefined,
      } : {}),
    },
    tempo: tempoEnabled ? {
      eccentric_s:  Number(vals.ex_tempo_eccentric)  || undefined,
      pause_s:      Number(vals.ex_tempo_pause)       || undefined,
      concentric_s: Number(vals.ex_tempo_concentric)  || undefined,
    } : undefined,
    rir_required: Boolean(vals.ex_rir_required),
  } as ExerciseMethodConfig;
}
