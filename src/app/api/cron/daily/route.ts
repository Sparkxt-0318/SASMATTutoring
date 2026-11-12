import { prisma } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron";
import { blastIncompleteWhere } from "@/lib/blast";
import { reportEmail, sendAdminAlert, sendEmail } from "@/lib/email";
import { adminAlertEmail, requestExpiredEmail, stillLookingEmail } from "@/emails/templates";
import { formatMeeting } from "@/lib/constants";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Daily maintenance, scheduled in vercel.json (around 06:30 in Shanghai):
 *  1. Expire OPEN requests whose meeting time has already started (nobody can
 *     claim them any more), tell each student (#7), and tell the officer inbox.
 *  2. Tidy: unconfirmed requests older than a day or already past (#4), old
 *     sign-in codes and officer sign-in attempts, and claim links of requests
 *     that are no longer open (#37).
 *  3. Warn students whose session starts within 24 hours and still has no tutor (#7).
 *  4. Send ONE "needs attention" email, only if there is something to act on:
 *     requests starting within 24 hours that still have no tutor, and requests
 *     whose member emails did not all go out (#8).
 */
export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const replyTo = reportEmail() ?? undefined;

  // 1. Expire requests nobody claimed in time. One guarded statement, so a
  // cancel or assign that lands meanwhile is never overwritten, and only rows
  // this run actually changed are reported (#22).
  const expired = await prisma.tutoringRequest.updateManyAndReturn({
    where: { status: "OPEN", meetingStart: { lt: now } },
    data: { status: "EXPIRED" },
  });
  if (expired.length > 0) {
    await Promise.allSettled(
      expired.map((r) => {
        const mail = requestExpiredEmail(r);
        return sendEmail({ to: r.studentEmail, subject: mail.subject, html: mail.html, replyTo });
      }),
    );
    const summary = expired
      .map(
        (r) =>
          `• ${r.subject} for ${r.studentName} (${r.studentEmail}), wanted ${formatMeeting(r.meetingStart, r.meetingEnd)}`,
      )
      .join("\n");
    const alert = adminAlertEmail(
      `${expired.length} unclaimed request${expired.length === 1 ? "" : "s"} expired`,
      `These requests were never claimed before their meeting time and have been closed. Each student was emailed and invited to ask again:\n${summary}`,
    );
    await sendAdminAlert(alert.subject, alert.html);
  }

  // 2. Tidy.
  const yesterday = new Date(now.getTime() - DAY);
  const [unconfirmed] = await Promise.all([
    prisma.tutoringRequest.deleteMany({
      where: { status: "UNCONFIRMED", OR: [{ createdAt: { lt: yesterday } }, { meetingStart: { lt: now } }] },
    }),
    prisma.loginCode.deleteMany({ where: { createdAt: { lt: yesterday } } }),
    prisma.adminLoginAttempt.deleteMany({ where: { createdAt: { lt: yesterday } } }),
  ]);
  // A claim link is only needed while its request is open, plus the claimer's
  // own link while they hold the session. Reopening blasts fresh links.
  const tokensDeleted = await prisma.$executeRaw`
    DELETE FROM "ClaimToken" t USING "TutoringRequest" r
    WHERE t."requestId" = r."id"
      AND r."status" <> 'OPEN'
      AND NOT (r."status" = 'CLAIMED' AND t."memberId" = r."claimedById")`;

  // 3 and 4. What needs a human today?
  const in24h = new Date(now.getTime() + DAY);
  const [startingSoon, unsent] = await Promise.all([
    prisma.tutoringRequest.findMany({
      where: { status: "OPEN", meetingStart: { gt: now, lt: in24h } },
      orderBy: { meetingStart: "asc" },
    }),
    prisma.tutoringRequest.findMany({
      where: { ...blastIncompleteWhere(now), meetingStart: { gt: now } },
      orderBy: { meetingStart: "asc" },
    }),
  ]);

  // This job runs once a day, so each request is in this window exactly once.
  await Promise.allSettled(
    startingSoon.map((r) => {
      const mail = stillLookingEmail(r);
      return sendEmail({ to: r.studentEmail, subject: mail.subject, html: mail.html, replyTo });
    }),
  );

  if (startingSoon.length > 0 || unsent.length > 0) {
    const line = (r: (typeof startingSoon)[number]) =>
      `• ${r.subject} for ${r.studentName}, ${formatMeeting(r.meetingStart, r.meetingEnd)}`;
    const parts: string[] = [];
    if (startingSoon.length > 0) {
      parts.push(
        `Still no tutor, and the meeting is within 24 hours (the students were told we are still looking):\n${startingSoon.map(line).join("\n")}\nAsk members directly, or use Assign in the Requests tab.`,
      );
    }
    if (unsent.length > 0) {
      parts.push(
        `Some member emails did not go out for these requests:\n${unsent.map(line).join("\n")}\nOpen the Requests tab and press Resend blast.`,
      );
    }
    const alert = adminAlertEmail("MAT tutoring needs your attention", parts.join("\n\n"));
    await sendAdminAlert(alert.subject, alert.html);
  }

  return Response.json({
    ok: true,
    expired: expired.length,
    unconfirmedRemoved: unconfirmed.count,
    claimLinksRemoved: tokensDeleted,
    startingSoonUnclaimed: startingSoon.length,
    emailsNotSent: unsent.length,
  });
}
