import { cronAuthorized } from "@/lib/cron";
import { getDigestData } from "@/lib/stats";
import { sendEmail, weeklyReportRecipients } from "@/lib/email";
import { buildHoursCsv, buildMembersCsv, buildSessionsCsv } from "@/lib/exports";
import { weeklyDigestEmail } from "@/emails/templates";

/**
 * Weekly report and backup, scheduled in vercel.json for Friday 12:00 UTC
 * (Friday 20:00 in Shanghai). Sends ONLY to the weekly report list (REPORT_EMAIL
 * plus WEEKLY_REPORT_EMAILS): the hours summary plus three CSV backups.
 */
export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const recipients = weeklyReportRecipients();
  if (recipients.length === 0) {
    return Response.json({ ok: false, error: "REPORT_EMAIL is not set" }, { status: 500 });
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [digest, members, sessions, hours] = await Promise.all([
    getDigestData(weekAgo),
    buildMembersCsv(),
    buildSessionsCsv(),
    buildHoursCsv(),
  ]);
  const { subject, html } = weeklyDigestEmail(digest);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
  const attachments = [
    { filename: `mat-members-${date}.csv`, content: members },
    { filename: `mat-all-sessions-${date}.csv`, content: sessions },
    { filename: `mat-hours-${date}.csv`, content: hours },
  ];
  // One email per person (not a shared To: line), and a failure to one never blocks the rest.
  const results = await Promise.allSettled(
    recipients.map((to) => sendEmail({ to, subject, html, attachments })),
  );
  const failed = recipients.filter((_, i) => results[i].status === "rejected");
  if (failed.length === recipients.length) {
    return Response.json({ ok: false, error: "Weekly report could not be sent to anyone" }, { status: 500 });
  }

  return Response.json({
    ok: true,
    totalMinutesAllTime: digest.totalMinutesAllTime,
    weekMinutes: digest.weekMinutes,
    awaitingCreditCount: digest.awaitingCreditCount,
    attachments: 3,
    sentTo: recipients.length - failed.length,
    failedTo: failed,
  });
}
