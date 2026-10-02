import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/member-auth";
import { claimRequestAsMember } from "@/lib/actions/member";
import { getMemberMinutes } from "@/lib/stats";
import { ProgressGrid } from "@/components/ProgressGrid";
import { Button } from "@/components/Button";
import { formatMeeting, formatMinutes, isPast, meetingMinutes } from "@/lib/constants";

export const metadata: Metadata = { title: "My dashboard" };

// Kept out of the component body so the render stays pure.
async function loadDashboard(memberId: string) {
  const [minutes, creditedCount, openRequests, sessions] = await Promise.all([
    getMemberMinutes(memberId),
    prisma.creditLog.count({ where: { memberId, status: "APPROVED" } }),
    prisma.tutoringRequest.findMany({
      where: { status: "OPEN", meetingStart: { gt: new Date() } },
      orderBy: { meetingStart: "asc" },
    }),
    prisma.tutoringRequest.findMany({
      where: { claimedById: memberId, status: { in: ["CLAIMED", "COMPLETED"] } },
      include: { credit: true },
    }),
  ]);

  const credited = sessions
    .filter((s) => s.credit)
    .sort((a, b) => b.meetingStart.getTime() - a.meetingStart.getTime());
  const active = sessions
    .filter((s) => !s.credit)
    .sort((a, b) => a.meetingStart.getTime() - b.meetingStart.getTime())
    .map((s) => ({ ...s, ended: isPast(s.meetingEnd) }));

  return { minutes, creditedCount, openRequests, active, credited };
}

const NOTICES: Record<string, { text: string; className: string }> = {
  claimed: {
    text: "It's yours! The student's contact details are under My sessions, and we emailed you both an intro.",
    className: "bg-green-50 text-green-700",
  },
  taken: {
    text: "Someone else claimed that one first. Another request will come along soon.",
    className: "bg-amber-50 text-amber-700",
  },
};

export default async function MemberDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const member = await requireMember();
  const { notice } = await searchParams;
  const { minutes, creditedCount, openRequests, active, credited } = await loadDashboard(member.id);
  const banner = notice ? NOTICES[notice] : undefined;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Hi, {member.name.split(" ")[0]}.
        </h1>
        <p className="mt-1 text-sm text-muted">Your tutoring hours, open requests, and sessions.</p>
      </div>

      {banner && <p className={`rounded-2xl px-5 py-4 text-sm ${banner.className}`}>{banner.text}</p>}

      <section className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Your progress</h2>
          <p className="text-xs text-muted">
            {creditedCount} credited session{creditedCount === 1 ? "" : "s"}
          </p>
        </div>
        <ProgressGrid minutes={minutes} />
        <p className="mt-4 text-xs text-faint">
          Officers record hours once a week, so new sessions show up here after the weekend review.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">
          Open requests{" "}
          {openRequests.length > 0 && (
            <span className="ml-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-accent">
              {openRequests.length}
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-muted">
          First member to confirm gets it. Only claim a request if you can make the time.
        </p>
        {openRequests.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-muted">
              No open requests right now. You will also get an email when a new one arrives.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {openRequests.map((request) => (
              <div key={request.id} className="flex flex-col rounded-2xl bg-white p-6 shadow-sm">
                <p className="font-semibold tracking-tight">{request.subject}</p>
                <p className="text-xs text-muted">Grade {request.gradeLevel}</p>
                <p className="mt-3 text-sm font-medium">
                  {formatMeeting(request.meetingStart, request.meetingEnd)}
                </p>
                <p className="text-xs text-muted">
                  {formatMinutes(meetingMinutes(request.meetingStart, request.meetingEnd))} ·
                  Shanghai time
                </p>
                <p className="mt-3 line-clamp-4 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                  {request.topic}
                </p>
                <form action={claimRequestAsMember.bind(null, request.id)} className="mt-5">
                  <Button type="submit" className="w-full">
                    Claim this request
                  </Button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">My sessions</h2>
        {active.length === 0 && credited.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-muted">You haven&rsquo;t claimed a session yet.</p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {active.map((session) => (
              <div key={session.id} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">
                    {session.subject}{" "}
                    <span className="font-normal text-muted">with {session.studentName}</span>
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      session.ended ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-accent"
                    }`}
                  >
                    {session.ended ? "Awaiting credit" : "Upcoming"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatMeeting(session.meetingStart, session.meetingEnd)} · Grade{" "}
                  {session.gradeLevel}
                </p>
                <p className="mt-2 text-sm">
                  <a href={`mailto:${session.studentEmail}`} className="text-accent hover:underline">
                    {session.studentEmail}
                  </a>
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                  {session.topic}
                </p>
              </div>
            ))}
            {credited.map((session) => (
              <div key={session.id} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">
                    {session.subject}{" "}
                    <span className="font-normal text-muted">with {session.studentName}</span>
                  </p>
                  <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    Credited {formatMinutes(session.credit?.minutes ?? 0)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatMeeting(session.meetingStart, session.meetingEnd)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
