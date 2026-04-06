import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth, Profile } from "@/hooks/useAuth";
import {
  getNutritionStrategy,
  upsertNutritionStrategy,
  NutritionStrategyType,
  CalorieMode,
} from "@/lib/nutrition";

const C = {
  bg: "#08090C", s1: "#111318", s2: "#181B24",
  brd: "rgba(255,255,255,0.06)", brdL: "rgba(255,255,255,0.1)",
  tx: "#F2F2F4", tx2: "#9194A0", tx3: "#555866",
  ac: "#7B6FFF", acS: "rgba(123,111,255,0.12)",
  coach: "#D4538E", coachS: "rgba(212,83,142,0.12)",
  g: "#22C993", gS: "rgba(34,201,147,0.1)",
  r: "#EF4B4B", b: "#3B8DF0", o: "#F5A623",
};

const NAP_OPTIONS = [
  { value: 1.2,   label: "Sédentaire",     sub: "Peu ou pas d'exercice" },
  { value: 1.375, label: "Légère",          sub: "1-3j / semaine" },
  { value: 1.55,  label: "Modérée",         sub: "3-5j / semaine" },
  { value: 1.725, label: "Intense",         sub: "6-7j / semaine" },
  { value: 1.9,   label: "Très intense",    sub: "Sport + travail physique" },
];

type MetaMode = "manual" | "formula_no_bf" | "formula_bf";

function calcMifflin(weight: number, height: number, age: number, gender: "male" | "female"): number {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(gender === "male" ? base + 5 : base - 161);
}

function calcKatchMcArdle(weight: number, bodyFat: number): number {
  const lbm = weight * (1 - bodyFat / 100);
  return Math.round(370 + 21.6 * lbm);
}

interface Props {
  athlete: Profile;
  onClose: () => void;
  inline?: boolean;
}

