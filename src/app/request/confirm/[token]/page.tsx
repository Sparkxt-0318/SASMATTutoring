import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { confirmRequest } from "@/lib/actions/requests";
import { Button } from "@/components/Button";
import { formatMeeting, isPast } from "@/lib/constants";
import { TokenShell, TokenCard, InvalidTokenCard } from "@/components/TokenShell";

export const metadata: Metadata = {
  title: "Your tutoring request",
  robots: { index: false, follow: false },
};

// The member email blast runs after the confirm response, within this limit (seconds).
export const maxDuration = 60;

// The student's link from the confirmation email (#4). ZERO writes on GET (email
// scanners open links): confirming is the POSTed form below. Afterwards the same
// link shows how the request is going.
export default async function ConfirmRequestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const request = await prisma.tutoringRequest.findUnique({
    where: { confirmToken: token },
    include: { claimedBy: { select: { name: true } } },
  });
  if (!request) return <InvalidTokenCard />;
  const when = formatMeeting(request.meetingStart, request.meetingEnd);

  if (request.status === "UNCONFIRMED") {
    if (isPast(request.meetingStart)) {
      return (
        <TokenShell>
          <TokenCard
            icon="⏰"
            title="This time has passed"
            body="The request was never confirmed, and its meeting time has passed. Send a new request with another time."
            linkHref="/request"
            linkLabel="Request a tutor"
          />
        </TokenShell>
      );
    }
    return (
      <TokenShell>
        <div className="rise-in w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight">Confirm your request</h1>
          <p className="mt-3 leading-relaxed text-muted">
            {request.subject}, {when} (Shanghai time). Once you confirm, every Mu Alpha Theta member is
            told, and you get an email as soon as one of them claims it.
          </p>
          <form action={confirmRequest.bind(null, token)} className="mt-7">
            <Button type="submit" size="lg" className="w-full">
              Confirm my request
            </Button>
          </form>
          <p className="mt-3 text-xs text-faint">Did not ask for tutoring? Close this page and nothing happens.</p>
        </div>
      </TokenShell>
    );
  }

  const cards = {
    OPEN: {
      icon: "✓",
      title: "Confirmed. We are finding you a tutor",
      body: `Every member has been told about your ${request.subject} session (${when}). You will get an email introducing your tutor as soon as one claims it.`,
    },
    CLAIMED: {
      icon: "🎉",
      title: `Your tutor is ${request.claimedBy?.name.split(" ")[0] ?? "on the way"}`,
      body: `Your ${request.subject} session (${when}) has a tutor. Check your school inbox for the intro email with their contact details.`,
    },
    COMPLETED: { icon: "✓", title: "Session done", body: `Your ${request.subject} session (${when}) is complete. Thanks for using MAT tutoring.` },
    CANCELLED: {
      icon: "🗓️",
      title: "This request was cancelled",
      body: "A club officer cancelled this request. If you still need help, send a new one.",
    },
    EXPIRED: {
      icon: "🗓️",
      title: "No tutor could make that time",
      body: "Sorry, nobody could take this session before it started. Please ask again with another time.",
    },
  } as const;
  const card = cards[request.status];
  const askAgain = request.status === "CANCELLED" || request.status === "EXPIRED";
  return (
    <TokenShell>
      <TokenCard
        icon={card.icon}
        title={card.title}
        body={card.body}
        linkHref={askAgain ? "/request" : undefined}
        linkLabel={askAgain ? "Request a tutor" : undefined}
      />
    </TokenShell>
  );
}
