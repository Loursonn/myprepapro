import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, ChevronRight, ChevronDown, Pencil, Trash2, GripVertical, Trophy, X } from 'lucide-react';
import {
  useSeasons,
  useCreateSeason,
  useUpdateSeason,
  useDeleteSeason,
  usePlanningBlocks,
  useCreateBlock,
  useUpdateBlock,
  useDeleteBlock,
  buildBlockTree,
  getBlockDepth,
} from '@/hooks/usePlanningBlocks';
import {
  useCompetitions,
  useCreateCompetition,
  useUpdateCompetition,
  useDeleteCompetition,
} from '@/hooks/useCompetitions';
import {
  type Season,
  type PlanningBlock,
  type Competition,
  type BlockType,
  type CompetitionType,
  type CompetitionPriority,
  BLOCK_TYPE_LABELS,
  BLOCK_COLORS,
  COMPETITION_META,
} from '@/types/planning';

// ─── Utils ───────────────────────────────────────────────────────────────────

function getSeasonWeeks(season: Season): number {
  const start = new Date(season.start_date);
  const end = new Date(season.end_date);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 86400 * 1000)));
}

function dateToWeekInSeason(isoDate: string, seasonStart: string): number {
  const d = new Date(isoDate);
  const s = new Date(seasonStart);
  return Math.max(1, Math.ceil((d.getTime() - s.getTime()) / (7 * 86400 * 1000)) + 1);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  athleteId: string;
  /** ID du coach connecté — passé depuis WeightliftingTracker qui a déjà l'auth */
  coachId: string | null | undefined;
  /** Sessions from current training block (for session count display) */
  sessions?: Array<{ id: string; name: string }>;
}

interface BlockFormState {
  name: string;
  description: string;
  type: BlockType;
  start_week: number;
  end_week: number;
  color: string;
}

interface CompFormState {
  name: string;
  type: CompetitionType;
  date: string;
  location: string;
  notes: string;
  priority: CompetitionPriority;
  planning_block_id: string;
}

interface SeasonFormState {
  name: string;
  start_date: string;
  end_date: string;
}

const DEFAULT_BLOCK: BlockFormState = {
  name: '',
  description: '',
  type: 'mesocycle',
  start_week: 1,
  end_week: 4,
  color: BLOCK_COLORS[0],
};

const DEFAULT_COMP: CompFormState = {
  name: '',
  type: 'competition',
  date: new Date().toISOString().slice(0, 10),
  location: '',
  notes: '',
  priority: 'A',
  planning_block_id: '',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {BLOCK_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
          style={{
            background: c,
            borderColor: value === c ? '#fff' : 'transparent',
            boxShadow: value === c ? `0 0 0 1px ${c}` : 'none',
          }}
        />
      ))}
    </div>
  );
}

// ─── Gantt Timeline ────────────────────────────────────────────────────────────

interface GanttProps {
  blocks: PlanningBlock[];
  competitions: Competition[];
  totalWeeks: number;
  seasonStart: string;
}

