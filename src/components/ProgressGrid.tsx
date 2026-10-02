import { MEMBER_HOURS_GOAL, PROGRESS_CELL_MINUTES, minutesToHours } from "@/lib/constants";

// Prefer a row count that divides the grid evenly so the last column is full.
const ROW_OPTIONS = [7, 5, 6, 8, 4, 10];

function pickRows(total: number): number {
  return ROW_OPTIONS.find((rows) => total % rows === 0) ?? 7;
}

type CellState = "full" | "partial" | "empty";

const cellStyles: Record<CellState, string> = {
  full: "bg-progress",
  partial: "bg-progress-partial",
  empty: "bg-progress-empty",
};

/**
 * GitHub-style grid, but it measures progress rather than activity: every
 * square is a slice of the hours goal. Green squares are done, blank squares
 * are still to fill. Squares fill top-to-bottom, left-to-right.
 */
export function ProgressGrid({
  minutes,
  goalHours = MEMBER_HOURS_GOAL,
}: {
  minutes: number;
  goalHours?: number;
}) {
  const total = Math.max(1, Math.round((goalHours * 60) / PROGRESS_CELL_MINUTES));
  const rows = pickRows(total);
  const cells: CellState[] = Array.from({ length: total }, (_, i) => {
    const filled = minutes / PROGRESS_CELL_MINUTES - i;
    return filled >= 1 ? "full" : filled > 0 ? "partial" : "empty";
  });
  const remainingMinutes = Math.max(0, goalHours * 60 - minutes);

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div
          role="img"
          aria-label={`${minutesToHours(minutes)} of ${goalHours} hours completed`}
          className="grid w-max grid-flow-col gap-1"
          style={{ gridTemplateRows: `repeat(${rows}, 0.875rem)`, gridAutoColumns: "0.875rem" }}
        >
          {cells.map((state, i) => (
            <span key={i} className={`rounded-[4px] ${cellStyles[state]}`} />
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          <strong className="font-semibold text-foreground">{minutesToHours(minutes)}</strong> of{" "}
          {goalHours} hours
          {remainingMinutes > 0 ? ` · ${minutesToHours(remainingMinutes)} to go` : " · Goal reached 🎉"}
        </span>
        <span className="flex items-center gap-1.5 text-faint">
          <span className="size-2.5 rounded-[3px] bg-progress" /> Done
          <span className="ml-1.5 size-2.5 rounded-[3px] bg-progress-empty" /> To go
        </span>
      </div>
    </div>
  );
}

/** Card wrapper used on the member-facing pages. */
export function ProgressCard({ minutes, title = "Your progress" }: { minutes: number; title?: string }) {
  return (
    <div className="rise-in w-full max-w-md rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-[15px] font-semibold tracking-tight">{title}</h2>
      <ProgressGrid minutes={minutes} />
    </div>
  );
}
