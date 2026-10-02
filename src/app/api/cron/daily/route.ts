import { prisma } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron";
import { sendAdminAlert } from "@/lib/email";
import { adminAlertEmail } from "@/emails/templates";
import { formatMeeting } from "@/lib/constants";

/**
 * Daily maintenance, scheduled in vercel.json. Expires OPEN requests whose
 * meeting time has already started (nobody can claim them any more) and tells
 * the officer inbox so they can follow up with those students.
 */
export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const toExpire = await prisma.tutoringRequest.findMany({
    where: { status: "OPEN", meetingStart: { lt: new Date() } },
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

  return Response.json({ ok: true, expired: toExpire.length });
}
