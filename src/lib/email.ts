import { Resend } from "resend";

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

function isDryRun(): boolean {
  return process.env.EMAIL_DRY_RUN === "true";
}

function fromAddress(): string {
  return process.env.EMAIL_FROM ?? "MAT Tutoring <onboarding@resend.dev>";
}

/**
 * Apply the TEST_EMAIL_OVERRIDE safety switch: when set, every email is
 * rerouted to that address and the real recipient is noted in the subject.
 */
function applyOverride(email: OutboundEmail): OutboundEmail {
  const override = process.env.TEST_EMAIL_OVERRIDE;
  if (!override) return email;
  return {
    ...email,
    to: override,
    subject: `[TEST → ${email.to}] ${email.subject}`,
  };
}

function logDryRun(emails: OutboundEmail[]): void {
  for (const email of emails) {
    console.log(
      `[email dry-run] to=${email.to} replyTo=${email.replyTo ?? "-"} subject="${email.subject}" html=${email.html.length} bytes`,
    );
  }
}

let resendClient: Resend | null = null;
function resend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

/** Send a single email. Throws on failure; callers decide how to handle it. */
export async function sendEmail(email: OutboundEmail): Promise<void> {
  const finalEmail = applyOverride(email);
  if (isDryRun()) {
    logDryRun([finalEmail]);
    return;
  }
  const { error } = await resend().emails.send({
    from: fromAddress(),
    to: finalEmail.to,
    subject: finalEmail.subject,
    html: finalEmail.html,
    replyTo: finalEmail.replyTo,
  });
  if (error) {
    throw new Error(`Resend error: ${error.name}: ${error.message}`);
  }
}

/**
 * Send a batch (used for the member blast, one API call for up to 100
 * recipients). Returns the indexes that were sent successfully.
 */
export async function sendBatch(emails: OutboundEmail[]): Promise<number[]> {
  if (emails.length === 0) return [];
  const finalEmails = emails.map(applyOverride);
  if (isDryRun()) {
    logDryRun(finalEmails);
    return emails.map((_, i) => i);
  }
  const { error } = await resend().batch.send(
    finalEmails.map((email) => ({
      from: fromAddress(),
      to: email.to,
      subject: email.subject,
      html: email.html,
      replyTo: email.replyTo,
    })),
  );
  if (error) {
    throw new Error(`Resend batch error: ${error.name}: ${error.message}`);
  }
  return emails.map((_, i) => i);
}

/** Best-effort alert to the officer inbox. Never throws. */
export async function sendAdminAlert(subject: string, html: string): Promise<void> {
  const to = process.env.REPORT_EMAIL;
  if (!to) return;
  try {
    await sendEmail({ to, subject, html });
  } catch (err) {
    console.error("Failed to send admin alert:", err);
  }
}
