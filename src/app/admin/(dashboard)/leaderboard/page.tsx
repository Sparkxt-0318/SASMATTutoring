import type { Metadata } from "next";
import { getCombinedTotal, getLeaderboard } from "@/lib/stats";
import { prisma } from "@/lib/db";
import { minutesToHours, formatMinutes } from "@/lib/constants";

export const metadata: Metadata = { title: "Leaderboard" };

export default async function AdminLeaderboardPage() {
  const [leaderboard, combined, pendingCount] = await Promise.all([
    getLeaderboard(),
    getCombinedTotal(),
    prisma.creditLog.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
          <p className="mt-1 text-sm text-muted">Approved tutoring hours per member.</p>
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
          {combined.sessions} approved session{combined.sessions === 1 ? "" : "s"}
          {pendingCount > 0 && ` · ${pendingCount} pending review`}
        </p>
      </div>

      {leaderboard.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="text-muted">No members yet.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline/60 text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3.5 font-semibold">#</th>
                <th className="px-5 py-3.5 font-semibold">Member</th>
                <th className="px-5 py-3.5 text-right font-semibold">Hours</th>
                <th className="px-5 py-3.5 text-right font-semibold">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((member, i) => (
                <tr key={member.memberId} className="border-b border-hairline/40 last:border-0">
                  <td className="px-5 py-3.5 text-muted">{i + 1}</td>
                  <td className="px-5 py-3.5 font-medium">
                    {member.name}
                    {!member.active && <span className="ml-1.5 text-xs text-faint">(former)</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium">
                    {minutesToHours(member.totalMinutes)}
                    <span className="ml-1 text-xs font-normal text-faint">
                      ({formatMinutes(member.totalMinutes)})
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-muted">{member.sessionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
