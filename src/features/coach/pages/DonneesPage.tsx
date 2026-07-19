import { useSearchParams } from "react-router-dom";
import { StrategieTab } from "@/features/coach/components/donnees/StrategieTab";
import { HistoriqueTab } from "@/features/coach/components/donnees/HistoriqueTab";

type DonneesView = "strategie" | "historique";

export default function DonneesPage() {
  const [searchParams] = useSearchParams();
  const raw = searchParams.get("view");
  // Legacy ?view=profil → le profil vit maintenant dans Profil athlète → Profil Général
  const view: DonneesView = raw === "historique" ? "historique" : "strategie";

  return (
    <div style={{ padding: "16px 16px 40px" }}>
      {view === "strategie" && <StrategieTab />}
      {view === "historique" && <HistoriqueTab />}
    </div>
  );
}
