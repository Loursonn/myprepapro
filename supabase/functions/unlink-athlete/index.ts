import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Get the coach's JWT to verify their identity
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non autorisé");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the caller is who they say they are
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Non autorisé");

    const { athleteId } = await req.json();
    if (!athleteId) throw new Error("athleteId manquant");

    // Verify the athlete actually belongs to this coach
    const { data: athlete } = await supabaseAdmin
      .from("profiles")
      .select("id, coach_id")
      .eq("id", athleteId)
      .single();

    if (!athlete || athlete.coach_id !== user.id) throw new Error("Athlète introuvable ou non assigné");

    // Unlink
    await supabaseAdmin.from("profiles").update({ coach_id: null }).eq("id", athleteId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