export default function AthleteProfileForm({ athlete, onClose, inline = false }: Props) {
  const { updateAthleteProfile, user } = useAuth();
  const isOwnProfile = user?.id === athlete.id;

  // ── Identité + MB ─────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState(athlete.first_name ?? "");
  const [lastName, setLastName] = useState(athlete.last_name ?? "");
  const [age, setAge] = useState(athlete.age?.toString() ?? "");
  const [heightCm, setHeightCm] = useState(athlete.height_cm?.toString() ?? "");
  const [gender, setGender] = useState<"male" | "female" | "">(athlete.gender ?? "");
  const [weightKg, setWeightKg] = useState(athlete.weight_kg?.toString() ?? "");
  const [bodyFatPct, setBodyFatPct] = useState(athlete.body_fat_pct?.toString() ?? "");
  const [metaMode, setMetaMode] = useState<MetaMode>("manual");
  const [metaManual, setMetaManual] = useState(athlete.base_metabolism?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Nutrition ─────────────────────────────────────────────────────────────
  const [nutStrategy, setNutStrategy] = useState<NutritionStrategyType>("maintenance");
  const [nutTargetWeight, setNutTargetWeight] = useState("");
  const [nutCalorieMode, setNutCalorieMode] = useState<CalorieMode>("nap");
  const [nutNap, setNutNap] = useState("");                 // NAP sélectionné (ex: "1.55")
  const [nutTargetPct, setNutTargetPct] = useState("");     // déficit/surplus/tolérance cible
  const [nutTotalCalCoach, setNutTotalCalCoach] = useState(""); // kcal total calculé ou manuel
  const [nutGlucides, setNutGlucides] = useState("");
  const [nutLipides, setNutLipides] = useState("");
  const [nutProteines, setNutProteines] = useState("");
  const [nutGlucidesPct, setNutGlucidesPct] = useState("");
  const [nutLipidesPct, setNutLipidesPct] = useState("");
  const [nutProteinesPct, setNutProteinesPct] = useState("");
  const [nutLoaded, setNutLoaded] = useState(false);

  // ── Valeurs dérivées ──────────────────────────────────────────────────────
  const bmr = parseInt(metaManual) || 0;
  const nap = parseFloat(nutNap) || 0;
  const tdee = bmr && nap ? Math.round(bmr * nap) : 0;
  const totalRefKcal = parseInt(nutTotalCalCoach) || 0;

  const DEFAULT_PCTS: Record<NutritionStrategyType, [number, number, number]> = {
    maintenance:    [45, 30, 25],
    seche:          [40, 25, 35],
    prise_de_masse: [50, 25, 25],
  };

  // Label et contraintes du champ % selon stratégie
  const stratPctMeta = {
    seche:          { label: "Déficit (%)", placeholder: "ex: 15", min: 1,  max: 40, sign: -1 },
    prise_de_masse: { label: "Surplus (%)", placeholder: "ex: 10", min: 1,  max: 30, sign: 1  },
    maintenance:    { label: "Tolérance (±%)", placeholder: "ex: 3",  min: 0,  max: 15, sign: 0  },
  }[nutStrategy];

  // ── Dériver targetPct depuis les min/max stockés au chargement ─────────────
  function deriveTargetPct(min: number | null, max: number | null, strategy: NutritionStrategyType): string {
    if (min == null && max == null) return "";
    if (strategy === "seche") return String(Math.abs(min ?? max ?? 0));
    if (strategy === "prise_de_masse") return String(Math.abs(max ?? min ?? 0));
    return String(Math.abs(max ?? 0)); // maintenance: max = tolérance
  }

  // ── Calculer min/max depuis targetPct pour la sauvegarde ─────────────────
  function computeMinMax(pct: string, strategy: NutritionStrategyType): [number | null, number | null] {
    const v = parseFloat(pct);
    if (!v) return [null, null];
    if (strategy === "seche")          return [-v, -v / 2];
    if (strategy === "prise_de_masse") return [v / 2, v];
    return [-v, v]; // maintenance
  }

  // ── Calcul kcal cibles depuis TDEE + targetPct ────────────────────────────
  function computeTargetKcal(tdeeVal: number, pct: string, strategy: NutritionStrategyType): number {
    const v = parseFloat(pct) || 0;
    if (!tdeeVal) return 0;
    if (strategy === "seche")          return Math.round(tdeeVal * (1 - v / 100));
    if (strategy === "prise_de_masse") return Math.round(tdeeVal * (1 + v / 100));
    return tdeeVal; // maintenance
  }

  // ── Sync kcal cibles quand TDEE ou targetPct changent ────────────────────
  useEffect(() => {
    if (!tdee) return;
    const kcal = computeTargetKcal(tdee, nutTargetPct, nutStrategy);
    if (kcal) setNutTotalCalCoach(String(kcal));
  }, [tdee, nutTargetPct, nutStrategy]);

  // ── Sync grammes quand totalRefKcal change (si % déjà renseignés) ─────────
  useEffect(() => {
    const kcal = parseInt(nutTotalCalCoach) || 0;
    if (!kcal) return;
    if (nutGlucidesPct) setNutGlucides(String(Math.round(kcal * parseFloat(nutGlucidesPct) / 100 / 4)));
    if (nutLipidesPct)  setNutLipides(String(Math.round(kcal * parseFloat(nutLipidesPct) / 100 / 9)));
    if (nutProteinesPct) setNutProteines(String(Math.round(kcal * parseFloat(nutProteinesPct) / 100 / 4)));
  }, [nutTotalCalCoach]);

  // ── Macro helpers ─────────────────────────────────────────────────────────
  function pctToG(pct: string, factor: number): string {
    if (!totalRefKcal || !pct) return "";
    return String(Math.round(totalRefKcal * parseFloat(pct) / 100 / factor));
  }

  function gToPct(g: string, factor: number): string {
    if (!totalRefKcal || !g) return "";
    return String(Math.round(parseInt(g) * factor / totalRefKcal * 100));
  }

  function onPctChange(macro: "g" | "l" | "p", val: string) {
    if (macro === "g") { setNutGlucidesPct(val); setNutGlucides(pctToG(val, 4)); }
    if (macro === "l") { setNutLipidesPct(val);  setNutLipides(pctToG(val, 9)); }
    if (macro === "p") { setNutProteinesPct(val); setNutProteines(pctToG(val, 4)); }
  }

  function onGramChange(macro: "g" | "l" | "p", val: string) {
    if (macro === "g") { setNutGlucides(val); setNutGlucidesPct(gToPct(val, 4)); }
    if (macro === "l") { setNutLipides(val);  setNutLipidesPct(gToPct(val, 9)); }
    if (macro === "p") { setNutProteines(val); setNutProteinesPct(gToPct(val, 4)); }
  }

  function applyDefaultPcts() {
    const [gP, lP, pP] = DEFAULT_PCTS[nutStrategy];
    setNutGlucidesPct(String(gP)); setNutLipidesPct(String(lP)); setNutProteinesPct(String(pP));
    setNutGlucides(pctToG(String(gP), 4));
    setNutLipides(pctToG(String(lP), 9));
    setNutProteines(pctToG(String(pP), 4));
  }

  // ── Chargement depuis Supabase ────────────────────────────────────────────
  useEffect(() => {
    getNutritionStrategy(athlete.id)
      .then(s => {
        if (s) {
          setNutStrategy(s.strategy);
          setNutTargetWeight(s.target_weight?.toString() ?? "");
          setNutCalorieMode(s.calorie_mode ?? (s.can_track_calories ? "active" : "nap"));
          setNutNap(s.nap?.toString() ?? "");
          setNutTotalCalCoach(s.total_calories_coach?.toString() ?? "");
          setNutTargetPct(deriveTargetPct(s.surplus_deficit_min ?? null, s.surplus_deficit_max ?? null, s.strategy));
          setNutGlucides(s.macros_glucides?.toString() ?? "");
          setNutLipides(s.macros_lipides?.toString() ?? "");
          setNutProteines(s.macros_proteines?.toString() ?? "");
          setNutGlucidesPct(s.macros_glucides_pct?.toString() ?? "");
          setNutLipidesPct(s.macros_lipides_pct?.toString() ?? "");
          setNutProteinesPct(s.macros_proteines_pct?.toString() ?? "");
        }
      })
      .catch(console.error)
      .finally(() => setNutLoaded(true));
  }, [athlete.id]);

  // ── Formule MB ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (metaMode === "formula_no_bf") {
      const w = parseFloat(weightKg), h = parseFloat(heightCm), a = parseInt(age);
      if (w > 0 && h > 0 && a > 0 && (gender === "male" || gender === "female"))
        setMetaManual(calcMifflin(w, h, a, gender).toString());
    } else if (metaMode === "formula_bf") {
      const w = parseFloat(weightKg), bf = parseFloat(bodyFatPct);
      if (w > 0 && bf > 0 && bf < 100)
        setMetaManual(calcKatchMcArdle(w, bf).toString());
    }
  }, [metaMode, weightKg, heightCm, age, gender, bodyFatPct]);

  // ── Sauvegarde ────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setError("");
    const [sdMin, sdMax] = computeMinMax(nutTargetPct, nutStrategy);
    try {
      await Promise.all([
        updateAthleteProfile(athlete.id, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          age: age ? parseInt(age) : null,
          height_cm: heightCm ? parseInt(heightCm) : null,
          gender: (gender as "male" | "female") || null,
          weight_kg: weightKg ? parseFloat(weightKg) : null,
          body_fat_pct: bodyFatPct ? parseFloat(bodyFatPct) : null,
          base_metabolism: metaManual ? parseInt(metaManual) : null,
        }),
        upsertNutritionStrategy(athlete.id, {
          strategy: nutStrategy,
          can_track_calories: nutCalorieMode !== "nap",
          calorie_mode: nutCalorieMode,
          nap: nutNap ? parseFloat(nutNap) : null,
          target_weight: nutTargetWeight ? parseFloat(nutTargetWeight) : null,
          total_calories_coach: nutTotalCalCoach ? parseInt(nutTotalCalCoach) : null,
          surplus_deficit_min: sdMin,
          surplus_deficit_max: sdMax,
          macros_glucides: nutGlucides ? parseInt(nutGlucides) : null,
          macros_lipides: nutLipides ? parseInt(nutLipides) : null,
          macros_proteines: nutProteines ? parseInt(nutProteines) : null,
          macros_glucides_pct: nutGlucidesPct ? parseFloat(nutGlucidesPct) : null,
          macros_lipides_pct: nutLipidesPct ? parseFloat(nutLipidesPct) : null,
          macros_proteines_pct: nutProteinesPct ? parseFloat(nutProteinesPct) : null,
        }),
      ]);
      toast.success("Profil enregistré !");
      onClose();
    } catch (e: any) {
      setError(e.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "1px solid " + C.brdL, background: C.s2, color: C.tx,
    fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const,
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 600 as const, color: C.tx3,
    textTransform: "uppercase" as const, letterSpacing: "0.5px",
    display: "block", marginBottom: 6,
  };
  const sectionTitle = {
    fontSize: 12, fontWeight: 700 as const, color: C.tx2,
    marginBottom: 12, marginTop: 20, paddingBottom: 6,
    borderBottom: "1px solid " + C.brd,
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  const formContent = (
    <div style={{ padding: inline ? "16px" : "20px 20px 32px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.tx }}>{isOwnProfile ? "Mon profil" : "Profil de l'athlète"}</div>
          <div style={{ fontSize: 12, color: C.tx3, marginTop: 2 }}>{athlete.full_name}</div>
        </div>
        <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, fontSize: 18, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
      </div>

      {/* ── Identité ── */}
      <div style={sectionTitle}>Identité</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><label style={labelStyle}>Prénom</label><input style={inputStyle} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Prénom" /></div>
        <div><label style={labelStyle}>Nom</label><input style={inputStyle} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Nom" /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><label style={labelStyle}>Âge</label><input style={inputStyle} type="number" min={10} max={100} value={age} onChange={e => setAge(e.target.value)} placeholder="ex: 24" /></div>
        <div><label style={labelStyle}>Taille (cm)</label><input style={inputStyle} type="number" min={100} max={250} value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="ex: 178" /></div>
      </div>
      <div style={{ marginBottom: 4 }}>
        <label style={labelStyle}>Genre</label>
        <div style={{ display: "flex", gap: 8 }}>
          {(["male", "female"] as const).map(g => (
            <button key={g} onClick={() => setGender(g)} style={{ flex: 1, padding: "9px 0", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, border: "1px solid " + (gender === g ? C.ac : C.brdL), background: gender === g ? C.acS : C.s2, color: gender === g ? C.ac : C.tx2 }}>
              {g === "male" ? "Homme" : "Femme"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Métabolisme de base ── */}
      <div style={sectionTitle}>Métabolisme de base</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" as const }}>
        {([["manual", "Manuel"], ["formula_no_bf", "Formule (sans MG)"], ["formula_bf", "Formule (avec MG)"]] as [MetaMode, string][]).map(([mode, label]) => (
          <button key={mode} onClick={() => setMetaMode(mode)} style={{ padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, border: "1px solid " + (metaMode === mode ? C.coach : C.brdL), background: metaMode === mode ? C.coachS : C.s2, color: metaMode === mode ? C.coach : C.tx2 }}>
            {label}
          </button>
        ))}
      </div>
      {metaMode === "formula_no_bf" && (
        <div style={{ background: C.s2, borderRadius: 10, padding: 12, marginBottom: 12, border: "1px solid " + C.brd }}>
          <div style={{ fontSize: 11, color: C.tx3, marginBottom: 10 }}>Formule Mifflin-St Jeor — nécessite poids, taille, âge et genre</div>
          <div><label style={labelStyle}>Poids (kg)</label><input style={inputStyle} type="number" min={30} max={250} step={0.1} value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="ex: 75.5" /></div>
          {(!heightCm || !age || !gender) && <div style={{ fontSize: 11, color: C.o, marginTop: 8 }}>Complète taille, âge et genre ci-dessus pour calculer automatiquement</div>}
        </div>
      )}
      {metaMode === "formula_bf" && (
        <div style={{ background: C.s2, borderRadius: 10, padding: 12, marginBottom: 12, border: "1px solid " + C.brd }}>
          <div style={{ fontSize: 11, color: C.tx3, marginBottom: 10 }}>Formule Katch-McArdle — nécessite poids et % de masse grasse</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={labelStyle}>Poids (kg)</label><input style={inputStyle} type="number" min={30} max={250} step={0.1} value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="ex: 75.5" /></div>
            <div><label style={labelStyle}>Masse grasse (%)</label><input style={inputStyle} type="number" min={1} max={60} step={0.1} value={bodyFatPct} onChange={e => setBodyFatPct(e.target.value)} placeholder="ex: 18" /></div>
          </div>
        </div>
      )}
      <div>
        <label style={labelStyle}>{metaMode === "manual" ? "Métabolisme de base (kcal/j)" : "Résultat calculé (kcal/j) — modifiable"}</label>
        <input style={{ ...inputStyle, border: "1px solid " + (metaMode !== "manual" ? C.coach + "60" : C.brdL) }} type="number" min={800} max={6000} value={metaManual} onChange={e => setMetaManual(e.target.value)} placeholder="ex: 1850" />
        {metaManual && <div style={{ fontSize: 11, color: C.tx3, marginTop: 4 }}>{parseInt(metaManual).toLocaleString("fr-FR")} kcal / jour</div>}
      </div>

      {error && <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: C.r + "15", border: "1px solid " + C.r + "40", fontSize: 13, color: C.r }}>{error}</div>}

      {/* ── Alimentation ── */}
      <div style={sectionTitle}>Alimentation</div>

      {/* Stratégie */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Stratégie</label>
        <div style={{ display: "flex", gap: 8 }}>
          {([["seche", "Sèche"], ["maintenance", "Maintenance"], ["prise_de_masse", "Prise de masse"]] as [NutritionStrategyType, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setNutStrategy(k)} style={{ flex: 1, padding: "9px 4px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, border: "1px solid " + (nutStrategy === k ? C.coach : C.brdL), background: nutStrategy === k ? C.coachS : C.s2, color: nutStrategy === k ? C.coach : C.tx2 }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Poids cible */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Poids cible (kg)</label>
        <input style={inputStyle} type="number" min={30} max={250} step={0.1} placeholder="ex: 80.0" value={nutTargetWeight} onChange={e => setNutTargetWeight(e.target.value)} />
      </div>

      {/* NAP */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Niveau d'activité (NAP)</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {NAP_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setNutNap(String(opt.value))} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", border: "1px solid " + (nutNap === String(opt.value) ? C.coach : C.brdL), background: nutNap === String(opt.value) ? C.coachS : C.s2, textAlign: "left" }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: nutNap === String(opt.value) ? C.coach : C.tx }}>{opt.label}</span>
                <span style={{ fontSize: 11, color: C.tx3, marginLeft: 8 }}>{opt.sub}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: nutNap === String(opt.value) ? C.coach : C.tx3 }}>×{opt.value}</span>
            </button>
          ))}
        </div>
        {tdee > 0 && (
          <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: C.s2, border: "1px solid " + C.brdL, fontSize: 12 }}>
            <span style={{ color: C.tx3 }}>TDEE (dépense totale) : </span>
            <span style={{ fontWeight: 800, color: C.tx }}>{tdee.toLocaleString("fr-FR")} kcal/j</span>
            <span style={{ color: C.tx3, fontSize: 10 }}> = BMR {bmr} × {nap}</span>
          </div>
        )}
      </div>

      {/* Déficit / Surplus / Tolérance selon stratégie */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>{stratPctMeta.label}</label>
        <input
          style={inputStyle}
          type="number" min={stratPctMeta.min} max={stratPctMeta.max} step={0.5}
          placeholder={stratPctMeta.placeholder}
          value={nutTargetPct}
          onChange={e => setNutTargetPct(e.target.value)}
        />
        {nutTargetPct && tdee > 0 && (
          <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 8, background: C.s2, border: "1px solid " + C.brdL, fontSize: 12 }}>
            <span style={{ color: C.tx3 }}>Calories cibles : </span>
            <span style={{ fontWeight: 800, color: nutStrategy === "seche" ? C.r : nutStrategy === "prise_de_masse" ? C.g : C.b }}>
              {computeTargetKcal(tdee, nutTargetPct, nutStrategy).toLocaleString("fr-FR")} kcal/j
            </span>
          </div>
        )}
      </div>

      {/* Mode de calcul calorique */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Mode de calcul calorique</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {([
            ["nap",    "BMR × NAP",           "Calories fixes basées sur le niveau d'activité"],
            ["active", "BMR + calories actives", "L'athlète saisit ses calories actives quotidiennes"],
            ["hybrid", "Hybride",              "NAP par défaut, remplacé si l'athlète saisit ses calories actives"],
          ] as [CalorieMode, string, string][]).map(([mode, label, sub]) => (
            <button key={mode} onClick={() => setNutCalorieMode(mode)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", border: "1px solid " + (nutCalorieMode === mode ? C.coach : C.brdL), background: nutCalorieMode === mode ? C.coachS : C.s2, textAlign: "left" }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: nutCalorieMode === mode ? C.coach : C.tx }}>{label}</span>
                <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>{sub}</div>
              </div>
              {nutCalorieMode === mode && <span style={{ fontSize: 16, color: C.coach }}>✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Total kcal (affiché toujours, auto-calculé ou manuel) */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Total calorique journalier cible (kcal)</label>
        <input style={{ ...inputStyle, border: "1px solid " + (tdee > 0 ? C.coach + "60" : C.brdL) }} type="number" min={500} max={8000} placeholder="ex: 2200" value={nutTotalCalCoach} onChange={e => setNutTotalCalCoach(e.target.value)} />
        {tdee > 0 && <div style={{ fontSize: 10, color: C.tx3, marginTop: 4 }}>Auto-calculé depuis TDEE — modifiable si besoin</div>}
      </div>

      {/* ── Macronutriments ── */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Répartition des macros</label>
          <button type="button" onClick={applyDefaultPcts} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid " + C.coach + "50", background: C.coachS, color: C.coach, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Suggestion {nutStrategy === "seche" ? "40/25/35" : nutStrategy === "prise_de_masse" ? "50/25/25" : "45/30/25"}
          </button>
        </div>

        {!totalRefKcal && (
          <div style={{ fontSize: 11, color: C.o, marginBottom: 10, padding: "6px 10px", borderRadius: 7, background: C.o + "12", border: "1px solid " + C.o + "30" }}>
            Renseigne les calories cibles ci-dessus pour que les grammes se calculent automatiquement.
          </div>
        )}

        {(() => {
          const pctSum = (parseFloat(nutGlucidesPct) || 0) + (parseFloat(nutLipidesPct) || 0) + (parseFloat(nutProteinesPct) || 0);
          const pctOk = pctSum === 0 || (pctSum >= 98 && pctSum <= 102);
          const macros = [
            { k: "g" as const, label: "Glucides", pct: nutGlucidesPct, g: nutGlucides, color: C.b },
            { k: "l" as const, label: "Lipides",  pct: nutLipidesPct,  g: nutLipides,  color: C.o },
            { k: "p" as const, label: "Protéines",pct: nutProteinesPct,g: nutProteines, color: C.g },
          ];
          return (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 8 }}>
                {macros.map(m => (
                  <div key={m.k} style={{ background: C.s2, borderRadius: 10, padding: "10px 10px 8px", border: "1px solid " + m.color + "30" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: m.color, marginBottom: 8 }}>{m.label}</div>
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 9, color: C.tx3, marginBottom: 3 }}>%</div>
                      <input style={{ ...inputStyle, padding: "7px 8px", fontSize: 15, fontWeight: 800, textAlign: "center" as const, borderColor: m.color + "50", color: m.color }} type="number" min={0} max={100} step={1} placeholder="—" value={m.pct} onChange={e => onPctChange(m.k, e.target.value)} />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: C.tx3, marginBottom: 3 }}>grammes</div>
                      <input style={{ ...inputStyle, padding: "6px 8px", fontSize: 13, textAlign: "center" as const }} type="number" min={0} max={1000} placeholder="0" value={m.g} onChange={e => onGramChange(m.k, e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: pctOk ? C.tx3 : C.r, fontWeight: pctOk ? 400 : 700 }}>
                  Total % : {pctSum}%{!pctOk && " ≠ 100%"}
                </span>
                {(nutGlucides || nutLipides || nutProteines) && (
                  <span style={{ color: C.tx3 }}>
                    Total kcal :&nbsp;
                    <span style={{ fontWeight: 700, color: C.tx }}>
                      {((parseInt(nutGlucides) || 0) * 4) + ((parseInt(nutLipides) || 0) * 9) + ((parseInt(nutProteines) || 0) * 4)}
                    </span>
                  </span>
                )}
              </div>
            </>
          );
        })()}
      </div>

      {/* ── Bouton unique ── */}
      <button
        onClick={handleSave}
        disabled={saving || !nutLoaded}
        style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: saving || !nutLoaded ? C.s2 : C.coach, color: saving || !nutLoaded ? C.tx3 : "#fff", fontSize: 15, fontWeight: 700, cursor: saving || !nutLoaded ? "default" : "pointer", fontFamily: "inherit", marginTop: 24 }}
      >
        {saving ? "Enregistrement..." : "Enregistrer"}
      </button>
    </div>
  );

  if (inline) {
    return <div style={{ background: C.s1, borderRadius: 14, border: "1px solid " + C.coach + "50" }}>{formContent}</div>;
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 480, background: C.s1, borderRadius: "16px 16px 0 0", maxHeight: "92vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        {formContent}
      </div>
    </div>
  );
}
