/** Utilitaires de date utilisés dans l'app. */

export const todayKey = () => {
  const d = new Date();
  return (
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0")
  );
};

export const hISO = (d?: Date) => (d || new Date()).toISOString().slice(0, 10);

export const hAddDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

export const calcHabitStreak = (logs: string[]): number => {
  const today = new Date();
  const todayISO = hISO(today);
  const base = logs.includes(todayISO) ? 0 : 1;
  let s = 0;
  for (let i = base; i < 365; i++) {
    if (logs.includes(hISO(hAddDays(today, -i)))) s++;
    else break;
  }
  return s;
};

export const streakMsg = (s: number): string => {
  if (s === 0)  return "🧊 Fais le aujourd'hui au moins";
  if (s === 1)  return "1er jour, garde la pêche 🍑";
  if (s <= 2)   return `🔥 ${s} jours d'affilée`;
  if (s <= 4)   return `🔥🔥 ${s} jours d'affilée`;
  if (s <= 9)   return `🔥🔥🔥 ${s} jours d'affilée`;
  if (s <= 29)  return `🔥🔥🔥🔥 ${s} jours d'affilée`;
  if (s < 365)  return `🔥🔥🔥🔥🔥 ${s} jours d'affilée`;
  const y = Math.floor(s / 365), day = s % 365;
  return `🏆🔥 ${y} an${y > 1 ? "s" : ""} et ${day} jours d'affilée !`;
};

export const getHabitWeekDays = () => {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => hAddDays(today, i - 6));
};

export const checkMilestone = (
  log: Record<string, number>,
  baseline: number
): number | null => {
  const sorted = Object.entries(log).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (sorted.length < 3) return null;
  const last3 = sorted.slice(-3);
  return last3.every(([, kg]) => kg > baseline)
    ? parseFloat((last3.reduce((s, [, kg]) => s + kg, 0) / 3).toFixed(1))
    : null;
};
