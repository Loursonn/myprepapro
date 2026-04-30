import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ── Recent pages ──────────────────────────────────────────────────────────────

const RECENTS_KEY = "coach:cmd_palette_recents";
const MAX_RECENTS = 5;

export interface RecentEntry {
  label: string;
  path: string;
  icon?: string;
}

function loadRecents(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecents(recents: RecentEntry[]) {
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
}

// ── Context ───────────────────────────────────────────────────────────────────

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  recents: RecentEntry[];
  pushRecent: (entry: RecentEntry) => void;
}

const CommandPaletteCtx = createContext<CommandPaletteContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteCtx);
  if (!ctx) throw new Error("useCommandPalette must be used inside CommandPaletteProvider");
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<RecentEntry[]>(loadRecents);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  const pushRecent = useCallback((entry: RecentEntry) => {
    setRecents((prev) => {
      // deduplicate by path — move to front
      const filtered = prev.filter((r) => r.path !== entry.path);
      const next = [entry, ...filtered].slice(0, MAX_RECENTS);
      saveRecents(next);
      return next;
    });
  }, []);

  return (
    <CommandPaletteCtx.Provider value={{ open, setOpen, toggle, recents, pushRecent }}>
      {children}
    </CommandPaletteCtx.Provider>
  );
}
