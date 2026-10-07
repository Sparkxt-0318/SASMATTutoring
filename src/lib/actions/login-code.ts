"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { createMemberSession } from "@/lib/member-auth";
import {
  CODE_COOLDOWN_SECONDS,
  CODE_TTL_MINUTES,
  MAX_CODES_PER_15_MIN,
  MAX_CODES_PER_DAY,
  MAX_CODE_ATTEMPTS,
  codeMatches,
  generateCode,
  hashCode,
  otpAllowedEmails,
} from "@/lib/login-code";
import { loginCodeEmail } from "@/emails/templates";

export interface CodeState {
  error?: string;
}

const emailSchema = z.string().trim().toLowerCase().email();
const WRONG = "That code is wrong or has expired. Request a new one.";

/** Step 1: email a fresh random PIN to an allowed member. */
export async function requestLoginCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Please enter a valid email address." };
  const email = parsed.data;

  if (!otpAllowedEmails().includes(email)) {
    return { error: "Code sign-in isn't turned on for this email yet. Please sign in with your password." };
  }
  const member = await prisma.member.findUnique({ where: { email } });
  if (!member) {
    return { error: "There is no member account for this email yet. Create your account first." };
  }
  if (!member.active) return { error: "This account was deactivated. Please ask an officer." };

  // Throttle: this is what keeps a 6-digit code safe from guessing.
  const now = Date.now();
  const [recent, today, latest] = await Promise.all([
    prisma.loginCode.count({ where: { memberId: member.id, createdAt: { gte: new Date(now - 15 * 60 * 1000) } } }),
    prisma.loginCode.count({ where: { memberId: member.id, createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) } } }),
    prisma.loginCode.findFirst({ where: { memberId: member.id }, orderBy: { createdAt: "desc" } }),
  ]);
  if (latest && now - latest.createdAt.getTime() < CODE_COOLDOWN_SECONDS * 1000) {
    return { error: "A code was just sent. Please wait a moment before asking for another." };
  }
  if (recent >= MAX_CODES_PER_15_MIN || today >= MAX_CODES_PER_DAY) {
    return { error: "Too many codes requested. Please wait a while, or sign in with your password." };
  }

  // Only the newest code can ever work.
  await prisma.loginCode.updateMany({
    where: { memberId: member.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  const code = generateCode();
  const row = await prisma.loginCode.create({
    data: {
      memberId: member.id,
      codeHash: hashCode(member.id, code),
      expiresAt: new Date(now + CODE_TTL_MINUTES * 60 * 1000),
    },
  });

  try {
    const mail = loginCodeEmail(member.name, code, CODE_TTL_MINUTES);
    await sendEmail({ to: member.email, subject: mail.subject, html: mail.html });
  } catch (err) {
    console.error("Sign-in code email failed:", err);
    await prisma.loginCode.delete({ where: { id: row.id } });
    return { error: "We couldn't send the email. Please sign in with your password, or ask an officer." };
  }

  redirect(`/member/code?email=${encodeURIComponent(email)}`);
}

/** Step 2: check the PIN. Single use, five guesses, ten minutes. */
export async function verifyLoginCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (!parsed.success || code.length !== 6) return { error: "Enter the 6-digit code from your email." };
  const email = parsed.data;

  if (!otpAllowedEmails().includes(email)) return { error: WRONG };
  const member = await prisma.member.findUnique({ where: { email } });
  if (!member || !member.active || !member.passwordHash) return { error: WRONG };

  const latest = await prisma.loginCode.findFirst({
    where: { memberId: member.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!latest || latest.attempts >= MAX_CODE_ATTEMPTS) return { error: WRONG };

  if (!codeMatches(member.id, code, latest.codeHash)) {
    const attempts = latest.attempts + 1;
    await prisma.loginCode.update({
      where: { id: latest.id },
      data: { attempts, ...(attempts >= MAX_CODE_ATTEMPTS ? { usedAt: new Date() } : {}) },
    });
    return {
      error:
        attempts >= MAX_CODE_ATTEMPTS
          ? "Too many wrong tries. That code no longer works. Request a new one."
          : WRONG,
    };
  }

  // Burn it atomically: if two requests race with the right code, only one wins.
  const burned = await prisma.loginCode.updateMany({
    where: { id: latest.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (burned.count !== 1) return { error: WRONG };

  await createMemberSession(member);
  redirect(member.mustChangePassword ? "/member/password" : "/member");
}
