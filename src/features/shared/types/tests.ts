export type TestKind    = 'preset' | 'custom';
export type ValueType   = 'number' | 'pace' | 'duration';
export type BetterWhen  = 'higher' | 'lower';

export interface TestDefinition {
  id: string;
  name: string;
  kind: TestKind;
  created_by: string | null;
  is_global: boolean;
  description: string | null;
  protocol: { text?: string } | null;
  created_at: string;
  updated_at: string;
}

export interface TestVariable {
  id: string;
  test_definition_id: string;
  key: string;
  label: string;
  unit: string;
  value_type: ValueType;
  better_when: BetterWhen;
  created_at: string;
}

export interface TestDefinitionWithVariables extends TestDefinition {
  test_variables: TestVariable[];
}

export interface AthleteTestValue {
  id: string;
  result_id: string;
  variable_id: string;
  value: number;
  test_variables?: TestVariable;
}

export interface AthleteTestResult {
  id: string;
  athlete_id: string;
  test_definition_id: string;
  performed_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  test_definitions?: TestDefinitionWithVariables;
  athlete_test_values?: AthleteTestValue[];
}

export interface AthleteCurrentValue {
  athlete_id: string;
  variable_id: string;
  key: string;
  label: string;
  unit: string;
  value_type: ValueType;
  better_when: BetterWhen;
  current_value: number;
  best_performed_at: string;
}

// ── Inputs mutations ──────────────────────────────────────────────────────────

export interface CreateVariableInput {
  key: string;
  label: string;
  unit: string;
  value_type: ValueType;
  better_when: BetterWhen;
}

export interface CreateTestDefinitionInput {
  name: string;
  description: string;
  protocol: string;
  variables: CreateVariableInput[];
}

export interface UpdateTestDefinitionInput {
  id: string;
  name: string;
  description: string;
  protocol: string;
}

export interface CreateTestResultInput {
  test_definition_id: string;
  performed_at: string;
  notes: string;
  values: Record<string, number>; // variable_id → numeric value
}
