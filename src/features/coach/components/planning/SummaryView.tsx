import { Accordion } from "@/components/ui/accordion";
import { usePlanningSummary } from "./hooks/usePlanningSummary";
import { MacrocycleSummary } from "./MacrocycleSummary";

interface Props {
  athleteId: string;
}

export function SummaryView({ athleteId }: Props) {
  const { data: macros = [], isLoading, error } = usePlanningSummary(athleteId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-white/30 text-sm">
        Chargement…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-red-400 text-sm">
        Erreur de chargement
      </div>
    );
  }

  if (macros.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <p className="text-white/30 text-sm">Aucun macrocycle trouvé</p>
        <p className="text-white/20 text-xs">Créez un macrocycle dans la vue Frise</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-white text-xl font-bold mb-5">Planification Synthétique</h2>

      <Accordion type="multiple" className="flex flex-col gap-4">
        {macros.map((macro) => (
          <MacrocycleSummary key={macro.id} macro={macro} athleteId={athleteId} />
        ))}
      </Accordion>
    </div>
  );
}
