/**
 * Utilitaires de mutation de l'arbre EnergyGroup.
 * Toutes les fonctions sont pures (retournent un nouveau root).
 */
import type { EnergyGroup, EnergyInterval, EnergyStep } from "@/types/energy";

export function genId(): string {
  return crypto.randomUUID();
}

// ── Lookup ────────────────────────────────────────────────────────────────────

type ParentInfo = { parent: EnergyGroup; index: number };

/** Trouve le parent direct d'un step par son id. Null si c'est la racine. */
export function findParent(root: EnergyGroup, id: string): ParentInfo | null {
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    if (child.id === id) return { parent: root, index: i };
    if (child.type === "group") {
      const found = findParent(child, id);
      if (found) return found;
    }
  }
  return null;
}

/** Trouve un step (n'importe où) par son id. */
export function findStep(root: EnergyGroup, id: string): EnergyStep | null {
  for (const child of root.children) {
    if (child.id === id) return child;
    if (child.type === "group") {
      const found = findStep(child, id);
      if (found) return found;
    }
  }
  return null;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Remplace un step par son id (mise à jour). */
export function updateStep(root: EnergyGroup, updated: EnergyStep): EnergyGroup {
  return {
    ...root,
    children: root.children.map((child) => {
      if (child.id === updated.id) return updated;
      if (child.type === "group") return updateStep(child, updated);
      return child;
    }),
  };
}

/** Supprime un step par son id. */
export function deleteStep(root: EnergyGroup, id: string): EnergyGroup {
  return {
    ...root,
    children: root.children
      .filter((child) => child.id !== id)
      .map((child) =>
        child.type === "group" ? deleteStep(child, id) : child
      ),
  };
}

/** Duplique un step (copie profonde avec nouveaux ids). */
export function duplicateStep(root: EnergyGroup, id: string): EnergyGroup {
  const info = findParent(root, id);
  if (!info) return root;
  const { parent, index } = info;
  const original = parent.children[index];
  const cloned = deepCloneWithNewIds(original);

  const newParent: EnergyGroup = {
    ...parent,
    children: [
      ...parent.children.slice(0, index + 1),
      cloned,
      ...parent.children.slice(index + 1),
    ],
  };
  if (parent.id === root.id) return newParent;
  return updateStep(root, newParent);
}

/** Réordonne les enfants directs d'un groupe (même parent). */
export function reorderChildren(
  root: EnergyGroup,
  parentId: string,
  fromIndex: number,
  toIndex: number
): EnergyGroup {
  if (root.id === parentId) {
    const children = [...root.children];
    const [moved] = children.splice(fromIndex, 1);
    children.splice(toIndex, 0, moved);
    return { ...root, children };
  }
  return {
    ...root,
    children: root.children.map((child) =>
      child.type === "group" ? reorderChildren(child, parentId, fromIndex, toIndex) : child
    ),
  };
}

/** Ajoute un step à la fin des enfants d'un groupe par son id. */
export function addStepToGroup(
  root: EnergyGroup,
  parentId: string,
  step: EnergyStep
): EnergyGroup {
  if (root.id === parentId) {
    return { ...root, children: [...root.children, step] };
  }
  return {
    ...root,
    children: root.children.map((child) =>
      child.type === "group" ? addStepToGroup(child, parentId, step) : child
    ),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deepCloneWithNewIds(step: EnergyStep): EnergyStep {
  if (step.type === "interval") {
    return { ...step, id: genId() };
  }
  return {
    ...step,
    id: genId(),
    children: step.children.map(deepCloneWithNewIds),
    rest_between: step.rest_between
      ? { ...step.rest_between, id: genId() }
      : undefined,
  };
}

// ── Default factories ─────────────────────────────────────────────────────────

export function makeInterval(): EnergyInterval {
  return {
    type: "interval",
    id: genId(),
    role: "work",
    duration: { kind: "time", value: 60 },
    target: { kind: "none" },
  };
}

export function makeGroup(): EnergyGroup {
  return {
    type: "group",
    id: genId(),
    role: "work",
    repeat: 3,
    children: [makeInterval()],
  };
}

export function makeRootGroup(): EnergyGroup {
  return {
    type: "group",
    id: genId(),
    role: "open",
    repeat: 1,
    children: [],
  };
}
