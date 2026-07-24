import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { TokenShell, TokenCard, InvalidTokenCard } from "@/components/TokenShell";
import { SessionForm } from "./SessionForm";
import { formatMinutes } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Log your session",
  robots: { index: false, follow: false },
};

export default async function CompletePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const claimToken = await prisma.claimToken.findUnique({
    where: { token },
    include: { request: { include: { credit: true } }, member: true },
  });

  if (!claimToken || claimToken.request.claimedById !== claimToken.memberId) {
    return <InvalidTokenCard />;
  }

  const { request, member } = claimToken;

  if (request.credit) {
    const approved = request.credit.status === "APPROVED";
    return (
      <TokenShell>
        <TokenCard
          icon={approved ? "✅" : "⏳"}
          title="Session logged"
          body={
            approved
              ? `Your ${formatMinutes(request.credit.minutes)} session with ${request.studentName} has been approved. Nice work!`
              : `Your ${formatMinutes(request.credit.minutes)} session with ${request.studentName} is waiting for officer approval. Nothing more to do.`
          }
        />
      </TokenShell>
    );
  }

  if (request.status === "CANCELLED" || request.status === "EXPIRED") {
    return (
      <TokenShell>
        <TokenCard
          icon="🗓️"
          title="This request is no longer active"
          body="It was cancelled or expired before a session was logged. If you did tutor this student, contact an officer to record your hours."
        />
      </TokenShell>
    );
  }

  return (
    <TokenShell>
      <div className="rise-in w-full max-w-md rounded-2xl bg-white p-8 shadow-sm sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">Log your session</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Hi {member.name.split(" ")[0]} — how long did you tutor {request.studentName.split(" ")[0]}{" "}
          in {request.subject}? An officer will approve it and it&rsquo;ll count toward your hours.
        </p>
        <div className="mt-6">
          <SessionForm token={token} />
        </div>
      </div>
    </TokenShell>
  );
}
