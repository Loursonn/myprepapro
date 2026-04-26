/** Palette de couleurs globale de l'app (mode sombre fixe). */
export const C = {
  bg: "#08090C", s1: "#111318", s2: "#181B24",
  brd: "rgba(255,255,255,0.04)", brdL: "rgba(255,255,255,0.08)",
  tx: "#F2F2F4", tx2: "#9194A0", tx3: "#555866",
  ac: "#7B6FFF", acS: "rgba(123,111,255,0.12)",
  g: "#22C993",  gS: "rgba(34,201,147,0.1)",
  o: "#F5A623",  oS: "rgba(245,166,35,0.1)",
  y: "#E8C93A",  yS: "rgba(232,201,58,0.1)",
  r: "#EF4B4B",  rS: "rgba(239,75,75,0.1)",
  b: "#3B8DF0",  bS: "rgba(59,141,240,0.1)",
  coach: "#D4538E", coachS: "rgba(212,83,142,0.12)",
} as const;

export const BT = {
  PERF:   { c: "#EF4B4B", l: "Mvt principal" },
  ESTH:   { c: "#7B6FFF", l: "Hypertrophie"  },
  BESOIN: { c: "#F5A623", l: "Besoin indiv."  },
  ASSOC:  { c: "#22C993", l: "Muscles assoc." },
  CORE:   { c: "#9194A0", l: "Core"           },
} as const;

export const BLOC_COLORS = [
  "#EF4B4B","#7B6FFF","#F5A623","#22C993","#9194A0",
  "#3B8DF0","#D4538E","#C060D0","#E06030","#22C9C9",
];

export const HABIT_COLORS = [
  "#F5A623","#22C993","#7B6FFF","#3B8DF0","#EF4B4B","#E8C93A","#D4538E","#C060D0",
];

export const HABIT_EMOJIS = [
  "💪","🏃","🧘","💧","📖","🛌","🥗","🎯","⚡","🔥","❤️","🎵",
  "✍️","🏋️","🚴","🌅","🍎","💊","🧠","🎾","⛷️","🏊","🚶","🌿",
  "☀️","🌙","🧹","🧴",
];
