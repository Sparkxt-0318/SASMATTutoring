"use server";

import { requireAdmin } from "@/lib/auth";
import { isDryRun, sendEmail } from "@/lib/email";
import { adminAlertEmail } from "@/emails/templates";

export interface TestEmailState {
  ok?: boolean;
  message?: string;
}

/** Sends one test email to the officer report address and reports exactly what happened. */
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
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
