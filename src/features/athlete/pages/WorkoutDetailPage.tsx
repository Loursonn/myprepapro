import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { C } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { useWorkoutSession } from "@/features/shared/hooks/useWorkoutSession";
import type { WorkoutBlocData } from "@/features/shared/hooks/useWorkoutSession";
import { useSaveWorkoutSets } from "@/features/shared/hooks/useSaveWorkoutSets";
import { usePrevWorkoutSets } from "@/features/shared/hooks/usePrevWorkoutSets";
import type { AthleteModifications, SessionSetLog } from "@/features/shared/types/athlete";
import type { ExerciceParams } from "@/features/coach/components/programmation/types";

// ── Constants ──────────────────────────────────────────────────────────────────

const VIOLET = "#7B6FFF";
const ROSE = "#D4538E";
const GREEN = "#22C993";
const REST_DEFAULT = 90;
const RING_R = 18;
const RING_C = 2 * Math.PI * RING_R; // ≈ 113.097

const BLOC_PALETTE = [
  "#7B6FFF", "#F97316", "#22C55E", "#EF4444",
  "#3B9EFF", "#FACC15", "#EC4899", "#14B8A6",
];

const FIELD_CFG = {
  kg:   { label: "Charge",                unit: "kg",   steps: [-2.5, -1.25, 1.25, 2.5] as number[] },
  reps: { label: "Répétitions",           unit: "reps", steps: [-2, -1, 1, 2] as number[] },
  rir:  { label: "RIR (reps en réserve)", unit: "",     steps: [-1, 1] as number[] },
} as const;

// ── Types ──────────────────────────────────────────────────────────────────────

interface SetState { kg: string; reps: string; rir: string; done: boolean; skipped: boolean; }
type AllSets = Record<string, SetState[]>;
interface PadTarget { exId: string; setIdx: number; field: "kg" | "reps" | "rir"; chargeUnit: string; }

// ── Helpers ────────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function haptic() {
  if (navigator.vibrate) navigator.vibrate(10);
}

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function parsePrevVal(str: string, field: "kg" | "reps"): string {
  if (!str || str === "—") return "";
  if (field === "kg") {
    const m = str.match(/^([\d,]+(?:\.\d+)?)/);
    return m ? m[1] : "";
  }
  const m = str.match(/×(\d+)/);
  return m ? m[1] : "";
}

function getSetTarget(
  params: ExerciceParams,
  setIdx: number,
): { reps?: number; kg?: number | null; rir?: number | null } {
  const reps =
    params.reps.mode === "par_serie" ? params.reps.values[setIdx] : params.reps.value;
  const kg =
    params.charge_unit !== "PDC"
      ? params.charge.mode === "par_serie"
        ? params.charge.values[setIdx]
        : params.charge.value
      : null;
  const rir =
    params.rir.mode === "par_serie"
      ? (params.rir.values as (number | null)[])[setIdx]
      : params.rir.value;
  return { reps, kg, rir };
}

function initSetState(
  params: ExerciceParams,
  setIdx: number,
  saved?: SessionSetLog,
): SetState {
  if (saved) {
    return {
      kg: saved.kg != null ? String(saved.kg).replace(".", ",") : "",
      reps: saved.reps != null ? String(saved.reps) : "",
      rir: saved.rir != null ? String(saved.rir) : "",
      done: saved.done,
      skipped: saved.skipped ?? false,
    };
  }
  const t = getSetTarget(params, setIdx);
  return {
    kg: t.kg != null ? String(t.kg).replace(".", ",") : "",
    reps: t.reps != null ? String(t.reps) : "",
    rir: t.rir != null ? String(t.rir) : "",
    done: false,
    skipped: false,
  };
}

function setStateToLog(s: SetState): SessionSetLog {
  const kgStr = s.kg.replace(",", ".");
  return {
    done: s.done,
    skipped: s.skipped,
    kg: kgStr ? parseFloat(kgStr) : undefined,
    reps: s.reps ? parseInt(s.reps) : undefined,
    rir: s.rir === "5+" ? 5 : s.rir !== "" ? parseFloat(s.rir) : undefined,
  };
}

function allSetsToMods(allSets: AllSets, base: AthleteModifications): AthleteModifications {
  const sessionSets: Record<string, SessionSetLog[]> = {};
  for (const [exId, exSets] of Object.entries(allSets)) {
    sessionSets[exId] = exSets.map(setStateToLog);
  }
  return { ...base, sessionSets };
}

function formatPrescription(params: ExerciceParams): string {
  const nb = params.nb_series;
  if (params.cluster) {
    const c = params.cluster;
    const repsArr = Array.isArray(c.reps) ? c.reps : Array(c.nb_clusters).fill(5);
    let s = `${nb}×(${repsArr.join("+")} + ${c.recup_sec}s)`;
    const charge = params.charge.mode === "global" ? params.charge.value : null;
    if (charge != null && params.charge_unit !== "PDC") s += ` @ ${charge}${params.charge_unit}`;
    return s;
  }
  if (params.reps.mode === "par_serie" || params.charge.mode === "par_serie") {
    const parts = Array.from({ length: nb }, (_, i) => {
      const r = params.reps.mode === "par_serie" ? params.reps.values[i] : params.reps.value;
      const c = params.charge.mode === "par_serie" ? params.charge.values[i] : params.charge.value;
      if (c != null && params.charge_unit !== "PDC") return `${r ?? "?"}@${c}${params.charge_unit}`;
      return String(r ?? "?");
    });
    return `${nb}× ${parts.join(" / ")}`;
  }
  const reps = params.reps.mode === "global" ? params.reps.value : "?";
  const chargeVal =
    params.charge_unit === "PDC"
      ? "PDC"
      : params.charge.mode === "global" && params.charge.value != null
      ? `${params.charge.value}${params.charge_unit}`
      : null;
  const rirVal = params.rir.mode === "global" && params.rir.value != null ? params.rir.value : null;
  let s = `${nb}×${reps}`;
  if (chargeVal) s += ` @ ${chargeVal}`;
  if (rirVal != null) s += ` · RIR ${rirVal}`;
  return s;
}

