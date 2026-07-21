import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Map exercise_id → youtube_id pour les exercices de la banque ayant une vidéo. */
export function useExerciseVideos(exerciseIds: string[]) {
  const key = [...exerciseIds].sort().join(",");
  return useQuery<Record<string, string>>({
    queryKey: ["exercise-videos", key],
    enabled: exerciseIds.length > 0,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, youtube_id")
        .in("id", exerciseIds)
        .not("youtube_id", "is", null);
      if (error) throw error;
      return Object.fromEntries(
        (data ?? []).map((r) => [r.id, r.youtube_id as string]),
      );
    },
  });
}
