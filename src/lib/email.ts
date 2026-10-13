import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { parseEmailList } from "./email-list";

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  /** Plain-text files to attach (used for the weekly CSV backup). */
  attachments?: Array<{ filename: string; content: string }>;
}

/**
 * Two ways to send:
 *  - "smtp": any mailbox that allows SMTP (a club Gmail account, for example).
 *  - "resend": Resend API. Needs a verified domain to reach other people.
 * EMAIL_PROVIDER picks one. When it is not set, SMTP is used as soon as
 * SMTP_USER or SMTP_PASSWORD is filled in (so a half-filled setup reports
 * "SMTP is not set up" instead of a confusing Resend error), otherwise Resend.
 */
export function emailProvider(): "resend" | "smtp" {
  const chosen = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (chosen === "smtp" || chosen === "resend") return chosen;
  return process.env.SMTP_USER?.trim() || process.env.SMTP_PASSWORD?.trim() ? "smtp" : "resend";
}

/**
 * SMTP login, cleaned up. For a Gmail address the server defaults to
 * smtp.gmail.com, and spaces are removed from the password because Google shows
 * app passwords in groups of four ("abcd efgh ijkl mnop").
 */
export function smtpSettings() {
  const rawUser = (process.env.SMTP_USER ?? "").trim();
  const user = parseEmailList(rawUser)[0] ?? rawUser.replace(/^["']+|["']+$/g, "");
  const gmail = /@(gmail|googlemail)\.com$/i.test(user);
  const host = (process.env.SMTP_HOST ?? "").trim() || (gmail ? "smtp.gmail.com" : "");
  const rawPass = process.env.SMTP_PASSWORD ?? "";
  const pass = gmail ? rawPass.replace(/[\s"']/g, "") : rawPass.trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  return { host, port, user, pass, gmail };
}

export function isDryRun(): boolean {
  return process.env.EMAIL_DRY_RUN === "true";
}

const DEFAULT_NAME = "MAT Tutoring";

function fromAddress(): string {
  const configured = process.env.EMAIL_FROM?.trim().replace(/^["']+|["']+$/g, "") ?? "";
  if (emailProvider() === "smtp") {
    // A mailbox sends as itself (Gmail rewrites anything else), so use its own
    // address and keep only the display name from EMAIL_FROM.
    const { user, gmail } = smtpSettings();
    const name = configured.match(/^(.+?)\s*<[^>]*>$/)?.[1]?.replace(/["']/g, "").trim() || DEFAULT_NAME;
    if (gmail || !configured || /resend\.dev/i.test(configured)) return `${name} <${user}>`;
    return configured;
  }
  return configured || `${DEFAULT_NAME} <onboarding@resend.dev>`;
}

/** Non-secret summary for the admin Email tab. */
export function emailStatus() {
  return {
    provider: emailProvider(),
    from: fromAddress(),
    smtpHost: emailProvider() === "smtp" ? smtpSettings().host || "(not set)" : null,
    dryRun: isDryRun(),
    override: process.env.TEST_EMAIL_OVERRIDE || null,
    reportEmail: reportEmail(),
    alertRecipients: alertRecipients(),
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
    const { host, port, user, pass } = smtpSettings();
    if (!host || !user || !pass) {
      throw new Error("SMTP is not set up. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD.");
    }
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

/** The officer report inbox (REPORT_EMAIL), cleaned up, or null when it is not set. */
export function reportEmail(): string | null {
  return parseEmailList(process.env.REPORT_EMAIL)[0] ?? null;
}

/**
 * Who receives alert emails (failures, "needs attention", expired requests):
 * REPORT_EMAIL, plus everyone in EXTRA_ALERT_EMAILS (comma separated). The
 * weekly report and backup files go to REPORT_EMAIL only.
 */
export function alertRecipients(): string[] {
  return [
    ...new Set([...parseEmailList(process.env.REPORT_EMAIL), ...parseEmailList(process.env.EXTRA_ALERT_EMAILS)]),
  ];
}

/** Best-effort alert to every alert address, one separate email each. Never throws. */
export async function sendAdminAlert(subject: string, html: string): Promise<void> {
  const recipients = alertRecipients();
  if (recipients.length === 0) return;
  try {
    await sendBatch(recipients.map((to) => ({ to, subject, html })));
  } catch (err) {
    console.error("Failed to send admin alert:", err);
  }
}
