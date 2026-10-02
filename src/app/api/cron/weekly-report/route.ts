import { cronAuthorized } from "@/lib/cron";
import { getDigestData } from "@/lib/stats";
import { sendEmail } from "@/lib/email";
import { buildHoursCsv, buildMembersCsv, buildSessionsCsv } from "@/lib/exports";
import { weeklyDigestEmail } from "@/emails/templates";

/**
 * Weekly report and backup, scheduled in vercel.json for Friday 12:00 UTC
 * (Friday 20:00 in Shanghai). Sends ONLY to REPORT_EMAIL: the hours summary
 * plus three CSV files (members, every session, hours) as a backup.
 */
export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const to = process.env.REPORT_EMAIL;
  if (!to) {
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
  await sendEmail({
    to,
    subject,
    html,
    attachments: [
      { filename: `mat-members-${date}.csv`, content: members },
      { filename: `mat-all-sessions-${date}.csv`, content: sessions },
      { filename: `mat-hours-${date}.csv`, content: hours },
    ],
  });

  return Response.json({
    ok: true,
    totalMinutesAllTime: digest.totalMinutesAllTime,
    weekMinutes: digest.weekMinutes,
    awaitingCreditCount: digest.awaitingCreditCount,
    attachments: 3,
  });
}
