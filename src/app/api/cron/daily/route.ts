import { prisma } from "@/lib/db";
import { sendEmail, sendAdminAlert } from "@/lib/email";
import { adminAlertEmail, completionReminderEmail } from "@/emails/templates";
import { COMPLETION_REMINDER_DAYS, REQUEST_EXPIRY_DAYS } from "@/lib/constants";

/**
 * Daily maintenance — scheduled in vercel.json:
 *  1. Expire OPEN requests older than REQUEST_EXPIRY_DAYS (and tell the officer).
 *  2. Remind tutors who claimed a session over COMPLETION_REMINDER_DAYS ago
 *     but haven't logged it yet.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = Date.now();
  const expiryCutoff = new Date(now - REQUEST_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const reminderCutoff = new Date(now - COMPLETION_REMINDER_DAYS * 24 * 60 * 60 * 1000);

  // 1. Auto-expire stale OPEN requests.
  const toExpire = await prisma.tutoringRequest.findMany({
    where: { status: "OPEN", createdAt: { lt: expiryCutoff } },
  });
  if (toExpire.length > 0) {
    await prisma.tutoringRequest.updateMany({
      where: { id: { in: toExpire.map((r) => r.id) } },
      data: { status: "EXPIRED" },
    });
    const summary = toExpire
      .map((r) => `• ${r.subject} for ${r.studentName} (${r.studentEmail})`)
      .join("\n");
    const alert = adminAlertEmail(
      `${toExpire.length} unclaimed request${toExpire.length === 1 ? "" : "s"} expired`,
      `These requests sat unclaimed for ${REQUEST_EXPIRY_DAYS} days and were auto-expired:\n${summary}\nYou may want to follow up with the students.`,
    );
    await sendAdminAlert(alert.subject, alert.html);
  }

  // 2. Nudge tutors with unlogged sessions. The one-day window means each
  // session gets exactly one reminder (the day it crosses the threshold),
  // not a nag every day after.
  const windowStart = new Date(now - (COMPLETION_REMINDER_DAYS + 1) * 24 * 60 * 60 * 1000);
  const unlogged = await prisma.tutoringRequest.findMany({
    where: {
      status: "CLAIMED",
      claimedAt: { lt: reminderCutoff, gte: windowStart },
      credit: null,
      claimedById: { not: null },
    },
    include: { claimedBy: true, claimTokens: true },
  });

  let reminded = 0;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  for (const req of unlogged) {
    const tutor = req.claimedBy;
    const token = req.claimTokens.find((t) => t.memberId === req.claimedById);
    if (!tutor || !token) continue;
    try {
      const { subject, html } = completionReminderEmail(
        req,
        tutor.name,
        `${appUrl}/complete/${token.token}`,
      );
      await sendEmail({ to: tutor.email, subject, html });
      reminded += 1;
    } catch (err) {
      console.error(`Completion reminder failed for request ${req.id}:`, err);
    }
  }

  return Response.json({ ok: true, expired: toExpire.length, reminded });
}