function timingLabel(bloc: {
  timing_mode: string;
  timing_repos_min?: number;
  timing_repos_sec?: number;
  timing_depart_min?: number;
  timing_depart_sec?: number;
}): string | null {
  if (bloc.timing_mode === "libre") return null;
  if (bloc.timing_mode === "depart") {
    const min = bloc.timing_depart_min ?? 0;
    const sec = bloc.timing_depart_sec ?? 0;
    return sec > 0
      ? `Départ /${min > 0 ? `${min}min ` : ""}${sec}s`
      : `Départ /${min}min`;
  }
  const min = bloc.timing_repos_min ?? 0;
  const sec = bloc.timing_repos_sec ?? 0;
  if (min > 0 && sec > 0) return `Repos ${min}min ${sec}s`;
  if (min > 0) return `Repos ${min}min`;
  if (sec > 0) return `Repos ${sec}s`;
  return null;
}

function blocRestSeconds(bloc: {
  timing_mode: string;
  timing_depart_min?: number;
  timing_depart_sec?: number;
  timing_repos_min?: number;
  timing_repos_sec?: number;
}): number {
  if (bloc.timing_mode === "repos") {
    const s = (bloc.timing_repos_min ?? 0) * 60 + (bloc.timing_repos_sec ?? 0);
    return s > 0 ? s : 0;
  }
  if (bloc.timing_mode === "depart") {
    const s = (bloc.timing_depart_min ?? 0) * 60 + (bloc.timing_depart_sec ?? 0);
    return s > 0 ? s : 0;
  }
  return 0; // libre → rien
}

// ── BadgeTag ───────────────────────────────────────────────────────────────────

function BadgeTag({ label, color = VIOLET }: { label: string; color?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: 20,
        background: hexToRgba(color, 0.12),
        color,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.2px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ── SetRow ─────────────────────────────────────────────────────────────────────

interface SetRowProps {
  setIdx: number;
  state: SetState;
  prevStr: string;
  chargeUnit: string;
  onToggle: () => void;
  onOpenPad: (field: "kg" | "reps" | "rir") => void;
  isCompleted: boolean;
  canRemove?: boolean;
  onRemoveSet?: () => void;
}

function SetRow({ setIdx, state, prevStr, chargeUnit, onToggle, onOpenPad, isCompleted, canRemove, onRemoveSet }: SetRowProps) {
  const isPDC = chargeUnit === "PDC";
  const checkState = state.done ? "done" : state.skipped ? "skip" : "empty";
  const gridCols = isPDC
    ? "34px 1fr 1.15fr 0.9fr 40px"
    : "34px 1fr 1.15fr 1.15fr 0.9fr 40px";

  function cell(field: "kg" | "reps" | "rir", val: string) {
    return (
      <div
        onClick={() => !isCompleted && onOpenPad(field)}
        style={{
          background: state.done ? hexToRgba(GREEN, 0.06) : C.s2,
          border: `1px solid ${state.done ? hexToRgba(GREEN, 0.3) : C.brdL}`,
          borderRadius: 8,
          padding: "7px 2px",
          color: state.done ? GREEN : state.skipped ? C.tx3 : C.tx,
          fontSize: 13,
          fontWeight: 700,
          textAlign: "center" as const,
          cursor: isCompleted ? "default" : "pointer",
          transition: "all 100ms",
          minHeight: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: state.skipped ? "line-through" : "none",
        }}
      >
        {val || <span style={{ color: C.tx3, fontWeight: 400, fontSize: 11 }}>—</span>}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: gridCols,
        gap: 5,
        alignItems: "center",
        padding: "5px 0",
        borderBottom: `1px solid ${C.brd}`,
      }}
    >
      {/* Set number / remove bonus */}
      <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: C.tx3 }}>
        {canRemove && onRemoveSet ? (
          <button
            onClick={onRemoveSet}
            style={{
              width: 22, height: 22, borderRadius: 6,
              border: `1px solid ${hexToRgba(ROSE, 0.5)}`,
              background: hexToRgba(ROSE, 0.12),
              color: ROSE, fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: 0,
            }}
          >×</button>
        ) : setIdx + 1}
      </div>

      {/* kg */}
      {!isPDC && cell("kg", state.kg)}

      {/* reps */}
      {cell("reps", state.reps)}

      {/* prev perf */}
      <div
        style={{
          textAlign: "center",
          fontSize: 10,
          color: C.tx3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {prevStr || "—"}
      </div>

      {/* rir */}
      {cell("rir", state.rir)}

      {/* 3-state checkmark */}
      <button
        onClick={() => {
          if (!isCompleted) {
            onToggle();
            haptic();
          }
        }}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: `2px solid ${
            checkState === "done" ? GREEN : checkState === "skip" ? ROSE : C.brdL
          }`,
          background:
            checkState === "done"
              ? GREEN
              : checkState === "skip"
              ? hexToRgba(ROSE, 0.18)
              : "transparent",
          color:
            checkState === "done"
              ? "#fff"
              : checkState === "skip"
              ? ROSE
              : C.tx3,
          fontSize: 14,
          fontWeight: 700,
          cursor: isCompleted ? "default" : "pointer",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 150ms",
          flexShrink: 0,
          justifySelf: "center" as const,
          minWidth: 32,
          opacity: checkState === "empty" ? 0.35 : 1,
        }}
      >
        {checkState === "skip" ? "✕" : "✓"}
      </button>
    </div>
  );
}

// ── InlineRestStrip ────────────────────────────────────────────────────────────

interface InlineRestStripProps {
  myKey: string;
  seconds: number;
  label: string;
  activeKey: string | null;
  left: number | null;
  total: number;
  onStart: () => void;
  onStop: () => void;
  canEdit: boolean;
}

function InlineRestStrip({ myKey, seconds, label, activeKey, left, total, onStart, onStop, canEdit }: InlineRestStripProps) {
  if (!canEdit || seconds <= 0) return null;
  const isActive = activeKey === myKey && left !== null;

  function fmt(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${s}s`;
  }

  if (isActive) {
    const pct = Math.max(0, 1 - left! / total);
    const urgent = left! <= 10;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0 2px" }}>
        <span style={{ fontSize: 9, color: urgent ? ROSE : VIOLET, flexShrink: 0 }}>⏱</span>
        <div style={{ flex: 1, height: 3, background: C.brd, borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${pct * 100}%`,
            background: urgent ? ROSE : VIOLET,
            borderRadius: 2,
            transition: "width 1s linear",
          }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: urgent ? ROSE : VIOLET, minWidth: 28, textAlign: "right" as const }}>
          {fmt(left!)}
        </span>
        <button
          onClick={onStop}
          style={{
            padding: "2px 6px", borderRadius: 4, border: "none",
            background: hexToRgba(ROSE, 0.15), color: ROSE,
            fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}
        >✕</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0 1px", opacity: 0.45 }}>
      <div style={{ flex: 1, height: 1, background: C.brdL }} />
      <span style={{ fontSize: 9, color: C.tx3, whiteSpace: "nowrap" as const }}>
        ⏱ {fmt(seconds)} {label}
      </span>
      <button
        onClick={onStart}
        style={{
          width: 18, height: 18, borderRadius: 4, border: `1px solid ${C.brdL}`,
          background: "transparent", color: C.tx3,
          fontSize: 9, cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 0,
        }}
      >▶</button>
      <div style={{ flex: 1, height: 1, background: C.brdL }} />
    </div>
  );
}

