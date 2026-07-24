import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { reviewCredit } from "@/lib/actions/credits";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatMinutes } from "@/lib/constants";

export const metadata: Metadata = { title: "Hours" };

export default async function AdminHoursPage() {
  const credits = await prisma.creditLog.findMany({
    orderBy: { submittedAt: "desc" },
    include: { member: true, request: true },
  });

  const pending = credits.filter((c) => c.status === "PENDING");
  const reviewed = credits.filter((c) => c.status !== "PENDING");

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Hours</h1>
      <p className="mt-1 text-sm text-muted">
        Approve logged sessions so they count toward member credit.
      </p>

      <h2 className="mt-8 text-lg font-semibold tracking-tight">
        Awaiting approval{" "}
        {pending.length > 0 && (
          <span className="ml-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            {pending.length}
          </span>
        )}
      </h2>

      {pending.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="text-muted">All caught up — nothing waiting for review.</p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {pending.map((credit) => (
            <div
              key={credit.id}
              className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">
                  {credit.member.name}{" "}
                  <span className="font-normal text-muted">
                    · {formatMinutes(credit.minutes)} · {credit.request.subject} with{" "}
                    {credit.request.studentName}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Logged {formatDate(credit.submittedAt)}
                  {credit.notes ? ` — “${credit.notes}”` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <form action={reviewCredit.bind(null, credit.id, "APPROVED")}>
                  <button
                    type="submit"
                    className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
                  >
                    Approve
                  </button>
                </form>
                <form action={reviewCredit.bind(null, credit.id, "REJECTED")}>
                  <button
                    type="submit"
                    className="rounded-full bg-surface px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-hairline/60"
                  >
                    Reject
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-10 text-lg font-semibold tracking-tight">History</h2>
      {reviewed.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No reviewed sessions yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline/60 text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3.5 font-semibold">Member</th>
                <th className="px-5 py-3.5 font-semibold">Session</th>
                <th className="px-5 py-3.5 font-semibold">Length</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 font-semibold">Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {reviewed.map((credit) => (
                <tr key={credit.id} className="border-b border-hairline/40 last:border-0">
                  <td className="px-5 py-3.5 font-medium">{credit.member.name}</td>
                  <td className="px-5 py-3.5 text-muted">
                    {credit.request.subject} with {credit.request.studentName}
                  </td>
                  <td className="px-5 py-3.5">{formatMinutes(credit.minutes)}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={credit.status} />
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-muted">
                    {credit.reviewedAt ? formatDate(credit.reviewedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
