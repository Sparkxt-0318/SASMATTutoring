import { prisma } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron";
import { sendAdminAlert } from "@/lib/email";
import { adminAlertEmail } from "@/emails/templates";
import { formatMeeting } from "@/lib/constants";

/**
 * Daily maintenance, scheduled in vercel.json (06:30 in Shanghai):
 *  1. Expire OPEN requests whose meeting time has already started (nobody can
 *     claim them any more) and tell the officer inbox so they can follow up.
 *  2. Send ONE "needs attention" email, only if there is something to act on:
 *     requests starting within 24 hours that still have no tutor, and requests
 *     whose member emails did not all go out.
 */
export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();

  // 1. Expire requests nobody claimed in time.
  const toExpire = await prisma.tutoringRequest.findMany({
    where: { status: "OPEN", meetingStart: { lt: now } },
  });
  if (toExpire.length > 0) {
    await prisma.tutoringRequest.updateMany({
      where: { id: { in: toExpire.map((r) => r.id) } },
      data: { status: "EXPIRED" },
    });
    const summary = toExpire
      .map(
        (r) =>
          `• ${r.subject} for ${r.studentName} (${r.studentEmail}), wanted ${formatMeeting(r.meetingStart, r.meetingEnd)}`,
      )
      .join("\n");
    const alert = adminAlertEmail(
      `${toExpire.length} unclaimed request${toExpire.length === 1 ? "" : "s"} expired`,
      `These requests were never claimed before their meeting time and have been closed:\n${summary}\nYou may want to follow up with the students.`,
    );
    await sendAdminAlert(alert.subject, alert.html);
  }

  // Tidy: sign-in codes are useless after a day, so do not keep them.
  await prisma.loginCode.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
  });

  // 2. What needs a human today?
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const [startingSoon, unsent] = await Promise.all([
    prisma.tutoringRequest.findMany({
      where: { status: "OPEN", meetingStart: { gt: now, lt: in24h } },
      orderBy: { meetingStart: "asc" },
    }),
    prisma.tutoringRequest.findMany({
      where: {
        status: "OPEN",
        meetingStart: { gt: now },
        createdAt: { lt: fifteenMinAgo },
        claimTokens: { some: { emailedAt: null } },
      },
      orderBy: { meetingStart: "asc" },
    }),
  ]);

  if (startingSoon.length > 0 || unsent.length > 0) {
    const line = (r: (typeof startingSoon)[number]) =>
      `• ${r.subject} for ${r.studentName}, ${formatMeeting(r.meetingStart, r.meetingEnd)}`;
    const parts: string[] = [];
    if (startingSoon.length > 0) {
      parts.push(
        `Still no tutor, and the meeting is within 24 hours:\n${startingSoon.map(line).join("\n")}\nAsk members directly, or use Assign in the Requests tab.`,
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
    expired: toExpire.length,
    startingSoonUnclaimed: startingSoon.length,
    emailsNotSent: unsent.length,
  });
}
