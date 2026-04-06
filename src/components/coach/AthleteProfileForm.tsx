import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth, Profile } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";
import {
  getNutritionStrategy,
  upsertNutritionStrategy,
  NutritionStrategyType,
  NutritionStrategy,
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

  // ── Nutrition strategy state ──────────────────────────────────────────────
  const [nutStrategy, setNutStrategy] = useState<NutritionStrategyType>("maintenance");
  const [nutTargetWeight, setNutTargetWeight] = useState("");
  const [nutCanTrack, setNutCanTrack] = useState(false);
  const [nutTotalCalCoach, setNutTotalCalCoach] = useState("");
  const [nutSurplusMin, setNutSurplusMin] = useState("");
  const [nutSurplusMax, setNutSurplusMax] = useState("");
  const [nutGlucides, setNutGlucides] = useState("");
  const [nutLipides, setNutLipides] = useState("");
  const [nutProteines, setNutProteines] = useState("");
  const [nutSaving, setNutSaving] = useState(false);
  const [nutLoaded, setNutLoaded] = useState(false);

  useEffect(() => {
    getNutritionStrategy(athlete.id)
      .then(s => {
        if (s) {
          setNutStrategy(s.strategy);
          setNutTargetWeight(s.target_weight?.toString() ?? "");
          setNutCanTrack(s.can_track_calories);
          setNutTotalCalCoach(s.total_calories_coach?.toString() ?? "");
          setNutSurplusMin(s.surplus_deficit_min?.toString() ?? "");
          setNutSurplusMax(s.surplus_deficit_max?.toString() ?? "");
          setNutGlucides(s.macros_glucides?.toString() ?? "");
          setNutLipides(s.macros_lipides?.toString() ?? "");
          setNutProteines(s.macros_proteines?.toString() ?? "");
        }
      })
      .catch(console.error)
      .finally(() => setNutLoaded(true));
  }, [athlete.id]);

  // Auto-calculate metabolism when formula inputs change
  useEffect(() => {
    if (metaMode === "formula_no_bf") {
      const w = parseFloat(weightKg);
      const h = parseFloat(heightCm);
      const a = parseInt(age);
      if (w > 0 && h > 0 && a > 0 && (gender === "male" || gender === "female")) {
        setMetaManual(calcMifflin(w, h, a, gender).toString());
      }
    } else if (metaMode === "formula_bf") {
      const w = parseFloat(weightKg);
      const bf = parseFloat(bodyFatPct);
      if (w > 0 && bf > 0 && bf < 100) {
        setMetaManual(calcKatchMcArdle(w, bf).toString());
      }
    }
  }, [metaMode, weightKg, heightCm, age, gender, bodyFatPct]);

  async function handleSaveNutrition() {
    if (!user?.id) return;
    setNutSaving(true);
    try {
      const payload: NutritionStrategy = {
        strategy: nutStrategy,
        can_track_calories: nutCanTrack,
        target_weight: nutTargetWeight ? parseFloat(nutTargetWeight) : null,
        total_calories_coach: nutTotalCalCoach ? parseInt(nutTotalCalCoach) : null,
        surplus_deficit_min: nutSurplusMin ? parseFloat(nutSurplusMin) : null,
        surplus_deficit_max: nutSurplusMax ? parseFloat(nutSurplusMax) : null,
        macros_glucides: nutGlucides ? parseInt(nutGlucides) : null,
        macros_lipides: nutLipides ? parseInt(nutLipides) : null,
        macros_proteines: nutProteines ? parseInt(nutProteines) : null,
      };
      await upsertNutritionStrategy(athlete.id, payload);
      toast.success("Stratégie nutritionnelle enregistrée !");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'enregistrement");
    } finally {
      setNutSaving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await updateAthleteProfile(athlete.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        age: age ? parseInt(age) : null,
        height_cm: heightCm ? parseInt(heightCm) : null,
        gender: (gender as "male" | "female") || null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        body_fat_pct: bodyFatPct ? parseFloat(bodyFatPct) : null,
        base_metabolism: metaManual ? parseInt(metaManual) : null,
      });
      onClose();
    } catch (e: any) {
      setError(e.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

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

  const formContent = (
    <div style={{ padding: inline ? "16px" : "20px 20px 32px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.tx }}>{isOwnProfile ? "Mon profil" : "Profil de l'athlète"}</div>
            <div style={{ fontSize: 12, color: C.tx3, marginTop: 2 }}>{athlete.full_name}</div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, fontSize: 18, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            ×
          </button>
        </div>

        {/* Identité */}
        <div style={sectionTitle}>Identité</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Prénom</label>
            <input style={inputStyle} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Prénom" />
          </div>
          <div>
            <label style={labelStyle}>Nom</label>
            <input style={inputStyle} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Nom" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Âge</label>
            <input style={inputStyle} type="number" min={10} max={100} value={age} onChange={e => setAge(e.target.value)} placeholder="ex: 24" />
          </div>
          <div>
            <label style={labelStyle}>Taille (cm)</label>
            <input style={inputStyle} type="number" min={100} max={250} value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="ex: 178" />
          </div>
        </div>

        {/* Genre */}
        <div style={{ marginBottom: 4 }}>
          <label style={labelStyle}>Genre</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["male", "female"] as const).map(g => (
              <button
                key={g}
                onClick={() => setGender(g)}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, fontWeight: 600,
                  border: "1px solid " + (gender === g ? C.ac : C.brdL),
                  background: gender === g ? C.acS : C.s2,
                  color: gender === g ? C.ac : C.tx2,
                }}
              >
                {g === "male" ? "Homme" : "Femme"}
              </button>
            ))}
          </div>
        </div>

        {/* Métabolisme de base */}
        <div style={sectionTitle}>Métabolisme de base</div>

        {/* Mode selector */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" as const }}>
          {([
            ["manual", "Manuel"],
            ["formula_no_bf", "Formule (sans MG)"],
            ["formula_bf", "Formule (avec MG)"],
          ] as [MetaMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setMetaMode(mode)}
              style={{
                padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                fontSize: 11, fontWeight: 600,
                border: "1px solid " + (metaMode === mode ? C.coach : C.brdL),
                background: metaMode === mode ? C.coachS : C.s2,
                color: metaMode === mode ? C.coach : C.tx2,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Formule sans MG — Mifflin-St Jeor */}
        {metaMode === "formula_no_bf" && (
          <div style={{ background: C.s2, borderRadius: 10, padding: 12, marginBottom: 12, border: "1px solid " + C.brd }}>
            <div style={{ fontSize: 11, color: C.tx3, marginBottom: 10 }}>
              Formule Mifflin-St Jeor — nécessite poids, taille, âge et genre
            </div>
            <div>
              <label style={labelStyle}>Poids (kg)</label>
              <input style={inputStyle} type="number" min={30} max={250} step={0.1} value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="ex: 75.5" />
            </div>
            {(!heightCm || !age || !gender) && (
              <div style={{ fontSize: 11, color: C.o, marginTop: 8 }}>
                Complète taille, âge et genre ci-dessus pour calculer automatiquement
              </div>
            )}
          </div>
        )}

        {/* Formule avec MG — Katch-McArdle */}
        {metaMode === "formula_bf" && (
          <div style={{ background: C.s2, borderRadius: 10, padding: 12, marginBottom: 12, border: "1px solid " + C.brd }}>
            <div style={{ fontSize: 11, color: C.tx3, marginBottom: 10 }}>
              Formule Katch-McArdle — nécessite poids et % de masse grasse
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Poids (kg)</label>
                <input style={inputStyle} type="number" min={30} max={250} step={0.1} value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="ex: 75.5" />
              </div>
              <div>
                <label style={labelStyle}>Masse grasse (%)</label>
                <input style={inputStyle} type="number" min={1} max={60} step={0.1} value={bodyFatPct} onChange={e => setBodyFatPct(e.target.value)} placeholder="ex: 18" />
              </div>
            </div>
          </div>
        )}

        {/* Valeur MB résultante */}
        <div>
          <label style={labelStyle}>
            {metaMode === "manual" ? "Métabolisme de base (kcal/j)" : "Résultat calculé (kcal/j) — modifiable"}
          </label>
          <input
            style={{ ...inputStyle, border: "1px solid " + (metaMode !== "manual" ? C.coach + "60" : C.brdL) }}
            type="number"
            min={800}
            max={6000}
            value={metaManual}
            onChange={e => setMetaManual(e.target.value)}
            placeholder="ex: 1850"
          />
          {metaManual && (
            <div style={{ fontSize: 11, color: C.tx3, marginTop: 4 }}>
              {parseInt(metaManual).toLocaleString("fr-FR")} kcal / jour
            </div>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: C.r + "15", border: "1px solid " + C.r + "40", fontSize: 13, color: C.r }}>
            {error}
          </div>
        )}

        {/* ── Alimentation ────────────────────────────────────────────────── */}
        <div style={sectionTitle}>Alimentation</div>

        {/* Général */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Poids cible (kg)</label>
          <input
            style={inputStyle}
            type="number" min={30} max={250} step={0.1}
            placeholder="ex: 80.0"
            value={nutTargetWeight}
            onChange={e => setNutTargetWeight(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: C.s2, border: "1px solid " + C.brdL, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13, color: C.tx, fontWeight: 600 }}>L'athlète peut tracker ses calories</div>
            <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>Montre connectée, app tierce…</div>
          </div>
          <Switch
            checked={nutCanTrack}
            onCheckedChange={setNutCanTrack}
            className="data-[state=checked]:bg-[#7B6FFF]"
          />
        </div>

        {!nutCanTrack && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Total calorique journalier fixé par le coach (kcal)</label>
            <input
              style={inputStyle}
              type="number" min={500} max={8000}
              placeholder="ex: 2200"
              value={nutTotalCalCoach}
              onChange={e => setNutTotalCalCoach(e.target.value)}
            />
          </div>
        )}

        {/* Stratégie */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Stratégie</label>
          <select
            style={{ ...inputStyle }}
            value={nutStrategy}
            onChange={e => setNutStrategy(e.target.value as NutritionStrategyType)}
          >
            <option value="maintenance">Maintenance</option>
            <option value="seche">Sèche</option>
            <option value="prise_de_masse">Prise de masse</option>
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>
              Surplus/Déficit min (%)
            </label>
            <input
              style={inputStyle}
              type="number" step={0.5}
              placeholder={nutStrategy === "seche" ? "-20" : nutStrategy === "prise_de_masse" ? "+3" : "-3"}
              value={nutSurplusMin}
              onChange={e => setNutSurplusMin(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>
              Surplus/Déficit max (%)
            </label>
            <input
              style={inputStyle}
              type="number" step={0.5}
              placeholder={nutStrategy === "seche" ? "-5" : nutStrategy === "prise_de_masse" ? "+15" : "+3"}
              value={nutSurplusMax}
              onChange={e => setNutSurplusMax(e.target.value)}
            />
          </div>
        </div>

        {/* Macronutriments */}
        <div style={{ marginBottom: 6 }}>
          <label style={labelStyle}>Macronutriments cibles</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "Glucides (g)", val: nutGlucides, set: setNutGlucides, color: C.b },
              { label: "Lipides (g)", val: nutLipides, set: setNutLipides, color: C.o },
              { label: "Protéines (g)", val: nutProteines, set: setNutProteines, color: C.g },
            ].map(m => (
              <div key={m.label}>
                <label style={{ ...labelStyle, color: m.color }}>{m.label}</label>
                <input
                  style={{ ...inputStyle, borderColor: m.color + "40" }}
                  type="number" min={0} max={1000}
                  placeholder="0"
                  value={m.val}
                  onChange={e => m.set(e.target.value)}
                />
              </div>
            ))}
          </div>
          {(nutGlucides || nutLipides || nutProteines) && (
            <div style={{ marginTop: 8, fontSize: 11, color: C.tx3 }}>
              Total théorique :&nbsp;
              <span style={{ fontWeight: 700, color: C.tx }}>
                {((parseInt(nutGlucides) || 0) * 4) + ((parseInt(nutLipides) || 0) * 9) + ((parseInt(nutProteines) || 0) * 4)} kcal
              </span>
            </div>
          )}
        </div>

        <button
          onClick={handleSaveNutrition}
          disabled={nutSaving || !nutLoaded}
          style={{
            width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
            background: nutSaving || !nutLoaded ? C.s2 : C.coach,
            color: nutSaving || !nutLoaded ? C.tx3 : "#fff",
            fontSize: 14, fontWeight: 700,
            cursor: nutSaving || !nutLoaded ? "default" : "pointer",
            fontFamily: "inherit", marginTop: 16, marginBottom: 4,
          }}
        >
          {nutSaving ? "Enregistrement..." : "Enregistrer la stratégie"}
        </button>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 2, padding: "11px 0", borderRadius: 10, border: "none", background: saving ? C.tx3 : C.coach, color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
    </div>
  );

  if (inline) {
    return (
      <div style={{ background: C.s1, borderRadius: 14, border: "1px solid " + C.coach + "50" }}>
        {formContent}
      </div>
    );
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 480, background: C.s1, borderRadius: "16px 16px 0 0", maxHeight: "92vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {formContent}
      </div>
    </div>
  );
}
