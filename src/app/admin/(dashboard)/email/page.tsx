import type { Metadata } from "next";
import { emailStatus } from "@/lib/email";
import { otpAllowedEmails } from "@/lib/login-code";
import { TestEmailForm } from "./TestEmailForm";

export const metadata: Metadata = { title: "Email" };

// Reads settings on every visit so it always shows what is live.
export const dynamic = "force-dynamic";

export default function AdminEmailPage() {
  const status = emailStatus();
  const otp = otpAllowedEmails();
  const usingResendTestSender =
    status.provider === "resend" && status.from.toLowerCase().includes("onboarding@resend.dev");

  const rows: Array<[string, string]> = [
    ["Sending method", status.provider === "smtp" ? "SMTP (a normal mailbox)" : "Resend"],
    ["Sent from", status.from],
    ...(status.smtpHost ? ([["Mail server", status.smtpHost]] as Array<[string, string]>) : []),
    ["Weekly report and backup go to", status.reportEmail ?? "(not set)"],
    [
      "Alerts go to",
      status.alertRecipients.length > 0 ? status.alertRecipients.join(", ") : "(nobody: set REPORT_EMAIL)",
    ],
    ["Code sign-in allowed for", otp.length > 0 ? otp.join(", ") : "Nobody (turned off)"],
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
            created with. To email everyone, add these settings in Vercel and redeploy:{" "}
            <code>EMAIL_PROVIDER=smtp</code>, <code>SMTP_HOST</code>, <code>SMTP_PORT</code>,{" "}
            <code>SMTP_USER</code>, <code>SMTP_PASSWORD</code>, and set <code>EMAIL_FROM</code> to the
            same mailbox. A club Gmail account with an app password is the most reliable choice.
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
