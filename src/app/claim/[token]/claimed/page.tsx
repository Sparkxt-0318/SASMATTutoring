import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ProgressCard } from "@/components/ProgressGrid";
import { formatMeeting, formatMinutes, meetingMinutes } from "@/lib/constants";
import { getMemberMinutes } from "@/lib/stats";
import { TokenShell, InvalidTokenCard } from "@/components/TokenShell";

export const metadata: Metadata = {
  title: "Request claimed",
  robots: { index: false, follow: false },
};

export default async function ClaimedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const claimToken = await prisma.claimToken.findUnique({
    where: { token },
    include: { request: true, member: true },
  });

  // Only the winning member's token may view the student's contact details.
  if (!claimToken || claimToken.request.claimedById !== claimToken.memberId) {
    return <InvalidTokenCard />;
  }

  const { request, member } = claimToken;
  const progress = <ProgressCard minutes={await getMemberMinutes(member.id)} />;

  return (
    <TokenShell footer={progress}>
      <div className="rise-in w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm sm:p-10">
        <div className="text-4xl" aria-hidden>
          🎉
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">It&rsquo;s yours!</h1>
        <p className="mt-3 leading-relaxed text-muted">
          {`Email ${request.studentName.split(" ")[0]} within 24 hours to confirm where to meet. `}
          We&rsquo;ve also sent you both an intro email.
        </p>

        <dl className="mt-6 space-y-4 rounded-xl bg-surface p-5 text-left">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Meeting time</dt>
            <dd className="mt-0.5 font-medium">{formatMeeting(request.meetingStart, request.meetingEnd)}</dd>
            <dd className="text-xs text-muted">
              {formatMinutes(meetingMinutes(request.meetingStart, request.meetingEnd))} · Shanghai time
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Student</dt>
            <dd className="mt-0.5 font-medium">{request.studentName}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Email</dt>
            <dd className="mt-0.5">
              <a href={`mailto:${request.studentEmail}`} className="text-accent hover:underline">
                {request.studentEmail}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
              Course · Grade
            </dt>
            <dd className="mt-0.5">
              {request.subject} · Grade {request.gradeLevel}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Topic</dt>
            <dd className="mt-0.5 whitespace-pre-wrap leading-relaxed">{request.topic}</dd>
          </div>
        </dl>

        <p className="mt-6 text-sm text-muted">
          Nothing to log afterwards — officers record tutoring hours every weekend.
        </p>
      </div>
    </TokenShell>
  );
}
