import type { Metadata } from "next";
import { emailStatus } from "@/lib/email";
import { TestEmailForm } from "./TestEmailForm";

export const metadata: Metadata = { title: "Email" };

export default function AdminEmailPage() {
  const status = emailStatus();
  const rows: Array<[string, string]> = [
    ["Sending method", status.provider === "smtp" ? "SMTP (a normal mailbox)" : "Resend"],
    ["Sent from", status.from],
    ...(status.smtpHost ? ([["Mail server", status.smtpHost]] as Array<[string, string]>) : []),
    ["Digest and alerts go to", status.reportEmail ?? "(not set)"],
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
        Check how the site sends email and send yourself a test. If the test fails, the message
        below it says why.
      </p>

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
        <p className="mt-1 mb-5 text-sm text-muted">Sends one email to the digest address above.</p>
        <TestEmailForm />
      </div>
    </div>
  );
}
