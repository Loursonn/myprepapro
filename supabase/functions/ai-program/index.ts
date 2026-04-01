import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const body = await req.json();
    const { mode, prompt, imageBase64, filesData, sessions, currentProgram, conversationHistory, message } = body;

    const sessionsList = sessions && Array.isArray(sessions) && sessions.length > 0
      ? sessions
      : [{ id: "s1", name: "Séance 1", short: "S1" }];

    const sessIds = sessionsList.map((s: any) => s.id).join(", ");
    const sessDesc = sessionsList.map((s: any) => `${s.id} (${s.name})`).join(", ");
    const sessKeysExample = sessionsList.map((s: any) => `"${s.id}":[...]`).join(",");

    const SESSIONS_INFO = `SESSIONS DISPONIBLES: ${sessDesc}
BLOCS: PERF (mouvement principal), ESTH (hypertrophie esthetique), ASSOC (muscles associes/esthetique associe), BESOIN (besoins individuels/correctifs/mobilite specifique), CORE (gainage/core/poids de corps), MOBIL (mobilite/souplesse generale)
MUSCLES VALIDES: Pecs, Dos-GD, Dos-Trap, Dos-Rhom, Ep-Ant, Ep-Lat, Ep-Post, Quads, Ischios, Fessiers, Adducteurs, Triceps, Biceps, Core, Mollets
TYPES D'EXERCICES:
- "muscu" (defaut): exercice de musculation classique avec kg, sets, repsRange, rir
- "plio": exercice pliometrique (sauts, lancers) avec sets, repsRange, PAS de kg ni rir
- "mobilite": exercice de mobilite/souplesse avec sets, repsRange (peut etre une duree ex "30s"), PAS de kg ni rir`;

    const JSON_FORMAT = `Reponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaires. Format exact:
{"sessions":{${sessKeysExample}},"rationale":"Explication courte"}
Chaque session contient un array d'exercices au format: {"id":"g_SESSID_NUM","name":"NOM EXERCICE","bloc":"PERF","target":"Pecs","exType":"muscu","weeks":{"1":{"kg":80,"sets":4,"repsRange":"10","rir":2.5}}}
REGLES:
- UTILISE UNIQUEMENT ces IDs de sessions: ${sessIds}
- Reproduis TOUS les exercices de la source sans en omettre, progression logique, RIR 3->1.5, ids uniques g_[sessid]_[num]
- PERF = 1 seul mouvement poly par session
- JSON compact, PAS de rationale longue (1 phrase max)
- CRITICAL: Le JSON DOIT etre COMPLET. Ne tronque JAMAIS la sortie.`;

    const systemPrompt = `Tu es un preparateur physique expert en musculation. Tu generes des programmes structures en JSON strict.\n${SESSIONS_INFO}\n${JSON_FORMAT}`;

    let userPrompt: string;
    if (mode === "generate") {
      userPrompt = prompt;
    } else if (mode === "chat_edit") {
      const limitedHistory = (conversationHistory || []).slice(-6);
      const historyText = limitedHistory.map((m: any) =>
        `${m.role === "user" ? "Coach" : "IA"}: ${m.content}`
      ).join("\n");
      userPrompt = `PROGRAMME ACTUEL:
${JSON.stringify(currentProgram)}

${historyText ? `HISTORIQUE:\n${historyText}\n\n` : ""}DEMANDE: ${message}

Retourne UNIQUEMENT les sessions modifiees dans {"sessions":{...},"rationale":"..."}. N'inclus PAS les sessions non modifiees — elles seront conservees automatiquement cote client. Exemple: si seule la session "s1" change, retourne {"sessions":{"s1":[...]},"rationale":"..."}.`;
    } else {
      userPrompt = `A partir du contenu suivant, cree un programme de musculation complet en repartissant les exercices dans les sessions disponibles: ${sessDesc}. Repartis intelligemment les exercices selon leur type et les noms des sessions.\n\nCONTENU A IMPORTER:\n${prompt || "Programme dans l'image ci-jointe"}`;
    }

    // Build Gemini request parts
    const parts: any[] = [{ text: systemPrompt + "\n\n" + userPrompt }];

    // Support multi-file (new format) or legacy single image
    if (filesData && Array.isArray(filesData) && filesData.length > 0) {
      for (const f of filesData) {
        parts.push({ inline_data: { mime_type: f.mimeType, data: f.data } });
      }
    } else if (imageBase64) {
      parts.push({ inline_data: { mime_type: "image/jpeg", data: imageBase64 } });
    }

    // Helper: call Gemini and parse JSON, returns parsed object or throws
    const callGemini = async (temperature: number, modelId = "gemini-2.5-flash") => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { maxOutputTokens: 32768, temperature, responseMimeType: "application/json" },
          }),
        }
      );

      if (!response.ok) {
        const t = await response.text();
        console.error("Gemini error:", response.status, t);
        if (response.status === 429) throw new Error("__429__");
        throw new Error("Erreur Gemini: " + response.status);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!text) {
        const reason = data.candidates?.[0]?.finishReason || "unknown";
        throw new Error("Reponse vide de Gemini (finishReason: " + reason + ")");
      }

      let clean = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const start = clean.indexOf("{");
      if (start > 0) clean = clean.slice(start);

      try {
        return JSON.parse(clean);
      } catch {
        // Repair: trailing commas
        clean = clean.replace(/,\s*([}\]])/g, "$1");
        try {
          return JSON.parse(clean);
        } catch {
          throw new Error("__json_invalid__:" + clean.slice(0, 400));
        }
      }
    };

    // chat_edit uses faster model; generate/import use quality model
    const primaryModel = mode === "chat_edit" ? "gemini-2.0-flash" : "gemini-2.5-flash";

    // Attempt 1, retry once on any error (except 429)
    let parsed: any;
    try {
      parsed = await callGemini(0.3, primaryModel);
    } catch (e: any) {
      if (e.message === "__429__") {
        return new Response(JSON.stringify({ error: "Trop de requetes, reessaie dans quelques secondes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.warn("Tentative 1 echouee (" + e.message?.slice(0, 80) + "), retry...");
      try {
        parsed = await callGemini(0.1, primaryModel);
      } catch (e2: any) {
        if (e2.message === "__429__") {
          return new Response(JSON.stringify({ error: "Trop de requetes, reessaie dans quelques secondes." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Generation echouee apres 2 tentatives. Reessaie." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-program error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
