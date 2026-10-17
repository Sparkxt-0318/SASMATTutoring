"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { explainEmailError } from "@/lib/email-errors";
import { createMemberSession } from "@/lib/member-auth";
import { CODE_TTL_MINUTES, MAX_CODE_ATTEMPTS } from "@/lib/constants";
import { codeMatches, generateCode, hashCode, otpAllowedEmails } from "@/lib/login-code";
import { consumeLoginCode, countGuess, issueLoginCode, newestLoginCode } from "@/lib/race-safe";
import { loginCodeEmail } from "@/emails/templates";

export interface CodeState {
  error?: string;
  /** First time on this site: ask for a name, then send the code. */
  needsName?: boolean;
  email?: string;
}

const emailSchema = z.string().trim().toLowerCase().email();
const nameSchema = z
  .string()
  .trim()
  .min(2, "Please enter your full name.")
  .max(100, "Name is too long.")
  .regex(/^[^\u0000-\u001f\u007f]+$/, "Please use a normal name without line breaks.");
const WRONG = "That code is wrong or has expired. Request a new one.";

function codePage(email: string): never {
  redirect(`/member/login?email=${encodeURIComponent(email)}`);
}

/**
 * Step 1 of member sign-in: email a fresh random PIN. This is the ONLY way to
 * sign in as a member. Only active members on the roster (the admin Members tab)
 * can use it, plus any extra addresses in OTP_LOGIN_EMAILS.
 *
 * An address that cannot sign in gets exactly what a member sees (the code page)
 * and no email, so the form does not reveal who is on the roster (#34).
 */
export async function requestLoginCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Please enter a valid email address." };
  const email = parsed.data;

  const member = await prisma.member.findUnique({ where: { email } });
  let pendingName: string | undefined;
  if (!member) {
    if (!otpAllowedEmails().includes(email)) codePage(email);
    // An extra address from OTP_LOGIN_EMAILS, first visit: ask for a name. The
    // member is only created once the code is verified (#33).
    const rawName = formData.get("name");
    if (rawName === null || String(rawName).trim() === "") return { needsName: true, email };
    const name = nameSchema.safeParse(rawName);
    if (!name.success) return { needsName: true, email, error: name.error.issues[0]?.message };
    pendingName = name.data;
  } else if (!member.active) {
    codePage(email);
  }

  const code = generateCode();
  const issued = await issueLoginCode(email, hashCode(email, code), { pendingName });
  if (!issued.ok) {
    const errors = {
      cooldown: "A code was just sent. Please wait a moment before asking for another.",
      limit: "Too many codes requested. Please wait a while and try again.",
      busy: "Lots of people are signing in right now. Please try again in a few minutes.",
    };
    return { error: errors[issued.reason], email };
  }

  try {
    const mail = loginCodeEmail(member?.name ?? pendingName ?? "", code, CODE_TTL_MINUTES);
    await sendEmail({ to: email, subject: mail.subject, html: mail.html });
  } catch (err) {
    console.error("Sign-in code email failed:", err);
    await prisma.loginCode.delete({ where: { id: issued.id } });
    // Only the plain-English explanation is shown, never the provider's raw error text.
    const why = explainEmailError(err instanceof Error ? err.message : String(err));
    return {
      error: why
        ? `We couldn't send the email. ${why}`
        : "We couldn't send the email. Please try again in a moment, or ask an officer to check the Email tab.",
      email,
    };
  }

  codePage(email);
}

/**
 * Step 2: check the PIN. Single use, five guesses, ten minutes. Only the newest
 * code for the address can work, and every guess is counted before comparing
 * (#2), so parallel guesses cannot get past the limit.
 */
export async function verifyLoginCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (!parsed.success || code.length !== 6) return { error: "Enter the 6-digit code from your email." };
  const email = parsed.data;

  const latest = await newestLoginCode(email);
  if (!latest) return { error: WRONG };
  const attempt = await countGuess(latest.id);
  if (attempt === null) return { error: WRONG };

  if (!codeMatches(email, code, latest.codeHash)) {
    return {
      error:
        attempt >= MAX_CODE_ATTEMPTS ? "Too many wrong tries. That code no longer works. Request a new one." : WRONG,
    };
  }
  if (!(await consumeLoginCode(latest.id))) return { error: WRONG };

  let member = await prisma.member.findUnique({ where: { email } });
  if (!member && latest.pendingName && otpAllowedEmails().includes(email)) {
    // First sign in of an OTP_LOGIN_EMAILS address, now proven to own the inbox.
    member = await prisma.member.upsert({
      where: { email },
      update: {},
      create: { email, name: latest.pendingName },
    });
  }
  if (!member?.active) return { error: WRONG };

  await createMemberSession(member);
  redirect("/member");
}
