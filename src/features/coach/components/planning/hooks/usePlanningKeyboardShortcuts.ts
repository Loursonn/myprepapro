/**
 * usePlanningKeyboardShortcuts — §6.a
 * Raccourcis clavier quand la frise de planification est active.
 *
 * N          → nouvelle période au niveau courant
 * ← / →      → période précédente / suivante (même niveau)
 * ↑ / ↓      → zoom out / zoom in
 * Suppr/Del  → supprimer la période sélectionnée
 * Cmd+D      → dupliquer
 * Esc        → désélectionner / fermer drawer
 */

import { useEffect } from "react";

export interface PlanningKeyboardHandlers {
  onNew?:        () => void;
  onPrevPeriod?: () => void;
  onNextPeriod?: () => void;
  onZoomOut?:    () => void;
  onZoomIn?:     () => void;
  onDelete?:     () => void;
  onDuplicate?:  () => void;
  onEscape?:     () => void;
  /** When true, shortcuts are active. Pass false when an input/textarea has focus to avoid conflicts. */
  enabled?: boolean;
}

export function usePlanningKeyboardShortcuts(handlers: PlanningKeyboardHandlers) {
  const { enabled = true } = handlers;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!enabled) return;

      // Skip if focus is inside an input / textarea / select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const isMac  = /Mac/i.test(navigator.platform);
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      switch (e.key) {
        case "n":
        case "N":
          if (!cmdKey) { e.preventDefault(); handlers.onNew?.(); }
          break;
        case "ArrowLeft":
          if (!cmdKey && !e.shiftKey) { e.preventDefault(); handlers.onPrevPeriod?.(); }
          break;
        case "ArrowRight":
          if (!cmdKey && !e.shiftKey) { e.preventDefault(); handlers.onNextPeriod?.(); }
          break;
        case "ArrowUp":
          if (!cmdKey && !e.shiftKey) { e.preventDefault(); handlers.onZoomOut?.(); }
          break;
        case "ArrowDown":
          if (!cmdKey && !e.shiftKey) { e.preventDefault(); handlers.onZoomIn?.(); }
          break;
        case "Delete":
        case "Backspace":
          if (!cmdKey) { e.preventDefault(); handlers.onDelete?.(); }
          break;
        case "d":
        case "D":
          if (cmdKey) { e.preventDefault(); handlers.onDuplicate?.(); }
          break;
        case "Escape":
          handlers.onEscape?.();
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers, enabled]);
}
