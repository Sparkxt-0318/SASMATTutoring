import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { awardCredit, revokeCredit } from "@/lib/actions/credits";
import { cancelRequest } from "@/lib/actions/admin";
import {
  formatDate,
  formatMeeting,
  formatMinutes,
  isPast,
  meetingMinutes,
} from "@/lib/constants";

export const metadata: Metadata = { title: "Hours" };

// Kept out of the component body so the render stays pure.
function splitByEnded<T extends { meetingEnd: Date }>(rows: T[]): { ended: T[]; upcoming: T[] } {
  return {
    ended: rows.filter((r) => isPast(r.meetingEnd)),
    upcoming: rows.filter((r) => !isPast(r.meetingEnd)),
  };
}

export default async function AdminHoursPage() {
  const [claimed, credits] = await Promise.all([
    prisma.tutoringRequest.findMany({
      where: { status: "CLAIMED" },
      orderBy: { meetingStart: "asc" },
      include: { claimedBy: true },
    }),
    prisma.creditLog.findMany({
      where: { status: "APPROVED" },
      orderBy: { reviewedAt: "desc" },
      take: 100,
      include: { member: true, request: true },
    }),
  ]);

  const { ended, upcoming } = splitByEnded(claimed);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Hours</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Credit is never automatic. Once a week, go through the sessions below and record the time
        each tutor earned — it defaults to the length the student booked.
      </p>

      <h2 className="mt-8 text-lg font-semibold tracking-tight">
        Ready for credit{" "}
        {ended.length > 0 && (
          <span className="ml-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            {ended.length}
          </span>
        )}
      </h2>

      {ended.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="text-muted">All caught up — no finished sessions waiting for credit.</p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {ended.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <p className="font-medium">
                  {request.claimedBy?.name ?? "Unknown tutor"}{" "}
                  <span className="font-normal text-muted">
                    · {request.subject} with {request.studentName}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatMeeting(request.meetingStart, request.meetingEnd)} · booked{" "}
                  {formatMinutes(meetingMinutes(request.meetingStart, request.meetingEnd))}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <form action={awardCredit.bind(null, request.id)} className="flex items-center gap-2">
                  <label htmlFor={`minutes-${request.id}`} className="sr-only">
                    Minutes to credit
                  </label>
                  <input
                    id={`minutes-${request.id}`}
                    name="minutes"
                    type="number"
                    min={5}
                    max={480}
                    step={5}
                    defaultValue={meetingMinutes(request.meetingStart, request.meetingEnd)}
                    className="w-20 rounded-xl border border-hairline bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
                  />
                  <span className="text-xs text-muted">min</span>
                  <button
                    type="submit"
                    className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
                  >
                    Award credit
                  </button>
                </form>
                <form action={cancelRequest.bind(null, request.id)}>
                  <button
                    type="submit"
                    className="rounded-full bg-surface px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-hairline/60"
                  >
                    Didn&rsquo;t happen
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-semibold tracking-tight">Upcoming sessions</h2>
          <p className="mt-1 text-sm text-muted">Claimed, but the meeting hasn&rsquo;t happened yet.</p>
          <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full min-w-[560px] text-left text-sm">
              <tbody>
                {upcoming.map((request) => (
                  <tr key={request.id} className="border-b border-hairline/40 last:border-0">
                    <td className="px-5 py-3.5 font-medium">{request.claimedBy?.name ?? "—"}</td>
                    <td className="px-5 py-3.5 text-muted">
                      {request.subject} with {request.studentName}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-muted">
                      {formatMeeting(request.meetingStart, request.meetingEnd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="mt-10 text-lg font-semibold tracking-tight">Credited</h2>
      {credits.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No credit has been recorded yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline/60 text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3.5 font-semibold">Member</th>
                <th className="px-5 py-3.5 font-semibold">Session</th>
                <th className="px-5 py-3.5 font-semibold">Credited</th>
                <th className="px-5 py-3.5 font-semibold">Recorded</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {credits.map((credit) => (
                <tr key={credit.id} className="border-b border-hairline/40 last:border-0">
                  <td className="px-5 py-3.5 font-medium">{credit.member.name}</td>
                  <td className="px-5 py-3.5 text-muted">
                    {credit.request.subject} with {credit.request.studentName}
                  </td>
                  <td className="px-5 py-3.5">{formatMinutes(credit.minutes)}</td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-muted">
                    {credit.reviewedAt ? formatDate(credit.reviewedAt) : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <form action={revokeCredit.bind(null, credit.id)}>
                      <button type="submit" className="text-red-600 hover:underline">
                        Undo
                      </button>
                    </form>
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
