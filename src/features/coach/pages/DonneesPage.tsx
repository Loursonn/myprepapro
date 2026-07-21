import { HistoriqueTab } from "@/features/coach/components/donnees/HistoriqueTab";

/** Onglet Historique (route legacy "donnees"). Stratégie vit dans Profil athlète. */
export default function DonneesPage() {
  return (
    <div style={{ padding: "16px 16px 40px" }}>
      <HistoriqueTab />
    </div>
  );
}
