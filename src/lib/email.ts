import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  /** Plain-text files to attach (used for the weekly CSV backup). */
  attachments?: Array<{ filename: string; content: string }>;
}

/**
 * Two ways to send, chosen with EMAIL_PROVIDER:
 *  - "resend" (default): Resend API. Needs a verified domain to reach other people.
 *  - "smtp": any mailbox that allows SMTP (a school or Gmail account, for example).
 */
export function emailProvider(): "resend" | "smtp" {
  return process.env.EMAIL_PROVIDER === "smtp" ? "smtp" : "resend";
}

export function isDryRun(): boolean {
  return process.env.EMAIL_DRY_RUN === "true";
}

function fromAddress(): string {
  return process.env.EMAIL_FROM ?? "MAT Tutoring <onboarding@resend.dev>";
}

/** Non-secret summary for the admin Email tab. */
export function emailStatus() {
  return {
    provider: emailProvider(),
    from: fromAddress(),
    smtpHost: emailProvider() === "smtp" ? (process.env.SMTP_HOST ?? "(not set)") : null,
    dryRun: isDryRun(),
    override: process.env.TEST_EMAIL_OVERRIDE || null,
    reportEmail: process.env.REPORT_EMAIL || null,
  };
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
      `[email dry-run] to=${email.to} replyTo=${email.replyTo ?? "-"} subject="${email.subject}" html=${email.html.length} bytes attachments=${email.attachments?.length ?? 0}`,
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

let smtpTransport: Transporter | null = null;
function smtp(): Transporter {
  if (!smtpTransport) {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    if (!host || !user || !pass) {
      throw new Error("SMTP is not set up. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD.");
    }
    const port = Number(process.env.SMTP_PORT) || 587;
    smtpTransport = nodemailer.createTransport({
      host,
      port,
      // Port 465 uses TLS from the start; 587 upgrades with STARTTLS.
      secure: port === 465,
      auth: { user, pass },
      pool: true,
      maxConnections: 3,
      connectionTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }
  return smtpTransport;
}

async function sendViaSmtp(email: OutboundEmail): Promise<void> {
  await smtp().sendMail({
    from: fromAddress(),
    to: email.to,
    subject: email.subject,
    html: email.html,
    replyTo: email.replyTo,
    attachments: email.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: "text/csv; charset=utf-8",
    })),
  });
}

/** Send a single email. Throws on failure; callers decide how to handle it. */
export async function sendEmail(email: OutboundEmail): Promise<void> {
  const finalEmail = applyOverride(email);
  if (isDryRun()) {
    logDryRun([finalEmail]);
    return;
  }
  if (emailProvider() === "smtp") {
    await sendViaSmtp(finalEmail);
    return;
  }
  const { error } = await resend().emails.send({
    from: fromAddress(),
    to: finalEmail.to,
    subject: finalEmail.subject,
    html: finalEmail.html,
    replyTo: finalEmail.replyTo,
    attachments: finalEmail.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, "utf-8"),
    })),
  });
  if (error) {
    throw new Error(`Resend error: ${error.name}: ${error.message}`);
  }
}

/**
 * Send many emails (used for the member blast). Returns the indexes that were
 * sent successfully. Resend sends one all-or-nothing API call; SMTP sends each
 * message separately, so some can succeed while others fail. Throws only when
 * nothing could be sent.
 */
export async function sendBatch(emails: OutboundEmail[]): Promise<number[]> {
  if (emails.length === 0) return [];
  const finalEmails = emails.map(applyOverride);
  if (isDryRun()) {
    logDryRun(finalEmails);
    return emails.map((_, i) => i);
  }

  if (emailProvider() === "smtp") {
    const results = await Promise.allSettled(finalEmails.map((email) => sendViaSmtp(email)));
    const sent = results.flatMap((r, i) => (r.status === "fulfilled" ? [i] : []));
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failures.length > 0) {
      console.error(`SMTP batch: ${failures.length} of ${emails.length} failed`, failures[0].reason);
    }
    if (sent.length === 0) {
      throw failures[0].reason instanceof Error ? failures[0].reason : new Error(String(failures[0].reason));
    }
    return sent;
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
