import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { QK } from '@/lib/queryKeys';
import { compressImage } from '@/lib/compressImage';
import {
  MEASUREMENT_BUCKET,
  ALL_MEASUREMENT_KEYS,
  type MeasurementLog,
  type MeasurementPhotos,
  type NewMeasurementInput,
  type UpdateMeasurementInput,
  type PhotoSlot,
} from '@/features/shared/types/measurements';

// Tables non typées dans types.ts (générées) → cast volontaire.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const todayISO = () => new Date().toISOString().slice(0, 10);

// ── Liste des logs (athlète ou coach, ordre chronologique décroissant) ────────

export function useMeasurementLogs(athleteId: string) {
  return useQuery({
    queryKey: QK.measurementLogs(athleteId),
    queryFn: async (): Promise<MeasurementLog[]> => {
      const { data, error } = await db
        .from('measurement_logs')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MeasurementLog[];
    },
    enabled: !!athleteId,
    staleTime: 30_000,
  });
}

// ── Création d'une log (upload photos + insert) ────────────────────────────────

export function useCreateMeasurementLog(athleteId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewMeasurementInput) => {
      // 1. Insert de la log (sans photos pour récupérer l'id)
      const { data: row, error: insErr } = await db
        .from('measurement_logs')
        .insert({
          athlete_id: athleteId,
          date: todayISO(),
          weight_kg: input.weight_kg ?? null,
          ...input.measurements,
          photos: {},
        })
        .select()
        .single();
      if (insErr) throw insErr;

      // 2. Upload des photos sous {athleteId}/mensurations/{logId}/{slot}.jpg
      const photos: Partial<Record<PhotoSlot, string>> = {};
      for (const [slot, raw] of Object.entries(input.photoFiles)) {
        if (!raw) continue;
        const file = await compressImage(raw);
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${athleteId}/mensurations/${row.id}/${slot}.${ext}`;
        const { error: upErr } = await db.storage
          .from(MEASUREMENT_BUCKET)
          .upload(path, file, { upsert: true, contentType: file.type });
        if (upErr) {
          // rollback : on supprime la log si l'upload échoue
          await db.from('measurement_logs').delete().eq('id', row.id);
          throw upErr;
        }
        photos[slot as PhotoSlot] = path;
      }

      // 3. Mise à jour des chemins photos
      if (Object.keys(photos).length > 0) {
        const { error: updErr } = await db
          .from('measurement_logs')
          .update({ photos })
          .eq('id', row.id);
        if (updErr) throw updErr;
      }

      // 4. Complète les mesures biométriques planifiées par le coach (échues ou du jour)
      await db
        .from('test_sessions')
        .update({ completed: true })
        .eq('athlete_id', athleteId)
        .eq('type', 'biometric')
        .eq('completed', false)
        .lte('date', todayISO());

      return row as MeasurementLog;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.measurementLogs(athleteId) });
      qc.invalidateQueries({ queryKey: QK.testSessions(athleteId) });
      qc.invalidateQueries({ queryKey: QK.activePlan(athleteId) });
      qc.invalidateQueries({ queryKey: ['cal', athleteId] });
      qc.invalidateQueries({ queryKey: ['calendar-events', athleteId] });
      qc.invalidateQueries({ queryKey: ['week-schedule', athleteId] });
      toast.success('Mensurations enregistrées ✓');
    },
    onError: (err: unknown) => {
      console.error('[measurement save error]', err);
      const msg = (err as { message?: string })?.message ?? String(err);
      toast.error('Erreur: ' + msg);
    },
  });
}

// ── Modification d'une log ─────────────────────────────────────────────────────

export function useUpdateMeasurementLog(athleteId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateMeasurementInput) => {
      const photos: MeasurementPhotos = { ...input.existingPhotos };

      // Suppression des photos retirées
      const toRemove: string[] = [];
      for (const slot of input.removedSlots) {
        if (photos[slot]) { toRemove.push(photos[slot]!); delete photos[slot]; }
      }

      // Upload des nouvelles photos (remplace l'existante du slot si différente)
      for (const [slot, raw] of Object.entries(input.newPhotoFiles)) {
        if (!raw) continue;
        const file = await compressImage(raw);
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        // Nom unique → toujours un INSERT (le bucket n'a pas de policy UPDATE), l'ancien est supprimé ensuite.
        const path = `${athleteId}/mensurations/${input.id}/${slot}_${Date.now()}.${ext}`;
        const { error: upErr } = await db.storage
          .from(MEASUREMENT_BUCKET)
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        const old = photos[slot as PhotoSlot];
        if (old && old !== path) toRemove.push(old);
        photos[slot as PhotoSlot] = path;
      }

      if (toRemove.length > 0) {
        await db.storage.from(MEASUREMENT_BUCKET).remove(toRemove);
      }

      // Toutes les mensurations (les non saisies repassent à null)
      const fields: Record<string, number | null> = {};
      for (const k of ALL_MEASUREMENT_KEYS) {
        fields[k] = input.measurements[k] ?? null;
      }

      const { error } = await db
        .from('measurement_logs')
        .update({ weight_kg: input.weight_kg ?? null, ...fields, photos })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.measurementLogs(athleteId) });
      toast.success('Saisie mise à jour ✓');
    },
    onError: (err: unknown) => {
      console.error('[measurement update error]', err);
      const msg = (err as { message?: string })?.message ?? String(err);
      toast.error('Erreur: ' + msg);
    },
  });
}

// ── Suppression d'une log (+ photos storage) ───────────────────────────────────

export function useDeleteMeasurementLog(athleteId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (log: MeasurementLog) => {
      const paths = Object.values(log.photos ?? {}).filter(Boolean) as string[];
      if (paths.length > 0) {
        await db.storage.from(MEASUREMENT_BUCKET).remove(paths);
      }
      const { error } = await db.from('measurement_logs').delete().eq('id', log.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.measurementLogs(athleteId) });
      toast.success('Saisie supprimée');
    },
    onError: (err: unknown) => {
      console.error('[measurement delete error]', err);
      toast.error('Erreur lors de la suppression');
    },
  });
}

// ── Signed URLs pour afficher les photos (bucket privé) ────────────────────────

export function useMeasurementPhotoUrls(paths: string[]) {
  const sorted = [...paths].sort();
  return useQuery({
    queryKey: ['measurementPhotoUrls', sorted],
    queryFn: async (): Promise<Record<string, string>> => {
      if (sorted.length === 0) return {};
      const { data, error } = await db.storage
        .from(MEASUREMENT_BUCKET)
        .createSignedUrls(sorted, 3600);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const item of data ?? []) {
        if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
      }
      return map;
    },
    enabled: sorted.length > 0,
    staleTime: 50 * 60 * 1000, // < 1h (durée du signed URL)
  });
}
