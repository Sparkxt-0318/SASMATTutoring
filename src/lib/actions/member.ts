"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { claimForMember, reopenClaimedRequest } from "@/lib/claiming";
import {
  createMemberSession,
  destroyMemberSession,
  getMember,
  requireMember,
} from "@/lib/member-auth";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/password";
import { Prisma } from "@/generated/prisma/client";
import { MAX_ACTIVE_MEMBERS, MAX_SIGNUPS_PER_HOUR, signupMode } from "@/lib/constants";
import { loginSchema, newPasswordSchema, signupSchema } from "@/lib/validation";

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export interface MemberLoginState {
  error?: string;
}

export async function memberLogin(
  _prev: MemberLoginState,
  formData: FormData,
): Promise<MemberLoginState> {
  const GENERIC = "Incorrect email or password.";
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: GENERIC };
  const { email, password } = parsed.data;

  const member = await prisma.member.findUnique({ where: { email } });
  if (!member || !member.active || !member.passwordHash) {
    await burnPasswordCheck(password);
    return { error: GENERIC };
  }

  if (member.lockedUntil && member.lockedUntil.getTime() > Date.now()) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  if (!(await verifyPassword(password, member.passwordHash))) {
    const failed = member.failedLogins + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await prisma.member.update({
      where: { id: member.id },
      data: {
        failedLogins: lock ? 0 : failed,
        lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
      },
    });
    return { error: GENERIC };
  }

  await prisma.member.update({
    where: { id: member.id },
    data: { failedLogins: 0, lockedUntil: null },
  });
  await createMemberSession(member);
  redirect(member.mustChangePassword ? "/member/password" : "/member");
}

export interface SignupState {
  errors?: Record<string, string>;
  values?: Record<string, string>;
}

/**
 * Members create their own account. In "open" mode anyone can; in "roster"
 * mode only emails an officer already added. An officer-added entry that has no
 * password yet is simply claimed (no duplicate is created). Deactivated members
 * can never sign themselves back in.
 */
export async function memberSignup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  // Bot trap: real people never see or fill this field.
  if (formData.get("website")) redirect("/member/login");

  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  };
  // Never send passwords back to the browser.
  const values = { name: raw.name, email: raw.email };

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      if (!errors[field]) errors[field] = issue.message;
    }
    return { errors, values };
  }
  const { name, email, password } = parsed.data;

  const [lastHour, activeMembers] = await Promise.all([
    prisma.member.count({ where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } }),
    prisma.member.count({ where: { active: true } }),
  ]);
  if (lastHour >= MAX_SIGNUPS_PER_HOUR || activeMembers >= MAX_ACTIVE_MEMBERS) {
    return {
      errors: { form: "Sign-ups are paused right now. Please try again later or ask an officer." },
      values,
    };
  }

  const existing = await prisma.member.findUnique({ where: { email } });
  if (existing && !existing.active) {
    return {
      errors: { form: "This account was deactivated. Please ask an officer." },
      values,
    };
  }
  if (existing?.passwordHash) {
    return {
      errors: { email: "That email already has an account. Sign in instead, or ask an officer to reset your password." },
      values,
    };
  }
  if (!existing && signupMode() === "roster") {
    return {
      errors: { email: "That email isn't on the club member list yet. Ask an officer to add it." },
      values,
    };
  }

  const passwordHash = await hashPassword(password);
  let member;
  try {
    member = existing
      ? await prisma.member.update({
          where: { id: existing.id },
          data: { passwordHash, mustChangePassword: false, failedLogins: 0, lockedUntil: null },
        })
      : await prisma.member.create({ data: { name, email, passwordHash } });
  } catch (err) {
    // Two sign-ups for the same email at the same instant: the loser lands here.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { errors: { email: "That email already has an account. Sign in instead." }, values };
    }
    throw err;
  }

  await createMemberSession(member);
  redirect("/member");
}

export async function memberLogout(): Promise<void> {
  await destroyMemberSession();
  redirect("/member/login");
}

export interface ChangePasswordState {
  errors?: Record<string, string>;
}

/** Used for both the forced first-time change and a voluntary change later. */
export async function changeMemberPassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const member = await getMember();
  if (!member) redirect("/member/login");

  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "password");
      if (!errors[field]) errors[field] = issue.message;
    }
    return { errors };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const updated = await prisma.member.update({
    where: { id: member.id },
    data: { passwordHash, mustChangePassword: false, failedLogins: 0, lockedUntil: null },
  });
  // The old session no longer matches the new password, so issue a fresh one.
  await createMemberSession(updated);
  redirect("/member");
}

/** A tutor can't make a session they claimed: give it back so someone else can take it. */
export async function releaseMyClaim(requestId: string): Promise<void> {
  const member = await requireMember();
  const released = await reopenClaimedRequest(requestId, { onlyMemberId: member.id });
  redirect(`/member?notice=${released ? "released" : "cannot-release"}`);
}

/** Claim an open request straight from the member dashboard. */
export async function claimRequestAsMember(requestId: string): Promise<void> {
  const member = await requireMember();
  const won = await claimForMember(member.id, requestId);
  redirect(`/member?notice=${won ? "claimed" : "taken"}`);
}
