/** Palette de couleurs globale de l'app (mode sombre fixe) — Agon "futurisme antique" */
export const C = {
  // ── Fond & surfaces ──────────────────────────────────────────────────────────
  bg:  "#15120F",    // obsidienne
  s1:  "#1E1A16",    // basalte (cards, drawers)
  s2:  "#27221D",    // basalte 2 (inputs, skeletons)

  // ── Bordures ─────────────────────────────────────────────────────────────────
  brd:  "rgba(231,211,168,0.10)",
  brdL: "rgba(231,211,168,0.18)",

  // ── Texte ────────────────────────────────────────────────────────────────────
  tx:  "#F4EFE3",    // marbre
  tx2: "#B9AE9C",    // secondaire
  tx3: "#7D7468",    // muted / placeholder

  // ── Accents principaux ───────────────────────────────────────────────────────
  ac:   "#C9A14A",               // PRIMARY — or
  acS:  "rgba(201,161,74,0.12)",

  // ── Sémantique ───────────────────────────────────────────────────────────────
  g:  "#9DB06A",  gS: "rgba(157,176,106,0.1)",   // success / olivier
  o:  "#D99A3E",  oS: "rgba(217,154,62,0.1)",     // alerte / ocre
  y:  "#D99A3E",  yS: "rgba(217,154,62,0.1)",     // ocre (alias alerte)
  r:  "#D9705A",  rS: "rgba(217,112,90,0.1)",     // danger / terracotta
  b:  "#7E9CA8",  bS: "rgba(126,156,168,0.1)",    // info / ardoise

  // ── Coach / secondaire ───────────────────────────────────────────────────────
  coach:  "#C9A14A",             // SECONDARY — or (coach = or)
  coachS: "rgba(201,161,74,0.12)",
} as const;

// ── Raccourcis sémantiques (même valeur, alias lisibles) ──────────────────────
export const PRIMARY   = C.ac;       // #C9A14A or
export const SECONDARY = C.coach;    // #C9A14A or
export const TERTIARY  = C.o;        // #D99A3E ocre
export const NEUTRAL   = C.tx3;      // #7D7468 pierre
export const SUCCESS   = C.g;        // #9DB06A olivier

export const BT = {
  PERF:   { c: "#D9705A", l: "Mvt principal" },   // terracotta
  ESTH:   { c: "#C9A14A", l: "Hypertrophie"  },   // or
  BESOIN: { c: "#7E9CA8", l: "Besoin indiv."  },   // ardoise
  ASSOC:  { c: "#7FA88E", l: "Muscles assoc." },   // patine
  CORE:   { c: "#8E8780", l: "Core"           },   // pierre
} as const;

export const BLOC_COLORS = [
  "#C9A14A","#D9705A","#9DB06A","#7E9CA8","#A67C52",
  "#7FA88E","#B48EA0","#D99A3E","#E7D3A8","#8E8780",
];

export const HABIT_COLORS = [
  "#C9A14A","#D9705A","#9DB06A","#7E9CA8","#A67C52","#D99A3E","#7FA88E","#B48EA0",
];

export const HABIT_EMOJIS = [
  "💪","🏃","🧘","💧","📖","🛌","🥗","🎯","⚡","🔥","❤️","🎵",
  "✍️","🏋️","🚴","🌅","🍎","💊","🧠","🎾","⛷️","🏊","🚶","🌿",
  "☀️","🌙","🧹","🧴",
];
