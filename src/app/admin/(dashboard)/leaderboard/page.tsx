import type { Metadata } from "next";
import { ProgressGrid } from "@/components/ProgressGrid";
import { countAwaitingCredit, getCombinedTotal, getLeaderboard } from "@/lib/stats";
import { MEMBER_HOURS_GOAL, minutesToHours } from "@/lib/constants";

export const metadata: Metadata = { title: "Leaderboard" };

export default async function AdminLeaderboardPage() {
  const [leaderboard, combined, awaitingCredit] = await Promise.all([
    getLeaderboard(),
    getCombinedTotal(),
    countAwaitingCredit(),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
          <p className="mt-1 text-sm text-muted">
            Credited tutoring hours per member, measured against the {MEMBER_HOURS_GOAL}-hour goal.
          </p>
        </div>
        <a
          href="/api/admin/export"
          className="rounded-full bg-surface px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-hairline/60"
          download
        >
          Export CSV
        </a>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">
          All-time total · all members combined
        </p>
        <p className="mt-2 text-6xl font-semibold tracking-tight">
          {minutesToHours(combined.minutes)}
          <span className="ml-2 text-2xl font-medium text-muted">hours</span>
        </p>
        <p className="mt-2 text-sm text-muted">
          {combined.sessions} credited session{combined.sessions === 1 ? "" : "s"}
          {awaitingCredit > 0 && ` · ${awaitingCredit} waiting for credit`}
        </p>
      </div>

      {leaderboard.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="text-muted">No members yet.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {leaderboard.map((member, i) => (
            <div key={member.memberId} className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <p className="font-semibold tracking-tight">
                  <span className="mr-2 text-sm font-normal text-faint">{i + 1}</span>
                  {member.name}
                  {!member.active && <span className="ml-1.5 text-xs font-normal text-faint">(former)</span>}
                </p>
                <p className="shrink-0 text-xs text-muted">
                  {member.sessionCount} session{member.sessionCount === 1 ? "" : "s"}
                </p>
              </div>
              <ProgressGrid minutes={member.totalMinutes} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
