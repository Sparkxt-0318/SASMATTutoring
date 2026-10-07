"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { memberSchema } from "@/lib/validation";

export interface MemberFormState {
  error?: string;
  /** Set after a member is added. */
  added?: { name: string; email: string };
}

/**
 * Add someone to the roster so they receive request emails and claim links.
 * This does not let them sign in: only addresses in OTP_LOGIN_EMAILS can.
 */
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
  if (existing) {
    if (existing.active) {
      return { error: "A member with that email already exists." };
    }
    // Rejoining former member: reactivate instead of duplicating.
    await prisma.member.update({
      where: { id: existing.id },
      data: { active: true, name: parsed.data.name },
    });
  } else {
    await prisma.member.create({ data: parsed.data });
  }

  revalidatePath("/admin/members");
  return { added: { name: parsed.data.name, email: parsed.data.email } };
}

export async function setMemberActive(memberId: string, active: boolean): Promise<void> {
  await requireAdmin();
  await prisma.member.update({ where: { id: memberId }, data: { active } });
  revalidatePath("/admin/members");
}
