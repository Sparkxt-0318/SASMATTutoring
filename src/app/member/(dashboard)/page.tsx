import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/member-auth";
import { claimRequestAsMember, releaseMyClaim } from "@/lib/actions/member";
import { getMemberMinutes } from "@/lib/stats";
import { senderAddress } from "@/lib/email";
import { ProgressGrid } from "@/components/ProgressGrid";
import { Button } from "@/components/Button";
import { CreditsCard } from "@/components/CreditsCard";
import {
  MEMBER_HOURS_GOAL,
  creditsUrl,
  formatMeeting,
  formatMinutes,
  isPast,
  formatHours,
  meetingMinutes,
} from "@/lib/constants";

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
    text: "It's yours! Email the student to confirm where to meet. Their details are under My sessions, and we emailed you both an intro.",
    className: "bg-green-50 text-green-700",
  },
  released: {
    text: "Done. The session went back to the other members and the student has been told.",
    className: "bg-green-50 text-green-700",
  },
  "cannot-release": {
    text: "That session can't be given back any more, because it has already started or isn't yours.",
    className: "bg-amber-50 text-amber-700",
  },
  taken: {
    text: "Someone else claimed that one first. Another request will come along soon.",
    className: "bg-amber-50 text-amber-700",
  },
  overlap: {
    text: "You already have a session at that time, so this one was not claimed. Leave it for another member.",
    className: "bg-amber-50 text-amber-700",
  },
};

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: "Get an email",
    body: "When a student asks for help, every member gets an email with the course, topic and meeting time.",
  },
  {
    title: "Claim it",
    body: "Press Claim in the email, or claim it here under Open requests. The first member to confirm gets it.",
  },
  {
    title: "Meet and tutor",
    body: "Email the student to confirm where to meet. Officers record your hours every week, so there is nothing to log.",
  },
];

/** The three steps, open for new members and folded away once they have tutored. */
function HowItWorks({ sender, folded }: { sender: string; folded: boolean }) {
  const steps = (
    <>
      <ol className="grid gap-5 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3 sm:flex-col">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
              {i + 1}
            </span>
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-5 rounded-xl bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
        Request emails come from <span className="font-medium text-foreground">{sender}</span>. Add
        it to your contacts so they don&rsquo;t end up in Junk.
      </p>
    </>
  );

  if (folded) {
    return (
      <details className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <summary className="cursor-pointer font-semibold tracking-tight">How tutoring works</summary>
        <div className="mt-5">{steps}</div>
      </details>
    );
  }
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="mb-5 text-lg font-semibold tracking-tight">How tutoring works</h2>
      {steps}
    </section>
  );
}

export default async function MemberDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const member = await requireMember();
  const { notice } = await searchParams;
  const { minutes, creditedCount, openRequests, active, credited } = await loadDashboard(member.id);
  const banner = notice ? NOTICES[notice] : undefined;
  const creditsLink = creditsUrl();
  const upcoming = active.filter((s) => !s.ended).length;
  const hasTutored = active.length + credited.length > 0;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Hi, {member.name.split(" ")[0]}.
        </h1>
        <p className="mt-1 text-sm text-muted">
          {plural(openRequests.length, "open request")} · {plural(upcoming, "upcoming session")} ·{" "}
          {formatHours(minutes)} of {MEMBER_HOURS_GOAL} hours
        </p>
      </div>

      {banner && <p role="status" className={`rounded-2xl px-5 py-4 text-sm ${banner.className}`}>{banner.text}</p>}

      {!hasTutored && <HowItWorks sender={senderAddress()} folded={false} />}

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
            <p className="font-medium">No open requests right now.</p>
            <p className="mt-1 text-sm text-muted">
              We&rsquo;ll email you as soon as a student asks for help.
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
                {/* Two steps, so a stray tap while scrolling can't claim a session. */}
                <details className="group mt-5">
                  <summary className="flex cursor-pointer list-none items-center justify-center rounded-full bg-accent px-6 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-accent-hover group-open:bg-surface group-open:text-foreground group-open:hover:bg-hairline/60 [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">Claim this request</span>
                    <span className="hidden group-open:inline">Not now</span>
                  </summary>
                  <div className="mt-3 rounded-xl bg-surface p-4">
                    <p className="text-sm leading-relaxed">
                      Can you make{" "}
                      <span className="font-medium">
                        {formatMeeting(request.meetingStart, request.meetingEnd)}
                      </span>
                      ? You&rsquo;ll get the student&rsquo;s email to arrange where to meet.
                    </p>
                    <form action={claimRequestAsMember.bind(null, request.id)} className="mt-3">
                      <Button type="submit" className="w-full">
                        Yes, I can make it
                      </Button>
                    </form>
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">My sessions</h2>
        {!hasTutored ? (
          <div className="mt-4 rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-medium">No sessions yet.</p>
            <p className="mt-1 text-sm text-muted">
              Sessions you claim show up here, with the student&rsquo;s email and meeting time.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {active.map((session) => (
              <div key={session.id} className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
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
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                  {session.topic}
                </p>
                {!session.ended && (
                  <>
                    <a
                      href={`mailto:${session.studentEmail}?subject=${encodeURIComponent(
                        `MAT tutoring: ${session.subject}, ${formatMeeting(session.meetingStart, session.meetingEnd)}`,
                      )}`}
                      className="mt-4 flex w-full items-center justify-center rounded-full bg-accent px-6 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-accent-hover sm:w-auto sm:inline-flex"
                    >
                      Email {session.studentName.split(" ")[0]}
                    </a>
                    <p className="mt-2 text-xs text-muted">
                      {session.studentEmail} · Confirm where to meet.
                    </p>
                    <details className="mt-4 text-sm">
                      <summary className="cursor-pointer text-muted hover:text-foreground">
                        Can&rsquo;t make it anymore?
                      </summary>
                      <form
                        action={releaseMyClaim.bind(null, session.id)}
                        className="mt-3 flex flex-wrap items-center gap-3"
                      >
                        <p className="text-muted">
                          This gives the session back to all members and lets the student know.
                        </p>
                        <button
                          type="submit"
                          className="rounded-full bg-surface px-4 py-1.5 font-medium text-red-600 transition-colors hover:bg-hairline/60"
                        >
                          Yes, give it back
                        </button>
                      </form>
                    </details>
                  </>
                )}
              </div>
            ))}
            {credited.map((session) => (
              <div key={session.id} className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
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

      <section className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Your progress</h2>
          <p className="text-xs text-muted">{plural(creditedCount, "credited session")}</p>
        </div>
        <ProgressGrid minutes={minutes} />
        <p className="mt-4 text-xs text-faint">
          Officers record hours once a week, so new sessions show up here after the weekend review.
        </p>
      </section>

      {creditsLink && <CreditsCard href={creditsLink} />}

      {hasTutored && <HowItWorks sender={senderAddress()} folded />}
    </div>
  );
}
