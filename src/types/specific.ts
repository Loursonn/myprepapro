// ─────────────────────────────────────────────────────────────────────────────
// Types pour la Banque Spécifique : référentiels Sport / Qualité physique,
// format Classique (builder par blocs) et banque de blocs spécifiques.
// Le format WOD réutilise EnergyStep[] (voir @/types/energy).
// ─────────────────────────────────────────────────────────────────────────────

// ── Référentiels ──────────────────────────────────────────────────────────────

export interface SpecificSport {
  id: string;
  name: string;
  slug: string;
  /** Nom d'icône lucide-react (ex. "Flame") */
  icon: string | null;
  /** Couleur hex du sport (badges, rail) */
  color: string | null;
  /** NULL = sport global seedé, sinon custom du coach */
  coach_id: string | null;
  is_default: boolean;
  created_at: string;
}

export interface PhysicalQuality {
  id: string;
  name: string;
  slug: string;
  coach_id: string | null;
  is_default: boolean;
  created_at: string;
}

// ── Format Classique ──────────────────────────────────────────────────────────

export interface ClassiqueItem {
  id: string;
  /** Exercice ou consigne libre */
  name: string;
  /** Prescription libre : "4x30m", "5 séries · 8 reps", "3'" */
  prescription?: string;
  rest?: string;
  notes?: string;
}

export interface ClassiqueBlock {
  id: string;
  title: string;
  /** Renseigné si importé depuis specific_blocks */
  sourceBlockId?: string;
  items: ClassiqueItem[];
}

export interface ClassiqueStructure {
  blocks: ClassiqueBlock[];
}

export type SessionFormat = 'wod' | 'classique';

// ── Banque de blocs spécifiques (privée par coach) ───────────────────────────

export interface SpecificBlockRow {
  id: string;
  coach_id: string;
  name: string;
  sport_id: string | null;
  quality_id: string | null;
  /** Un ClassiqueBlock sans id/sourceBlockId : { title, items } */
  content: { title: string; items: ClassiqueItem[] };
  created_at: string;
  updated_at: string;
}

export type CreateSpecificBlockInput = Omit<SpecificBlockRow, 'id' | 'created_at' | 'updated_at'>;