// ── ExerciceCard ───────────────────────────────────────────────────────────────

interface ExerciceCardProps {
  exId: string;
  name: string;
  muscle?: string;
  prescription: string;
  params: ExerciceParams;
  sets: SetState[];
  prevSets: string[];
  comment: string;
  canEdit: boolean;
  blocColor: string;
  timingMode: string;
  blocRestSec: number;
  blocRestLabel: string;
  restActiveKey: string | null;
  restLeft: number | null;
  restTotal: number;
  onToggle: (setIdx: number) => void;
  onOpenPad: (setIdx: number, field: "kg" | "reps" | "rir") => void;
  onAddSet: () => void;
  onRemoveSet: (setIdx: number) => void;
  onCommentChange: (c: string) => void;
  onStartRest: (key: string, sec: number) => void;
  onStopRest: () => void;
}

function ExerciceCard({
  exId,
  name,
  muscle,
  prescription,
  params,
  sets,
  prevSets,
  comment,
  canEdit,
  timingMode,
  blocColor,
  blocRestSec,
  blocRestLabel,
  restActiveKey,
  restLeft,
  restTotal,
  onToggle,
  onOpenPad,
  onAddSet,
  onRemoveSet,
  onCommentChange,
  onStartRest,
  onStopRest,
}: ExerciceCardProps) {
  const [showComment, setShowComment] = useState(false);
  const isPDC = params.charge_unit === "PDC";
  const doneSets = sets.filter((s) => s.done).length;
  // For cluster: cluster.recup_sec is intra-cluster rest (shown as badge); inter-set rest = bloc rest
  const restSec = blocRestSec;
  const restLabel = blocRestLabel;
  // stripSec: InlineRestStrip only for repos timing (bloc-level) — not for depart or cluster-only
  const stripSec = timingMode === "repos" ? blocRestSec : 0;
  const totalSets = sets.length;
  const allDone = doneSets === totalSets && totalSets > 0;

  return (
    <div
      style={{
        background: C.s1,
        borderRadius: 14,
        border: `1px solid ${C.brd}`,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "11px 14px 8px",
          borderBottom: `1px solid ${C.brd}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 5 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: C.tx,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </div>
          </div>
          {doneSets > 0 && (
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: allDone ? C.g : C.tx3,
                background: allDone ? C.gS : C.s2,
                padding: "2px 8px",
                borderRadius: 20,
                flexShrink: 0,
              }}
            >
              {doneSets}/{totalSets} ✓
            </div>
          )}
        </div>
        {/* Badge row */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <BadgeTag label={prescription} color={VIOLET} />
          {muscle && <BadgeTag label={muscle} color={blocColor} />}
        </div>
      </div>

      {/* Cluster info strip */}
      {params.cluster && (() => {
        const c = params.cluster;
        const safeReps = Array.isArray(c.reps) ? c.reps : Array(c.nb_clusters).fill(5);
        return (
          <div style={{
            padding: "5px 14px",
            borderBottom: `1px solid ${C.brd}`,
            background: "rgba(245,166,35,0.06)",
            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: "#F5A623", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>
              Cluster
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#F5A623", letterSpacing: 1 }}>
              {safeReps.join("+")}
            </span>
            <span style={{ fontSize: 9, color: C.tx3 }}>·  {c.recup_sec}s entre clusters</span>
          </div>
        );
      })()}

      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isPDC
            ? "34px 1fr 1.15fr 0.9fr 40px"
            : "34px 1fr 1.15fr 1.15fr 0.9fr 40px",
          gap: 5,
          padding: "4px 14px 2px",
          fontSize: 9,
          color: C.tx3,
          fontWeight: 600,
          letterSpacing: "0.4px",
          textTransform: "uppercase" as const,
        }}
      >
        <div style={{ textAlign: "center" }}>#</div>
        {!isPDC && <div style={{ textAlign: "center" }}>Charge</div>}
        <div style={{ textAlign: "center" }}>Reps</div>
        <div style={{ textAlign: "center" }}>Préc.</div>
        <div style={{ textAlign: "center" }}>RIR</div>
        <div />
      </div>

      {/* Set rows */}
      <div style={{ padding: "0 14px" }}>
        {sets.map((s, i) => {
          const stripKey = `${exId}:${i}`;
          return (
            <div key={i}>
              <SetRow
                setIdx={i}
                state={s}
                prevStr={prevSets[i] ?? "—"}
                chargeUnit={params.charge_unit}
                onToggle={() => onToggle(i)}
                onOpenPad={(field) => onOpenPad(i, field)}
                isCompleted={!canEdit}
                canRemove={canEdit && i >= params.nb_series}
                onRemoveSet={canEdit && i >= params.nb_series ? () => onRemoveSet(i) : undefined}
              />
              <InlineRestStrip
                myKey={stripKey}
                seconds={stripSec}
                label={restLabel}
                activeKey={restActiveKey}
                left={restLeft}
                total={restTotal}
                onStart={() => onStartRest(stripKey, restSec)}
                onStop={onStopRest}
                canEdit={canEdit}
              />
            </div>
          );
        })}
      </div>

      {/* Comment + bonus set */}
      {canEdit && (
        <div style={{ padding: "6px 14px 12px" }}>
          {(showComment || comment) && (
            <textarea
              value={comment}
              onChange={(e) => onCommentChange(e.target.value)}
              placeholder="Commentaire sur cet exercice…"
              rows={2}
              style={{
                width: "100%",
                background: C.s2,
                border: `1px solid ${C.brdL}`,
                borderRadius: 8,
                padding: "8px 10px",
                color: C.tx,
                fontSize: 12,
                fontFamily: "inherit",
                outline: "none",
                resize: "none",
                boxSizing: "border-box",
                marginBottom: 6,
              }}
            />
          )}
          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: showComment || comment ? 0 : 6,
            }}
          >
            {!showComment && !comment && (
              <button
                onClick={() => setShowComment(true)}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: 7,
                  border: `1px dashed ${C.brdL}`,
                  background: "transparent",
                  color: C.tx3,
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                💬 Commentaire
              </button>
            )}
            <button
              onClick={onAddSet}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: 7,
                border: "1px dashed rgba(245,158,11,0.5)",
                background: "rgba(245,158,11,0.05)",
                color: "#F59E0B",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              + Série bonus
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── NumPad ─────────────────────────────────────────────────────────────────────

interface NumPadProps {
  target: PadTarget;
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

function NumPad({ target, value, onChange, onConfirm, onClose }: NumPadProps) {
  const cfg = FIELD_CFG[target.field];

  function step(delta: number) {
    const v = parseFloat(value.replace(",", ".")) || 0;
    const next = Math.max(0, v + delta);
    if (target.field === "kg") {
      const rounded = Math.round(next * 4) / 4;
      onChange(String(rounded).replace(".", ","));
    } else {
      onChange(String(Math.max(0, Math.round(next))));
    }
  }

  function press(key: string) {
    if (key === "←") {
      onChange(value.slice(0, -1));
    } else if (key === ",") {
      if (!value.includes(",")) onChange(value + ",");
    } else {
      onChange(value + key);
    }
  }

  const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "←"];

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 40,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 41,
          background: C.s1,
          borderRadius: "20px 20px 0 0",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        {/* Label + value display */}
        <div style={{ padding: "16px 20px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.tx3, fontWeight: 600, marginBottom: 4 }}>
            {cfg.label}
            {cfg.unit ? ` (${cfg.unit})` : ""}
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: VIOLET,
              letterSpacing: "1px",
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {value || <span style={{ color: C.tx3, fontWeight: 400, fontSize: 22 }}>—</span>}
          </div>
        </div>

        {/* Steppers */}
        <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
          {cfg.steps.map((s) => (
            <button
              key={s}
              onClick={() => step(s)}
              style={{
                flex: 1,
                padding: "9px 0",
                borderRadius: 8,
                border: `1px solid ${C.brdL}`,
                background: C.s2,
                color: s < 0 ? ROSE : VIOLET,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {s > 0 ? `+${s}` : s}
            </button>
          ))}
        </div>

        {/* Keyboard */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 6,
            padding: "0 12px 8px",
          }}
        >
          {KEYS.map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              style={{
                padding: "14px 0",
                borderRadius: 10,
                border: `1px solid ${C.brdL}`,
                background: k === "←" ? hexToRgba(ROSE, 0.1) : C.s2,
                color: k === "←" ? ROSE : C.tx,
                fontSize: k === "←" ? 18 : 16,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {k}
            </button>
          ))}
        </div>

        {/* Confirm */}
        <div style={{ padding: "4px 12px 28px" }}>
          <button
            onClick={onConfirm}
            style={{
              width: "100%",
              padding: "14px 0",
              borderRadius: 12,
              border: "none",
              background: VIOLET,
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Valider
          </button>
        </div>
      </div>
    </>
  );
}

// ── RirPicker ──────────────────────────────────────────────────────────────────

const RIR_ITEMS: Array<{ val: string; label: string; desc: string }> = [
  { val: "0",   label: "0",    desc: "Échec" },
  { val: "0.5", label: "0,5",  desc: "Quasi échec" },
  { val: "1",   label: "1",    desc: "Très difficile" },
  { val: "1.5", label: "1,5",  desc: "Difficile" },
  { val: "2",   label: "2",    desc: "Modéré" },
  { val: "2.5", label: "2,5",  desc: "" },
  { val: "3",   label: "3",    desc: "Confortable" },
  { val: "3.5", label: "3,5",  desc: "" },
  { val: "4",   label: "4",    desc: "Facile" },
  { val: "4.5", label: "4,5",  desc: "" },
  { val: "5",   label: "5",    desc: "Très facile" },
  { val: "5+",  label: "5+",   desc: "Aucun effort" },
];

function getRirColor(val: string): string {
  const n = val === "5+" ? 6 : parseFloat(val);
  if (n <= 0.5) return "#EF4444";
  if (n <= 1.5) return "#F97316";
  if (n <= 2.5) return "#FACC15";
  if (n <= 3.5) return "#84CC16";
  if (n <= 4.5) return "#22C55E";
  if (n <= 5)   return "#22C993";
  return "#3B9EFF";
}

interface RirPickerProps {
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

function RirPicker({ value, onChange, onConfirm, onClose }: RirPickerProps) {
  const selectedItem = RIR_ITEMS.find((r) => r.val === value);
  const selColor = value ? getRirColor(value) : VIOLET;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} />
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 41,
          background: C.s1, borderRadius: "20px 20px 0 0",
          maxWidth: 480, margin: "0 auto",
        }}
      >
        {/* Label + selected value display */}
        <div style={{ padding: "16px 20px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.tx3, fontWeight: 600, marginBottom: 4 }}>
            RIR — Reps en réserve
          </div>
          <div
            style={{
              fontSize: 36, fontWeight: 900, color: selColor,
              minHeight: 44, display: "flex", alignItems: "center",
              justifyContent: "center", gap: 10,
            }}
          >
            {value ? (
              <>
                <span>{selectedItem?.label ?? value}</span>
                {selectedItem?.desc && (
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.tx3 }}>
                    {selectedItem.desc}
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: C.tx3, fontWeight: 400, fontSize: 22 }}>—</span>
            )}
          </div>
        </div>

        {/* 4-column grid of RIR values */}
        <div
          style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            gap: 6, padding: "0 12px 8px",
          }}
        >
          {RIR_ITEMS.map((item) => {
            const color = getRirColor(item.val);
            const selected = value === item.val;
            return (
              <button
                key={item.val}
                onClick={() => onChange(item.val)}
                style={{
                  height: 52, borderRadius: 10,
                  border: `2px solid ${selected ? color : hexToRgba(color, 0.3)}`,
                  background: selected ? hexToRgba(color, 0.2) : hexToRgba(color, 0.07),
                  color: selected ? color : C.tx2,
                  fontSize: 15, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "all 120ms",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Confirm */}
        <div style={{ padding: "4px 12px 28px" }}>
          <button
            onClick={onConfirm}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12,
              border: "none",
              background: value ? selColor : C.s2,
              color: value ? "#fff" : C.tx3,
              fontSize: 14, fontWeight: 700,
              cursor: value ? "pointer" : "default", fontFamily: "inherit",
            }}
          >
            Valider
          </button>
        </div>
      </div>
    </>
  );
}

// ── RestTimer ──────────────────────────────────────────────────────────────────

interface RestTimerProps {
  left: number;
  total: number;
  nextInfo: string | null;
  loop?: boolean;
  onDismiss: () => void;
}

function RestTimer({ left, total, nextInfo, loop, onDismiss }: RestTimerProps) {
  const offset = RING_C * (1 - left / total);
  const isUrgent = left <= 10;

  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed",
        bottom: 90,
        right: 16,
        zIndex: 30,
        background: C.s1,
        borderRadius: 16,
        border: `1px solid ${isUrgent ? ROSE : C.brdL}`,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        cursor: "pointer",
        maxWidth: 220,
      }}
    >
      {/* SVG ring */}
      <div style={{ flexShrink: 0 }}>
        <svg width={44} height={44} viewBox="0 0 44 44">
          <circle
            cx={22} cy={22} r={RING_R}
            fill="none" stroke={C.brd} strokeWidth={3}
          />
          <circle
            cx={22} cy={22} r={RING_R}
            fill="none"
            stroke={isUrgent ? ROSE : VIOLET}
            strokeWidth={3}
            strokeDasharray={RING_C}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 22 22)"
          />
          <text
            x={22} y={22}
            textAnchor="middle"
            dominantBaseline="central"
            fill={isUrgent ? ROSE : C.tx}
            fontSize={10}
            fontWeight={700}
            fontFamily="inherit"
          >
            {left}s
          </text>
        </svg>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.tx }}>{loop ? "Départ ∞" : "Repos"}</div>
        {nextInfo && (
          <div
            style={{
              fontSize: 9,
              color: C.tx3,
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 130,
            }}
          >
            Suiv. : {nextInfo}
          </div>
        )}
        <div style={{ fontSize: 9, color: C.tx3, marginTop: 2 }}>Tap pour ignorer</div>
      </div>
    </div>
  );
}

// ── FinishDialog ───────────────────────────────────────────────────────────────

interface FinishDialogProps {
  blocs: WorkoutBlocData[];
  allSets: AllSets;
  sessionComment: string;
  sessionForme: number | undefined;
  onCommentChange: (c: string) => void;
  onFormeChange: (f: number) => void;
  onConfirm: () => void;
  onClose: () => void;
  completing: boolean;
}

function FinishDialog({
  blocs,
  allSets,
  sessionComment,
  sessionForme,
  onCommentChange,
  onFormeChange,
  onConfirm,
  onClose,
  completing,
}: FinishDialogProps) {
  let totalSets = 0, doneSets = 0, skippedSets = 0;
  for (const bloc of blocs) {
    for (const ex of bloc.exercices) {
      const exSets = allSets[ex.id] ?? [];
      totalSets += exSets.length;
      doneSets += exSets.filter((s) => s.done).length;
      skippedSets += exSets.filter((s) => s.skipped).length;
    }
  }

  const FORME_LABELS = ["😴", "😐", "🙂", "💪", "🔥"];

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          zIndex: 50,
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 51,
          background: C.bg,
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px 40px",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 900,
            color: C.tx,
            textAlign: "center",
            marginBottom: 14,
          }}
        >
          🏁 Terminer la séance ?
        </div>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              textAlign: "center",
              background: C.gS,
              borderRadius: 12,
              padding: "8px 16px",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900, color: C.g }}>{doneSets}</div>
            <div style={{ fontSize: 9, color: C.g }}>Séries ok</div>
          </div>
          {skippedSets > 0 && (
            <div
              style={{
                textAlign: "center",
                background: hexToRgba(ROSE, 0.1),
                borderRadius: 12,
                padding: "8px 16px",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 900, color: ROSE }}>{skippedSets}</div>
              <div style={{ fontSize: 9, color: ROSE }}>Passées</div>
            </div>
          )}
          <div
            style={{
              textAlign: "center",
              background: C.s1,
              borderRadius: 12,
              padding: "8px 16px",
              border: `1px solid ${C.brd}`,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900, color: C.tx }}>{totalSets}</div>
            <div style={{ fontSize: 9, color: C.tx3 }}>Total</div>
          </div>
        </div>

        {/* Forme */}
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.tx3,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: 8,
            }}
          >
            État de forme
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {FORME_LABELS.map((emoji, i) => (
              <button
                key={i}
                onClick={() => onFormeChange(i + 1)}
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  borderRadius: 10,
                  border: `1px solid ${sessionForme === i + 1 ? VIOLET : C.brdL}`,
                  background:
                    sessionForme === i + 1 ? hexToRgba(VIOLET, 0.15) : C.s2,
                  fontSize: 18,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  minHeight: 44,
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <textarea
          value={sessionComment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Comment s'est passée la séance ?"
          rows={2}
          style={{
            width: "100%",
            background: C.s2,
            border: `1px solid ${C.brdL}`,
            borderRadius: 10,
            padding: "10px 12px",
            color: C.tx,
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
            resize: "none",
            boxSizing: "border-box",
            marginBottom: 12,
          }}
        />

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 12,
              border: `1px solid ${C.brdL}`,
              background: "transparent",
              color: C.tx2,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Continuer
          </button>
          <button
            onClick={onConfirm}
            disabled={completing}
            style={{
              flex: 2,
              padding: "12px 0",
              borderRadius: 12,
              border: "none",
              background: VIOLET,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: completing ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: completing ? 0.7 : 1,
            }}
          >
            {completing ? "Enregistrement…" : "Terminer ✓"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── RPE sheet ──────────────────────────────────────────────────────────────────

function RpeSheetForLog({
  workoutLogId,
  onClose,
}: {
  workoutLogId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { athleteId } = useAthleteContext();
  const [rpe, setRpe] = useState<number | null>(null);

  const { mutate: saveRpe, isPending } = useMutation({
    mutationFn: async (rpeScore: number) => {
      await supabase
        .from("workout_logs")
        .update({ rpe_score: rpeScore })
        .eq("id", workoutLogId);
      await supabase.from("workout_rpe").upsert({
        workout_log_id: workoutLogId,
        athlete_id: athleteId ?? "",
        rpe_score: rpeScore,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout-log-detail", workoutLogId] });
      onClose();
    },
  });

  const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 50,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: C.bg,
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px 40px",
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: C.tx,
            textAlign: "center",
            marginBottom: 6,
          }}
        >
          🏁 Séance terminée !
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.tx3,
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          Quelle était ton effort global ? (RPE)
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          {RPE_VALUES.map((v) => (
            <button
              key={v}
              onClick={() => setRpe(v)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                border: `1px solid ${rpe === v ? VIOLET : C.brdL}`,
                background: rpe === v ? hexToRgba(VIOLET, 0.2) : C.s1,
                color: rpe === v ? VIOLET : C.tx,
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 12,
              border: `1px solid ${C.brdL}`,
              background: "transparent",
              color: C.tx2,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Passer
          </button>
          <button
            onClick={() => rpe != null && saveRpe(rpe)}
            disabled={rpe == null || isPending}
            style={{
              flex: 2,
              padding: "12px 0",
              borderRadius: 12,
              border: "none",
              background: rpe != null ? VIOLET : C.s2,
              color: rpe != null ? "#fff" : C.tx3,
              fontSize: 13,
              fontWeight: 700,
              cursor: rpe != null ? "pointer" : "default",
              fontFamily: "inherit",
            }}
          >
            {isPending ? "Enregistrement…" : "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { athleteId } = useAthleteContext();
  const qc = useQueryClient();

  const workout = useWorkoutSession(id);
  const saveWorkoutSets = useSaveWorkoutSets(id);

  // ── State ────────────────────────────────────────────────────────────────
  const [sets, setSets] = useState<AllSets>({});
  const [setsInit, setSetsInit] = useState(false);
  const [localMods, setLocalMods] = useState<AthleteModifications>({});
  const [padTarget, setPadTarget] = useState<PadTarget | null>(null);
  const [padVal, setPadVal] = useState("");
  const [restLeft, setRestLeft] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(REST_DEFAULT);
  const [restNextInfo, setRestNextInfo] = useState<string | null>(null);
  const [restActiveKey, setRestActiveKey] = useState<string | null>(null);
  const [showFinish, setShowFinish] = useState(false);
  const [showRpe, setShowRpe] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const restRef = useRef<ReturnType<typeof setInterval>>();
  const elapsedRef = useRef<ReturnType<typeof setInterval>>();
  const loopRef = useRef(false);
  const restSecondsRef = useRef(REST_DEFAULT);

  // ── Collect all exIds for usePrevWorkoutSets ─────────────────────────────
  const allExIds = useMemo(
    () => workout.blocs.flatMap((b) => b.exercices.map((e) => e.id)),
    [workout.blocs],
  );

  const prevSets = usePrevWorkoutSets(
    workout.sessionId,
    workout.workoutLogId,
    allExIds,
    workout.weekNumber,
  );

  // ── Init sets once workout loaded ────────────────────────────────────────
  useEffect(() => {
    if (workout.isLoading || setsInit) return;

    const base = workout.athleteModifications ?? {};
    const savedSets = base.sessionSets ?? {};
    const newSets: AllSets = {};

    for (const bloc of workout.blocs) {
      for (const ex of bloc.exercices) {
        const saved = savedSets[ex.id];
        newSets[ex.id] = Array.from({ length: ex.params.nb_series }, (_, i) =>
          initSetState(ex.params, i, saved?.[i]),
        );
      }
    }

    setSets(newSets);
    setLocalMods(base);
    setSetsInit(true);
  }, [workout.isLoading, workout.blocs, workout.athleteModifications, setsInit]);

  // ── Backfill empty cells from prevSets once they load ───────────────────
  useEffect(() => {
    if (!setsInit || Object.keys(prevSets).length === 0) return;
    setSets((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [exId, exSets] of Object.entries(next)) {
        const prevEx = prevSets[exId];
        if (!prevEx) continue;
        const updated = exSets.map((s, i) => {
          if (s.done || s.skipped) return s;
          const prevStr = prevEx[i] ?? "";
          if (!prevStr) return s;
          let newS = { ...s };
          let dirty = false;
          if (!newS.kg) {
            const v = parsePrevVal(prevStr, "kg");
            if (v) { newS.kg = v; dirty = true; }
          }
          if (!newS.reps) {
            const v = parsePrevVal(prevStr, "reps");
            if (v) { newS.reps = v; dirty = true; }
          }
          return dirty ? newS : s;
        });
        if (updated.some((s, i) => s !== exSets[i])) {
          next[exId] = updated;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [setsInit, prevSets]);

  // ── Session timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (workout.status === "completed") return;
    elapsedRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(elapsedRef.current);
  }, [workout.status]);

  // ── Rest timer helpers ───────────────────────────────────────────────────
  const stopRest = useCallback(() => {
    clearInterval(restRef.current);
    loopRef.current = false;
    setRestLeft(null);
    setRestActiveKey(null);
  }, []);

  const startRest = useCallback((seconds: number, nextInfo: string | null, activeKey?: string, loop = false) => {
    clearInterval(restRef.current);
    loopRef.current = loop;
    restSecondsRef.current = seconds;
    setRestTotal(seconds);
    setRestLeft(seconds);
    setRestNextInfo(nextInfo);
    setRestActiveKey(activeKey ?? null);
    restRef.current = setInterval(() => {
      setRestLeft((prev) => {
        if (prev === null || prev <= 1) {
          if (loopRef.current) {
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            return restSecondsRef.current; // relance automatique
          }
          clearInterval(restRef.current);
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Persist helper ───────────────────────────────────────────────────────
  const persist = useCallback(
    (newSets: AllSets, mods: AthleteModifications) => {
      const next = allSetsToMods(newSets, mods);
      setLocalMods(next);
      saveWorkoutSets(next);
    },
    [saveWorkoutSets],
  );

  // ── Toggle 3-state checkmark ─────────────────────────────────────────────
  const toggleAndPersist = useCallback(
    (exId: string, setIdx: number, restSec: number, nextInfo: string | null, timingMode = "repos", blocId = "", blocExIds: string[] = []) => {
      let shouldStop = false;

      setSets((prev) => {
        const exSets = [...(prev[exId] ?? [])];
        const s = { ...exSets[setIdx] };

        if (!s.done && !s.skipped) {
          const prevStr = prevSets[exId]?.[setIdx] ?? "";
          if (!s.kg && prevStr) s.kg = parsePrevVal(prevStr, "kg");
          if (!s.reps && prevStr) s.reps = parsePrevVal(prevStr, "reps");
          s.done = true;
          s.skipped = false;

          if (timingMode === "depart" && restSec > 0) {
            startRest(restSec, null, `depart:${blocId}`, true /* loop */);
          } else if (restSec > 0) {
            startRest(restSec, nextInfo, `${exId}:${setIdx}`);
          }
        } else if (s.done) {
          s.done = false;
          s.skipped = true;
          if (timingMode !== "depart") stopRest();
        } else {
          s.done = false;
          s.skipped = false;
        }

        exSets[setIdx] = s;
        const next = { ...prev, [exId]: exSets };

        // Départ mode: stop looping timer when all bloc sets are done/skipped
        if (timingMode === "depart" && blocExIds.length > 0) {
          const allDone = blocExIds.every((eid) => {
            const eSets = next[eid] ?? [];
            return eSets.length > 0 && eSets.every((ss) => ss.done || ss.skipped);
          });
          if (allDone) shouldStop = true;
        }

        const mods = allSetsToMods(next, localMods);
        setLocalMods(mods);
        saveWorkoutSets(mods);
        return next;
      });

      if (shouldStop) stopRest();
    },
    [prevSets, startRest, stopRest, localMods, saveWorkoutSets],
  );

  // ── Open NumPad ──────────────────────────────────────────────────────────
  const openPad = useCallback(
    (exId: string, setIdx: number, field: "kg" | "reps" | "rir", chargeUnit: string) => {
      const current = sets[exId]?.[setIdx];
      setPadTarget({ exId, setIdx, field, chargeUnit });
      setPadVal(current?.[field] ?? "");
    },
    [sets],
  );

  // ── Confirm NumPad ───────────────────────────────────────────────────────
  const confirmPad = useCallback(
    (value: string) => {
      if (!padTarget) return;
      const { exId, setIdx, field } = padTarget;

      setSets((prev) => {
        const exSets = [...(prev[exId] ?? [])];
        const s = { ...exSets[setIdx], [field]: value };

        // Auto-validate: if not done/skipped, mark done
        if (!s.done && !s.skipped) {
          // If entering kg and reps still empty, autofill from prev
          if (field === "kg" && !s.reps) {
            const prevStr = prevSets[exId]?.[setIdx] ?? "";
            const prevReps = parsePrevVal(prevStr, "reps");
            if (prevReps) s.reps = prevReps;
          }
          s.done = true;
        }

        exSets[setIdx] = s;
        const next = { ...prev, [exId]: exSets };
        const mods = allSetsToMods(next, localMods);
        setLocalMods(mods);
        saveWorkoutSets(mods);
        return next;
      });

      setPadTarget(null);
      setPadVal("");
    },
    [padTarget, prevSets, localMods, saveWorkoutSets],
  );

  // ── Add bonus set ────────────────────────────────────────────────────────
  const addBonusSet = useCallback(
    (exId: string) => {
      setSets((prev) => {
        const exSets = [...(prev[exId] ?? [])];
        exSets.push({ kg: "", reps: "", rir: "", done: false, skipped: false });
        const next = { ...prev, [exId]: exSets };
        const mods = allSetsToMods(next, localMods);
        setLocalMods(mods);
        saveWorkoutSets(mods);
        return next;
      });
      haptic();
    },
    [localMods, saveWorkoutSets],
  );

  // ── Remove bonus set ─────────────────────────────────────────────────────
  const removeBonusSet = useCallback(
    (exId: string, setIdx: number) => {
      setSets((prev) => {
        const exSets = [...(prev[exId] ?? [])];
        exSets.splice(setIdx, 1);
        const next = { ...prev, [exId]: exSets };
        const mods = allSetsToMods(next, localMods);
        setLocalMods(mods);
        saveWorkoutSets(mods);
        return next;
      });
    },
    [localMods, saveWorkoutSets],
  );

  // ── Update comment / forme ───────────────────────────────────────────────
  const updateExComment = useCallback(
    (exId: string, comment: string) => {
      const next = {
        ...localMods,
        exerciceComments: { ...(localMods.exerciceComments ?? {}), [exId]: comment },
      };
      setLocalMods(next);
      saveWorkoutSets(next);
    },
    [localMods, saveWorkoutSets],
  );

  const updateSessionComment = useCallback(
    (comment: string) => {
      setLocalMods((prev) => {
        const next = { ...prev, sessionComment: comment };
        saveWorkoutSets(next);
        return next;
      });
    },
    [saveWorkoutSets],
  );

  const updateForme = useCallback(
    (forme: number) => {
      setLocalMods((prev) => {
        const next = { ...prev, sessionForme: forme };
        saveWorkoutSets(next);
        return next;
      });
    },
    [saveWorkoutSets],
  );

  // ── Complete workout ─────────────────────────────────────────────────────
  const { mutate: completeWorkout, isPending: completing } = useMutation({
    mutationFn: async () => {
      if (!id) return;
      const finalMods = allSetsToMods(sets, localMods);
      const { error } = await supabase
        .from("workout_logs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          athlete_modifications: finalMods,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout-log-detail", id] });
      qc.invalidateQueries({ queryKey: ["workout-logs-week", athleteId] });
      qc.invalidateQueries({ queryKey: ["activePlan", athleteId] });
      setShowFinish(false);
      setShowRpe(true);
      toast.success("Séance complétée ! 🏁");
    },
    onError: () => {
      toast.error("Erreur lors de l'enregistrement");
    },
  });

  // ── Progress bar ─────────────────────────────────────────────────────────
  const { progTotal, progDone } = useMemo(() => {
    let total = 0, done = 0;
    for (const bloc of workout.blocs) {
      for (const ex of bloc.exercices) {
        const exSets = sets[ex.id] ?? [];
        total += exSets.length;
        done += exSets.filter((s) => s.done || s.skipped).length;
      }
    }
    return { progTotal: total, progDone: done };
  }, [sets, workout.blocs]);

  const isCompleted = workout.status === "completed";
  const canEdit = !isCompleted && !!id;

  // ── Early returns ────────────────────────────────────────────────────────
  if (workout.isLoading) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: C.tx3, fontSize: 13 }}>
        Chargement…
      </div>
    );
  }
  if (!workout.workoutLogId) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: C.tx3, fontSize: 13 }}>
        Séance introuvable
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 140, scrollbarWidth: "none" }}>
      {/* ── Header ── */}
      <div
        style={{
          padding: "12px 16px 0",
          position: "sticky",
          top: 45,
          background: C.bg,
          zIndex: 5,
          borderBottom: `1px solid ${C.brd}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              flexShrink: 0,
              border: `1px solid ${C.brdL}`,
              background: "transparent",
              color: C.tx3,
              fontSize: 16,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ←
          </button>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.tx3 }}>{workout.sessionShort}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.tx }}>
              {workout.sessionName}
            </div>
            {workout.rescheduledByAthlete &&
              workout.originalScheduledDate &&
              workout.originalScheduledDate !== workout.scheduledDate && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: 20,
                    marginTop: 3,
                    background: "rgba(245,158,11,0.12)",
                    border: "1px solid rgba(245,158,11,0.3)",
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#F59E0B",
                  }}
                >
                  Décalée du{" "}
                  {new Date(
                    workout.originalScheduledDate + "T12:00:00",
                  ).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
              )}
          </div>

          {/* Timer or "completed" badge */}
          {!isCompleted ? (
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: C.tx3,
                background: C.s2,
                borderRadius: 8,
                padding: "4px 10px",
                fontVariantNumeric: "tabular-nums",
                flexShrink: 0,
              }}
            >
              ⏱ {formatElapsed(elapsed)}
            </div>
          ) : (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 20,
                background: C.gS,
                color: C.g,
                flexShrink: 0,
              }}
            >
              ✓ Complétée
            </span>
          )}
        </div>

        {/* Progress bar */}
        {!isCompleted && progTotal > 0 && (
          <div
            style={{
              height: 3,
              background: C.brd,
              borderRadius: 2,
              marginBottom: 1,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.round((progDone / progTotal) * 100)}%`,
                background: VIOLET,
                borderRadius: 2,
                transition: "width 300ms ease",
              }}
            />
          </div>
        )}
      </div>

      {/* ── Blocs ── */}
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {workout.blocs.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: C.tx3,
              fontSize: 12,
            }}
          >
            Aucun exercice dans cette séance
          </div>
        ) : (
          workout.blocs.map((bloc, blocIdx) => {
            const bColor = bloc.color ?? BLOC_PALETTE[blocIdx % BLOC_PALETTE.length];
            const timing = timingLabel(bloc);
            const restSec = blocRestSeconds(bloc);

            return (
              <div key={bloc.id}>
                {/* Bloc header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                    padding: "5px 10px 5px 12px",
                    borderRadius: 8,
                    background: hexToRgba(bColor, 0.08),
                    borderLeft: `3px solid ${bColor}`,
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      background: hexToRgba(bColor, 0.18),
                      color: bColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    {String.fromCharCode(65 + blocIdx)}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: bColor }}>
                    {bloc.name || `Bloc ${blocIdx + 1}`}
                  </div>
                  {timing && <BadgeTag label={timing} color={bColor} />}
                </div>

                {/* Exercices — colored background groups them visually as superset */}
                <div
                  style={{
                    background: hexToRgba(bColor, 0.05),
                    border: `1px solid ${hexToRgba(bColor, 0.2)}`,
                    borderRadius: 14,
                    padding: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {bloc.exercices.map((ex, exIdx) => {
                    const nextEx = bloc.exercices[exIdx + 1];
                    const nextInfo = nextEx ? nextEx.exercise_name : null;

                    return (
                      <ExerciceCard
                        key={ex.id}
                        exId={ex.id}
                        name={ex.exercise_name}
                        muscle={ex.muscle}
                        prescription={formatPrescription(ex.params)}
                        params={ex.params}
                        sets={sets[ex.id] ?? []}
                        prevSets={prevSets[ex.id] ?? []}
                        comment={localMods.exerciceComments?.[ex.id] ?? ""}
                        canEdit={canEdit}
                        timingMode={bloc.timing_mode}
                        blocColor={bColor}
                        blocRestSec={restSec}
                        blocRestLabel={bloc.timing_mode === "depart" ? "départ" : "repos"}
                        restActiveKey={restActiveKey}
                        restLeft={restLeft}
                        restTotal={restTotal}
                        onToggle={(setIdx) =>
                          toggleAndPersist(ex.id, setIdx, restSec, nextInfo, bloc.timing_mode, bloc.id, bloc.exercices.map(e => e.id))
                        }
                        onOpenPad={(setIdx, field) =>
                          openPad(ex.id, setIdx, field, ex.params.charge_unit)
                        }
                        onAddSet={() => addBonusSet(ex.id)}
                        onRemoveSet={(setIdx) => removeBonusSet(ex.id, setIdx)}
                        onCommentChange={(c) => updateExComment(ex.id, c)}
                        onStartRest={(key, sec) => startRest(sec, null, key)}
                        onStopRest={stopRest}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        {/* Completed session comment */}
        {isCompleted && localMods.sessionComment && (
          <div
            style={{
              background: C.s1,
              borderRadius: 12,
              border: `1px solid ${C.brd}`,
              padding: "12px 16px",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.tx3,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: 6,
              }}
            >
              Commentaire
            </div>
            <div style={{ fontSize: 13, color: C.tx2 }}>
              {localMods.sessionComment}
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky "Terminer" button ── */}
      {canEdit && (
        <div
          style={{
            position: "fixed",
            bottom: 64,
            left: 0,
            right: 0,
            zIndex: 20,
            padding: "12px 16px",
            background: `linear-gradient(transparent, ${C.bg} 30%)`,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            onClick={() => setShowFinish(true)}
            style={{
              width: "100%",
              maxWidth: 480,
              padding: "16px 0",
              borderRadius: 16,
              border: "none",
              background: VIOLET,
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: `0 4px 20px ${hexToRgba(VIOLET, 0.35)}`,
            }}
          >
            Terminer la séance
          </button>
        </div>
      )}

      {/* ── NumPad / RirPicker ── */}
      {padTarget && padTarget.field === "rir" ? (
        <RirPicker
          value={padVal}
          onChange={setPadVal}
          onConfirm={() => confirmPad(padVal)}
          onClose={() => { setPadTarget(null); setPadVal(""); }}
        />
      ) : padTarget ? (
        <NumPad
          target={padTarget}
          value={padVal}
          onChange={setPadVal}
          onConfirm={() => confirmPad(padVal)}
          onClose={() => { setPadTarget(null); setPadVal(""); }}
        />
      ) : null}

      {/* ── Rest timer ── */}
      {restLeft !== null && (
        <RestTimer
          left={restLeft}
          total={restTotal}
          nextInfo={restNextInfo}
          loop={restActiveKey?.startsWith("depart:") ?? false}
          onDismiss={stopRest}
        />
      )}

      {/* ── Finish dialog ── */}
      {showFinish && (
        <FinishDialog
          blocs={workout.blocs}
          allSets={sets}
          sessionComment={localMods.sessionComment ?? ""}
          sessionForme={localMods.sessionForme}
          onCommentChange={updateSessionComment}
          onFormeChange={updateForme}
          onConfirm={() => completeWorkout()}
          onClose={() => setShowFinish(false)}
          completing={completing}
        />
      )}

      {/* ── RPE sheet ── */}
      {showRpe && workout.workoutLogId && (
        <RpeSheetForLog
          workoutLogId={workout.workoutLogId}
          onClose={() => {
            setShowRpe(false);
            navigate(-1);
          }}
        />
      )}
    </div>
  );
}
