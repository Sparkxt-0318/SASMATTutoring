"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { memberSchema } from "@/lib/validation";

export interface MemberFormState {
  error?: string;
  /** Set after a member is added: the temporary password to hand over. */
  added?: { name: string; email: string; password: string };
}

export interface ResetPasswordState {
  error?: string;
  password?: string;
}

async function issueTempPassword(memberId: string): Promise<string> {
  const password = generateTempPassword();
  await prisma.member.update({
    where: { id: memberId },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      failedLogins: 0,
      lockedUntil: null,
    },
  });
  return password;
}

export async function addMember(_prev: MemberFormState, formData: FormData): Promise<MemberFormState> {
  await requireAdmin();
  const parsed = memberSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const existing = await prisma.member.findUnique({ where: { email: parsed.data.email } });
  let memberId: string;
  if (existing) {
    if (existing.active) {
      return { error: "A member with that email already exists." };
    }
    // Rejoining former member: reactivate instead of duplicating.
    await prisma.member.update({
      where: { id: existing.id },
      data: { active: true, name: parsed.data.name },
    });
    memberId = existing.id;
  } else {
    memberId = (await prisma.member.create({ data: parsed.data })).id;
  }

  const password = await issueTempPassword(memberId);
  revalidatePath("/admin/members");
  return { added: { name: parsed.data.name, email: parsed.data.email, password } };
}

/** Issue a new temporary password (first-time setup or a forgotten password). */
export async function resetMemberPassword(memberId: string): Promise<ResetPasswordState> {
  await requireAdmin();
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return { error: "Member not found." };
  const password = await issueTempPassword(memberId);
  revalidatePath("/admin/members");
  return { password };
}

export async function setMemberActive(memberId: string, active: boolean): Promise<void> {
  await requireAdmin();
  await prisma.member.update({ where: { id: memberId }, data: { active } });
  revalidatePath("/admin/members");
}
