export type BlockType = 'macrocycle' | 'mesocycle' | 'cycle' | 'microcycle';
export type CompetitionType = 'competition' | 'match' | 'stage' | 'off' | 'autre';
export type CompetitionPriority = 'A' | 'B' | 'C';

export interface Competition {
  id: string;
  coach_id: string;
  athlete_id: string;
  macrocycle_id?: string | null;
  name: string;
  type: CompetitionType;
  date: string;
  location: string | null;
  notes: string | null;
  priority: CompetitionPriority;
  created_at: string;
}

export type CompetitionInsert = Omit<Competition, 'id' | 'created_at'>;

export const COMPETITION_META: Record<CompetitionType, { emoji: string; label: string; color: string }> = {
  competition: { emoji: '🏆', label: 'Compétition', color: '#F5A623' },
  match:       { emoji: '⚽', label: 'Match',        color: '#D9705A' },
  stage:       { emoji: '🏕',  label: 'Stage',        color: '#C9A14A' },
  off:         { emoji: '🔄', label: 'Récup / Off',  color: '#9DB06A' },
  autre:       { emoji: '📌', label: 'Autre',         color: '#9194A0' },
};

export const BLOCK_COLORS = [
  '#C9A14A', '#5AC8FA', '#9DB06A', '#F5A623',
  '#D9705A', '#FF6B9D', '#A78BFA', '#34D399',
];

/** Default durations (in weeks) for each period level */
export const PERIOD_DEFAULTS: Record<BlockType, number> = {
  macrocycle: 52,  // 12 months
  mesocycle:  13,  // 3 months
  cycle:       4,  // 4 weeks
  microcycle:  1,  // 1 week
};
