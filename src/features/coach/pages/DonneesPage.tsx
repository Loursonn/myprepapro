import { useSearchParams } from "react-router-dom";
import { ProfilTab } from "@/features/coach/components/donnees/ProfilTab";
import { StrategieTab } from "@/features/coach/components/donnees/StrategieTab";
import { HistoriqueTab } from "@/features/coach/components/donnees/HistoriqueTab";

type DonneesView = "profil" | "strategie" | "historique";

export default function DonneesPage() {
  const [searchParams] = useSearchParams();
  const view = (searchParams.get("view") as DonneesView) ?? "profil";

  return (
    <div style={{ padding: "16px 16px 40px" }}>
      {view === "profil" && <ProfilTab />}
      {view === "strategie" && <StrategieTab />}
      {view === "historique" && <HistoriqueTab />}
    </div>
  );
}
