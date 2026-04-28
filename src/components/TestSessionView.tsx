import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

type TestType = "musculation" | "energetique" | "specifique" | "mobilite" | "custom";

interface TestSession {
  id: string;
  athlete_id: string;
  coach_id?: string;
  type: TestType;
  custom_type?: string;
  title: string;
  description?: string;
  reference_file_url?: string;
  reference_file_type?: string;
  date: string;
  completed: boolean;
  results_structured?: { metrics?: ResultMetric[] };
  results_note?: string;
  created_at: string;
}

interface ResultMetric {
  name: string;
  value: string;
  unit: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const TEST_TYPES: { id: TestType; label: string; emoji: string; color: string }[] = [
  { id: "musculation", label: "Musculation", emoji: "🏋️", color: "#7B6FFF" },
  { id: "energetique", label: "Énergétique", emoji: "🏃", color: "#EF4B4B" },
  { id: "specifique", label: "Spécifique", emoji: "⚡", color: "#F5A623" },
  { id: "mobilite", label: "Mobilité", emoji: "🧘", color: "#22C993" },
  { id: "custom", label: "Autre", emoji: "📋", color: "#9194A0" },
];

// ── Composant principal ────────────────────────────────────────────────────────

interface Props {
  athleteId: string;
  viewOnly?: boolean;
  isCoach?: boolean;
  C: Record<string, string>;
  testSubTab: string;
  setTestSubTab: (t: string) => void;
}

export default function TestSessionView({ athleteId, viewOnly, isCoach, C, testSubTab, setTestSubTab }: Props) {
  const [tests, setTests] = useState<TestSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"list" | "create" | "view" | "fill" | "edit">("list");
  const [selectedTest, setSelectedTest] = useState<TestSession | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  // Formulaire création
  const [createForm, setCreateForm] = useState({
    type: "musculation" as TestType,
    custom_type: "",
    title: "",
    description: "",
    reference_file_url: "",
    reference_file_type: "",
    date: new Date().toISOString().slice(0, 10),
  });

  // Formulaire résultats
  const [resultsNote, setResultsNote] = useState("");
  const [metrics, setMetrics] = useState<ResultMetric[]>([{ name: "", value: "", unit: "" }]);

  const activeType = testSubTab as TestType;

  useEffect(() => {
    loadTests();
  }, [athleteId, testSubTab]);

  const loadTests = async () => {
    setLoading(true);
    let query = supabase
      .from("test_sessions")
      .select("*")
      .eq("athlete_id", athleteId)
      .order("date", { ascending: false });

    if (activeType !== "custom") {
      query = query.eq("type", activeType);
    }

    const { data } = await query;
    setTests((data as TestSession[]) || []);
    setLoading(false);
  };

  const handleFileUpload = async (file: File) => {
    setFileUploading(true);
    setUploadError("");
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const isPdf = ext === "pdf";

      if (!isPdf) {
        // Images : stockage base64 dans la BDD (pas besoin de bucket Storage)
        if (file.size > 3 * 1024 * 1024) throw new Error("Image trop grande (max 3 Mo)");
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error("Erreur lecture fichier"));
          reader.readAsDataURL(file);
        });
        setCreateForm(f => ({ ...f, reference_file_url: dataUrl, reference_file_type: "image" }));
      } else {
        // PDFs : bucket Supabase Storage requis
        const path = `${athleteId}/${Date.now()}.pdf`;
        const { error } = await supabase.storage.from("test-media").upload(path, file);
        if (error) throw new Error("Bucket 'test-media' manquant. Créez-le dans Supabase Storage > New bucket (private).");
        const { data: signed } = await supabase.storage.from("test-media").createSignedUrl(path, 60 * 60 * 24 * 365);
        setCreateForm(f => ({ ...f, reference_file_url: signed?.signedUrl || "", reference_file_type: "pdf" }));
      }
    } catch (e: any) {
      setUploadError(e?.message || "Erreur upload");
    } finally {
      setFileUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.title.trim() || saving) return;
    setSaving(true);
    try {
      const payload = {
        athlete_id: athleteId,
        coach_id: isCoach ? athleteId : null,
        type: createForm.type,
        custom_type: createForm.type === "custom" ? createForm.custom_type : null,
        title: createForm.title.trim(),
        description: createForm.description || null,
        reference_file_url: createForm.reference_file_url || null,
        reference_file_type: createForm.reference_file_type || null,
        date: createForm.date,
        completed: false,
      };
      await supabase.from("test_sessions").insert(payload);
      setStep("list");
      loadTests();
    } finally {
      setSaving(false);
    }
  };

  const openTest = (test: TestSession) => {
    setSelectedTest(test);
    setStep("view");
  };

  const startFill = () => {
    if (!selectedTest) return;
    setResultsNote(selectedTest.results_note || "");
    setMetrics(selectedTest.results_structured?.metrics?.length
      ? selectedTest.results_structured.metrics
      : [{ name: "", value: "", unit: "" }]);
    setStep("fill");
  };

  const startEdit = () => {
    if (!selectedTest) return;
    setCreateForm({
      type: selectedTest.type,
      custom_type: selectedTest.custom_type || "",
      title: selectedTest.title,
      description: selectedTest.description || "",
      reference_file_url: selectedTest.reference_file_url || "",
      reference_file_type: selectedTest.reference_file_type || "",
      date: selectedTest.date,
    });
    setUploadError("");
    setStep("edit");
  };

  const handleEditSave = async () => {
    if (!selectedTest || !createForm.title.trim() || saving) return;
    setSaving(true);
    try {
      const payload = {
        type: createForm.type,
        custom_type: createForm.type === "custom" ? createForm.custom_type : null,
        title: createForm.title.trim(),
        description: createForm.description || null,
        reference_file_url: createForm.reference_file_url || null,
        reference_file_type: createForm.reference_file_type || null,
        date: createForm.date,
      };
      await supabase.from("test_sessions").update(payload).eq("id", selectedTest.id);
      setSelectedTest(prev => prev ? { ...prev, ...payload, custom_type: payload.custom_type ?? undefined, description: payload.description ?? undefined, reference_file_url: payload.reference_file_url ?? undefined, reference_file_type: payload.reference_file_type ?? undefined } : null);
      loadTests();
      setStep("view");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveResults = async () => {
    if (!selectedTest || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const validMetrics = metrics.filter(m => m.name.trim() && m.value.trim());
      const payload = {
        completed: true,
        results_note: resultsNote || null,
        results_structured: validMetrics.length ? { metrics: validMetrics } : {},
        updated_at: new Date().toISOString(),
      };
      const { error: updateErr } = await supabase.from("test_sessions").update(payload).eq("id", selectedTest.id);
      if (updateErr) throw updateErr;

      // Sauvegarder comme performance (optionnel — table peut ne pas exister)
      if (validMetrics.length > 0) {
        try {
          for (const m of validMetrics) {
            const numVal = parseFloat(m.value);
            if (!isNaN(numVal)) {
              await supabase.from("performance_logs").insert({
                athlete_id: athleteId,
                metric_type: guessMetricType(m.name),
                metric_name: m.name,
                value: numVal,
                unit: m.unit || "custom",
                date: selectedTest.date,
                test_session_id: selectedTest.id,
                is_active_reference: false,
                created_by: athleteId,
              });
            }
          }
        } catch (_) { /* performance_logs optionnel */ }

        // Notifier coach (optionnel)
        try {
          const { data: prof } = await supabase.from("profiles").select("coach_id").eq("id", athleteId).single();
          if (prof?.coach_id) {
            await supabase.from("performance_notifications").insert({
              coach_id: prof.coach_id,
              athlete_id: athleteId,
              test_session_id: selectedTest.id,
              status: "pending",
            });
          }
        } catch (_) { /* performance_notifications optionnel */ }
      }

      setSelectedTest(prev => prev ? { ...prev, completed: true, results_note: resultsNote || undefined, results_structured: validMetrics.length ? { metrics: validMetrics } : {} } : prev);
      setStep("list");
      loadTests();
    } catch (e: any) {
      setSaveError(e?.message || "Erreur lors de l'enregistrement des résultats.");
    } finally {
      setSaving(false);
    }
  };

  const guessMetricType = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes("vma")) return "vma";
    if (n.includes("vitesse critique") || n.includes("vc")) return "vitesse_critique";
    if (n.includes("1rm") || n.includes("rm")) return "one_rm";
    if (n.includes("fc") || n.includes("fréquence")) return "fc_max";
    return "custom";
  };

  const typeInfo = TEST_TYPES.find(t => t.id === activeType);

  // ── Sous-onglets ──────────────────────────────────────────────────────────────
  const SubTabs = () => (
    <div style={{ display: "flex", borderBottom: "1px solid " + C.brd, background: C.bg, paddingLeft: 16, paddingRight: 16, gap: 0, overflowX: "auto" }}>
      {TEST_TYPES.map(t => (
        <button key={t.id} onClick={() => { setTestSubTab(t.id); setStep("list"); }}
          style={{ flexShrink: 0, padding: "10px 12px", border: "none", borderBottom: "2px solid " + (testSubTab === t.id ? t.color : "transparent"), background: "transparent", color: testSubTab === t.id ? t.color : C.tx3, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.3px" }}>
          {t.emoji} {t.label}
        </button>
      ))}
    </div>
  );

  // ── Vue liste ──────────────────────────────────────────────────────────────────
  if (step === "list") {
    return (
      <div>
        <SubTabs />
        <div style={{ padding: "16px 16px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.tx }}>Tests {typeInfo?.label}</div>
              <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>{tests.filter(t => t.completed).length}/{tests.length} réalisés</div>
            </div>
            <button onClick={() => { setCreateForm(f => ({ ...f, type: activeType, title: "", description: "", reference_file_url: "", reference_file_type: "", date: new Date().toISOString().slice(0, 10) })); setStep("create"); }}
              style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: typeInfo?.color || C.ac, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              + Créer
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: C.tx3 }}>Chargement…</div>
          ) : tests.length === 0 ? (
            <div style={{ background: C.s1, borderRadius: 14, padding: "32px 20px", border: "1px solid " + C.brd, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>{typeInfo?.emoji}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 6 }}>Aucun test {typeInfo?.label}</div>
              <div style={{ fontSize: 12, color: C.tx3 }}>Crée un test pour commencer le suivi</div>
            </div>
          ) : (
            tests.map(test => {
              const tInfo = TEST_TYPES.find(t => t.id === test.type);
              return (
                <button key={test.id} onClick={() => openTest(test)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 12, border: "1px solid " + (test.completed ? C.g + "40" : C.brdL), background: C.s1, marginBottom: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: (tInfo?.color || C.ac) + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    {tInfo?.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>{test.title}</div>
                      {test.completed && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: C.g + "20", color: C.g }}>FAIT</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>{test.date}</div>
                    {test.results_structured?.metrics?.length ? (
                      <div style={{ fontSize: 10, color: C.tx3, marginTop: 3 }}>
                        {test.results_structured.metrics.filter(m => m.name && m.value).map((m, i) => (
                          <span key={i} style={{ marginRight: 8 }}>{m.name}: <strong style={{ color: tInfo?.color }}>{m.value} {m.unit}</strong></span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 18, color: C.tx3 }}>›</div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ── Vue création ──────────────────────────────────────────────────────────────
  if (step === "create") {
    return (
      <div>
        <SubTabs />
        <div style={{ padding: "16px 16px 40px" }}>
          <button onClick={() => setStep("list")} style={{ background: "none", border: "none", color: C.tx3, fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 14 }}>‹ Retour</button>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.tx, marginBottom: 16 }}>Créer un test</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Type */}
            <div style={{ background: C.s1, borderRadius: 12, padding: 14, border: "1px solid " + C.brd }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Type de test</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TEST_TYPES.map(t => (
                  <button key={t.id} onClick={() => setCreateForm(f => ({ ...f, type: t.id }))}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1px solid " + (createForm.type === t.id ? t.color : C.brdL), background: createForm.type === t.id ? t.color + "20" : "transparent", color: createForm.type === t.id ? t.color : C.tx3, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    <span>{t.emoji}</span> {t.label}
                  </button>
                ))}
              </div>
              {createForm.type === "custom" && (
                <input value={createForm.custom_type} onChange={e => setCreateForm(f => ({ ...f, custom_type: e.target.value }))} placeholder="Préciser le type de test…"
                  style={{ marginTop: 10, width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              )}
            </div>

            {/* Titre */}
            <div style={{ background: C.s1, borderRadius: 12, padding: 14, border: "1px solid " + C.brd }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Titre *</div>
              <input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Test VMA Cooper — 12 min"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            </div>

            {/* Date */}
            <div style={{ background: C.s1, borderRadius: 12, padding: 14, border: "1px solid " + C.brd }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Date du test</div>
              <input type="date" value={createForm.date} onChange={e => setCreateForm(f => ({ ...f, date: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            </div>

            {/* Description texte */}
            <div style={{ background: C.s1, borderRadius: 12, padding: 14, border: "1px solid " + C.brd }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Instructions / Description</div>
              <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Décris le protocole du test, les consignes pour l'athlète…"
                rows={4}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            </div>

            {/* Fichier de référence */}
            <div style={{ background: C.s1, borderRadius: 12, padding: 14, border: "1px solid " + C.brd }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Fichier de référence (optionnel)</div>
              <div style={{ fontSize: 10, color: C.tx3, marginBottom: 10 }}>Photo, schéma, PDF de protocole</div>
              {createForm.reference_file_url ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {createForm.reference_file_type === "image" ? (
                    <img src={createForm.reference_file_url} alt="Ref" style={{ height: 80, borderRadius: 8, objectFit: "cover" }} />
                  ) : (
                    <div style={{ padding: "10px 16px", borderRadius: 8, background: C.s2, color: C.ac, fontSize: 12, fontWeight: 600 }}>📄 PDF chargé</div>
                  )}
                  <button onClick={() => setCreateForm(f => ({ ...f, reference_file_url: "", reference_file_type: "" }))}
                    style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "rgba(239,75,75,0.12)", color: "#EF4B4B", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Supprimer</button>
                </div>
              ) : (
                <label style={{ display: "block", padding: "20px", borderRadius: 9, border: "1px dashed " + (uploadError ? "#EF4B4B" : C.brdL), background: C.s2, textAlign: "center", cursor: fileUploading ? "default" : "pointer" }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>📎</div>
                  <div style={{ fontSize: 12, color: uploadError ? "#EF4B4B" : C.tx3 }}>{fileUploading ? "Upload en cours…" : uploadError || "Photo, PNG, JPG ou PDF"}</div>
                  <input type="file" accept="image/*,application/pdf" onChange={e => { setUploadError(""); if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} style={{ display: "none" }} />
                </label>
              )}
            </div>
          </div>

          <button onClick={handleCreate} disabled={!createForm.title.trim() || saving}
            style={{ width: "100%", padding: "15px 0", borderRadius: 14, border: "none", background: (createForm.title.trim() && !saving) ? (typeInfo?.color || C.ac) : C.s2, color: (createForm.title.trim() && !saving) ? "#fff" : C.tx3, fontSize: 14, fontWeight: 800, cursor: (createForm.title.trim() && !saving) ? "pointer" : "default", fontFamily: "inherit", marginTop: 20 }}>
            {saving ? "Création…" : "Créer le test"}
          </button>
        </div>
      </div>
    );
  }

  // ── Vue détail du test ────────────────────────────────────────────────────────
  if (step === "view" && selectedTest) {
    const tInfo = TEST_TYPES.find(t => t.id === selectedTest.type);
    return (
      <div>
        <SubTabs />
        <div style={{ padding: "16px 16px 40px" }}>
          <button onClick={() => setStep("list")} style={{ background: "none", border: "none", color: C.tx3, fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 14 }}>‹ Retour</button>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: (tInfo?.color || C.ac) + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{tInfo?.emoji}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.tx }}>{selectedTest.title}</div>
              <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>{selectedTest.date} · {tInfo?.label}{selectedTest.custom_type ? " — " + selectedTest.custom_type : ""}</div>
            </div>
          </div>

          {/* Fichier de référence */}
          {selectedTest.reference_file_url && (
            <div style={{ marginBottom: 14 }}>
              {selectedTest.reference_file_type === "image" ? (
                <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid " + C.brdL, background: C.s2, maxWidth: "100%" }}>
                  <img src={selectedTest.reference_file_url} alt="Référence" style={{ width: "100%", display: "block", maxHeight: 320, objectFit: "contain" }} />
                </div>
              ) : (
                <a href={selectedTest.reference_file_url} target="_blank" rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 12, border: "1px solid " + C.brdL, background: C.s1, color: C.ac, textDecoration: "none" }}>
                  <span style={{ fontSize: 24 }}>📄</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Protocole PDF</div>
                    <div style={{ fontSize: 11, color: C.tx3 }}>Ouvrir le fichier</div>
                  </div>
                </a>
              )}
            </div>
          )}

          {/* Description */}
          {selectedTest.description && (
            <div style={{ background: C.s1, borderRadius: 12, padding: 14, border: "1px solid " + C.brd, marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Instructions</div>
              <div style={{ fontSize: 13, color: C.tx2, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{selectedTest.description}</div>
            </div>
          )}

          {/* Résultats si déjà remplis */}
          {selectedTest.completed && (
            <div style={{ background: "rgba(34,201,147,0.08)", borderRadius: 12, padding: 14, border: "1px solid rgba(34,201,147,0.2)", marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.g, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Résultats</div>
              {selectedTest.results_structured?.metrics?.filter(m => m.name).map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(34,201,147,0.1)" }}>
                  <span style={{ fontSize: 12, color: C.tx2 }}>{m.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.g }}>{m.value} {m.unit}</span>
                </div>
              ))}
              {selectedTest.results_note && (
                <div style={{ fontSize: 12, color: C.tx3, marginTop: 10, fontStyle: "italic" }}>"{selectedTest.results_note}"</div>
              )}
            </div>
          )}

          {(!viewOnly || isCoach) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={startFill}
                style={{ width: "100%", padding: "15px 0", borderRadius: 14, border: "none", background: selectedTest.completed ? C.s2 : (tInfo?.color || C.ac), color: selectedTest.completed ? C.tx3 : "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                {selectedTest.completed ? "Modifier les résultats" : "▶ Remplir les résultats"}
              </button>
              <button onClick={startEdit}
                style={{ width: "100%", padding: "11px 0", borderRadius: 14, border: "1px solid " + C.brdL, background: "transparent", color: C.tx2, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                ✏ Modifier le test
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Vue édition du test ───────────────────────────────────────────────────────
  if (step === "edit" && selectedTest) {
    const editTypeInfo = TEST_TYPES.find(t => t.id === createForm.type);
    return (
      <div>
        <SubTabs />
        <div style={{ padding: "16px 16px 40px" }}>
          <button onClick={() => setStep("view")} style={{ background: "none", border: "none", color: C.tx3, fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 14 }}>‹ Retour</button>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.tx, marginBottom: 16 }}>Modifier le test</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Type */}
            <div style={{ background: C.s1, borderRadius: 12, padding: 14, border: "1px solid " + C.brd }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Type de test</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TEST_TYPES.map(t => (
                  <button key={t.id} onClick={() => setCreateForm(f => ({ ...f, type: t.id }))}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1px solid " + (createForm.type === t.id ? t.color : C.brdL), background: createForm.type === t.id ? t.color + "20" : "transparent", color: createForm.type === t.id ? t.color : C.tx3, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    <span>{t.emoji}</span> {t.label}
                  </button>
                ))}
              </div>
              {createForm.type === "custom" && (
                <input value={createForm.custom_type} onChange={e => setCreateForm(f => ({ ...f, custom_type: e.target.value }))} placeholder="Préciser le type de test…"
                  style={{ marginTop: 10, width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              )}
            </div>

            {/* Titre */}
            <div style={{ background: C.s1, borderRadius: 12, padding: 14, border: "1px solid " + C.brd }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Titre *</div>
              <input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Test VMA Cooper — 12 min"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            </div>

            {/* Date */}
            <div style={{ background: C.s1, borderRadius: 12, padding: 14, border: "1px solid " + C.brd }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Date du test</div>
              <input type="date" value={createForm.date} onChange={e => setCreateForm(f => ({ ...f, date: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            </div>

            {/* Description */}
            <div style={{ background: C.s1, borderRadius: 12, padding: 14, border: "1px solid " + C.brd }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Instructions / Description</div>
              <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Décris le protocole du test, les consignes pour l'athlète…"
                rows={4}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            </div>

            {/* Fichier de référence */}
            <div style={{ background: C.s1, borderRadius: 12, padding: 14, border: "1px solid " + C.brd }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Fichier de référence (optionnel)</div>
              <div style={{ fontSize: 10, color: C.tx3, marginBottom: 10 }}>Photo, schéma, PDF de protocole</div>
              {createForm.reference_file_url ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {createForm.reference_file_type === "image" ? (
                    <img src={createForm.reference_file_url} alt="Ref" style={{ height: 80, borderRadius: 8, objectFit: "cover" }} />
                  ) : (
                    <div style={{ padding: "10px 16px", borderRadius: 8, background: C.s2, color: C.ac, fontSize: 12, fontWeight: 600 }}>📄 PDF chargé</div>
                  )}
                  <button onClick={() => setCreateForm(f => ({ ...f, reference_file_url: "", reference_file_type: "" }))}
                    style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "rgba(239,75,75,0.12)", color: "#EF4B4B", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Supprimer</button>
                </div>
              ) : (
                <label style={{ display: "block", padding: "20px", borderRadius: 9, border: "1px dashed " + (uploadError ? "#EF4B4B" : C.brdL), background: C.s2, textAlign: "center", cursor: fileUploading ? "default" : "pointer" }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>📎</div>
                  <div style={{ fontSize: 12, color: uploadError ? "#EF4B4B" : C.tx3 }}>{fileUploading ? "Upload en cours…" : uploadError || "Photo, PNG, JPG ou PDF"}</div>
                  <input type="file" accept="image/*,application/pdf" onChange={e => { setUploadError(""); if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} style={{ display: "none" }} />
                </label>
              )}
            </div>
          </div>

          <button onClick={handleEditSave} disabled={!createForm.title.trim() || saving}
            style={{ width: "100%", padding: "15px 0", borderRadius: 14, border: "none", background: (createForm.title.trim() && !saving) ? (editTypeInfo?.color || C.ac) : C.s2, color: (createForm.title.trim() && !saving) ? "#fff" : C.tx3, fontSize: 14, fontWeight: 800, cursor: (createForm.title.trim() && !saving) ? "pointer" : "default", fontFamily: "inherit", marginTop: 20 }}>
            {saving ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </div>
      </div>
    );
  }

  // ── Vue remplissage résultats ──────────────────────────────────────────────────
  if (step === "fill" && selectedTest) {
    const tInfo = TEST_TYPES.find(t => t.id === selectedTest.type);
    return (
      <div>
        <SubTabs />
        <div style={{ padding: "16px 16px 40px" }}>
          <button onClick={() => setStep("view")} style={{ background: "none", border: "none", color: C.tx3, fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 14 }}>‹ Retour</button>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.tx, marginBottom: 4 }}>Résultats — {selectedTest.title}</div>
          <div style={{ fontSize: 11, color: C.tx3, marginBottom: 16 }}>Ces résultats seront enregistrés dans les performances</div>

          {/* Métriques structurées */}
          <div style={{ background: C.s1, borderRadius: 14, padding: 14, border: "1px solid " + C.brd, marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Mesures</div>
            {metrics.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <input value={m.name} onChange={e => setMetrics(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  placeholder="Ex: VMA"
                  style={{ flex: 2, padding: "8px 10px", borderRadius: 7, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                <input type="text" value={m.value} onChange={e => setMetrics(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                  placeholder="Ex: 18.5"
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 7, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                <input value={m.unit} onChange={e => setMetrics(prev => prev.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))}
                  placeholder="km/h"
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 7, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                {metrics.length > 1 && (
                  <button onClick={() => setMetrics(prev => prev.filter((_, j) => j !== i))}
                    style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "rgba(239,75,75,0.1)", color: "#EF4B4B", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>×</button>
                )}
              </div>
            ))}
            <button onClick={() => setMetrics(prev => [...prev, { name: "", value: "", unit: "" }])}
              style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "1px dashed " + C.brdL, background: "transparent", color: C.tx3, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
              + Ajouter une mesure
            </button>
          </div>

          {/* Note libre */}
          <div style={{ background: C.s1, borderRadius: 14, padding: 14, border: "1px solid " + C.brd, marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Note libre (optionnel)</div>
            <textarea value={resultsNote} onChange={e => setResultsNote(e.target.value)}
              placeholder="Conditions, ressenti, observations…"
              rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
          </div>

          {saveError && (
            <div style={{ background: "rgba(239,75,75,0.08)", borderRadius: 10, padding: "10px 14px", border: "1px solid rgba(239,75,75,0.2)", marginBottom: 16, fontSize: 11, color: "#EF4B4B" }}>
              ⚠️ {saveError}
            </div>
          )}

          <button onClick={handleSaveResults} disabled={saving}
            style={{ width: "100%", padding: "15px 0", borderRadius: 14, border: "none", background: saving ? C.s2 : (tInfo?.color || C.g), color: saving ? C.tx3 : "#fff", fontSize: 14, fontWeight: 800, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}>
            {saving ? "Enregistrement…" : "Valider les résultats"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
