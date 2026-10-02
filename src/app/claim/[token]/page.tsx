import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { claimRequest } from "@/lib/actions/claims";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { ProgressCard } from "@/components/ProgressGrid";
import { formatDate, formatMeeting, formatMinutes, isPast, meetingMinutes } from "@/lib/constants";
import { getMemberMinutes } from "@/lib/stats";
import { TokenShell, TokenCard, InvalidTokenCard } from "@/components/TokenShell";

export const metadata: Metadata = {
  title: "Claim request",
  robots: { index: false, follow: false },
};

// This page performs ZERO writes on GET: email scanners that prefetch links
// can never claim a request. Claiming happens only via the POSTed form below.
export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const claimToken = await prisma.claimToken.findUnique({
    where: { token },
    include: {
      member: true,
      request: { include: { claimedBy: true } },
    },
  });

  if (!claimToken) {
    return <InvalidTokenCard />;
  }

  const { request, member } = claimToken;

  if (!member.active) {
    return (
      <TokenShell>
        <TokenCard
          icon="🪪"
          title="You're not on the active roster"
          body="This claim link belongs to a deactivated member account. If that seems wrong, contact a club officer."
        />
      </TokenShell>
    );
  }

  const progress = <ProgressCard minutes={await getMemberMinutes(member.id)} />;

  if (request.status === "CLAIMED" || request.status === "COMPLETED") {
    const wasMe = request.claimedById === member.id;
    return (
      <TokenShell footer={progress}>
        <TokenCard
          icon={wasMe ? "🎉" : "⚡️"}
          title={wasMe ? "You claimed this one" : `Claimed by ${request.claimedBy?.name ?? "another member"}`}
          body={
            wasMe
              ? "This request is yours. Check your email for the student's contact details."
              : "Someone beat you to it this time. The next request could be yours."
          }
          linkHref={wasMe ? `/claim/${token}/claimed` : undefined}
          linkLabel={wasMe ? "View student details" : undefined}
        />
      </TokenShell>
    );
  }

  if (request.status === "CANCELLED" || request.status === "EXPIRED") {
    return (
      <TokenShell footer={progress}>
        <TokenCard
          icon="🗓️"
          title={request.status === "CANCELLED" ? "This request was cancelled" : "This request expired"}
          body="No action needed. Thanks for checking, and keep an eye out for the next one."
        />
      </TokenShell>
    );
  }

  // Still OPEN, but the meeting time has already started.
  if (isPast(request.meetingStart)) {
    return (
      <TokenShell footer={progress}>
        <TokenCard
          icon="⏰"
          title="This meeting time has passed"
          body="Nobody claimed this request before it was due to start, so it can no longer be claimed. Keep an eye out for the next one."
        />
      </TokenShell>
    );
  }

  const claimWithToken = claimRequest.bind(null, token);
  const length = formatMinutes(meetingMinutes(request.meetingStart, request.meetingEnd));

  return (
    <TokenShell footer={progress}>
      <div className="rise-in w-full max-w-md rounded-2xl bg-white p-8 shadow-sm sm:p-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Tutoring request</h1>
          <StatusBadge status={request.status} />
        </div>
        <p className="mt-2 text-sm text-muted">
          Hi {member.name.split(" ")[0]}, first member to confirm gets it.
        </p>

        <dl className="mt-6 space-y-4 rounded-xl bg-surface p-5">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Meeting time</dt>
            <dd className="mt-0.5 font-medium">{formatMeeting(request.meetingStart, request.meetingEnd)}</dd>
            <dd className="text-xs text-muted">{length} · Shanghai time</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Course</dt>
            <dd className="mt-0.5 font-medium">{request.subject}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Grade</dt>
            <dd className="mt-0.5">{request.gradeLevel}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Topic</dt>
            <dd className="mt-0.5 whitespace-pre-wrap leading-relaxed">{request.topic}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Requested</dt>
            <dd className="mt-0.5">{formatDate(request.createdAt)}</dd>
          </div>
        </dl>

        <form action={claimWithToken} className="mt-7">
          <Button type="submit" size="lg" className="w-full">
            Claim this request
          </Button>
        </form>
        <p className="mt-3 text-center text-xs text-faint">
          Only claim it if you can make this time. Claiming shares the student&rsquo;s contact info
          with you and introduces you both by email.
        </p>
      </div>
    </TokenShell>
  );
}
