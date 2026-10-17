import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { emailStatus } from "@/lib/email";
import { BULK_SHARE, sentToday } from "@/lib/email-budget";
import { otpAllowedEmails } from "@/lib/login-code";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/constants";
import { TestEmailForm } from "./TestEmailForm";

export const metadata: Metadata = { title: "Email" };

// Reads settings on every visit so it always shows what is live.
export const dynamic = "force-dynamic";

export default async function AdminEmailPage() {
  await requireAdmin();
  const status = emailStatus();
  const otp = otpAllowedEmails();
  const otpRawSet = Boolean(process.env.OTP_LOGIN_EMAILS?.trim());
  const [activeMembers, sent] = await Promise.all([prisma.member.count({ where: { active: true } }), sentToday()]);
  const weakPassword = (process.env.ADMIN_PASSWORD ?? "").length < 12;
  const usingResendTestSender =
    status.provider === "resend" && status.from.toLowerCase().includes("onboarding@resend.dev");

  const siteUrl = appUrl();
  const linksBroken = siteUrl.includes("localhost") && Boolean(process.env.VERCEL);

  const rows: Array<[string, string]> = [
    ["Sending method", status.provider === "smtp" ? "SMTP (a normal mailbox)" : "Resend"],
    ["Sent from", status.from],
    ...(status.smtpHost ? ([["Mail server", status.smtpHost]] as Array<[string, string]>) : []),
    ["Weekly report and backup go to", status.reportEmail ?? "(not set)"],
    [
      "Alerts go to",
      status.alertRecipients.length > 0 ? status.alertRecipients.join(", ") : "(nobody: set REPORT_EMAIL)",
    ],
    ["Who can sign in as a member", `Every active member on the Members tab (${activeMembers})`],
    [
      "Extra sign-in addresses (OTP_LOGIN_EMAILS)",
      otp.length > 0
        ? otp.join(", ")
        : otpRawSet
          ? "Set, but no valid email address in it. Check it for typos."
          : "None",
    ],
    [
      "Claim links in emails open",
      linksBroken ? `${siteUrl}, which members cannot open. Set APP_URL in Vercel to this site's address.` : siteUrl,
    ],
    [
      "Sent today (UTC)",
      `${sent} of ${status.dailyLimit} (member request emails pause at ${Math.floor(status.dailyLimit * BULK_SHARE)}; set EMAIL_DAILY_LIMIT to change)`,
    ],
    ["Dry run", status.dryRun ? "On: nothing is really sent" : "Off"],
    [
      "Test override",
      status.override ? `On: every email goes to ${status.override}` : "Off: emails go to the real recipients",
    ],
  ];

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Email</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Check how the site sends email and send a test. If a test fails, the message under it says
        why and what to do next.
      </p>

      {usingResendTestSender && (
        <div className="mt-6 rounded-2xl bg-amber-50 p-5 text-sm text-amber-700">
          <p className="font-semibold">Email is in test mode, so members will not get anything yet.</p>
          <p className="mt-1">
            Resend&rsquo;s shared test sender only delivers to the address your Resend account was
            created with. To email everyone, use a club Gmail account: in Vercel set{" "}
            <code>SMTP_USER</code> to the Gmail address and <code>SMTP_PASSWORD</code> to an app
            password, then redeploy. Nothing else is needed (other mailboxes also need{" "}
            <code>SMTP_HOST</code>).
          </p>
        </div>
      )}

      {weakPassword && (
        <div className="mt-6 rounded-2xl bg-amber-50 p-5 text-sm text-amber-700">
          <p className="font-semibold">The officer password is short.</p>
          <p className="mt-1">
            Set <code>ADMIN_PASSWORD</code> in Vercel to at least 12 characters. Changing it signs
            every officer out, and nobody else.
          </p>
        </div>
      )}

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <dl className="divide-y divide-hairline/50">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:gap-6">
              <dt className="w-56 shrink-0 text-sm text-muted">{label}</dt>
              <dd className="break-all text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight">Send a test</h2>
        <p className="mt-1 mb-5 text-sm text-muted">
          Sends one email to the weekly report address above.
        </p>
        <TestEmailForm kind="email" />
      </div>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight">Test the alert list</h2>
        <p className="mt-1 mb-5 text-sm text-muted">
          Sends a test alert to every address under &ldquo;Alerts go to&rdquo;, so you know each
          person will really receive the real ones.
        </p>
        <TestEmailForm kind="alert" />
      </div>
    </div>
  );
}
