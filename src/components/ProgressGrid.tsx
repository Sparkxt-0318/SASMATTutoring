import { MEMBER_HOURS_GOAL, PROGRESS_CELL_MINUTES, formatHours } from "@/lib/constants";

/** Squares per row. Extra (gold) rows line up under the same columns. */
const COLUMNS = 10;

type CellState = "full" | "partial" | "empty" | "extra" | "extra-partial";

const cellStyles: Record<CellState, string> = {
  full: "bg-progress",
  partial: "bg-progress-partial",
  empty: "bg-progress-empty",
  extra: "bg-progress-extra",
  "extra-partial": "bg-progress-extra-partial",
};

/**
 * Progress toward the hours goal: one square per hour, filled left to right in
 * rows of ten. Green is done, grey is still to go, a lighter square is an hour
 * that is partly done. Hours beyond the goal appear as gold squares on extra
 * rows below, only once the goal has been passed.
 */
export function ProgressGrid({
  minutes,
  goalHours = MEMBER_HOURS_GOAL,
}: {
  minutes: number;
  goalHours?: number;
}) {
  const goalCells = Math.max(1, Math.round((goalHours * 60) / PROGRESS_CELL_MINUTES));
  const done = minutes / PROGRESS_CELL_MINUTES;
  const cells: CellState[] = Array.from({ length: goalCells }, (_, i) =>
    done - i >= 1 ? "full" : done - i > 0 ? "partial" : "empty",
  );
  const extraDone = Math.max(0, done - goalCells);
  const extraCells = Math.ceil(extraDone);
  for (let i = 0; i < extraCells; i++) cells.push(extraDone - i >= 1 ? "extra" : "extra-partial");

  const columns = Math.min(COLUMNS, goalCells);
  const remainingMinutes = Math.max(0, goalHours * 60 - minutes);
  const extraMinutes = Math.max(0, minutes - goalHours * 60);

  return (
    <div>
      <div
        role="img"
        aria-label={`${formatHours(minutes)} of ${goalHours} hours completed`}
        className="grid w-full max-w-sm gap-1.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {cells.map((state, i) => (
          <span key={i} className={`aspect-square rounded-md ${cellStyles[state]}`} />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          <strong className="font-semibold text-foreground">{formatHours(minutes)}</strong> of{" "}
          {goalHours} hours
          {remainingMinutes > 0
            ? ` · ${formatHours(remainingMinutes)} to go`
            : extraMinutes > 0
              ? ` · Goal reached, +${formatHours(extraMinutes)} extra 🎉`
              : " · Goal reached 🎉"}
        </span>
        <span className="flex items-center gap-1.5 text-faint">
          <span className="size-2.5 rounded-[3px] bg-progress" /> Done
          <span className="ml-1.5 size-2.5 rounded-[3px] bg-progress-empty" /> To go
          {extraMinutes > 0 && (
            <>
              <span className="ml-1.5 size-2.5 rounded-[3px] bg-progress-extra" /> Extra
            </>
          )}
        </span>
      </div>
      <p className="mt-1 text-xs text-faint">Each square is one hour.</p>
    </div>
  );
}
