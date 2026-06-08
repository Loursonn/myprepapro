/**
 * MethodBuilder — formulaire de création / édition d'une méthode d'entraînement.
 * 2 étapes : informations générales → paramètres selon scope.
 * React Hook Form + Zod. Aucun nom de méthode inscrit en dur.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Plus, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { C } from "@/lib/theme";
import { MethodPreview, formValuesToConfig, methodConfigToText } from "./MethodPreview";
import { useTrainingMethods } from "@/features/shared/hooks/useTrainingMethods";
import type { TrainingMethod, FullWeekConfig, MethodScope, MethodConfig, ClassicMethodConfig, SetMethodConfig, ExerciseMethodConfig } from "@/types/trainingMethods";

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  name:        z.string().min(1, "Nom requis").max(60, "60 caractères max"),
  description: z.string().max(300, "300 caractères max").optional().default(""),
  scope:       z.enum(["classic", "set", "exercise"]),
  category:    z.string().min(1, "Catégorie requise"),
  tags:        z.array(z.string()).default([]),

  // set
  set_sub_sets_count_type:  z.enum(["fixed", "range"]).default("fixed"),
  set_sub_sets_count_value: z.number().min(1).max(20).default(3),
  set_sub_sets_count_min:   z.number().min(1).max(20).default(2),
  set_sub_sets_count_max:   z.number().min(1).max(20).default(5),
  set_reps_type:            z.enum(["fixed", "decreasing", "increasing", "amrap", "custom"]).default("fixed"),
  set_reps_value:           z.number().min(1).max(100).default(5),
  set_reps_pattern:         z.string().default(""),
  set_rest_intra_type:      z.enum(["free", "fixed"]).default("fixed"),
  set_rest_intra_seconds:   z.number().min(0).max(600).default(15),
  set_load_type:            z.enum(["same", "free", "decreasing_pct", "increasing_pct", "custom"]).default("same"),
  set_load_pct_change:      z.number().min(1).max(100).default(10),
  set_load_custom_values:   z.string().default(""),
  set_load_values_unit:     z.enum(["kg", "pct"]).default("kg"),
  set_load_reference:       z.string().default(""),
  set_rir_required:         z.boolean().default(false),

  // exercise
  ex_sets_count:       z.number().min(1).max(20).default(4),
  ex_reps_type:        z.enum(["fixed", "ascending", "descending", "custom"]).default("fixed"),
  ex_reps_value:       z.number().min(1).max(100).default(8),
  ex_reps_pattern:     z.string().default(""),
  ex_rest_type:        z.enum(["free", "fixed", "variable"]).default("fixed"),
  ex_rest_seconds:     z.number().min(0).max(600).default(90),
  ex_rest_min_s:       z.number().min(0).max(600).default(60),
  ex_rest_max_s:       z.number().min(0).max(600).default(180),
  ex_load_type:        z.enum(["same", "ascending", "descending", "custom"]).default("same"),
  ex_load_1rm_mode:    z.boolean().default(false),
  ex_load_values:      z.string().default(""),
  ex_load_values_unit: z.enum(["kg", "pct"]).default("kg"),
  ex_load_pct_1rm:     z.number().min(1).max(100).default(75),
  ex_tempo_enabled:    z.boolean().default(false),
  ex_tempo_eccentric:  z.number().min(0).max(10).default(3),
  ex_tempo_pause:      z.number().min(0).max(10).default(0),
  ex_tempo_concentric: z.number().min(0).max(10).default(1),
  ex_rir_required:     z.boolean().default(false),

  // classic
  cl_sets_count:        z.number().min(1).max(20).default(4),
  cl_reps_type:         z.enum(["fixed", "range", "amrap"]).default("range"),
  cl_reps_value:        z.number().min(1).max(100).default(10),
  cl_reps_min:          z.number().min(1).max(100).default(10),
  cl_reps_max:          z.number().min(1).max(100).default(12),
  cl_rest_type:         z.enum(["free", "fixed", "variable"]).default("fixed"),
  cl_rest_seconds:      z.number().min(0).max(600).default(90),
  cl_rest_min_s:        z.number().min(0).max(600).default(60),
  cl_rest_max_s:        z.number().min(0).max(600).default(180),
  cl_load_type:          z.enum(["same", "ascending", "descending", "custom"]).default("same"),
  cl_load_pct_change:    z.number().min(1).max(100).default(5),
  cl_load_custom_values: z.string().default(""),
  cl_load_values_unit:   z.enum(["kg", "pct"]).default("kg"),
  cl_load_reference:     z.string().default(""),
  cl_rir_required:       z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

// ─── Style helpers ────────────────────────────────────────────────────────────

const input = (extra?: React.CSSProperties): React.CSSProperties => ({
  width: "100%", padding: "8px 10px", borderRadius: 8,
  border: `1px solid ${C.brdL}`, background: C.s2,
  color: C.tx, fontSize: 13, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
  ...extra,
});

const label = (extra?: React.CSSProperties): React.CSSProperties => ({
  fontSize: 11, fontWeight: 600, color: C.tx3,
  textTransform: "uppercase", letterSpacing: "0.4px",
  display: "block", marginBottom: 6,
  ...extra,
});

const radioBtn = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
  border: `1px solid ${active ? C.ac : C.brdL}`,
  background: active ? C.acS : "transparent",
  color: active ? C.ac : C.tx2,
  fontSize: 12, fontWeight: active ? 700 : 400,
  fontFamily: "inherit", textAlign: "left",
  transition: "all 120ms",
});

const toggleBtn = (active: boolean, color = C.ac): React.CSSProperties => ({
  padding: "5px 12px", borderRadius: 7, cursor: "pointer",
  border: `1px solid ${active ? color : C.brdL}`,
  background: active ? `${color}18` : "transparent",
  color: active ? color : C.tx3,
  fontSize: 12, fontWeight: active ? 700 : 400,
  fontFamily: "inherit",
  transition: "all 120ms",
});

const numInput = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: "7px 8px", borderRadius: 7, border: `1px solid ${C.brdL}`,
  background: C.s2, color: C.tx, fontSize: 13, fontFamily: "inherit",
  outline: "none", textAlign: "center" as const, width: 72,
  ...extra,
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <div style={{ fontSize: 11, color: C.r, marginTop: 4 }}>{message}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: C.tx, marginBottom: 12, marginTop: 20, paddingBottom: 8, borderBottom: `1px solid ${C.brd}` }}>
      {children}
    </div>
  );
}

// ─── Tag input ────────────────────────────────────────────────────────────────

function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function add() {
    const t = draft.trim().toLowerCase();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {value.map((tag) => (
          <span key={tag} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "3px 8px", borderRadius: 20,
            background: C.acS, color: C.ac,
            fontSize: 11, fontWeight: 600,
          }}>
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              style={{ background: "none", border: "none", cursor: "pointer", color: C.ac, padding: 0, display: "flex", lineHeight: 1 }}
            ><X size={10} /></button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Ajouter un tag…"
          style={{ ...input(), flex: 1 }}
        />
        <button type="button" onClick={add} style={{
          width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.brdL}`,
          background: "transparent", color: C.tx3, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Category input with autocomplete ────────────────────────────────────────

function CategoryInput({
  value,
  onChange,
  suggestions,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(value.toLowerCase()) && s !== value
  );

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="ex: Intensification, Volume, Technique…"
        style={input()}
        autoComplete="off"
      />
      {error && <FieldError message={error} />}
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: C.bg, border: `1px solid ${C.brdL}`, borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.35)", overflow: "hidden",
        }}>
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={() => { onChange(s); setOpen(false); }}
              style={{
                width: "100%", padding: "8px 12px", textAlign: "left" as const,
                border: "none", borderBottom: `1px solid ${C.brd}`,
                background: "transparent", color: C.tx, fontSize: 13,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

function Step1({
  control,
  errors,
  existingCategories,
}: {
  control: ReturnType<typeof useForm<FormValues>>["control"];
  errors: ReturnType<typeof useForm<FormValues>>["formState"]["errors"];
  existingCategories: string[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Nom */}
      <div>
        <span style={label()}>Nom de la méthode *</span>
        <Controller name="name" control={control} render={({ field }) => (
          <input {...field} placeholder="ex: 3 sous-séries décroissantes…" style={input()} maxLength={60} />
        )} />
        <FieldError message={errors.name?.message} />
      </div>

      {/* Description */}
      <div>
        <span style={label()}>Description (optionnelle)</span>
        <Controller name="description" control={control} render={({ field }) => (
          <textarea {...field} rows={3} placeholder="Comment utiliser cette méthode, contexte…" style={{ ...input(), resize: "vertical" as const }} maxLength={300} />
        )} />
        <FieldError message={errors.description?.message} />
      </div>

      {/* Scope */}
      <div>
        <span style={label()}>Application</span>
        <Controller name="scope" control={control} render={({ field }) => (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => field.onChange("classic")} style={radioBtn(field.value === "classic")}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Classique</div>
              <div style={{ fontSize: 10, color: field.value === "classic" ? C.ac : C.tx3 }}>Séries × fourchette de reps (4×10-12)</div>
            </button>
            <button type="button" onClick={() => field.onChange("set")} style={radioBtn(field.value === "set")}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Sous-série</div>
              <div style={{ fontSize: 10, color: field.value === "set" ? C.ac : C.tx3 }}>S'applique à un set précis — les autres sets restent classiques</div>
            </button>
            <button type="button" onClick={() => field.onChange("exercise")} style={radioBtn(field.value === "exercise")}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Exercice</div>
              <div style={{ fontSize: 10, color: field.value === "exercise" ? C.ac : C.tx3 }}>Remplace entièrement le pattern de séries</div>
            </button>
          </div>
        )} />
        <FieldError message={errors.scope?.message} />
      </div>

      {/* Catégorie */}
      <div>
        <span style={label()}>Catégorie *</span>
        <Controller name="category" control={control} render={({ field }) => (
          <CategoryInput
            value={field.value}
            onChange={field.onChange}
            suggestions={existingCategories}
            error={errors.category?.message}
          />
        )} />
      </div>

      {/* Tags */}
      <div>
        <span style={label()}>Tags (optionnel)</span>
        <Controller name="tags" control={control} render={({ field }) => (
          <TagInput value={field.value} onChange={field.onChange} />
        )} />
      </div>
    </div>
  );
}

