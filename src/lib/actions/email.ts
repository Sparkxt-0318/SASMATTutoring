"use server";

import { requireAdmin } from "@/lib/auth";
import { alertRecipients, isDryRun, sendBatch, sendEmail } from "@/lib/email";
import { explainEmailError } from "@/lib/email-errors";
import { adminAlertEmail } from "@/emails/templates";

export interface TestEmailState {
  ok?: boolean;
  /** Plain-English result, with the next step when something failed. */
  message?: string;
  /** The provider's own wording, for when you need to ask for help. */
  detail?: string;
}

function failure(err: unknown): TestEmailState {
  const raw = err instanceof Error ? err.message : String(err);
  const friendly = explainEmailError(raw);
  return friendly
    ? { ok: false, message: friendly, detail: raw }
    : { ok: false, message: "The email could not be sent.", detail: raw };
}

/** Sends one test email to the report address and reports exactly what happened. */
export async function sendTestEmail(): Promise<TestEmailState> {
  await requireAdmin();
  const to = process.env.REPORT_EMAIL;
  if (!to) return { ok: false, message: "REPORT_EMAIL is not set, so there is nowhere to send the test." };

  try {
    const { subject, html } = adminAlertEmail(
      "Test email",
      "If you can read this, the MAT tutoring site can send email.",
    );
    await sendEmail({ to, subject, html });
    return isDryRun()
      ? { ok: true, message: "Dry run is on, so nothing was really sent. Set EMAIL_DRY_RUN to false to send." }
      : { ok: true, message: `Sent. Check the inbox (and spam folder) of ${process.env.TEST_EMAIL_OVERRIDE || to}.` };
  } catch (err) {
    return failure(err);
  }
}

/** Sends a test alert to EVERY alert address, so a new address is proven to work before a real alert needs it. */
export async function sendTestAlert(): Promise<TestEmailState> {
  await requireAdmin();
  const recipients = alertRecipients();
  if (recipients.length === 0) {
    return { ok: false, message: "No alert addresses are set. Add REPORT_EMAIL in Vercel." };
  }

  try {
    const { subject, html } = adminAlertEmail(
      "Test alert",
      "This is a test of the MAT tutoring alert emails. You are on the list that receives them.",
    );
    const sent = await sendBatch(recipients.map((to) => ({ to, subject, html })));
    if (isDryRun()) {
      return { ok: true, message: "Dry run is on, so nothing was really sent. Set EMAIL_DRY_RUN to false to send." };
    }
    const missed = recipients.filter((_, i) => !sent.includes(i));
    return missed.length === 0
      ? { ok: true, message: `Sent to all ${recipients.length}: ${recipients.join(", ")}. Ask each person to check their inbox and spam folder.` }
      : {
          ok: false,
          message: `Sent to ${sent.length} of ${recipients.length}. These did not go through: ${missed.join(", ")}.`,
        };
  } catch (err) {
    return failure(err);
  }
}
