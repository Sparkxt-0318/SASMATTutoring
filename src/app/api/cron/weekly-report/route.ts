import { cronAuthorized } from "@/lib/cron";
import { getDigestData } from "@/lib/stats";
import { sendEmail } from "@/lib/email";
import { weeklyDigestEmail } from "@/emails/templates";

/**
 * Weekly hours digest, scheduled in vercel.json for Monday 01:00 UTC
 * (09:00 in Shanghai). Sends ONLY to REPORT_EMAIL.
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
  const digest = await getDigestData(weekAgo);
  const { subject, html } = weeklyDigestEmail(digest);
  await sendEmail({ to, subject, html });

  return Response.json({
    ok: true,
    totalMinutesAllTime: digest.totalMinutesAllTime,
    weekMinutes: digest.weekMinutes,
    awaitingCreditCount: digest.awaitingCreditCount,
  });
}
