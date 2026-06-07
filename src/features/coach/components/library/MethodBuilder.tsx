/**
 * MethodBuilder — formulaire de création / édition d'une méthode d'entraînement.
 * 2 étapes : informations générales → paramètres selon scope.
 * React Hook Form + Zod. Aucun nom de méthode inscrit en dur.
 */
import { useState, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Plus, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { C } from "@/lib/theme";
import { MethodPreview, formValuesToConfig } from "./MethodPreview";
import { useTrainingMethods } from "@/features/shared/hooks/useTrainingMethods";
import type { TrainingMethod } from "@/types/trainingMethods";

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
  ex_load_rm_kg:       z.number().min(0).max(500).default(0),
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

function Step2Classic({ control, watch }: { control: ReturnType<typeof useForm<FormValues>>["control"]; watch: ReturnType<typeof useForm<FormValues>>["watch"] }) {
  const repsType   = watch("cl_reps_type");
  const restType   = watch("cl_rest_type");
  const loadType   = watch("cl_load_type");
  const setsCount  = watch("cl_sets_count") || 4;

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
            <div style={{ fontSize: 11, color: C.tx3, marginBottom: 10 }}>
              Valeur par série (kg, %, RPE… au choix)
            </div>
            <Controller name="cl_load_custom_values" control={control} render={({ field }) => (
              <SubSetValuesInput value={field.value} count={setsCount} onChange={field.onChange} />
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
}: {
  value: string;
  count: number;
  onChange: (v: string) => void;
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
          <span style={label({ marginBottom: 4 })}>SS{i + 1}</span>
          <input
            type="number"
            value={v}
            onChange={(e) => update(i, e.target.value)}
            placeholder="—"
            style={numInput({ width: 64 })}
            step={0.5}
            min={0}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Step 2 — Set scope ───────────────────────────────────────────────────────

function Step2Set({ control, watch }: { control: ReturnType<typeof useForm<FormValues>>["control"]; watch: ReturnType<typeof useForm<FormValues>>["watch"] }) {
  const countType  = watch("set_sub_sets_count_type");
  const countValue = watch("set_sub_sets_count_value");
  const countMax   = watch("set_sub_sets_count_max");
  const repsType   = watch("set_reps_type");
  const restType   = watch("set_rest_intra_type");
  const loadType   = watch("set_load_type");
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
            <div style={{ fontSize: 11, color: C.tx3, marginBottom: 10 }}>
              Valeur par sous-série (kg, %, RPE… au choix)
            </div>
            <Controller name="set_load_custom_values" control={control} render={({ field }) => (
              <SubSetValuesInput
                value={field.value}
                count={subSetCount}
                onChange={field.onChange}
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

function Step2Exercise({ control, watch }: { control: ReturnType<typeof useForm<FormValues>>["control"]; watch: ReturnType<typeof useForm<FormValues>>["watch"] }) {
  const repsType     = watch("ex_reps_type");
  const restType     = watch("ex_rest_type");
  const loadType     = watch("ex_load_type");
  const load1rmMode  = watch("ex_load_1rm_mode");
  const tempoEnabled = watch("ex_tempo_enabled");

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

        {/* 1RM section — only visible when custom */}
        {loadType === "custom" && (
          <div style={{
            padding: "12px 14px", borderRadius: 8,
            background: C.s2, border: `1px solid ${C.brdL}`,
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <Controller name="ex_load_1rm_mode" control={control} render={({ field }) => (
              <button
                type="button"
                onClick={() => field.onChange(!field.value)}
                style={{ ...toggleBtn(field.value, C.b), display: "flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
              >
                <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${field.value ? C.b : C.brdL}`, background: field.value ? C.b : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {field.value && <Check size={9} color="#fff" />}
                </div>
                En % du 1RM
              </button>
            )} />

            {load1rmMode && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <span style={label()}>1RM de référence (kg)</span>
                    <Controller name="ex_load_rm_kg" control={control} render={({ field }) => (
                      <input
                        type="number"
                        {...field}
                        onChange={e => field.onChange(+e.target.value)}
                        placeholder="0 = non défini"
                        style={{ ...numInput(), width: "100%", textAlign: "left" as const, padding: "7px 10px" }}
                        min={0} max={500}
                      />
                    )} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={label()}>% du 1RM cible</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Controller name="ex_load_pct_1rm" control={control} render={({ field }) => (
                        <input
                          type="number"
                          {...field}
                          onChange={e => field.onChange(+e.target.value)}
                          style={numInput({ width: "100%" })}
                          min={1} max={100}
                        />
                      )} />
                      <span style={{ color: C.tx3, fontSize: 13 }}>%</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: C.tx3 }}>
                  Le 1RM peut être laissé à 0 pour que l'athlète le renseigne au moment de la séance.
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
    ex_load_rm_kg:       0,
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
    await handleSubmit(onSubmit)();
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
        {step === 2 && scope === "classic"  && <Step2Classic  control={control} watch={watch} />}
        {step === 2 && scope === "set"      && <Step2Set      control={control} watch={watch} />}
        {step === 2 && scope === "exercise" && <Step2Exercise control={control} watch={watch} />}

        {/* Preview live */}
        {step === 2 && (
          <div style={{ marginTop: 24 }}>
            <MethodPreview config={preview} />
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
