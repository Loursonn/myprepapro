export interface SurgeryEntry {
  zone: string;
  date: string;
  details: string;
}

export interface PastInjuryEntry {
  zone: string;
  date: string;
  type: string;
  details: string;
}

export interface MedicalHistory {
  id: string;
  athlete_id: string;
  conditions: string;
  allergies: string;
  surgeries: SurgeryEntry[];
  past_injuries: PastInjuryEntry[];
  current_treatments: string;
  medical_notes: string;
  created_at: string;
  updated_at: string;
}

export type MedicalHistoryInput = Omit<MedicalHistory, 'id' | 'created_at' | 'updated_at'>;