function GanttTimeline({ blocks, competitions, totalWeeks, seasonStart }: GanttProps) {
  const maxDepth = useMemo(() => {
    if (blocks.length === 0) return 0;
    return Math.min(3, Math.max(...blocks.map((b) => getBlockDepth(b.id, blocks))));
  }, [blocks]);

  const RULER_H = 20;
  const ROW_H = 18;
  const COMP_ROW_H = 16;
  const totalH = RULER_H + COMP_ROW_H + ROW_H * (maxDepth + 1);

  // Week markers: show every ~5 weeks, always show last
  const markers: number[] = [];
  const step = totalWeeks <= 20 ? 4 : totalWeeks <= 40 ? 5 : 8;
  for (let w = 1; w <= totalWeeks; w += step) markers.push(w);
  if (markers[markers.length - 1] !== totalWeeks) markers.push(totalWeeks);

  function pct(week: number) {
    return `${((week - 1) / totalWeeks) * 100}%`;
  }
  function widthPct(start: number, end: number) {
    return `${((end - start + 1) / totalWeeks) * 100}%`;
  }

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-[#0d0e14]"
      style={{ height: totalH }}
    >
      {/* Vertical grid lines */}
      {markers.map((w) => (
        <div
          key={w}
          className="absolute top-0 bottom-0 border-l border-white/5"
          style={{ left: pct(w) }}
        />
      ))}

      {/* Week ruler */}
      {markers.map((w) => (
        <div
          key={w}
          className="absolute text-[9px] text-white/30 font-medium"
          style={{ left: pct(w), top: 4, transform: 'translateX(-50%)' }}
        >
          S{w}
        </div>
      ))}

      {/* Competition markers */}
      {competitions.map((comp) => {
        const week = dateToWeekInSeason(comp.date, seasonStart);
        if (week < 1 || week > totalWeeks + 1) return null;
        const meta = COMPETITION_META[comp.type] ?? COMPETITION_META.autre;
        return (
          <div
            key={comp.id}
            className="absolute flex flex-col items-center"
            style={{ left: pct(week), top: RULER_H, transform: 'translateX(-50%)' }}
            title={`${comp.name} (${fmtDate(comp.date)})`}
          >
            <span style={{ fontSize: 11, lineHeight: `${COMP_ROW_H}px` }}>{meta.emoji}</span>
          </div>
        );
      })}

      {/* Block bars */}
      {blocks.map((block) => {
        const depth = getBlockDepth(block.id, blocks);
        const top = RULER_H + COMP_ROW_H + depth * ROW_H;
        const barH = ROW_H - 3;
        const opacity = depth === 0 ? 'cc' : depth === 1 ? '99' : '66';
        return (
          <div
            key={block.id}
            className="absolute rounded flex items-center px-1.5 overflow-hidden cursor-default"
            style={{
              left: pct(block.start_week),
              width: widthPct(block.start_week, block.end_week),
              top,
              height: barH,
              background: block.color + opacity,
              border: `1px solid ${block.color}`,
            }}
            title={`${block.name} · S${block.start_week}–S${block.end_week}`}
          >
            <span className="text-[8px] font-semibold text-white truncate leading-none">
              {block.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Block form modal ──────────────────────────────────────────────────────────

interface BlockModalProps {
  initial?: Partial<BlockFormState>;
  title: string;
  totalWeeks: number;
  onSave: (form: BlockFormState) => void;
  onClose: () => void;
}

function BlockModal({ initial, title, totalWeeks, onSave, onClose }: BlockModalProps) {
  const [form, setForm] = useState<BlockFormState>({ ...DEFAULT_BLOCK, ...initial });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#141519] rounded-t-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white">{title}</span>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <input
          autoFocus
          placeholder="Nom du bloc…"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full bg-[#1c1d24] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
        />

        <textarea
          placeholder="Description (optionnel)"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
          className="w-full bg-[#1c1d24] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 resize-none"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1 block">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as BlockType }))}
              className="w-full bg-[#1c1d24] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
            >
              {(Object.keys(BLOCK_TYPE_LABELS) as BlockType[]).map((t) => (
                <option key={t} value={t}>
                  {BLOCK_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1 block">Couleur</label>
            <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(['start_week', 'end_week'] as const).map((key) => (
            <div key={key}>
              <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1 block">
                {key === 'start_week' ? 'Semaine début' : 'Semaine fin'}
              </label>
              <input
                type="number"
                min={1}
                max={totalWeeks}
                value={form[key]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [key]: Math.max(1, parseInt(e.target.value) || 1) }))
                }
                className="w-full bg-[#1c1d24] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              />
            </div>
          ))}
        </div>

        <button
          disabled={!form.name.trim()}
          onClick={() => form.name.trim() && onSave(form)}
          className="w-full py-3 rounded-xl font-bold text-sm text-white transition-opacity disabled:opacity-40"
          style={{ background: form.color }}
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// ─── Competition form modal ────────────────────────────────────────────────────

interface CompModalProps {
  initial?: Partial<CompFormState>;
  title: string;
  blocks: PlanningBlock[];
  onSave: (form: CompFormState) => void;
  onClose: () => void;
}

function CompModal({ initial, title, blocks, onSave, onClose }: CompModalProps) {
  const [form, setForm] = useState<CompFormState>({ ...DEFAULT_COMP, ...initial });

  const rootBlocks = blocks.filter((b) => !b.parent_block_id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#141519] rounded-t-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white">{title}</span>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <input
          autoFocus
          placeholder="Nom de l'événement…"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full bg-[#1c1d24] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1 block">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CompetitionType }))}
              className="w-full bg-[#1c1d24] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
            >
              {(Object.keys(COMPETITION_META) as CompetitionType[]).map((t) => (
                <option key={t} value={t}>
                  {COMPETITION_META[t].emoji} {COMPETITION_META[t].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1 block">Priorité</label>
            <div className="flex gap-2">
              {(['A', 'B', 'C'] as CompetitionPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, priority: p }))}
                  className="flex-1 py-1.5 rounded-lg text-sm font-bold border transition-colors"
                  style={{
                    background: form.priority === p ? '#F5A623' : 'transparent',
                    borderColor: form.priority === p ? '#F5A623' : 'rgba(255,255,255,0.1)',
                    color: form.priority === p ? '#fff' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1 block">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full bg-[#1c1d24] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1 block">Lieu</label>
            <input
              placeholder="Lieu…"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className="w-full bg-[#1c1d24] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
            />
          </div>
        </div>

        {rootBlocks.length > 0 && (
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1 block">
              Bloc associé (optionnel)
            </label>
            <select
              value={form.planning_block_id}
              onChange={(e) => setForm((f) => ({ ...f, planning_block_id: e.target.value }))}
              className="w-full bg-[#1c1d24] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">— Aucun —</option>
              {blocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <textarea
          placeholder="Notes (optionnel)"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
          className="w-full bg-[#1c1d24] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 resize-none"
        />

        <button
          disabled={!form.name.trim() || !form.date}
          onClick={() => form.name.trim() && form.date && onSave(form)}
          className="w-full py-3 rounded-xl font-bold text-sm text-white bg-[#F5A623] transition-opacity disabled:opacity-40"
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// ─── Season form modal ─────────────────────────────────────────────────────────

interface SeasonModalProps {
  initial?: Partial<SeasonFormState>;
  title: string;
  onSave: (form: SeasonFormState) => void;
  onClose: () => void;
}

function SeasonModal({ initial, title, onSave, onClose }: SeasonModalProps) {
  const [form, setForm] = useState<SeasonFormState>({
    name: initial?.name ?? '',
    start_date: initial?.start_date ?? new Date().toISOString().slice(0, 10),
    end_date:
      initial?.end_date ??
      new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 10),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#141519] rounded-t-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white">{title}</span>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <input
          autoFocus
          placeholder="Ex : Saison 2025-2026"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full bg-[#1c1d24] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
        />

        <div className="grid grid-cols-2 gap-3">
          {(['start_date', 'end_date'] as const).map((key) => (
            <div key={key}>
              <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1 block">
                {key === 'start_date' ? 'Date de début' : 'Date de fin'}
              </label>
              <input
                type="date"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full bg-[#1c1d24] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              />
            </div>
          ))}
        </div>

        <button
          disabled={!form.name.trim() || !form.start_date || !form.end_date}
          onClick={() => form.name.trim() && onSave(form)}
          className="w-full py-3 rounded-xl font-bold text-sm text-white bg-[#5865F2] transition-opacity disabled:opacity-40"
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// ─── Block node (recursive tree row) ──────────────────────────────────────────

interface BlockNodeProps {
  block: PlanningBlock;
  allBlocks: PlanningBlock[];
  competitions: Competition[];
  depth: number;
  totalWeeks: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (block: PlanningBlock) => void;
  onDelete: (block: PlanningBlock) => void;
  onAddChild: (parentId: string) => void;
  /** Drag-and-drop callbacks */
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: (targetId: string) => void;
  draggingId: string | null;
  dragOverId: string | null;
}

function BlockNode({
  block,
  allBlocks,
  competitions,
  depth,
  totalWeeks,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddChild,
  onDragStart,
  onDragOver,
  onDrop,
  draggingId,
  dragOverId,
}: BlockNodeProps) {
  const isExpanded = expanded.has(block.id);
  const children = block.children ?? [];
  const compCount = competitions.filter((c) => c.planning_block_id === block.id).length;
  const weeks = block.end_week - block.start_week + 1;
  const isDragging = draggingId === block.id;
  const isDropTarget = dragOverId === block.id && draggingId !== block.id;

  return (
    <div>
      <div
        draggable
        onDragStart={() => onDragStart(block.id)}
        onDragOver={(e) => { e.preventDefault(); onDragOver(block.id); }}
        onDrop={(e) => { e.preventDefault(); onDrop(block.id); }}
        className={`group flex items-center gap-2 py-2 px-3 rounded-xl transition-all cursor-grab active:cursor-grabbing ${
          isDragging ? 'opacity-30' : ''
        } ${isDropTarget ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'}`}
        style={{ marginLeft: depth * 20 }}
      >
        {/* Drag handle */}
        <GripVertical size={14} className="text-white/20 group-hover:text-white/40 shrink-0" />

        {/* Expand toggle */}
        <button
          onClick={() => onToggle(block.id)}
          className="text-white/40 hover:text-white/80 transition-colors shrink-0"
          style={{ visibility: children.length > 0 ? 'visible' : 'hidden' }}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Color dot */}
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: block.color }}
        />

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{block.name}</span>
            <span
              className="text-[9px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0"
              style={{ background: block.color + '30', color: block.color }}
            >
              {BLOCK_TYPE_LABELS[block.type]}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-white/40">
              S{block.start_week}–S{block.end_week} · {weeks} sem.
            </span>
            {compCount > 0 && (
              <span className="text-[10px] text-[#F5A623]">
                🏆 {compCount}
              </span>
            )}
            {children.length > 0 && (
              <span className="text-[10px] text-white/30">
                {children.length} sous-bloc{children.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onAddChild(block.id)}
            className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
            title="Ajouter un sous-bloc"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={() => onEdit(block)}
            className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(block)}
            className="p-1 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Children */}
      {isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <BlockNode
              key={child.id}
              block={child}
              allBlocks={allBlocks}
              competitions={competitions}
              depth={depth + 1}
              totalWeeks={totalWeeks}
              expanded={expanded}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              draggingId={draggingId}
              dragOverId={dragOverId}
            />
          ))}
        </div>
      )}

      {/* Add child shortcut (shown when expanded) */}
      {isExpanded && (
        <button
          onClick={() => onAddChild(block.id)}
          className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/60 py-1 transition-colors"
          style={{ marginLeft: (depth + 1) * 20 + 32 }}
        >
          <Plus size={10} />
          Ajouter un sous-bloc
        </button>
      )}
    </div>
  );
}

// ─── Main PlanningEditor ───────────────────────────────────────────────────────

export function PlanningEditor({ athleteId, coachId: coachIdProp, sessions = [] }: Props) {
  // coachId vient du parent (WeightliftingTracker a déjà l'auth) — pas de fetch async
  const coachId = coachIdProp ?? null;

  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

  // Modal state
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<PlanningBlock | null>(null);
  const [parentForNewBlock, setParentForNewBlock] = useState<string | null>(null);
  const [showCompModal, setShowCompModal] = useState(false);
  const [editingComp, setEditingComp] = useState<Competition | null>(null);

  // Tree state
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Queries
  const { data: seasons = [] } = useSeasons(athleteId);
  const { data: flatBlocks = [] } = usePlanningBlocks(selectedSeasonId);
  const { data: competitions = [] } = useCompetitions(athleteId, selectedSeasonId);

  // Mutations
  const createSeason = useCreateSeason();
  const updateSeason = useUpdateSeason();
  const deleteSeason = useDeleteSeason();
  const createBlock = useCreateBlock();
  const updateBlock = useUpdateBlock();
  const deleteBlock = useDeleteBlock();
  const createComp = useCreateCompetition();
  const updateComp = useUpdateCompetition();
  const deleteComp = useDeleteCompetition();

  // Auto-select first season
  useEffect(() => {
    if (seasons.length > 0 && !selectedSeasonId) {
      setSelectedSeasonId(seasons[0].id);
    }
  }, [seasons, selectedSeasonId]);

  const season = useMemo(
    () => seasons.find((s) => s.id === selectedSeasonId) ?? null,
    [seasons, selectedSeasonId]
  );

  const totalWeeks = useMemo(() => (season ? getSeasonWeeks(season) : 0), [season]);

  const tree = useMemo(() => buildBlockTree(flatBlocks), [flatBlocks]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleToggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  function handleSaveSeason(form: SeasonFormState) {
    if (!coachId) return;
    if (editingSeason) {
      updateSeason.mutate({ id: editingSeason.id, updates: form });
    } else {
      createSeason.mutate(
        { ...form, coach_id: coachId, athlete_id: athleteId },
        {
          onSuccess: (data) => setSelectedSeasonId(data.id),
        }
      );
    }
    setShowSeasonModal(false);
    setEditingSeason(null);
  }

  function handleSaveBlock(form: BlockFormState) {
    if (!coachId || !selectedSeasonId) return;

    const siblings = flatBlocks.filter((b) => b.parent_block_id === parentForNewBlock);
    const maxOrder = siblings.reduce((m, b) => Math.max(m, b.sort_order), -1);

    if (editingBlock) {
      updateBlock.mutate({ id: editingBlock.id, updates: form });
    } else {
      createBlock.mutate({
        ...form,
        season_id: selectedSeasonId,
        coach_id: coachId,
        athlete_id: athleteId,
        parent_block_id: parentForNewBlock,
        sort_order: maxOrder + 1,
      });
    }
    setShowBlockModal(false);
    setEditingBlock(null);
    setParentForNewBlock(null);
  }

  function handleDeleteBlock(block: PlanningBlock) {
    if (!confirm(`Supprimer "${block.name}" et tous ses sous-blocs ?`)) return;
    deleteBlock.mutate({ id: block.id, season_id: block.season_id });
  }

  function handleSaveComp(form: CompFormState) {
    if (!coachId) return;
    const payload = {
      ...form,
      coach_id: coachId,
      athlete_id: athleteId,
      season_id: selectedSeasonId,
      planning_block_id: form.planning_block_id || null,
    };
    if (editingComp) {
      updateComp.mutate({ id: editingComp.id, updates: payload });
    } else {
      createComp.mutate(payload);
    }
    setShowCompModal(false);
    setEditingComp(null);
  }

  function handleDeleteComp(comp: Competition) {
    if (!confirm(`Supprimer "${comp.name}" ?`)) return;
    deleteComp.mutate({ id: comp.id, athlete_id: comp.athlete_id });
  }

  // Drag-and-drop: swap sort_order between dragged block and drop target (same parent only)
  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    const dragged = flatBlocks.find((b) => b.id === draggingId);
    const target = flatBlocks.find((b) => b.id === targetId);

    if (!dragged || !target || dragged.parent_block_id !== target.parent_block_id) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    updateBlock.mutate({ id: draggingId, updates: { sort_order: target.sort_order } });
    updateBlock.mutate({ id: targetId, updates: { sort_order: dragged.sort_order } });
    setDraggingId(null);
    setDragOverId(null);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-8">
      {/* Season selector */}
      <div className="flex items-center gap-3">
        <select
          value={selectedSeasonId ?? ''}
          onChange={(e) => setSelectedSeasonId(e.target.value || null)}
          className="flex-1 bg-[#141519] border border-white/10 rounded-xl px-3 py-2.5 text-sm font-semibold text-white outline-none"
        >
          <option value="" disabled>
            — Choisir une saison —
          </option>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {fmtDate(s.start_date)} → {fmtDate(s.end_date)}
            </option>
          ))}
        </select>

        {season && (
          <button
            onClick={() => { setEditingSeason(season); setShowSeasonModal(true); }}
            className="p-2.5 rounded-xl bg-[#141519] border border-white/10 text-white/40 hover:text-white/80 transition-colors"
          >
            <Pencil size={15} />
          </button>
        )}

        <button
          onClick={() => { setEditingSeason(null); setShowSeasonModal(true); }}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/30 text-[#5865F2] text-sm font-semibold hover:bg-[#5865F2]/30 transition-colors shrink-0"
        >
          <Plus size={14} />
          Saison
        </button>
      </div>

      {!season ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="text-4xl">📅</div>
          <div>
            <div className="text-sm font-bold text-white mb-1">Aucune saison</div>
            <div className="text-xs text-white/40">
              Crée une saison pour commencer la planification
            </div>
          </div>
          <button
            onClick={() => setShowSeasonModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#5865F2] text-white text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Créer une saison
          </button>
        </div>
      ) : (
        <>
          {/* Season info bar */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#141519] border border-white/10">
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/40">
                {fmtDate(season.start_date)} → {fmtDate(season.end_date)}
              </span>
              <span className="text-[10px] font-semibold text-[#5865F2] px-2 py-0.5 rounded-full bg-[#5865F2]/15">
                {totalWeeks} semaines
              </span>
            </div>
            <button
              onClick={() => {
                if (!confirm(`Supprimer la saison "${season.name}" et tous ses blocs ?`)) return;
                deleteSeason.mutate({ id: season.id, athlete_id: athleteId });
                setSelectedSeasonId(null);
              }}
              className="text-[10px] text-white/30 hover:text-red-400 transition-colors"
            >
              Supprimer la saison
            </button>
          </div>

          {/* Gantt timeline */}
          {flatBlocks.length > 0 && (
            <GanttTimeline
              blocks={flatBlocks}
              competitions={competitions}
              totalWeeks={totalWeeks}
              seasonStart={season.start_date}
            />
          )}

          {/* Block tree header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/40 uppercase tracking-wide">
              Blocs de planification
            </span>
            <button
              onClick={() => {
                setEditingBlock(null);
                setParentForNewBlock(null);
                setShowBlockModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5865F2]/15 border border-[#5865F2]/20 text-[#5865F2] text-xs font-semibold hover:bg-[#5865F2]/25 transition-colors"
            >
              <Plus size={12} />
              Ajouter un bloc
            </button>
          </div>

          {/* Block tree */}
          <div className="bg-[#141519] border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5">
            {tree.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-2xl mb-2">📋</div>
                <div className="text-xs text-white/40">Aucun bloc — ajoute un macrocycle pour commencer</div>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {tree.map((block) => (
                  <BlockNode
                    key={block.id}
                    block={block}
                    allBlocks={flatBlocks}
                    competitions={competitions}
                    depth={0}
                    totalWeeks={totalWeeks}
                    expanded={expanded}
                    onToggle={handleToggle}
                    onEdit={(b) => {
                      setEditingBlock(b);
                      setParentForNewBlock(b.parent_block_id);
                      setShowBlockModal(true);
                    }}
                    onDelete={handleDeleteBlock}
                    onAddChild={(parentId) => {
                      setEditingBlock(null);
                      setParentForNewBlock(parentId);
                      setExpanded((prev) => new Set([...prev, parentId]));
                      setShowBlockModal(true);
                    }}
                    onDragStart={setDraggingId}
                    onDragOver={setDragOverId}
                    onDrop={handleDrop}
                    draggingId={draggingId}
                    dragOverId={dragOverId}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Competitions section */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <Trophy size={13} className="text-[#F5A623]" />
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wide">
                Compétitions & Tests
              </span>
            </div>
            <button
              onClick={() => { setEditingComp(null); setShowCompModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5A623]/15 border border-[#F5A623]/20 text-[#F5A623] text-xs font-semibold hover:bg-[#F5A623]/25 transition-colors"
            >
              <Plus size={12} />
              Ajouter
            </button>
          </div>

          <div className="bg-[#141519] border border-white/10 rounded-xl overflow-hidden">
            {competitions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-xs text-white/30">
                  Aucune compétition ou test pour cette saison
                </div>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {competitions.map((comp) => {
                  const meta = COMPETITION_META[comp.type] ?? COMPETITION_META.autre;
                  const linkedBlock = flatBlocks.find((b) => b.id === comp.planning_block_id);
                  return (
                    <div
                      key={comp.id}
                      className="group flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <span className="text-base shrink-0">{meta.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">{comp.name}</span>
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                            style={{
                              background: '#F5A623' + '30',
                              color: '#F5A623',
                            }}
                          >
                            {comp.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-white/40">
                            {fmtDate(comp.date)}
                          </span>
                          {comp.location && (
                            <span className="text-[10px] text-white/30">· {comp.location}</span>
                          )}
                          {linkedBlock && (
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded"
                              style={{ background: linkedBlock.color + '25', color: linkedBlock.color }}
                            >
                              {linkedBlock.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingComp(comp); setShowCompModal(true); }}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteComp(comp)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {showSeasonModal && (
        <SeasonModal
          title={editingSeason ? 'Modifier la saison' : 'Nouvelle saison'}
          initial={
            editingSeason
              ? { name: editingSeason.name, start_date: editingSeason.start_date, end_date: editingSeason.end_date }
              : undefined
          }
          onSave={handleSaveSeason}
          onClose={() => { setShowSeasonModal(false); setEditingSeason(null); }}
        />
      )}

      {showBlockModal && (
        <BlockModal
          title={editingBlock ? 'Modifier le bloc' : parentForNewBlock ? 'Nouveau sous-bloc' : 'Nouveau bloc'}
          totalWeeks={totalWeeks}
          initial={
            editingBlock
              ? {
                  name: editingBlock.name,
                  description: editingBlock.description ?? '',
                  type: editingBlock.type,
                  start_week: editingBlock.start_week,
                  end_week: editingBlock.end_week,
                  color: editingBlock.color,
                }
              : undefined
          }
          onSave={handleSaveBlock}
          onClose={() => { setShowBlockModal(false); setEditingBlock(null); setParentForNewBlock(null); }}
        />
      )}

      {showCompModal && (
        <CompModal
          title={editingComp ? "Modifier l'événement" : 'Nouvel événement'}
          blocks={flatBlocks}
          initial={
            editingComp
              ? {
                  name: editingComp.name,
                  type: editingComp.type,
                  date: editingComp.date,
                  location: editingComp.location ?? '',
                  notes: editingComp.notes ?? '',
                  priority: editingComp.priority,
                  planning_block_id: editingComp.planning_block_id ?? '',
                }
              : undefined
          }
          onSave={handleSaveComp}
          onClose={() => { setShowCompModal(false); setEditingComp(null); }}
        />
      )}
    </div>
  );
}
