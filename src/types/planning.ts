export type BlockType = 'macrocycle' | 'mesocycle' | 'microcycle' | 'custom';
export type CompetitionType = 'competition' | 'match' | 'stage' | 'off' | 'autre';
export type CompetitionPriority = 'A' | 'B' | 'C';

export interface Season {
  id: string;
  coach_id: string;
  athlete_id: string;
  name: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface PlanningBlock {
  id: string;
  season_id: string;
  coach_id: string;
  athlete_id: string;
  name: string;
  description: string | null;
  type: BlockType;
  start_week: number;
  end_week: number;
  color: string;
  parent_block_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Populated client-side when building the tree
  children?: PlanningBlock[];
}

export interface Competition {
  id: string;
  coach_id: string;
  athlete_id: string;
  planning_block_id: string | null;
  season_id: string | null;
  name: string;
  type: CompetitionType;
  date: string;
  location: string | null;
  notes: string | null;
  priority: CompetitionPriority;
  created_at: string;
}

export type SeasonInsert = Omit<Season, 'id' | 'created_at'>;
export type PlanningBlockInsert = Omit<PlanningBlock, 'id' | 'created_at' | 'updated_at' | 'children'>;
export type CompetitionInsert = Omit<Competition, 'id' | 'created_at'>;

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  macrocycle: 'Macrocycle',
  mesocycle: 'Mésocycle',
  microcycle: 'Microcycle',
  custom: 'Personnalisé',
};

export const BLOCK_COLORS = [
  '#7B6FFF', '#5AC8FA', '#22C993', '#F5A623',
  '#EF4B4B', '#FF6B9D', '#A78BFA', '#34D399',
];

export const COMPETITION_META: Record<CompetitionType, { emoji: string; label: string; color: string }> = {
  competition: { emoji: '🏆', label: 'Compétition', color: '#F5A623' },
  match:       { emoji: '⚽', label: 'Match',        color: '#EF4B4B' },
  stage:       { emoji: '🏕',  label: 'Stage',        color: '#7B6FFF' },
  off:         { emoji: '🔄', label: 'Récup / Off',  color: '#22C993' },
  autre:       { emoji: '📌', label: 'Autre',         color: '#9194A0' },
};
