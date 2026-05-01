import { useAuth } from "@/hooks/useAuth";
import { ExerciseBank } from "@/components/coach/ExerciseBank";

/**
 * Banque d'exercices muscu — non liée à un athlète spécifique.
 * La banque énergétique est disponible via ⚡ Énergie dans la sidebar (/coach/energy-library).
 */
export default function LibraryPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div style={{ padding: "16px 24px 40px" }}>
      <ExerciseBank coachId={user.id} onAddToExos={undefined} />
    </div>
  );
}
