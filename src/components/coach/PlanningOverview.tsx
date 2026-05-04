/**
 * PlanningOverview — vue read-only de la planification dans l'onglet Stats.
 * Même données que PlanningEditor (seasons / planning_blocks / competitions),
 * présentées du point de vue du joueur : où en est-il dans sa saison ?
 */
import { useMemo } from 'react';
import { Trophy, Pencil } from 'lucide-react';
import { useSeasons, usePlanningBlocks, getBlockDepth } from '@/hooks/usePlanningBlocks';
import { useCompetitions } from '@/hooks/useCompetitions';
import { COMPETITION_META, type PlanningBlock, type Competition } from '@/types/planning';

// ─── Utils ────────────────────────────────────────────────────────────────────

function getSeasonWeeks(startDate: string, endDate: string): number {
  const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.max(1, Math.round(ms / (7 * 86400 * 1000)));
}

function getCurrentWeekInSeason(startDate: string): number {
  const ms = Date.now() - new Date(startDate).getTime();
  return Math.max(1, Math.floor(ms / (7 * 86400 * 1000)) + 1);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function daysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
}

// ─── Mini Gantt read-only ─────────────────────────────────────────────────────

function MiniGantt({
  blocks,
  totalWeeks,
  currentWeek,
}: {
  blocks: PlanningBlock[];
  totalWeeks: number;
  currentWeek: number;
}) {
  const maxDepth = Math.min(2, Math.max(0, ...blocks.map((b) => getBlockDepth(b.id, blocks))));
  const RULER_H = 18;
  const ROW_H = 16;
  const height = RULER_H + ROW_H * (maxDepth + 1);

  const step = totalWeeks <= 20 ? 4 : totalWeeks <= 40 ? 5 : 8;
  const markers: number[] = [];
  for (let w = 1; w <= totalWeeks; w += step) markers.push(w);
  if (markers[markers.length - 1] !== totalWeeks) markers.push(totalWeeks);

  function pct(w: number) {
    return `${((w - 1) / totalWeeks) * 100}%`;
  }

  const nowPct = `${Math.min(((currentWeek - 0.5) / totalWeeks) * 100, 100)}%`;

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden bg-[#0d0e14] border border-white/10"
      style={{ height }}
    >
      {/* Grid lines */}
      {markers.map((w) => (
        <div key={w} className="absolute top-0 bottom-0 border-l border-white/5" style={{ left: pct(w) }} />
      ))}

      {/* Week numbers */}
      {markers.map((w) => (
        <div
          key={w}
          className="absolute text-[9px] text-white/25 font-medium"
          style={{ left: pct(w), top: 3, transform: 'translateX(-50%)' }}
        >
          S{w}
        </div>
      ))}

      {/* Block bars */}
      {blocks.map((block) => {
        const depth = getBlockDepth(block.id, blocks);
        const top = RULER_H + depth * ROW_H;
        const barH = ROW_H - 3;
        const opacity = depth === 0 ? 'cc' : depth === 1 ? '99' : '66';
        const isActive = currentWeek >= block.start_week && currentWeek <= block.end_week;
        return (
          <div
            key={block.id}
            className="absolute rounded flex items-center px-1 overflow-hidden"
            style={{
              left: `${((block.start_week - 1) / totalWeeks) * 100}%`,
              width: `${((block.end_week - block.start_week + 1) / totalWeeks) * 100}%`,
              top,
              height: barH,
              background: block.color + opacity,
              border: `1px solid ${block.color}${isActive ? '' : '60'}`,
              opacity: isActive ? 1 : 0.5,
            }}
            title={`${block.name} · S${block.start_week}–S${block.end_week}`}
          >
            <span className="text-[7px] font-semibold text-white truncate leading-none">{block.name}</span>
          </div>
        );
      })}

      {/* Current week marker */}
      {currentWeek >= 1 && currentWeek <= totalWeeks && (
        <div
          className="absolute top-0 bottom-0 w-px bg-white/70 z-10"
          style={{ left: nowPct }}
        />
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function PlanningOverview({ athleteId, onEditComp }: { athleteId: string; onEditComp?: (comp: Competition) => void }) {
  const { data: seasons = [] } = useSeasons(athleteId);

  // Prend la saison la plus récente qui couvre aujourd'hui, sinon la plus récente
  const currentSeason = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const active = seasons.find((s) => s.start_date <= today && s.end_date >= today);
    return active ?? seasons[0] ?? null;
  }, [seasons]);

  const { data: blocks = [] } = usePlanningBlocks(currentSeason?.id ?? null);
  // Toutes les compétitions de l'athlète (pas seulement la saison courante)
  // pour que les ajouts du coach dans n'importe quelle saison soient visibles ici.
  const { data: competitions = [] } = useCompetitions(athleteId);

  const totalWeeks = useMemo(
    () => (currentSeason ? getSeasonWeeks(currentSeason.start_date, currentSeason.end_date) : 0),
    [currentSeason]
  );

  const currentWeek = useMemo(
    () => (currentSeason ? getCurrentWeekInSeason(currentSeason.start_date) : 0),
    [currentSeason]
  );

  // Bloc actif le plus précis (depth max parmi ceux qui couvrent la semaine courante)
  const activeBlocks = useMemo(
    () =>
      blocks
        .filter((b) => b.start_week <= currentWeek && b.end_week >= currentWeek)
        .sort((a, b) => getBlockDepth(b.id, blocks) - getBlockDepth(a.id, blocks)),
    [blocks, currentWeek]
  );

  // Compétitions à venir — comparaison par date ISO (pas par timestamp) pour éviter
  // les décalages UTC : '2026-04-26' >= '2026-04-26' est toujours vrai le jour J
  const todayISO = new Date().toISOString().slice(0, 10);
  const upcomingComps = useMemo(() => {
    return competitions
      .filter((c) => c.date >= todayISO)
      .slice(0, 4);
  }, [competitions, todayISO]);

  const isInSeason = currentWeek >= 1 && currentWeek <= totalWeeks;

  // Pas de saison ET pas de compétitions → rien à montrer
  if (!currentSeason && competitions.length === 0) return null;

  return (
    <div
      className="rounded-2xl border overflow-hidden mb-4"
      style={{ background: '#141519', borderColor: 'rgba(255,255,255,0.06)' }}
    >
      {/* Header saison — uniquement si saison trouvée */}
      {currentSeason && (
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div>
            <div className="text-xs font-bold text-white">{currentSeason.name}</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {fmtDate(currentSeason.start_date)} → {fmtDate(currentSeason.end_date)} · {totalWeeks} semaines
            </div>
          </div>
          {isInSeason && (
            <div
              className="px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: 'rgba(91,201,115,0.15)', color: '#22C993' }}
            >
              S{currentWeek} / {totalWeeks}
            </div>
          )}
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Gantt — uniquement si saison + blocs */}
        {currentSeason && blocks.length > 0 && (
          <MiniGantt blocks={blocks} totalWeeks={totalWeeks} currentWeek={currentWeek} />
        )}

        {/* Phase actuelle */}
        {activeBlocks.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Phase actuelle
            </span>
            {activeBlocks.slice(0, 3).map((b) => (
              <span
                key={b.id}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: b.color + '25', color: b.color }}
              >
                {b.name}
              </span>
            ))}
          </div>
        )}

        {/* Prochaines compétitions */}
        {upcomingComps.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Trophy size={11} color="#F5A623" />
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Prochains événements
              </span>
            </div>
            <div className="space-y-1.5">
              {upcomingComps.map((comp) => {
                const meta = COMPETITION_META[comp.type] ?? COMPETITION_META.autre;
                const days = daysUntil(comp.date);
                return (
                  <div
                    key={comp.id}
                    className="group flex items-center gap-2.5 px-3 py-2 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <span className="text-sm shrink-0">{meta.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{comp.name}</div>
                      {comp.location && (
                        <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {comp.location}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-bold" style={{ color: meta.color }}>
                        {days === 0 ? "Aujourd'hui" : days === 1 ? 'Demain' : `J-${days}`}
                      </div>
                      <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {fmtDate(comp.date)}
                      </div>
                    </div>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: '#F5A623' + '25', color: '#F5A623' }}
                    >
                      {comp.priority}
                    </span>
                    {onEditComp && (
                      <button
                        onClick={() => onEditComp(comp)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-all shrink-0"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {blocks.length === 0 && upcomingComps.length === 0 && (
          <div className="text-center py-4">
            <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Aucun bloc ni événement à venir
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
