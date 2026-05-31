import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/features/shared/hooks/useCoachDashboard";

const CFG: Record<SessionStatus, { label: string; cls: string }> = {
  planned:     { label: "Planifié",  cls: "bg-[rgba(124,116,128,0.12)] text-[#7C7480]  border-[rgba(124,116,128,0.3)]" },
  in_progress: { label: "En cours",  cls: "bg-[rgba(59,141,240,0.12)]  text-[#3B8DF0]  border-[rgba(59,141,240,0.3)]"  },
  completed:   { label: "Terminé",   cls: "bg-[rgba(34,201,147,0.12)]  text-[#22C993]  border-[rgba(34,201,147,0.3)]"  },
  missed:      { label: "Manqué",    cls: "bg-[rgba(239,75,75,0.12)]   text-[#EF4B4B]  border-[rgba(239,75,75,0.3)]"   },
  skipped:     { label: "Sauté",     cls: "bg-[rgba(251,146,60,0.12)]  text-[#FB923C]  border-[rgba(251,146,60,0.3)]"  },
};

interface StatusPillProps {
  status: SessionStatus;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const cfg = CFG[status] ?? CFG.planned;
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-px rounded text-[10px] font-bold border leading-none",
        cfg.cls,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}
