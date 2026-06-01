import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Trophy, Plus, Trash2, FlaskConical, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAthleteContext } from '@/features/shared/context/AthleteContext';
import { C } from '@/lib/theme';
import { EmptyState } from '@/features/shared/components/EmptyState';
import { ListSkeleton, CardSkeleton } from '@/features/shared/components/skeletons';
import { useAthleteTestResults, useAthleteCurrentValues, useCreateTestResult, useDeleteTestResult } from '@/features/shared/hooks/tests/useAthleteTests';
import { useTestDefinitions } from '@/features/shared/hooks/tests/useTestDefinitions';
import type { TestDefinitionWithVariables, AthleteCurrentValue, AthleteTestResult } from '@/features/shared/types/tests';

// ── Composant : valeurs courantes ─────────────────────────────────────────────

function CurrentValueChip({ cv }: { cv: AthleteCurrentValue }) {
  return (
    <div style={{
      background: C.s1, borderRadius: 10, border: '1px solid ' + C.brd,
      padding: '10px 14px', minWidth: 100, flexShrink: 0,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
        {cv.label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.ac, lineHeight: 1.1 }}>
        {cv.current_value % 1 === 0 ? cv.current_value : cv.current_value.toFixed(1)}
      </div>
      <div style={{ fontSize: 11, color: C.tx3, marginTop: 1 }}>{cv.unit}</div>
      <div style={{ fontSize: 10, color: C.tx3, marginTop: 4 }}>
        {format(new Date(cv.best_performed_at), 'd MMM yyyy', { locale: fr })}
      </div>
    </div>
  );
}

// ── Composant : carte résultat ────────────────────────────────────────────────

function ResultCard({
  result, onDelete, deleting,
}: {
  result: AthleteTestResult;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const def = result.test_definitions;
  const values = result.athlete_test_values ?? [];

  return (
    <div style={{
      background: C.s1, borderRadius: 12, border: '1px solid ' + C.brd, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <FlaskConical size={14} color={C.ac} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>
              {def?.name ?? 'Test inconnu'}
            </span>
            <span style={{ fontSize: 11, color: C.tx3 }}>
              · {format(new Date(result.performed_at), 'd MMM yyyy', { locale: fr })}
            </span>
          </div>

          {/* Valeurs */}
          {values.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {values.map(v => {
                const varDef = v.test_variables;
                const num = Number(v.value);
                return (
                  <div key={v.id} style={{
                    padding: '4px 10px', borderRadius: 7,
                    background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)',
                  }}>
                    <span style={{ fontSize: 11, color: C.tx3 }}>
                      {varDef?.label ?? '—'}{' '}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.ac }}>
                      {num % 1 === 0 ? num : num.toFixed(1)}{' '}{varDef?.unit ?? ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {result.notes && (
            <p style={{ fontSize: 11, color: C.tx3, marginTop: 8, fontStyle: 'italic', lineHeight: 1.5 }}>
              "{result.notes}"
            </p>
          )}
        </div>

        {/* Supprimer */}
        <div style={{ flexShrink: 0 }}>
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => { onDelete(result.id); setConfirmDelete(false); }}
                disabled={deleting}
                style={{
                  padding: '5px 10px', borderRadius: 6, border: 'none', fontFamily: 'inherit',
                  background: 'rgba(239,75,75,0.15)', color: '#EF4B4B',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Supprimer
              </button>
              <button onClick={() => setConfirmDelete(false)} style={{
                padding: '5px 8px', borderRadius: 6, border: '1px solid ' + C.brdL,
                background: 'transparent', color: C.tx3, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={{
              width: 28, height: 28, borderRadius: 6, border: '1px solid ' + C.brdL,
              background: 'transparent', color: C.tx3, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color 150ms ease-out',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#EF4B4B')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = C.tx3)}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Formulaire ajout résultat ─────────────────────────────────────────────────

function AddResultForm({
  tests, athleteId, onSuccess, onCancel,
}: {
  tests: TestDefinitionWithVariables[];
  athleteId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const createMut = useCreateTestResult(athleteId);

  const [selectedTestId, setSelectedTestId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});

  const selectedTest = tests.find(t => t.id === selectedTestId);

  function handleTestSelect(id: string) {
    setSelectedTestId(id);
    setValues({});
  }

  function handleSubmit() {
    if (!selectedTest) return;
    const numericValues: Record<string, number> = {};
    for (const [variableId, raw] of Object.entries(values)) {
      const n = parseFloat(raw.replace(',', '.'));
      if (!isNaN(n)) numericValues[variableId] = n;
    }
    createMut.mutate(
      { test_definition_id: selectedTestId, performed_at: date, notes, values: numericValues },
      { onSuccess },
    );
  }

  const isValid = !!selectedTest && selectedTest.test_variables.some(v => {
    const raw = values[v.id];
    return raw && !isNaN(parseFloat(raw.replace(',', '.')));
  });

  return (
    <div style={{
      background: C.s1, borderRadius: 14, border: '1px solid ' + C.ac + '40',
      padding: '20px', display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onCancel} style={{
          width: 28, height: 28, borderRadius: 6, border: '1px solid ' + C.brdL,
          background: 'transparent', color: C.tx3, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ChevronLeft size={14} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>Nouveau résultat</span>
      </div>

      {/* Sélection du test */}
      <div>
        <label style={labelStyle}>Test *</label>
        <select
          value={selectedTestId}
          onChange={e => handleTestSelect(e.target.value)}
          style={inputStyle}
        >
          <option value="">Sélectionner un test…</option>
          {tests.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div>
        <label style={labelStyle}>Date *</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Variables du test sélectionné */}
      {selectedTest && (
        <div>
          <label style={labelStyle}>Mesures</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedTest.test_variables.map(v => (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 90, fontSize: 12, fontWeight: 600, color: C.tx }}>
                  {v.label}
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={values[v.id] ?? ''}
                  onChange={e => setValues(prev => ({ ...prev, [v.id]: e.target.value }))}
                  placeholder="—"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <div style={{ minWidth: 48, fontSize: 12, color: C.tx3, flexShrink: 0 }}>
                  {v.unit}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Note */}
      <div>
        <label style={labelStyle}>Note (optionnel)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Conditions, ressenti, observations…"
          rows={2}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={cancelBtnStyle}>Annuler</button>
        <button
          onClick={handleSubmit}
          disabled={!isValid || createMut.isPending}
          style={{
            padding: '9px 22px', borderRadius: 9, border: 'none', fontFamily: 'inherit',
            background: isValid && !createMut.isPending ? C.ac : C.s2,
            color: isValid && !createMut.isPending ? '#fff' : C.tx3,
            fontSize: 13, fontWeight: 700,
            cursor: isValid && !createMut.isPending ? 'pointer' : 'default',
            transition: 'background 150ms ease-out',
          }}
        >
          {createMut.isPending ? 'Enregistrement…' : 'Valider les résultats'}
        </button>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function TestPage({ embedded = false }: { embedded?: boolean }) {
  const { profile } = useAuth();
  const { athleteId } = useAthleteContext();
  const coachId = profile?.id ?? '';

  const { data: results = [], isLoading: loadingResults } = useAthleteTestResults(athleteId);
  const { data: currentValues = [], isLoading: loadingCurrent } = useAthleteCurrentValues(athleteId);
  const { data: allTests = [] } = useTestDefinitions(coachId);
  const deleteMut = useDeleteTestResult(athleteId);

  const [addingResult, setAddingResult] = useState(false);

  return (
    <div style={embedded ? { display: 'flex', flexDirection: 'column' } : { padding: '24px', maxWidth: 800, margin: '0 auto' }}>

      {/* Valeurs courantes (PR) */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Trophy size={15} color={C.ac} />
          <span style={{
            fontSize: 10, fontWeight: 700, color: C.tx3,
            textTransform: 'uppercase', letterSpacing: '0.6px',
          }}>
            Valeurs courantes
          </span>
        </div>

        {loadingCurrent ? (
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {[0, 1, 2].map(i => <CardSkeleton key={i} />)}
          </div>
        ) : currentValues.length === 0 ? (
          <div style={{
            padding: '14px 18px', borderRadius: 10, border: '1px dashed ' + C.brdL,
            fontSize: 12, color: C.tx3,
          }}>
            Aucune valeur enregistrée. Ajoute un premier résultat de test.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {currentValues.map(cv => <CurrentValueChip key={cv.variable_id} cv={cv} />)}
          </div>
        )}
      </section>

      {/* Historique des résultats */}
      <section>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FlaskConical size={15} color={C.tx3} />
            <span style={{
              fontSize: 10, fontWeight: 700, color: C.tx3,
              textTransform: 'uppercase', letterSpacing: '0.6px',
            }}>
              Résultats — {results.length}
            </span>
          </div>
          {!addingResult && (
            <button
              onClick={() => setAddingResult(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8, border: 'none',
                background: C.ac, color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'opacity 150ms ease-out',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.85')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
            >
              <Plus size={13} /> Ajouter un résultat
            </button>
          )}
        </div>

        {/* Formulaire inline */}
        {addingResult && (
          <div style={{ marginBottom: 16 }}>
            <AddResultForm
              tests={allTests}
              athleteId={athleteId}
              onSuccess={() => setAddingResult(false)}
              onCancel={() => setAddingResult(false)}
            />
          </div>
        )}

        {loadingResults ? (
          <ListSkeleton rows={3} />
        ) : results.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="Aucun résultat de test"
            description="Ajoute le premier résultat pour cet athlète."
            cta={{ label: 'Ajouter un résultat', onClick: () => setAddingResult(true) }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {results.map(r => (
              <ResultCard
                key={r.id} result={r}
                onDelete={id => deleteMut.mutate(id)}
                deleting={deleteMut.isPending}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: '#E8E6EA', fontSize: 12, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 600,
  color: '#7C7480', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6,
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 9,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'transparent', color: '#7C7480',
  fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
};
