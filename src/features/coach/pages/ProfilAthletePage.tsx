/**
 * ProfilAthletePage — onglet « Profil athlète » (route profil-sportif).
 * Sous-onglets (?view=) :
 *   - sportif  : Profil Sportif Actuel (ancienne page Profil sportif)
 *   - general  : Profil Général (ancien onglet Profil de Données)
 *   - testing  : Suivi Testing (ancienne page Tests)
 */
import { useSearchParams } from "react-router-dom";
import ProfilSportifPage from "./ProfilSportifPage";
import TestPage from "./TestPage";
import { ProfilTab } from "@/features/coach/components/donnees/ProfilTab";

type ProfilView = "sportif" | "general" | "testing";

export default function ProfilAthletePage() {
  const [searchParams] = useSearchParams();
  const view = (searchParams.get("view") as ProfilView) ?? "sportif";

  if (view === "general") {
    return (
      <div style={{ padding: "16px 16px 40px" }}>
        <ProfilTab />
      </div>
    );
  }
  if (view === "testing") return <TestPage />;
  return <ProfilSportifPage />;
}
