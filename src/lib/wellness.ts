import { C } from "@/lib/theme";

export const WELL_ITEMS = [
  { k: "fatigue", q: "Récupération",        lo: "Épuisé",       hi: "Très reposé",  inv: false },
  { k: "sommeil", q: "Qualité du sommeil",   lo: "Très mauvais", hi: "Excellent",    inv: false },
  { k: "stress",  q: "Sérénité / mental",    lo: "Très stressé", hi: "Très détendu", inv: false },
  { k: "energie", q: "Niveau d'énergie",     lo: "Très bas",     hi: "Très élevé",   inv: false },
  { k: "doms",    q: "Fraîcheur musculaire", lo: "DOMS intenses", hi: "Aucune douleur", inv: false },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const calcScore = (w: any): number => {
  if (!w) return 0;
  return Math.round(((w.fatigue||3)+(w.sommeil||3)+(w.stress||3)+(w.energie||3)+(w.doms||3)) / 25 * 100);
};

export const getReco = (score: number) => {
  if (score >= 80) return { label: "Optimal",   desc: "Seance a pleine charge",         c: C.g };
  if (score >= 65) return { label: "Bon",        desc: "Adapter si besoin",              c: "#7BC67E" };
  if (score >= 50) return { label: "Modere",     desc: "Reduire volume de 10-15%",       c: C.o };
  if (score >= 35) return { label: "Fatigue",    desc: "Seance legere recommandee",      c: "#F07030" };
  return              { label: "Surmenage",  desc: "Repos ou recuperation active",   c: C.r };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getAlerts = (w: any): string[] => {
  const a: string[] = [];
  if (w?.fatigue <= 2) a.push("Récupération faible: surveiller la technique");
  if (w?.doms    <= 2) a.push("DOMS intenses: adapter les muscles cibles");
  if (w?.stress  <= 2) a.push("Stress élevé: séance technique recommandée");
  if (w?.energie <= 2) a.push("Énergie faible: réduire le volume");
  return a;
};
