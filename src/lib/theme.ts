/** Palette de couleurs globale de l'app (mode sombre fixe) — v2 MyPrepaPro */
export const C = {
  // ── Fond & surfaces ──────────────────────────────────────────────────────────
  bg:  "#1D1C1E",
  s1:  "#252327",   // surface élevée (cards, drawers)
  s2:  "#2A282C",   // surface doublement élevée (inputs, skeletons)

  // ── Bordures ─────────────────────────────────────────────────────────────────
  brd:  "rgba(124,116,128,0.15)",
  brdL: "rgba(124,116,128,0.25)",

  // ── Texte ────────────────────────────────────────────────────────────────────
  tx:  "#FFFFFF",
  tx2: "#B0A8B4",   // secondaire clair
  tx3: "#7C7480",   // muted / placeholder

  // ── Accents principaux ───────────────────────────────────────────────────────
  ac:   "#A855F7",              // PRIMARY — violet
  acS:  "rgba(168,85,247,0.12)",

  // ── Sémantique ───────────────────────────────────────────────────────────────
  g:  "#22C993",  gS: "rgba(34,201,147,0.1)",   // success / vert
  o:  "#FB923C",  oS: "rgba(251,146,60,0.1)",    // tertiary / orange
  y:  "#E8C93A",  yS: "rgba(232,201,58,0.1)",    // jaune
  r:  "#EF4B4B",  rS: "rgba(239,75,75,0.1)",     // danger / rouge
  b:  "#3B8DF0",  bS: "rgba(59,141,240,0.1)",    // info / bleu

  // ── Coach / secondaire ───────────────────────────────────────────────────────
  coach:  "#F472B6",             // SECONDARY — rose
  coachS: "rgba(244,114,182,0.12)",
} as const;

// ── Raccourcis sémantiques (même valeur, alias lisibles) ──────────────────────
export const PRIMARY   = C.ac;       // #A855F7 violet
export const SECONDARY = C.coach;    // #F472B6 rose
export const TERTIARY  = C.o;        // #FB923C orange
export const NEUTRAL   = C.tx3;      // #7C7480 gris
export const SUCCESS   = C.g;        // #22C993 vert

export const BT = {
  PERF:   { c: "#EF4B4B", l: "Mvt principal" },
  ESTH:   { c: "#A855F7", l: "Hypertrophie"  },   // mis à jour primary
  BESOIN: { c: "#FB923C", l: "Besoin indiv."  },   // mis à jour tertiary
  ASSOC:  { c: "#22C993", l: "Muscles assoc." },
  CORE:   { c: "#7C7480", l: "Core"           },
} as const;

export const BLOC_COLORS = [
  "#EF4B4B","#A855F7","#FB923C","#22C993","#7C7480",
  "#3B8DF0","#F472B6","#C060D0","#E06030","#22C9C9",
];

export const HABIT_COLORS = [
  "#FB923C","#22C993","#A855F7","#3B8DF0","#EF4B4B","#E8C93A","#F472B6","#C060D0",
];

export const HABIT_EMOJIS = [
  "💪","🏃","🧘","💧","📖","🛌","🥗","🎯","⚡","🔥","❤️","🎵",
  "✍️","🏋️","🚴","🌅","🍎","💊","🧠","🎾","⛷️","🏊","🚶","🌿",
  "☀️","🌙","🧹","🧴",
];
