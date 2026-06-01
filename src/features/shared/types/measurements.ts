// Mensurations + photos d'évolution corporelle

export type MeasurementKey =
  | 'bras' | 'epaules' | 'poitrine' | 'taille' | 'hanche' | 'cuisse' | 'mollet';

export type PhotoSlot =
  | 'face' | 'cote' | 'dos' | 'jambes_face' | 'jambes_dos';

export const MEASUREMENT_FIELDS: { key: MeasurementKey; label: string }[] = [
  { key: 'bras',     label: 'Bras'     },
  { key: 'epaules',  label: 'Épaules'  },
  { key: 'poitrine', label: 'Poitrine' },
  { key: 'taille',   label: 'Taille'   },
  { key: 'hanche',   label: 'Hanche'   },
  { key: 'cuisse',   label: 'Cuisse'   },
  { key: 'mollet',   label: 'Mollet'   },
];

export const PHOTO_SLOTS: { key: PhotoSlot; label: string }[] = [
  { key: 'face',        label: 'Face'           },
  { key: 'cote',        label: 'Côté'           },
  { key: 'dos',         label: 'Dos'            },
  { key: 'jambes_face', label: 'Jambes (face)'  },
  { key: 'jambes_dos',  label: 'Jambes (dos)'   },
];

export const MEASUREMENT_BUCKET = 'test-media';

export type MeasurementPhotos = Partial<Record<PhotoSlot, string>>; // slot -> storage path

export interface MeasurementLog {
  id: string;
  athlete_id: string;
  date: string;            // YYYY-MM-DD
  weight_kg: number | null;
  bras: number | null;
  epaules: number | null;
  poitrine: number | null;
  taille: number | null;
  hanche: number | null;
  cuisse: number | null;
  mollet: number | null;
  photos: MeasurementPhotos;
  created_at: string;
}

// Saisie d'une nouvelle log (avant upload photos)
export interface NewMeasurementInput {
  weight_kg?: number;
  measurements: Partial<Record<MeasurementKey, number>>;
  photoFiles: Partial<Record<PhotoSlot, File>>;
}

// Modification d'une log existante
export interface UpdateMeasurementInput {
  id: string;
  existingPhotos: MeasurementPhotos;
  weight_kg?: number;
  measurements: Partial<Record<MeasurementKey, number>>;
  newPhotoFiles: Partial<Record<PhotoSlot, File>>;
  removedSlots: PhotoSlot[];
}
