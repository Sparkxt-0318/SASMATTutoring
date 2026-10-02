"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { claimForMember } from "@/lib/claiming";
import {
  createMemberSession,
  destroyMemberSession,
  getMember,
  requireMember,
} from "@/lib/member-auth";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/password";
import { loginSchema, newPasswordSchema } from "@/lib/validation";

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

/** Claim an open request straight from the member dashboard. */
export async function claimRequestAsMember(requestId: string): Promise<void> {
  const member = await requireMember();
  const won = await claimForMember(member.id, requestId);
  redirect(`/member?notice=${won ? "claimed" : "taken"}`);
}
