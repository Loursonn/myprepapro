import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Trophy, MapPin, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useUpdateCompetitionComment } from "@/features/shared/hooks/retoursComments.mutations";

interface AthleteCompetitionCardProps {
  competition: {
    id: string;
    name: string;
    type: string;
    date: string;
    location: string | null;
    athlete_comment: string | null;
    priority: "A" | "B" | "C" | null;
  };
}

/**
 * Card mobile pour qu'un athlète commente sa compétition
 * À afficher dans TodayPage ou dans une page dédiée Compétitions
 */
export function AthleteCompetitionCard({ competition }: AthleteCompetitionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [comment, setComment] = useState(competition.athlete_comment || "");

  const updateComment = useUpdateCompetitionComment();

  const handleSave = () => {
    updateComment.mutate(
      {
        competitionId: competition.id,
        athleteComment: comment,
      },
      {
        onSuccess: () => setIsEditing(false),
      }
    );
  };

  const isPast = new Date(competition.date) < new Date();

  return (
    <Card className="max-w-[480px]">
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <CardTitle className="text-base">{competition.name}</CardTitle>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {format(new Date(competition.date), "d MMM yyyy", { locale: fr })}
          </div>
          {competition.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {competition.location}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Badge variant="outline">{competition.type}</Badge>
          {competition.priority && (
            <Badge variant="outline">Priorité {competition.priority}</Badge>
          )}
        </div>

        {/* Commentaire uniquement si compétition passée */}
        {isPast && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Mon ressenti</p>
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  placeholder="Comment ça s'est passé ?"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave}>
                    Enregistrer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false);
                      setComment(competition.athlete_comment || "");
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {competition.athlete_comment ? (
                  <div className="bg-muted/50 p-3 rounded-md">
                    <p className="text-sm text-muted-foreground">{competition.athlete_comment}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Aucun commentaire pour l'instant
                  </p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="w-full"
                >
                  {competition.athlete_comment ? "Modifier" : "Ajouter un commentaire"}
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
