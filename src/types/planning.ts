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
  match:       { emoji: '⚽', label: 'Match',        color: '#EF4B4B' },
  stage:       { emoji: '🏕',  label: 'Stage',        color: '#7B6FFF' },
  off:         { emoji: '🔄', label: 'Récup / Off',  color: '#22C993' },
  autre:       { emoji: '📌', label: 'Autre',         color: '#9194A0' },
};

export const BLOCK_COLORS = [
  '#7B6FFF', '#5AC8FA', '#22C993', '#F5A623',
  '#EF4B4B', '#FF6B9D', '#A78BFA', '#34D399',
];

/** Default durations (in weeks) for each period level */
export const PERIOD_DEFAULTS: Record<BlockType, number> = {
  macrocycle: 52,  // 12 months
  mesocycle:  13,  // 3 months
  cycle:       4,  // 4 weeks
  microcycle:  1,  // 1 week
};
