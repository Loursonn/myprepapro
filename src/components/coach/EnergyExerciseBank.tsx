import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EnergyExercise {
  id: string;
  name: string;
  type: string;
  custom_type?: string;
  description?: string;
  photo_url?: string;
  is_official: boolean;
  created_by?: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const TYPES = [
  { id: "course", label: "Course à pied", emoji: "🏃" },
  { id: "skierg", label: "SkiErg", emoji: "⛷️" },
  { id: "bikeerg", label: "BikeErg", emoji: "🚴" },
  { id: "wattbike", label: "WattBike", emoji: "⚡" },
  { id: "rameur", label: "Rameur", emoji: "🚣" },
  { id: "velo", label: "Vélo", emoji: "🚲" },
  { id: "natation", label: "Natation", emoji: "🏊" },
  { id: "corde", label: "Corde à sauter", emoji: "🪢" },
  { id: "custom", label: "Custom", emoji: "➕" },
];

const TYPE_COLORS: Record<string, string> = {
  course: "#EF4B4B", skierg: "#3B8DF0", bikeerg: "#22C993",
  wattbike: "#F5A623", rameur: "#7B6FFF", velo: "#D4538E",
  natation: "#30B0E0", corde: "#C060D0", custom: "#9194A0",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  coachId: string;
  C: Record<string, string>;
  onSelectExercise?: (ex: EnergyExercise) => void;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function EnergyExerciseBank({ coachId, C, onSelectExercise }: Props) {
  const { profile } = useAuth();
  const [exercises, setExercises] = useState<EnergyExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editEx, setEditEx] = useState<EnergyExercise | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [form, setForm] = useState({
    name: "", type: "course", custom_type: "", description: "", photo_url: "",
  });

  const isAdmin = profile?.is_admin === true;

  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("energy_exercises")
      .select("*")
      .order("is_official", { ascending: false })
      .order("name");
    setExercises((data as EnergyExercise[]) || []);
    setLoading(false);
  };

  const handlePhotoUpload = async (file: File) => {
    setPhotoUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${coachId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("energy-exercise-photos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("energy-exercise-photos").getPublicUrl(path);
      setForm(f => ({ ...f, photo_url: urlData.publicUrl }));
    } finally {
      setPhotoUploading(false);
    }
  };

  const openCreate = () => {
    setForm({ name: "", type: "course", custom_type: "", description: "", photo_url: "" });
    setEditEx(null);
    setShowForm(true);
  };

  const openEdit = (ex: EnergyExercise) => {
    setForm({ name: ex.name, type: ex.type, custom_type: ex.custom_type || "", description: ex.description || "", photo_url: ex.photo_url || "" });
    setEditEx(ex);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      type: form.type,
      custom_type: form.type === "custom" ? form.custom_type : null,
      description: form.description || null,
      photo_url: form.photo_url || null,
      created_by: coachId,
      is_official: isAdmin,
    };

    if (editEx) {
      await supabase.from("energy_exercises").update(payload).eq("id", editEx.id);
    } else {
      await supabase.from("energy_exercises").insert(payload);
    }
    setShowForm(false);
    loadExercises();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("energy_exercises").delete().eq("id", id);
    setConfirmDelete(null);
    loadExercises();
  };

  const filtered = exercises.filter(ex => {
    const matchType = filterType === "all" || ex.type === filterType;
    const matchSearch = !search || ex.name.toLowerCase().includes(search.toLowerCase()) || (ex.description || "").toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const canEdit = (ex: EnergyExercise) => isAdmin || ex.created_by === coachId;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.tx }}>Banque d'exercices énergétiques</div>
          <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>{exercises.length} exercices disponibles</div>
        </div>
        <button onClick={openCreate}
          style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: C.ac, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          + Créer
        </button>
      </div>

      {/* Recherche */}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un exercice…"
        style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid " + C.brdL, background: C.s1, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 10 }} />

      {/* Filtres par type */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 14 }}>
        <button onClick={() => setFilterType("all")}
          style={{ flexShrink: 0, padding: "5px 14px", borderRadius: 8, border: "1px solid " + (filterType === "all" ? C.ac : C.brdL), background: filterType === "all" ? C.acS : "transparent", color: filterType === "all" ? C.ac : C.tx3, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Tous
        </button>
        {TYPES.map(t => (
          <button key={t.id} onClick={() => setFilterType(t.id)}
            style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 8, border: "1px solid " + (filterType === t.id ? (TYPE_COLORS[t.id] || C.ac) : C.brdL), background: filterType === t.id ? (TYPE_COLORS[t.id] || C.ac) + "20" : "transparent", color: filterType === t.id ? (TYPE_COLORS[t.id] || C.ac) : C.tx3, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <span>{t.emoji}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "30px 0", color: C.tx3, fontSize: 13 }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 20px", background: C.s1, borderRadius: 12, border: "1px solid " + C.brd }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 13, color: C.tx3 }}>Aucun exercice trouvé</div>
        </div>
      ) : (
        filtered.map(ex => {
          const typeInfo = TYPES.find(t => t.id === ex.type);
          const typeColor = TYPE_COLORS[ex.type] || C.ac;
          return (
            <div key={ex.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid " + C.brdL, background: C.s1, marginBottom: 8 }}>
              {ex.photo_url ? (
                <img src={ex.photo_url} alt={ex.name} style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 10, background: typeColor + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                  {typeInfo?.emoji || "🏃"}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>{ex.name}</div>
                  {ex.is_official && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: C.g + "20", color: C.g }}>OFFICIEL</span>}
                </div>
                <div style={{ fontSize: 11, color: typeColor, fontWeight: 600 }}>
                  {typeInfo?.emoji} {ex.type === "custom" ? (ex.custom_type || "Custom") : typeInfo?.label}
                </div>
                {ex.description && <div style={{ fontSize: 11, color: C.tx3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.description}</div>}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {onSelectExercise && (
                  <button onClick={() => onSelectExercise(ex)}
                    style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: C.ac, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    Utiliser
                  </button>
                )}
                {canEdit(ex) && (
                  <>
                    <button onClick={() => openEdit(ex)}
                      style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, fontSize: 13, cursor: "pointer" }}>✏️</button>
                    <button onClick={() => setConfirmDelete(ex.id)}
                      style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid rgba(239,75,75,0.3)", background: "rgba(239,75,75,0.08)", color: "#EF4B4B", fontSize: 13, cursor: "pointer" }}>×</button>
                  </>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Modal création/édition */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowForm(false)}>
          <div style={{ width: "100%", maxWidth: 600, background: C.s1, borderRadius: "16px 16px 0 0", padding: "20px 20px 40px", maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.tx, marginBottom: 16 }}>{editEx ? "Modifier" : "Créer"} un exercice énergétique</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: C.tx3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Nom *</div>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Intervalles 400m piste"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>

              <div>
                <div style={{ fontSize: 10, color: C.tx3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Type d'appareil</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TYPES.map(t => (
                    <button key={t.id} onClick={() => setForm(f => ({ ...f, type: t.id }))}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid " + (form.type === t.id ? (TYPE_COLORS[t.id] || C.ac) : C.brdL), background: form.type === t.id ? (TYPE_COLORS[t.id] || C.ac) + "20" : "transparent", color: form.type === t.id ? (TYPE_COLORS[t.id] || C.ac) : C.tx3, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      <span>{t.emoji}</span> {t.label}
                    </button>
                  ))}
                </div>
                {form.type === "custom" && (
                  <input value={form.custom_type} onChange={e => setForm(f => ({ ...f, custom_type: e.target.value }))} placeholder="Nom du type d'appareil"
                    style={{ marginTop: 8, width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                )}
              </div>

              <div>
                <div style={{ fontSize: 10, color: C.tx3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Description</div>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Décrire l'exercice, les consignes…"
                  rows={2}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              </div>

              {/* Photo */}
              <div>
                <div style={{ fontSize: 10, color: C.tx3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Photo</div>
                {form.photo_url ? (
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <img src={form.photo_url} alt="Preview" style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 9, objectFit: "cover" }} />
                    <button onClick={() => setForm(f => ({ ...f, photo_url: "" }))}
                      style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(239,75,75,0.9)", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                ) : (
                  <label style={{ display: "block", padding: "16px", borderRadius: 9, border: "1px dashed " + C.brdL, background: C.s2, textAlign: "center", cursor: photoUploading ? "default" : "pointer" }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>📸</div>
                    <div style={{ fontSize: 11, color: C.tx3 }}>{photoUploading ? "Upload…" : "Ajouter une photo"}</div>
                    <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} style={{ display: "none" }} />
                  </label>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowForm(false)}
                style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Annuler
              </button>
              <button onClick={handleSubmit} disabled={!form.name.trim()}
                style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none", background: form.name.trim() ? C.ac : C.s2, color: form.name.trim() ? "#fff" : C.tx3, fontSize: 13, fontWeight: 700, cursor: form.name.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
                {editEx ? "Mettre à jour" : "Créer l'exercice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setConfirmDelete(null)}>
          <div style={{ background: C.s1, borderRadius: 16, padding: 24, maxWidth: 320, width: "100%", border: "1px solid " + C.brd }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.tx, marginBottom: 8 }}>Supprimer cet exercice ?</div>
            <div style={{ fontSize: 12, color: C.tx3, marginBottom: 20 }}>Cette action est irréversible.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "1px solid " + C.brdL, background: "transparent", color: C.tx2, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
              <button onClick={() => handleDelete(confirmDelete!)}
                style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "none", background: "#EF4B4B", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
