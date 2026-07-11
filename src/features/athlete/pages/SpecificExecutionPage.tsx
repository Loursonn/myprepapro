/**
 * SpecificExecutionPage — athlete view for specific (CrossFit/MetCon) sessions.
 *
 * Route: /athlete/specific/:assignmentId
 * 3 states: preview → executing → completed
 */
import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  useEnergyAssignments,
  useCompleteEnergyAssignment,
  useUpsertEnergyRpe,
} from "@/features/shared/hooks/useEnergyAssignments";
import { useSpecificExecution } from "@/features/athlete/hooks/useSpecificExecution";
import StepTimeline from "@/features/athlete/components/specific/StepTimeline";
import ExecutionCard from "@/features/athlete/components/specific/ExecutionCard";
import SessionEndForm from "@/features/athlete/components/specific/SessionEndForm";
import type { EnergySessionAssignmentRow } from "@/types/energy";
import { SchemaViewerWithZoom } from "@/features/coach/components/energy/SchemaViewer";
import { formatSLong } from "@/lib/energy/formatTarget";

export default function SpecificExecutionPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: assignments = [] } = useEnergyAssignments(user?.id);
  const assignment = assignments.find((a: EnergySessionAssignmentRow) => a.id === assignmentId);
  const session = assignment?.energy_sessions;

  const completeMutation = useCompleteEnergyAssignment();
  const rpeMutation = useUpsertEnergyRpe();

  const intervals = session?.intervals ?? [];
  const exec = useSpecificExecution(intervals);

  // Wake lock
  useEffect(() => {
    if (exec.phase !== "executing") return;
    let wakeLock: WakeLockSentinel | null = null;
    async function acquire() {
      try {
        wakeLock = await navigator.wakeLock.request("screen");
      } catch {
        // Wake Lock not supported
      }
    }
    acquire();
    return () => { wakeLock?.release(); };
  }, [exec.phase]);

  if (!assignment || !session) {
    return (
      <div style={{ padding: 32, color: "#8B8A92", fontSize: 13, textAlign: "center" }}>
        {!assignmentId ? "ID manquant" : "Chargement…"}
      </div>
    );
  }

  const totalSteps = exec.flatSteps.length;
  const sessionName = session.name;

  // Handle end-of-session submit
  async function handleEndSubmit(data: { rpe: number; respected: boolean; comment: string }) {
    if (!assignment || !user) return;
    const durationMin = exec.elapsedTotal > 0 ? Math.round(exec.elapsedTotal / 60) : undefined;
    const notes = [
      data.respected ? "Séance respectée" : "Séance adaptée",
      data.comment,
    ].filter(Boolean).join(" — ");

    try {
      await completeMutation.mutateAsync({
        id: assignment.id,
        athleteId: user.id,
        block_logs: {},
        notes,
        actual_duration_min: durationMin ?? null,
      });
      await rpeMutation.mutateAsync({
        id: assignment.id,
        athleteId: user.id,
        rpe_score: data.rpe,
      });
      navigate("/athlete");
    } catch {
      // Error handled by mutation toast
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg, #08090C)", color: "#F2F1F5",
      padding: "20px 16px 110px",
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          style={{
            color: "#8B8A92", fontSize: 13, marginBottom: 10,
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ← Retour
        </button>

        {/* Title */}
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>{sessionName}</h1>

        {/* Meta pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 99,
            background: "rgba(245,166,35,0.12)", color: "#F5A623",
            border: "1px solid rgba(245,166,35,0.3)",
          }}>
            Spécifique
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 99,
            background: "rgba(139,138,146,0.12)", color: "#8B8A92",
            border: "1px solid var(--border, #2E2D33)",
          }}>
            {totalSteps} étapes
          </span>
          {session.total_duration_s != null && session.total_duration_s > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 99,
              background: "rgba(139,138,146,0.12)", color: "#8B8A92",
              border: "1px solid var(--border, #2E2D33)",
            }}>
              ~{formatSLong(session.total_duration_s)}
            </span>
          )}
        </div>

        {/* Coach notes */}
        {session.notes && (
          <div style={{
            background: "var(--card, #1D1C1E)", border: "1px solid var(--border, #2E2D33)",
            borderLeft: "3px solid #F5A623",
            borderRadius: 12, padding: "12px 14px", fontSize: 13,
            marginBottom: 16,
          }}>
            <strong style={{ display: "block", fontSize: 11, color: "#F5A623", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 }}>
              Note coach
            </strong>
            {session.notes}
          </div>
        )}

        {/* ── Schema ── */}
        {session.schema && (
          <div style={{ marginBottom: 16, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border, #2E2D33)" }}>
            <SchemaViewerWithZoom schema={session.schema} />
          </div>
        )}

        {/* ── PREVIEW ── */}
        {exec.phase === "preview" && (
          <>
            <StepTimeline steps={intervals} />

            {/* Sticky start button */}
            <div style={{
              position: "fixed", bottom: 0, left: 0, right: 0,
              background: "linear-gradient(transparent, var(--bg, #08090C) 30%)",
              padding: "22px 16px 18px",
            }}>
              <div style={{ maxWidth: 480, margin: "0 auto" }}>
                <button
                  onClick={exec.start}
                  style={{
                    width: "100%", background: "#F5A623", color: "#1a1204",
                    border: "none", borderRadius: 12, padding: 15,
                    fontSize: 16, fontWeight: 700, cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Démarrer la séance
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── EXECUTING ── */}
        {exec.phase === "executing" && exec.currentFlatStep && (
          <div style={{ marginTop: 12 }}>
            {/* Elapsed */}
            <div style={{ textAlign: "center", fontSize: 12, color: "#8B8A92", marginBottom: 12 }}>
              Temps écoulé : <strong style={{ color: "#F2F1F5" }}>{formatSLong(exec.elapsedTotal)}</strong>
              {" · "}Étape {exec.currentIndex + 1}/{totalSteps}
            </div>

            <ExecutionCard
              current={exec.currentFlatStep}
              next={exec.nextFlatStep}
              secondsLeft={exec.secondsLeft}
              isLastStep={exec.isLastStep}
              onNext={exec.next}
              onSkip={exec.skip}
            />
          </div>
        )}

        {/* ── COMPLETED ── */}
        {exec.phase === "completed" && (
          <div style={{ marginTop: 12 }}>
            <h2 style={{
              fontSize: 13, color: "#8B8A92", textTransform: "uppercase" as const,
              letterSpacing: "0.05em", marginBottom: 12,
            }}>
              Fin de séance — retour athlète
            </h2>
            <SessionEndForm
              onSubmit={handleEndSubmit}
              isPending={completeMutation.isPending || rpeMutation.isPending}
            />
          </div>
        )}
      </div>
    </div>
  );
}
