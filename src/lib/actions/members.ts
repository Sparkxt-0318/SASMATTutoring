"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { memberSchema } from "@/lib/validation";
import { otpAllowedEmails } from "@/lib/login-code";
import { MAX_IMPORT_ROWS, parseRoster } from "@/lib/roster-import";

const MAX_IMPORT_BYTES = 500_000;

export interface MemberFormState {
  error?: string;
  /** Set after a member is added. */
  added?: { name: string; email: string };
}

/**
 * Add someone to the roster: they receive request emails and claim links, and
 * can sign in with an emailed one-time code.
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

export interface ImportState {
  error?: string;
  result?: {
    added: string[];
    reactivated: string[];
    alreadyListed: number;
    deactivated: string[];
  };
}

/**
 * Import the member list from a CSV file (the club attendance sheet works as is)
 * or pasted text. Everyone found is added, or reactivated if they were removed
 * before. With "replace", everyone else is deactivated, so the roster becomes
 * exactly this list (addresses in OTP_LOGIN_EMAILS are never deactivated).
 */
export async function importMembers(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireAdmin();

  const file = formData.get("file");
  let text: string;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMPORT_BYTES) {
      return { error: "That file is too big. Upload a CSV with just the member names and emails." };
    }
    text = await file.text();
  } else {
    text = String(formData.get("text") ?? "");
    if (text.length > MAX_IMPORT_BYTES) return { error: "That is too much text. Paste just the names and emails." };
  }
  if (!text.trim()) return { error: "Choose a CSV file or paste a list first." };

  const entries = parseRoster(text);
  if (entries.length === 0) {
    return { error: "No email addresses were found. Each member needs their email in the file." };
  }
  if (entries.length > MAX_IMPORT_ROWS) {
    return { error: `That is more than ${MAX_IMPORT_ROWS} people. Split the list into smaller files.` };
  }
  const replace = formData.get("replace") === "on";
  const emails = entries.map((e) => e.email);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.member.findMany({ where: { email: { in: emails } } });
    const known = new Map(existing.map((m) => [m.email, m]));

    const fresh = entries.filter((e) => !known.has(e.email));
    await tx.member.createMany({ data: fresh, skipDuplicates: true });

    const inactive = existing.filter((m) => !m.active);
    await tx.member.updateMany({ where: { id: { in: inactive.map((m) => m.id) } }, data: { active: true } });

    let removed: { id: string; name: string }[] = [];
    if (replace) {
      removed = await tx.member.findMany({
        where: { active: true, email: { notIn: [...emails, ...otpAllowedEmails()] } },
        select: { id: true, name: true },
      });
      await tx.member.updateMany({ where: { id: { in: removed.map((m) => m.id) } }, data: { active: false } });
    }

    return {
      added: fresh.map((e) => e.name),
      reactivated: inactive.map((m) => m.name),
      alreadyListed: existing.length - inactive.length,
      deactivated: removed.map((m) => m.name),
    };
  });

  revalidatePath("/admin/members");
  return { result };
}
