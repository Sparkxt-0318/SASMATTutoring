import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { parseEmailList } from "./email-list";
import {
  EmailBudgetError,
  claimBudgetAlert,
  dailyEmailLimit,
  reserveEmails,
  type EmailKind,
} from "./email-budget";
import { adminAlertEmail } from "@/emails/templates";

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
 * SMTP login, cleaned up. A Gmail address can only send through smtp.gmail.com,
 * so that server is always used for one (even if SMTP_HOST still names an old
 * provider), and spaces are removed from the password because Google shows app
 * passwords in groups of four ("abcd efgh ijkl mnop").
 */
export function smtpSettings() {
  const rawUser = (process.env.SMTP_USER ?? "").trim();
  const user = parseEmailList(rawUser)[0] ?? rawUser.replace(/^["']+|["']+$/g, "");
  const gmail = /@(gmail|googlemail)\.com$/i.test(user);
  const host = gmail ? "smtp.gmail.com" : (process.env.SMTP_HOST ?? "").trim();
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

/** Just the email address the site sends from, for telling members what to look for. */
export function senderAddress(): string {
  const from = fromAddress();
  return (from.match(/<([^>]+)>/)?.[1] ?? from).trim();
}

/**
 * Plain-text version of an email. Mail filters (Outlook especially) trust
 * messages more when they carry text as well as HTML, and some people read
 * mail as text. Links keep their address so buttons still work.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, "").trim();
      if (href.startsWith("mailto:")) return text;
      // A link that shows its own address ("site.app/member") is written once, in full.
      return text === href || text === href.replace(/^https?:\/\//, "") ? href : `${text}: ${href}`;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|tr|table)>/gi, "\n")
    .replace(/<\/td>/gi, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Non-secret summary for the admin Email tab. */
export function emailStatus() {
  return {
    provider: emailProvider(),
    from: fromAddress(),
    smtpHost: emailProvider() === "smtp" ? smtpSettings().host || "(not set)" : null,
    dryRun: isDryRun(),
    dailyLimit: dailyEmailLimit(emailProvider()),
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
    // Locally, show the text too, so sign-in codes and confirm links can be copied.
    // Never in production, where logs are kept and codes must stay secret.
    if (process.env.NODE_ENV !== "production") console.log(htmlToText(email.html));
  }
}

let resendClient: Resend | null = null;
function resend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

/**
 * A fresh connection for every send (or batch), closed afterwards. Serverless
 * functions are frozen between requests, so a connection kept open from an
 * earlier request can be dead by the time the next email needs it.
 */
function openSmtp(pool: boolean): Transporter {
  const { host, port, user, pass } = smtpSettings();
  if (!host || !user || !pass) {
    throw new Error("SMTP is not set up. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD.");
  }
  return nodemailer.createTransport({
    host,
    port,
    // Port 465 uses TLS from the start; other ports must upgrade with STARTTLS
    // before the password is sent, or the send fails (never falls back to plain text).
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
    pool,
    maxConnections: 3,
    connectionTimeout: 15_000,
    socketTimeout: 30_000,
  });
}

async function sendViaSmtp(transport: Transporter, email: OutboundEmail): Promise<void> {
  await transport.sendMail({
    from: fromAddress(),
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: htmlToText(email.html),
    replyTo: email.replyTo,
    attachments: email.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.filename.endsWith(".json") ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
    })),
  });
}

/**
 * Count real sends against today's budget (see email-budget.ts) or throw
 * EmailBudgetError. The first time blasts are refused on a day, officers are told.
 */
async function reserveOrThrow(count: number, kind: EmailKind): Promise<void> {
  if (await reserveEmails(count, kind, dailyEmailLimit(emailProvider()))) return;
  if (kind === "bulk" && (await claimBudgetAlert())) {
    const alert = adminAlertEmail(
      "Member emails paused for today",
      "The site has used most of today's email limit, so new request emails to members are paused until tomorrow (UTC). Sign-in codes and intro emails still go out. Requests stay in the Requests tab: press Resend blast tomorrow, or assign a tutor directly.",
    );
    await sendAdminAlert(alert.subject, alert.html);
  }
  throw new EmailBudgetError(kind);
}

/** Send a single email. Throws on failure; callers decide how to handle it. */
export async function sendEmail(email: OutboundEmail, kind: EmailKind = "essential"): Promise<void> {
  const finalEmail = applyOverride(email);
  if (isDryRun()) {
    logDryRun([finalEmail]);
    return;
  }
  await reserveOrThrow(1, kind);
  if (emailProvider() === "smtp") {
    const transport = openSmtp(false);
    try {
      await sendViaSmtp(transport, finalEmail);
    } finally {
      transport.close();
    }
    return;
  }
  const { error } = await resend().emails.send({
    from: fromAddress(),
    to: finalEmail.to,
    subject: finalEmail.subject,
    html: finalEmail.html,
    text: htmlToText(finalEmail.html),
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

/** Resend's batch endpoint takes at most this many emails per call. */
const RESEND_BATCH_SIZE = 100;

/**
 * Send many emails (used for the member blast). Returns the indexes that were
 * sent successfully. Resend sends all-or-nothing calls of up to 100; SMTP sends
 * each message separately. Either way some can succeed while others fail.
 * Throws only when nothing could be sent.
 */
export async function sendBatch(emails: OutboundEmail[], kind: EmailKind = "essential"): Promise<number[]> {
  if (emails.length === 0) return [];
  const finalEmails = emails.map(applyOverride);
  if (isDryRun()) {
    logDryRun(finalEmails);
    return emails.map((_, i) => i);
  }
  await reserveOrThrow(emails.length, kind);

  if (emailProvider() === "smtp") {
    const transport = openSmtp(true);
    let results: PromiseSettledResult<void>[];
    try {
      results = await Promise.allSettled(finalEmails.map((email) => sendViaSmtp(transport, email)));
    } finally {
      transport.close();
    }
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

  const sent: number[] = [];
  let firstError: Error | null = null;
  for (let start = 0; start < finalEmails.length; start += RESEND_BATCH_SIZE) {
    const chunk = finalEmails.slice(start, start + RESEND_BATCH_SIZE);
    const { error } = await resend().batch.send(
      chunk.map((email) => ({
        from: fromAddress(),
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: htmlToText(email.html),
        replyTo: email.replyTo,
        attachments: email.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content, "utf-8"),
        })),
      })),
    );
    if (error) {
      firstError ??= new Error(`Resend batch error: ${error.name}: ${error.message}`);
      console.error(`Resend batch: emails ${start} to ${start + chunk.length - 1} failed`, error);
    } else {
      sent.push(...chunk.map((_, i) => start + i));
    }
  }
  if (sent.length === 0 && firstError) throw firstError;
  return sent;
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