// ─── Step 2 — Classic scope ──────────────────────────────────────────────────

function Step2Classic({ control }: { control: ReturnType<typeof useForm<FormValues>>["control"] }) {
  const repsType       = useWatch({ control, name: "cl_reps_type" });
  const restType       = useWatch({ control, name: "cl_rest_type" });
  const loadType       = useWatch({ control, name: "cl_load_type" });
  const loadValuesUnit = useWatch({ control, name: "cl_load_values_unit" });
  const setsCount      = (useWatch({ control, name: "cl_sets_count" }) as number) || 4;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <SectionTitle>Structure classique</SectionTitle>

      {/* Nombre de séries */}
      <div>
        <span style={label()}>Nombre de séries</span>
        <Controller name="cl_sets_count" control={control} render={({ field }) => (
          <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={1} max={20} />
        )} />
      </div>

      {/* Reps */}
      <div>
        <span style={label()}>Répétitions</span>
        <Controller name="cl_reps_type" control={control} render={({ field }) => (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {([["range", "Fourchette"], ["fixed", "Fixe"], ["amrap", "AMRAP"]] as const).map(([v, lbl]) => (
              <button key={v} type="button" onClick={() => field.onChange(v)} style={toggleBtn(field.value === v)}>
                {lbl}
              </button>
            ))}
          </div>
        )} />
        {repsType === "range" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Controller name="cl_reps_min" control={control} render={({ field }) => (
              <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={1} max={100} />
            )} />
            <span style={{ color: C.tx3, fontSize: 13 }}>à</span>
            <Controller name="cl_reps_max" control={control} render={({ field }) => (
              <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={1} max={100} />
            )} />
            <span style={{ color: C.tx3, fontSize: 13 }}>reps</span>
          </div>
        )}
        {repsType === "fixed" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Controller name="cl_reps_value" control={control} render={({ field }) => (
              <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={1} max={100} />
            )} />
            <span style={{ color: C.tx3, fontSize: 13 }}>reps</span>
          </div>
        )}
      </div>

      {/* Récupération */}
      <div>
        <span style={label()}>Récupération entre séries</span>
        <Controller name="cl_rest_type" control={control} render={({ field }) => (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {([["free", "Libre"], ["fixed", "Fixe"], ["variable", "Variable"]] as const).map(([v, lbl]) => (
              <button key={v} type="button" onClick={() => field.onChange(v)} style={toggleBtn(field.value === v)}>
                {lbl}
              </button>
            ))}
          </div>
        )} />
        {restType === "fixed" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Controller name="cl_rest_seconds" control={control} render={({ field }) => (
              <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={0} max={600} />
            )} />
            <span style={{ color: C.tx3, fontSize: 13 }}>secondes</span>
          </div>
        )}
        {restType === "variable" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Controller name="cl_rest_min_s" control={control} render={({ field }) => (
              <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={0} max={600} />
            )} />
            <span style={{ color: C.tx3, fontSize: 13 }}>à</span>
            <Controller name="cl_rest_max_s" control={control} render={({ field }) => (
              <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={0} max={600} />
            )} />
            <span style={{ color: C.tx3, fontSize: 13 }}>secondes</span>
          </div>
        )}
      </div>

      {/* Charge */}
      <div>
        <span style={label()}>Charge</span>
        <Controller name="cl_load_type" control={control} render={({ field }) => (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {([
              ["same", "Identique"], ["ascending", "Montante"],
              ["descending", "Descendante"], ["custom", "Valeurs libres"],
            ] as const).map(([v, lbl]) => (
              <button key={v} type="button" onClick={() => field.onChange(v)} style={toggleBtn(field.value === v)}>
                {lbl}
              </button>
            ))}
          </div>
        )} />
        {(loadType === "ascending" || loadType === "descending") && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Controller name="cl_load_pct_change" control={control} render={({ field }) => (
              <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={1} max={100} />
            )} />
            <span style={{ color: C.tx3, fontSize: 13 }}>
              % {loadType === "descending" ? "de drop" : "de gain"} par série
            </span>
          </div>
        )}
        {loadType === "custom" && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: C.tx3 }}>Valeur par série</span>
              <Controller name="cl_load_values_unit" control={control} render={({ field }) => (
                <div style={{ display: "flex", gap: 4 }}>
                  {([["kg", "kg"], ["pct", "% 1RM"]] as const).map(([v, lbl]) => (
                    <button key={v} type="button" onClick={() => field.onChange(v)}
                      style={{ ...toggleBtn(field.value === v), padding: "3px 8px", fontSize: 10 }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              )} />
            </div>
            <Controller name="cl_load_custom_values" control={control} render={({ field }) => (
              <SubSetValuesInput value={field.value} count={setsCount} onChange={field.onChange}
                labelPrefix="S" unit={loadValuesUnit as "kg" | "pct"} />
            )} />
          </div>
        )}
        {/* Charge de référence — tous les types */}
        <Controller name="cl_load_reference" control={control} render={({ field }) => (
          <input
            {...field}
            placeholder='Charge de référence (ex: "80%", "75kg", "RPE 8"…)'
            style={input()}
          />
        )} />
      </div>

      {/* RIR */}
      <div>
        <Controller name="cl_rir_required" control={control} render={({ field }) => (
          <button type="button" onClick={() => field.onChange(!field.value)} style={{ ...toggleBtn(field.value, C.g), display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${field.value ? C.g : C.brdL}`, background: field.value ? C.g : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {field.value && <Check size={9} color="#fff" />}
            </div>
            RIR obligatoire
          </button>
        )} />
      </div>
    </div>
  );
}

// ─── Sub-set individual load input ───────────────────────────────────────────

function SubSetValuesInput({
  value,
  count,
  onChange,
  labelPrefix = "SS",
  unit,
}: {
  value: string;
  count: number;
  onChange: (v: string) => void;
  labelPrefix?: string;
  unit?: "kg" | "pct";
}) {
  const parts = value.split(",").map((s) => s.trim());
  const items = Array.from({ length: count }, (_, i) => parts[i] ?? "");

  function update(index: number, v: string) {
    const next = [...items];
    next[index] = v;
    onChange(next.join(","));
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      {items.map((v, i) => (
        <div key={i} style={{ textAlign: "center" as const }}>
          <span style={label({ marginBottom: 4 })}>{labelPrefix}{i + 1}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <input
              type="number"
              value={v}
              onChange={(e) => update(i, e.target.value)}
              placeholder="—"
              style={numInput({ width: 56 })}
              step={unit === "pct" ? 1 : 0.5}
              min={0}
              max={unit === "pct" ? 100 : undefined}
            />
            {unit === "pct" && (
              <span style={{ fontSize: 11, color: C.tx3, flexShrink: 0 }}>%</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Step 2 — Set scope ───────────────────────────────────────────────────────

function Step2Set({ control }: { control: ReturnType<typeof useForm<FormValues>>["control"] }) {
  const countType      = useWatch({ control, name: "set_sub_sets_count_type" });
  const countValue     = useWatch({ control, name: "set_sub_sets_count_value" }) as number;
  const countMax       = useWatch({ control, name: "set_sub_sets_count_max" }) as number;
  const repsType       = useWatch({ control, name: "set_reps_type" });
  const restType       = useWatch({ control, name: "set_rest_intra_type" });
  const loadType       = useWatch({ control, name: "set_load_type" });
  const loadValuesUnit = useWatch({ control, name: "set_load_values_unit" });
  // number of individual inputs = fixed value or range max
  const subSetCount = countType === "fixed" ? (countValue || 3) : (countMax || 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <SectionTitle>Structure de la série</SectionTitle>

      {/* Nombre de sous-séries */}
      <div>
        <span style={label()}>Nombre de sous-séries</span>
        <Controller name="set_sub_sets_count_type" control={control} render={({ field }) => (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {(["fixed", "range"] as const).map((t) => (
              <button key={t} type="button" onClick={() => field.onChange(t)} style={toggleBtn(field.value === t)}>
                {t === "fixed" ? "Fixe" : "Plage"}
              </button>
            ))}
          </div>
        )} />
        {countType === "fixed" ? (
          <Controller name="set_sub_sets_count_value" control={control} render={({ field }) => (
            <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={1} max={20} />
          )} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Controller name="set_sub_sets_count_min" control={control} render={({ field }) => (
              <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={1} max={20} />
            )} />
            <span style={{ color: C.tx3, fontSize: 13 }}>à</span>
            <Controller name="set_sub_sets_count_max" control={control} render={({ field }) => (
              <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={1} max={20} />
            )} />
          </div>
        )}
      </div>

      {/* Reps par sous-série */}
      <div>
        <span style={label()}>Reps par sous-série</span>
        <Controller name="set_reps_type" control={control} render={({ field }) => (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {([
              ["fixed", "Fixe"], ["decreasing", "Décroissant"], ["increasing", "Croissant"],
              ["amrap", "AMRAP"], ["custom", "Pattern custom"],
            ] as const).map(([v, lbl]) => (
              <button key={v} type="button" onClick={() => field.onChange(v)} style={toggleBtn(field.value === v)}>
                {lbl}
              </button>
            ))}
          </div>
        )} />
        {repsType === "fixed" && (
          <Controller name="set_reps_value" control={control} render={({ field }) => (
            <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={1} max={100} />
          )} />
        )}
        {repsType === "custom" && (
          <Controller name="set_reps_pattern" control={control} render={({ field }) => (
            <input {...field} placeholder="5,4,3,2,1 (séparés par virgule)" style={input()} />
          )} />
        )}
      </div>

      {/* Récupération intra */}
      <div>
        <span style={label()}>Récupération intra-série</span>
        <Controller name="set_rest_intra_type" control={control} render={({ field }) => (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {(["free", "fixed"] as const).map((t) => (
              <button key={t} type="button" onClick={() => field.onChange(t)} style={toggleBtn(field.value === t)}>
                {t === "free" ? "Libre" : "Fixe (secondes)"}
              </button>
            ))}
          </div>
        )} />
        {restType === "fixed" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Controller name="set_rest_intra_seconds" control={control} render={({ field }) => (
              <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={0} max={600} />
            )} />
            <span style={{ color: C.tx3, fontSize: 13 }}>secondes</span>
          </div>
        )}
      </div>

      {/* Charge */}
      <div>
        <span style={label()}>Charge</span>
        <Controller name="set_load_type" control={control} render={({ field }) => (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {([
              ["same",           "Identique"],
              ["free",           "Libre"],
              ["decreasing_pct", "Dégressive (%)"],
              ["increasing_pct", "Progressive (%)"],
              ["custom",         "Valeurs libres"],
            ] as const).map(([v, lbl]) => (
              <button key={v} type="button" onClick={() => field.onChange(v)} style={toggleBtn(field.value === v)}>
                {lbl}
              </button>
            ))}
          </div>
        )} />
        {(loadType === "decreasing_pct" || loadType === "increasing_pct") && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Controller name="set_load_pct_change" control={control} render={({ field }) => (
              <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={1} max={100} />
            )} />
            <span style={{ color: C.tx3, fontSize: 13 }}>
              % {loadType === "decreasing_pct" ? "de drop" : "de gain"} par sous-série
            </span>
          </div>
        )}
        {loadType === "custom" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: C.tx3 }}>Valeur par sous-série</span>
              <Controller name="set_load_values_unit" control={control} render={({ field }) => (
                <div style={{ display: "flex", gap: 4 }}>
                  {([["kg", "kg"], ["pct", "% 1RM"]] as const).map(([v, lbl]) => (
                    <button key={v} type="button" onClick={() => field.onChange(v)}
                      style={{ ...toggleBtn(field.value === v), padding: "3px 8px", fontSize: 10 }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              )} />
            </div>
            <Controller name="set_load_custom_values" control={control} render={({ field }) => (
              <SubSetValuesInput
                value={field.value}
                count={subSetCount}
                onChange={field.onChange}
                unit={loadValuesUnit as "kg" | "pct"}
              />
            )} />
          </div>
        )}
        {/* Charge de référence — tous les types */}
        <Controller name="set_load_reference" control={control} render={({ field }) => (
          <input
            {...field}
            placeholder='Charge de référence (ex: "80%", "75kg", "RPE 8"…)'
            style={{ ...input(), marginTop: 10 }}
          />
        )} />
      </div>

      {/* RIR */}
      <div>
        <Controller name="set_rir_required" control={control} render={({ field }) => (
          <button type="button" onClick={() => field.onChange(!field.value)} style={{ ...toggleBtn(field.value, C.g), display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${field.value ? C.g : C.brdL}`, background: field.value ? C.g : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {field.value && <Check size={9} color="#fff" />}
            </div>
            RIR obligatoire
          </button>
        )} />
      </div>
    </div>
  );
}

// ─── Step 2 — Exercise scope ──────────────────────────────────────────────────

function Step2Exercise({ control }: { control: ReturnType<typeof useForm<FormValues>>["control"] }) {
  const repsType     = useWatch({ control, name: "ex_reps_type" });
  const restType     = useWatch({ control, name: "ex_rest_type" });
  const loadType     = useWatch({ control, name: "ex_load_type" });
  const load1rmMode    = useWatch({ control, name: "ex_load_1rm_mode" });
  const loadValuesUnit = useWatch({ control, name: "ex_load_values_unit" });
  const tempoEnabled   = useWatch({ control, name: "ex_tempo_enabled" });
  const setsCount      = (useWatch({ control, name: "ex_sets_count" }) as number) || 4;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <SectionTitle>Structure de l'exercice</SectionTitle>

      {/* Nombre de séries */}
      <div>
        <span style={label()}>Nombre de séries</span>
        <Controller name="ex_sets_count" control={control} render={({ field }) => (
          <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={1} max={20} />
        )} />
      </div>

      {/* Pattern de reps */}
      <div>
        <span style={label()}>Pattern de reps</span>
        <Controller name="ex_reps_type" control={control} render={({ field }) => (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {([
              ["fixed", "Fixe"], ["ascending", "Pyramide montante"],
              ["descending", "Pyramide descendante"], ["custom", "Pattern custom"],
            ] as const).map(([v, lbl]) => (
              <button key={v} type="button" onClick={() => field.onChange(v)} style={toggleBtn(field.value === v)}>
                {lbl}
              </button>
            ))}
          </div>
        )} />
        {repsType === "fixed" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Controller name="ex_reps_value" control={control} render={({ field }) => (
              <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={1} max={100} />
            )} />
            <span style={{ color: C.tx3, fontSize: 13 }}>reps par série</span>
          </div>
        )}
        {repsType === "custom" && (
          <Controller name="ex_reps_pattern" control={control} render={({ field }) => (
            <input {...field} placeholder="3,4,5,6,7 (autant que le nombre de séries)" style={input()} />
          )} />
        )}
      </div>

      {/* Récupération entre séries */}
      <div>
        <span style={label()}>Récupération entre séries</span>
        <Controller name="ex_rest_type" control={control} render={({ field }) => (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {([["free", "Libre"], ["fixed", "Fixe"], ["variable", "Variable"]] as const).map(([v, lbl]) => (
              <button key={v} type="button" onClick={() => field.onChange(v)} style={toggleBtn(field.value === v)}>
                {lbl}
              </button>
            ))}
          </div>
        )} />
        {restType === "fixed" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Controller name="ex_rest_seconds" control={control} render={({ field }) => (
              <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={0} max={600} />
            )} />
            <span style={{ color: C.tx3, fontSize: 13 }}>secondes</span>
          </div>
        )}
        {restType === "variable" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Controller name="ex_rest_min_s" control={control} render={({ field }) => (
              <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={0} max={600} />
            )} />
            <span style={{ color: C.tx3, fontSize: 13 }}>à</span>
            <Controller name="ex_rest_max_s" control={control} render={({ field }) => (
              <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={numInput()} min={0} max={600} />
            )} />
            <span style={{ color: C.tx3, fontSize: 13 }}>secondes</span>
          </div>
        )}
      </div>

      {/* Charge */}
      <div>
        <span style={label()}>Charge</span>
        <Controller name="ex_load_type" control={control} render={({ field }) => (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {([
              ["same", "Identique"], ["ascending", "Montante"],
              ["descending", "Descendante"], ["custom", "Custom"],
            ] as const).map(([v, lbl]) => (
              <button key={v} type="button" onClick={() => field.onChange(v)} style={toggleBtn(field.value === v)}>
                {lbl}
              </button>
            ))}
          </div>
        )} />

        {/* Custom load — per-set values OR % 1RM auto */}
        {loadType === "custom" && (
          <div style={{
            padding: "12px 14px", borderRadius: 8,
            background: C.s2, border: `1px solid ${C.brdL}`,
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            {/* Mode toggle */}
            <Controller name="ex_load_1rm_mode" control={control} render={({ field }) => (
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => field.onChange(false)} style={toggleBtn(!field.value)}>
                  Valeurs par série
                </button>
                <button type="button" onClick={() => field.onChange(true)} style={toggleBtn(field.value, C.b)}>
                  % du 1RM (auto)
                </button>
              </div>
            )} />

            {/* Per-set values */}
            {!load1rmMode && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: C.tx3 }}>Valeur par série</span>
                  <Controller name="ex_load_values_unit" control={control} render={({ field }) => (
                    <div style={{ display: "flex", gap: 4 }}>
                      {([["kg", "kg"], ["pct", "% 1RM"]] as const).map(([v, lbl]) => (
                        <button key={v} type="button" onClick={() => field.onChange(v)}
                          style={{ ...toggleBtn(field.value === v), padding: "3px 8px", fontSize: 10 }}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  )} />
                </div>
                <Controller name="ex_load_values" control={control} render={({ field }) => (
                  <SubSetValuesInput
                    value={field.value}
                    count={setsCount}
                    onChange={field.onChange}
                    labelPrefix="S"
                    unit={loadValuesUnit as "kg" | "pct"}
                  />
                )} />
              </div>
            )}

            {/* 1RM auto mode */}
            {load1rmMode && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={label({ marginBottom: 0 })}>% du 1RM cible</span>
                  <Controller name="ex_load_pct_1rm" control={control} render={({ field }) => (
                    <input
                      type="number"
                      {...field}
                      onChange={e => field.onChange(+e.target.value)}
                      style={numInput({ width: 64 })}
                      min={1} max={100}
                    />
                  )} />
                  <span style={{ color: C.tx3, fontSize: 13 }}>%</span>
                </div>
                <div style={{ fontSize: 11, color: C.tx3, lineHeight: 1.5 }}>
                  Le 1RM est récupéré automatiquement depuis les PRs de l'athlète pour cet exercice.
                  Si aucun PR n'existe, l'athlète saisit sa charge directement lors de la séance.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tempo */}
      <div>
        <Controller name="ex_tempo_enabled" control={control} render={({ field }) => (
          <button type="button" onClick={() => field.onChange(!field.value)} style={{ ...toggleBtn(field.value, C.b), display: "flex", alignItems: "center", gap: 6, marginBottom: tempoEnabled ? 12 : 0 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${field.value ? C.b : C.brdL}`, background: field.value ? C.b : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {field.value && <Check size={9} color="#fff" />}
            </div>
            Tempo
          </button>
        )} />
        {tempoEnabled && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {([
              ["ex_tempo_eccentric",  "Excentrique"],
              ["ex_tempo_pause",      "Pause"],
              ["ex_tempo_concentric", "Concentrique"],
            ] as const).map(([fname, lbl]) => (
              <div key={fname} style={{ textAlign: "center" as const }}>
                <span style={label({ textAlign: "center" as const })}>{lbl}</span>
                <Controller name={fname} control={control} render={({ field }) => (
                  <input type="number" {...field} onChange={e => field.onChange(+e.target.value)} style={{ ...numInput(), width: "100%" }} min={0} max={10} />
                )} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIR */}
      <div>
        <Controller name="ex_rir_required" control={control} render={({ field }) => (
          <button type="button" onClick={() => field.onChange(!field.value)} style={{ ...toggleBtn(field.value, C.g), display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${field.value ? C.g : C.brdL}`, background: field.value ? C.g : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {field.value && <Check size={9} color="#fff" />}
            </div>
            RIR obligatoire
          </button>
        )} />
      </div>
    </div>
  );
}

// ─── formValuesToMethodConfig ─────────────────────────────────────────────────

function buildConfig(vals: FormValues) {
  return formValuesToConfig(vals as unknown as Record<string, unknown>);
}

// ─── Config → Form defaults (reverse of formValuesToConfig) ──────────────────

function configToFormDefaults(config: Partial<MethodConfig> | undefined, scope: MethodScope): Partial<FormValues> {
  if (!config) return {};
  if (scope === "classic" && config.scope === "classic") {
    const c = config as ClassicMethodConfig;
    return {
      cl_sets_count:        c.sets?.count ?? 4,
      cl_reps_type:         c.reps?.type ?? "range",
      cl_reps_value:        c.reps?.value ?? 10,
      cl_reps_min:          c.reps?.min ?? 10,
      cl_reps_max:          c.reps?.max ?? 12,
      cl_rest_type:         c.rest_between?.type ?? "fixed",
      cl_rest_seconds:      c.rest_between?.seconds ?? 90,
      cl_rest_min_s:        c.rest_between?.min_s ?? 60,
      cl_rest_max_s:        c.rest_between?.max_s ?? 180,
      cl_load_type:         c.load?.type ?? "same",
      cl_load_pct_change:   c.load?.pct_change ?? 5,
      cl_load_custom_values: (c.load?.values ?? []).join(","),
      cl_load_values_unit:   (c.load?.values_unit ?? "kg") as "kg" | "pct",
      cl_load_reference:    c.load?.reference ?? "",
      cl_rir_required:      c.rir_required ?? false,
    };
  }
  if (scope === "set" && config.scope === "set") {
    const c = config as SetMethodConfig;
    return {
      set_sub_sets_count_type:  c.sub_sets?.count?.type ?? "fixed",
      set_sub_sets_count_value: c.sub_sets?.count?.value ?? 3,
      set_sub_sets_count_min:   c.sub_sets?.count?.min ?? 2,
      set_sub_sets_count_max:   c.sub_sets?.count?.max ?? 5,
      set_reps_type:            c.sub_sets?.reps?.type ?? "fixed",
      set_reps_value:           c.sub_sets?.reps?.value ?? 5,
      set_reps_pattern:         (c.sub_sets?.reps?.pattern ?? []).join(","),
      set_rest_intra_type:      c.sub_sets?.rest_intra?.type ?? "fixed",
      set_rest_intra_seconds:   c.sub_sets?.rest_intra?.seconds ?? 15,
      set_load_type:            c.load?.type ?? "same",
      set_load_pct_change:      c.load?.pct_change ?? 10,
      set_load_custom_values:   (c.load?.values ?? []).join(","),
      set_load_values_unit:     (c.load?.values_unit ?? "kg") as "kg" | "pct",
      set_load_reference:       c.load?.reference ?? "",
      set_rir_required:         c.rir_required ?? false,
    };
  }
  if (scope === "exercise" && config.scope === "exercise") {
    const c = config as ExerciseMethodConfig;
    return {
      ex_sets_count:       c.sets?.count ?? 4,
      ex_reps_type:        c.reps?.type ?? "fixed",
      ex_reps_value:       c.reps?.value ?? 8,
      ex_reps_pattern:     (c.reps?.pattern ?? []).join(","),
      ex_rest_type:        c.rest_between?.type ?? "fixed",
      ex_rest_seconds:     c.rest_between?.seconds ?? 90,
      ex_rest_min_s:       c.rest_between?.min_s ?? 60,
      ex_rest_max_s:       c.rest_between?.max_s ?? 180,
      ex_load_type:        c.load?.type ?? "same",
      ex_load_1rm_mode:    c.load?.mode === "pct_1rm",
      ex_load_values:      (c.load?.values ?? []).join(","),
      ex_load_values_unit: (c.load?.values_unit ?? "kg") as "kg" | "pct",
      ex_load_pct_1rm:     c.load?.pct_of_1rm ?? 75,
      ex_tempo_enabled:    !!c.tempo,
      ex_tempo_eccentric:  c.tempo?.eccentric_s ?? 3,
      ex_tempo_pause:      c.tempo?.pause_s ?? 0,
      ex_tempo_concentric: c.tempo?.concentric_s ?? 1,
      ex_rir_required:     c.rir_required ?? false,
    };
  }
  return {};
}

// ─── WeekFormSlot — one week's full method config ────────────────────────────

const BASE_FORM_DEFAULTS: FormValues = {
  name: "", description: "", scope: "classic", category: "", tags: [],
  set_sub_sets_count_type: "fixed", set_sub_sets_count_value: 3,
  set_sub_sets_count_min: 2, set_sub_sets_count_max: 5,
  set_reps_type: "fixed", set_reps_value: 5, set_reps_pattern: "",
  set_rest_intra_type: "fixed", set_rest_intra_seconds: 15,
  set_load_type: "same", set_load_pct_change: 10,
  set_load_custom_values: "", set_load_values_unit: "kg", set_load_reference: "", set_rir_required: false,
  ex_sets_count: 4, ex_reps_type: "fixed", ex_reps_value: 8,
  ex_reps_pattern: "", ex_rest_type: "fixed", ex_rest_seconds: 90,
  ex_rest_min_s: 60, ex_rest_max_s: 180, ex_load_type: "same",
  ex_load_1rm_mode: false, ex_load_values: "", ex_load_values_unit: "kg", ex_load_pct_1rm: 75,
  ex_tempo_enabled: false, ex_tempo_eccentric: 3, ex_tempo_pause: 0,
  ex_tempo_concentric: 1, ex_rir_required: false,
  cl_sets_count: 4, cl_reps_type: "range", cl_reps_value: 10,
  cl_reps_min: 10, cl_reps_max: 12, cl_rest_type: "fixed",
  cl_rest_seconds: 90, cl_rest_min_s: 60, cl_rest_max_s: 180,
  cl_load_type: "same", cl_load_pct_change: 5,
  cl_load_custom_values: "", cl_load_values_unit: "kg", cl_load_reference: "", cl_rir_required: false,
};

function WeekFormSlot({
  week, scope, initialConfig, isDeload, onChange,
}: {
  week: number;
  scope: MethodScope;
  initialConfig?: Partial<MethodConfig>;
  isDeload: boolean;
  onChange: (week: number, config: Partial<MethodConfig>) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const defaults: FormValues = {
    ...BASE_FORM_DEFAULTS,
    scope,
    ...configToFormDefaults(initialConfig, scope),
  };

  const { control, watch, getValues } = useForm<FormValues>({ defaultValues: defaults });

  // Stable ref for onChange to avoid re-subscriptions
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  useEffect(() => {
    // Fire with initial defaults on mount
    const init = getValues();
    const initCfg = formValuesToConfig({ ...init, scope } as Record<string, unknown>);
    if (initCfg) onChangeRef.current(week, initCfg);

    // Subscribe to all subsequent changes
    const subscription = watch((vals) => {
      const cfg = formValuesToConfig({ ...vals, scope } as Record<string, unknown>);
      if (cfg) onChangeRef.current(week, cfg);
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, scope]);

  const currentVals = useWatch({ control });
  const currentConfig = formValuesToConfig({ ...currentVals, scope } as Record<string, unknown>);
  const preview = currentConfig ? methodConfigToText(currentConfig as MethodConfig) : "—";

  return (
    <div style={{
      borderRadius: 8,
      border: `1px solid ${expanded ? "#7B6FFF" : C.brdL}`,
      overflow: "hidden",
      marginBottom: 6,
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded((p) => !p)}
        style={{
          padding: "9px 14px",
          background: expanded ? "rgba(123,111,255,0.08)" : C.s2,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: expanded ? "#7B6FFF" : C.tx2, flexShrink: 0 }}>
          S{week}{isDeload ? " 🔄" : ""}
        </span>
        <span style={{
          flex: 1, fontSize: 10, color: C.tx3,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          fontFamily: "monospace",
        }}>
          {preview}
        </span>
        <span style={{ fontSize: 10, color: C.tx3 }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div style={{ padding: "16px", borderTop: `1px solid ${C.brd}` }}>
          {scope === "classic"  && <Step2Classic  control={control} />}
          {scope === "set"      && <Step2Set      control={control} />}
          {scope === "exercise" && <Step2Exercise control={control} />}
          {currentConfig && (
            <div style={{ marginTop: 16 }}>
              <MethodPreview config={currentConfig} compact />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MethodBuilder ────────────────────────────────────────────────────────────

interface MethodBuilderProps {
  initial?: TrainingMethod;
  coachId:  string;
  onSubmit: (values: FormValues) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function MethodBuilder({ initial, coachId: _coachId, onSubmit, onCancel, loading }: MethodBuilderProps) {
  const [step, setStep] = useState(1);

  // ── Multi-week protocol state ─────────────────────────────────────────────
  const initWC = (initial?.config as Record<string, unknown>)?.weekly_configs as FullWeekConfig[] | undefined;
  const [multiWeek, setMultiWeek] = useState(() => !!initWC?.length);
  const [weekCount, setWeekCount] = useState(() => initWC?.length || 6);
  const [weeklyConfigs, setWeeklyConfigs] = useState<FullWeekConfig[]>(() =>
    initWC ?? Array.from({ length: 6 }, (_, i) => ({ week: i + 1, config: {} as MethodConfig }))
  );

  const updateWeekConfig = useCallback((week: number, config: Partial<MethodConfig>) => {
    setWeeklyConfigs((prev) =>
      prev.map((wc) => wc.week === week ? { ...wc, config: config as MethodConfig } : wc)
    );
  }, []);

  function resizeWC(n: number) {
    setWeekCount(n);
    setWeeklyConfigs((prev) => {
      const next = [...prev];
      while (next.length < n) next.push({ week: next.length + 1, config: {} as MethodConfig });
      return next.slice(0, n);
    });
  }

  const { data: methods = [] } = useTrainingMethods();
  const existingCategories = [...new Set(methods.map((m) => m.category).filter(Boolean))];

  const defaultValues: FormValues = {
    name:        initial?.name        ?? "",
    description: initial?.description ?? "",
    scope:       initial?.scope       ?? "classic",
    category:    initial?.category    ?? "",
    tags:        initial?.tags        ?? [],

    set_sub_sets_count_type:  "fixed",
    set_sub_sets_count_value: 3,
    set_sub_sets_count_min:   2,
    set_sub_sets_count_max:   5,
    set_reps_type:            "fixed",
    set_reps_value:           5,
    set_reps_pattern:         "",
    set_rest_intra_type:      "fixed",
    set_rest_intra_seconds:   15,
    set_load_type:            "same",
    set_load_pct_change:      10,
    set_load_custom_values:   "",
    set_load_values_unit:     "kg",
    set_load_reference:       "",
    set_rir_required:         false,

    ex_sets_count:       4,
    ex_reps_type:        "fixed",
    ex_reps_value:       8,
    ex_reps_pattern:     "",
    ex_rest_type:        "fixed",
    ex_rest_seconds:     90,
    ex_rest_min_s:       60,
    ex_rest_max_s:       180,
    ex_load_type:        "same",
    ex_load_1rm_mode:    false,
    ex_load_values:      "",
    ex_load_values_unit: "kg",
    ex_load_pct_1rm:     75,
    ex_tempo_enabled:    false,
    ex_tempo_eccentric:  3,
    ex_tempo_pause:      0,
    ex_tempo_concentric: 1,
    ex_rir_required:     false,

    cl_sets_count:        4,
    cl_reps_type:         "range",
    cl_reps_value:        10,
    cl_reps_min:          10,
    cl_reps_max:          12,
    cl_rest_type:         "fixed",
    cl_rest_seconds:      90,
    cl_rest_min_s:        60,
    cl_rest_max_s:        180,
    cl_load_type:          "same",
    cl_load_pct_change:    5,
    cl_load_custom_values: "",
    cl_load_values_unit:   "kg",
    cl_load_reference:     "",
    cl_rir_required:       false,
  };

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const watchAll = watch();
  const scope    = watchAll.scope;
  const preview  = buildConfig(watchAll);

  async function handleNext() {
    if (step === 1) { setStep(2); return; }
    await handleSubmit((vals) => {
      const hasData = weeklyConfigs.some((wc) => wc.config && Object.keys(wc.config).length > 1);
      onSubmit({
        ...vals,
        weekly_configs: (multiWeek && hasData ? weeklyConfigs : undefined) as unknown as undefined,
      });
    })();
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Step indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[1, 2].map((s) => (
          <div key={s} style={{
            flex: 1, height: 3, borderRadius: 3,
            background: step >= s ? C.ac : C.brdL,
            transition: "background 200ms",
          }} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.tx3, marginBottom: 16 }}>
        Étape {step} / 2 — {step === 1 ? "Informations générales" : "Paramètres"}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", paddingRight: 2 }}>
        {step === 1 && (
          <Step1
            control={control}
            errors={errors}
            existingCategories={existingCategories}
          />
        )}
        {step === 2 && scope === "classic"  && <Step2Classic  control={control} />}
        {step === 2 && scope === "set"      && <Step2Set      control={control} />}
        {step === 2 && scope === "exercise" && <Step2Exercise control={control} />}

        {/* Preview live */}
        {step === 2 && (
          <div style={{ marginTop: 24 }}>
            <MethodPreview config={preview} />
          </div>
        )}

        {/* Multi-week protocol */}
        {step === 2 && (
          <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.brd}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => {
                  if (!multiWeek) {
                    setWeeklyConfigs(Array.from({ length: weekCount }, (_, i) => ({
                      week: i + 1,
                      config: {} as MethodConfig,
                    })));
                  }
                  setMultiWeek(!multiWeek);
                }}
                style={{ ...toggleBtn(multiWeek, "#7B6FFF"), display: "flex", alignItems: "center", gap: 6 }}
              >
                <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${multiWeek ? "#7B6FFF" : C.brdL}`, background: multiWeek ? "#7B6FFF" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {multiWeek && <Check size={9} color="#fff" />}
                </div>
                📅 Protocole multi-semaines
              </button>
              {multiWeek && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={label({ marginBottom: 0 })}>Semaines</span>
                  <input
                    type="number"
                    value={weekCount}
                    min={2}
                    max={16}
                    onChange={(e) => resizeWC(Math.max(2, Math.min(16, +e.target.value || 2)))}
                    style={{ ...numInput(), width: 52 }}
                  />
                </div>
              )}
            </div>

            {multiWeek && (
              <div>
                <div style={{ fontSize: 10, color: C.tx3, marginBottom: 10, lineHeight: 1.5 }}>
                  Configure chaque semaine individuellement. Clique sur une semaine pour l'ouvrir.
                </div>
                {weeklyConfigs.map((wc) => (
                  <WeekFormSlot
                    key={wc.week}
                    week={wc.week}
                    scope={scope}
                    initialConfig={wc.config && Object.keys(wc.config).length > 1 ? wc.config : undefined}
                    isDeload={false}
                    onChange={updateWeekConfig}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", gap: 8, paddingTop: 16, borderTop: `1px solid ${C.brd}`, marginTop: 16, flexShrink: 0 }}>
        {step === 1 ? (
          <button type="button" onClick={onCancel} style={{
            flex: 1, padding: "10px 0", borderRadius: 9,
            border: `1px solid ${C.brdL}`, background: "transparent",
            color: C.tx2, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>Annuler</button>
        ) : (
          <button type="button" onClick={() => setStep(1)} style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "10px 16px", borderRadius: 9,
            border: `1px solid ${C.brdL}`, background: "transparent",
            color: C.tx2, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>
            <ChevronLeft size={14} />
            Retour
          </button>
        )}
        <button type="button" onClick={handleNext} disabled={!!loading} style={{
          flex: 1, padding: "10px 0", borderRadius: 9,
          border: "none", background: loading ? C.s2 : C.ac,
          color: loading ? C.tx3 : "#fff",
          fontSize: 13, fontWeight: 700, cursor: loading ? "default" : "pointer",
          fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          {step === 1 ? (
            <><span>Suivant</span><ChevronRight size={14} /></>
          ) : loading ? (
            "Enregistrement…"
          ) : (
            <><Check size={14} /><span>{initial ? "Mettre à jour" : "Créer la méthode"}</span></>
          )}
        </button>
      </div>
    </form>
  );
}

export type { FormValues as MethodFormRawValues };
