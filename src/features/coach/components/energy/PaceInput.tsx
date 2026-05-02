/**
 * PaceInput — input texte pour saisir une allure au format mm:ss.
 *
 * Accepte : "4:20", "4'20", "420" (auto-formaté en 4:20)
 * Stocke en interne en secondes par km.
 * onBlur reformate proprement (ex: "4:5" → "4:05").
 */
import { useState, useEffect } from "react";
import { C } from "@/lib/theme";

interface Props {
  /** Valeur en secondes par km */
  value: number;
  onChange: (seconds: number) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

const inpStyle: React.CSSProperties = {
  background: C.s2,
  border: `1px solid ${C.brd}`,
  borderRadius: 6,
  color: C.tx,
  fontSize: 13,
  padding: "6px 10px",
  width: 80,
  fontFamily: "inherit",
  outline: "none",
};

/** Parse une saisie utilisateur en secondes. Accepte mm:ss, m'ss, mmss. */
export function parsePaceInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/[''`]/g, ":").replace(/[^0-9:]/g, ":");
  const colonIdx = cleaned.indexOf(":");

  if (colonIdx !== -1) {
    const mPart = cleaned.slice(0, colonIdx);
    const sPart = cleaned.slice(colonIdx + 1);
    const m = parseInt(mPart, 10);
    const s = parseInt(sPart, 10);
    if (isNaN(m) || isNaN(s)) return null;
    if (s < 0 || s > 59) return null;
    return m * 60 + s;
  }

  // Pas de séparateur : "420" → 4:20 si 3-4 chiffres, sinon secondes brutes
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 3) {
    const m = parseInt(digits.slice(0, 1), 10);
    const s = parseInt(digits.slice(1), 10);
    if (s > 59) return null;
    return m * 60 + s;
  }
  if (digits.length === 4) {
    const m = parseInt(digits.slice(0, 2), 10);
    const s = parseInt(digits.slice(2), 10);
    if (s > 59) return null;
    return m * 60 + s;
  }

  const n = parseInt(digits, 10);
  return isNaN(n) ? null : n;
}

/** Formate des secondes par km en "M:SS" */
export function formatPaceSeconds(totalSecs: number): string {
  const m = Math.floor(totalSecs / 60);
  const s = Math.round(totalSecs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function PaceInput({ value, onChange, placeholder = "4:20", style }: Props) {
  const [text, setText] = useState<string>(value > 0 ? formatPaceSeconds(value) : "");

  // Sync from parent when value changes externally
  useEffect(() => {
    if (value > 0) setText(formatPaceSeconds(value));
    else setText("");
  }, [value]);

  function handleBlur() {
    if (!text.trim()) return;
    const parsed = parsePaceInput(text);
    if (parsed !== null && parsed > 0) {
      onChange(parsed);
      setText(formatPaceSeconds(parsed));
    } else {
      // Restore previous valid value
      setText(value > 0 ? formatPaceSeconds(value) : "");
    }
  }

  return (
    <input
      type="text"
      style={{ ...inpStyle, ...style }}
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleBlur}
    />
  );
}
