import { useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { X, Edit3, Check } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { C } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Macrocycle } from "../hooks/useTimelineData";
import { useTestResults } from "../hooks/useTimelineData";

// ── Recharts tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.s2, border: "1px solid " + C.brd, borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ fontSize: 10, color: C.tx3, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ fontSize: 12, fontWeight: 600, color: p.color }}>
          {p.name} : {p.value}
        </div>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  macro:      Macrocycle;
  athleteId:  string;
  rangeStart: string;
  rangeEnd:   string;
  onClose:    () => void;
}

export function MacrocycleDrawer({ macro, athleteId, rangeStart, rangeEnd, onClose }: Props) {
  const qc = useQueryClient();
  const { data: testResults = [] } = useTestResults(athleteId, macro.id);

  const [editingObj, setEditingObj] = useState(false);
  const [objective,  setObjective]  = useState(macro.objective ?? "");

  async function saveObjective() {
    const { error } = await supabase
      .from("macrocycles")
      .update({ objective })
      .eq("id", macro.id);
    if (error) { toast.error("Erreur"); return; }
    qc.invalidateQueries({ queryKey: ["timeline-data", athleteId, rangeStart, rangeEnd] });
    setEditingObj(false);
    toast.success("Objectif enregistré");
  }

  // Group test results by test name for chart
  const testNames = [...new Set(testResults.map((r) => r.test?.name ?? "Test"))];
  const chartData = testResults.reduce<Record<string, Record<string, number>>>((acc, r) => {
    const dateKey = format(parseISO(r.test_date), "dd/MM", { locale: fr });
    (acc[dateKey] ??= {})[r.test?.name ?? "Test"] = r.value;
    return acc;
  }, {});
  const chartRows = Object.entries(chartData).map(([date, vals]) => ({ date, ...vals }));

  const LINE_COLORS = [C.ac, C.coach, C.o, C.g, C.b];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Dates */}
      <div style={{ display: "flex", gap: 8 }}>
        {[
          { label: "Début", val: format(parseISO(macro.start_date), "d MMM yyyy", { locale: fr }) },
          { label: "Fin",   val: format(parseISO(macro.end_date),   "d MMM yyyy", { locale: fr }) },
        ].map(({ label, val }) => (
          <div key={label} style={{ flex: 1, background: C.s2, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 9, color: C.tx3 }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.tx }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Objectif */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px" }}>
            Objectif
          </span>
          <button
            onClick={() => editingObj ? saveObjective() : setEditingObj(true)}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, border: "1px solid " + (editingObj ? C.g + "60" : C.brdL), background: editingObj ? C.gS : "transparent", color: editingObj ? C.g : C.tx3, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            {editingObj ? <><Check size={11} /> Enregistrer</> : <><Edit3 size={11} /> Modifier</>}
          </button>
        </div>
        {editingObj ? (
          <textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            rows={3}
            autoFocus
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid " + C.ac + "60", background: C.s2, color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }}
          />
        ) : (
          <div style={{ background: objective ? C.acS : C.s2, borderRadius: 10, padding: "12px 14px", border: "1px solid " + (objective ? C.ac + "30" : C.brd), fontSize: 13, color: objective ? C.tx : C.tx3 }}>
            {objective || "Aucun objectif défini"}
          </div>
        )}
      </div>

      {/* Test progression chart */}
      {chartRows.length > 0 ? (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 12 }}>
            Progression Tests
          </div>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.brd} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.tx3 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: C.tx3 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, color: C.tx3 }} />
                {testNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ fill: LINE_COLORS[i % LINE_COLORS.length], r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "20px 0", color: C.tx3, fontSize: 12 }}>
          Aucun résultat de test lié à ce macrocycle.
        </div>
      )}
    </div>
  );
}
