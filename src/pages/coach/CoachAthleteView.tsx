import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AthleteProvider } from "@/features/shared/context/AthleteContext";
import CoachLayout from "@/features/coach/CoachLayout";

/**
 * Wrapper that provides AthleteProvider for a coach viewing an athlete.
 * athleteId comes from the URL param — viewOnly=true for others' athletes,
 * false when the coach is viewing their own program.
 */
export default function CoachAthleteView() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const { user, profile, athletes } = useAuth();
  const navigate = useNavigate();

  if (!athleteId || !user) return null;

  const isOwnView = athleteId === user.id;
  const selectedAthlete = athletes.find(a => a.id === athleteId);
  const athleteProfile = isOwnView ? profile : (selectedAthlete ?? null);

  return (
    <AthleteProvider
      athleteId={athleteId}
      viewOnly={!isOwnView}
      athleteProfile={athleteProfile}
      userName={profile?.full_name}
    >
      <CoachLayout
        onSwitchMode={isOwnView ? () => navigate("/athlete") : undefined}
      />
    </AthleteProvider>
  );
}
