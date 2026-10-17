import { cronAuthorized } from "@/lib/cron";
import { getDigestData } from "@/lib/stats";
import { reportEmail, sendAdminAlert, sendEmail } from "@/lib/email";
import { buildBackupJson } from "@/lib/backup";
import { buildHoursCsv, buildMembersCsv, buildSessionsCsv } from "@/lib/exports";
import { adminAlertEmail, weeklyDigestEmail } from "@/emails/templates";

/**
 * Weekly report and backup, scheduled in vercel.json for Friday 12:00 UTC
 * (Friday 20:00 in Shanghai). Sends ONLY to REPORT_EMAIL: the hours summary
 * plus the complete JSON backup (restorable with `npm run restore`) and three
 * readable CSVs (members, every session, hours). Emailed files never include
 * survey answers. If anything fails, the alert list is told and the route returns 500.
 */
export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const to = reportEmail();
  if (!to) {
    return Response.json({ ok: false, error: "REPORT_EMAIL is not set" }, { status: 500 });
  }

  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [digest, backup, members, sessions, hours] = await Promise.all([
      getDigestData(weekAgo),
      buildBackupJson({ includeSurvey: false }),
      buildMembersCsv(),
      buildSessionsCsv({ includeSurvey: false }),
      buildHoursCsv(),
    ]);
    const { subject, html } = weeklyDigestEmail(digest);
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
    const attachments = [
      { filename: `mat-backup-${date}.json`, content: backup },
      { filename: `mat-members-${date}.csv`, content: members },
      { filename: `mat-all-sessions-${date}.csv`, content: sessions },
      { filename: `mat-hours-${date}.csv`, content: hours },
    ];
    await sendEmail({ to, subject, html, attachments });

    return Response.json({
      ok: true,
      totalMinutesAllTime: digest.totalMinutesAllTime,
      weekMinutes: digest.weekMinutes,
      awaitingCreditCount: digest.awaitingCreditCount,
      attachments: attachments.length,
    });
  } catch (err) {
    console.error("Weekly report failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    const alert = adminAlertEmail(
      "Weekly report failed",
      `This week's hours report and backup files could not be sent to ${to}.\n\nError: ${message}\n\n` +
        "You can download a backup any time from the admin Leaderboard (Full backup).",
    );
    await sendAdminAlert(alert.subject, alert.html);
    return Response.json({ ok: false, error: "Weekly report failed" }, { status: 500 });
  }
}
