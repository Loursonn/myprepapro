import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { QK } from '@/lib/queryKeys';
import type {
  TestDefinitionWithVariables,
  CreateTestDefinitionInput,
  UpdateTestDefinitionInput,
} from '@/features/shared/types/tests';

// ── Lecture ───────────────────────────────────────────────────────────────────

async function fetchTestDefinitions(coachId: string): Promise<TestDefinitionWithVariables[]> {
  const { data, error } = await supabase
    .from('test_definitions')
    .select('*, test_variables(*)')
    .or(`is_global.eq.true,created_by.eq.${coachId}`)
    .order('kind')          // preset avant custom
    .order('name');
  if (error) throw error;
  // Trier les variables par label dans chaque test
  return ((data ?? []) as TestDefinitionWithVariables[]).map(td => ({
    ...td,
    test_variables: [...td.test_variables].sort((a, b) => a.label.localeCompare(b.label)),
  }));
}

export function useTestDefinitions(coachId: string) {
  return useQuery({
    queryKey: QK.testDefinitions(coachId),
    queryFn:  () => fetchTestDefinitions(coachId),
    staleTime: 5 * 60_000,
    enabled:  !!coachId,
  });
}

// ── Créer un test custom ──────────────────────────────────────────────────────

export function useCreateTestDefinition(coachId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTestDefinitionInput) => {
      const { data: def, error: defErr } = await supabase
        .from('test_definitions')
        .insert({
          name:       input.name.trim(),
          kind:       'custom',
          created_by: coachId,
          is_global:  false,
          description: input.description.trim() || null,
          protocol:   input.protocol.trim() ? { text: input.protocol.trim() } : null,
        })
        .select()
        .single();
      if (defErr) throw defErr;

      const { error: varErr } = await supabase
        .from('test_variables')
        .insert(input.variables.map(v => ({ ...v, test_definition_id: def.id })));
      if (varErr) {
        // Nettoyage : supprimer la définition si les variables échouent
        await supabase.from('test_definitions').delete().eq('id', def.id);
        throw varErr;
      }
      return def;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.testDefinitions(coachId) });
      toast.success('Test créé');
    },
    onError: () => toast.error('Erreur lors de la création du test'),
  });
}

// ── Mettre à jour nom / description / protocole (pas les variables) ───────────

export function useUpdateTestDefinition(coachId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateTestDefinitionInput) => {
      const { error } = await supabase
        .from('test_definitions')
        .update({
          name:       input.name.trim(),
          description: input.description.trim() || null,
          protocol:   input.protocol.trim() ? { text: input.protocol.trim() } : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.testDefinitions(coachId) });
      toast.success('Test mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });
}

// ── Supprimer un test custom (cascade sur variables) ─────────────────────────

export function useDeleteTestDefinition(coachId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (testId: string) => {
      const { error } = await supabase.from('test_definitions').delete().eq('id', testId);
      if (error) throw error;
    },
    onMutate: async (testId) => {
      await qc.cancelQueries({ queryKey: QK.testDefinitions(coachId) });
      const previous = qc.getQueryData<TestDefinitionWithVariables[]>(QK.testDefinitions(coachId));
      qc.setQueryData<TestDefinitionWithVariables[]>(
        QK.testDefinitions(coachId),
        (old) => (old ?? []).filter(d => d.id !== testId),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(QK.testDefinitions(coachId), ctx.previous);
      toast.error('Erreur lors de la suppression');
    },
    onSuccess: () => toast.success('Test supprimé'),
  });
}
