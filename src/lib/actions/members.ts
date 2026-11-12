"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { memberSchema } from "@/lib/validation";
import { generateCode, hashCode, otpAllowedEmails } from "@/lib/login-code";
import { issueLoginCode } from "@/lib/race-safe";
import { reopenClaimedRequest } from "@/lib/claiming";
import { backWithNotice } from "@/lib/notices";
import { CODE_TTL_MINUTES } from "@/lib/constants";
import { MAX_IMPORT_ROWS, parseRoster, type RejectedRow } from "@/lib/roster-import";

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

/**
 * Everything that must follow a deactivation, on every path (toggle and full-list
 * import): old sessions and sign-in codes stop working for good (#32), and
 * sessions they had claimed that have not started go back to the pool with the
 * student told (#25). Past sessions stay claimed so officers can still credit
 * them. Returns how many sessions were given back.
 */
async function afterDeactivation(memberIds: string[]): Promise<number> {
  if (memberIds.length === 0) return 0;
  const members = await prisma.member.findMany({ where: { id: { in: memberIds } }, select: { email: true } });
  await prisma.loginCode.deleteMany({ where: { email: { in: members.map((m) => m.email) } } });
  const upcoming = await prisma.tutoringRequest.findMany({
    where: { claimedById: { in: memberIds }, status: "CLAIMED", meetingStart: { gt: new Date() } },
    select: { id: true },
  });
  let released = 0;
  for (const request of upcoming) {
    if (await reopenClaimedRequest(request.id)) released++;
  }
  return released;
}

export async function setMemberActive(memberId: string, active: boolean): Promise<void> {
  await requireAdmin();
  if (active) {
    await prisma.member.update({ where: { id: memberId }, data: { active: true } });
    revalidatePath("/admin/members");
    backWithNotice("members", "reactivated");
  }
  // Bumping sessionVersion ends every session this member has, even after a later reactivation.
  await prisma.member.update({
    where: { id: memberId },
    data: { active: false, sessionVersion: { increment: 1 } },
  });
  const released = await afterDeactivation([memberId]);
  revalidatePath("/admin/members");
  revalidatePath("/admin/requests");
  backWithNotice("members", "deactivated", released);
}

export interface ImportState {
  error?: string;
  /** Lines that were not imported, with the reason. */
  rejected?: RejectedRow[];
  result?: {
    added: string[];
    reactivated: string[];
    renamed: string[];
    alreadyListed: number;
    deactivated: string[];
    sessionsReleased: number;
  };
}

/**
 * Import the member list from a CSV file (the club attendance sheet works as is)
 * or pasted text. Everyone found is added, or reactivated if they were removed
 * before, and their name is updated when the file gives one. Rows marked
 * "Inactive" (as in the members backup) are never activated. With "replace",
 * everyone else is deactivated, so the roster becomes exactly this list
 * (addresses in OTP_LOGIN_EMAILS are never deactivated). A "replace" import with
 * any rejected line is refused, because dropping a line would deactivate that member.
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

  const { entries, rejected } = parseRoster(text);
  const replace = formData.get("replace") === "on";
  if (replace && rejected.length > 0) {
    return {
      error:
        "Some lines could not be read, so nothing was changed. Fix them (or untick \"Make this the whole member list\") and import again.",
      rejected,
    };
  }
  if (entries.length === 0) {
    return { error: "No email addresses were found. Each member needs their email in the file.", rejected };
  }
  if (entries.length > MAX_IMPORT_ROWS) {
    return { error: `That is more than ${MAX_IMPORT_ROWS} people. Split the list into smaller files.` };
  }

  const activeEntries = entries.filter((e) => !e.inactive);
  const activeEmails = activeEntries.map((e) => e.email);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.member.findMany({ where: { email: { in: entries.map((e) => e.email) } } });
    const known = new Map(existing.map((m) => [m.email, m]));

    const fresh = entries.filter((e) => !known.has(e.email));
    await tx.member.createMany({
      data: fresh.map((e) => ({ name: e.name, email: e.email, active: !e.inactive })),
      skipDuplicates: true,
    });

    const toReactivate = existing.filter((m) => !m.active && activeEmails.includes(m.email));
    await tx.member.updateMany({ where: { id: { in: toReactivate.map((m) => m.id) } }, data: { active: true } });

    // A corrected sheet repairs names an earlier import got wrong.
    const renamed: string[] = [];
    for (const entry of entries) {
      const member = known.get(entry.email);
      if (member && entry.nameGiven && member.name !== entry.name) {
        await tx.member.update({ where: { id: member.id }, data: { name: entry.name } });
        renamed.push(entry.name);
      }
    }

    let removed: { id: string; name: string }[] = [];
    if (replace) {
      removed = await tx.member.findMany({
        where: { active: true, email: { notIn: [...activeEmails, ...otpAllowedEmails()] } },
        select: { id: true, name: true },
      });
      await tx.member.updateMany({
        where: { id: { in: removed.map((m) => m.id) } },
        data: { active: false, sessionVersion: { increment: 1 } },
      });
    }

    return {
      added: fresh.filter((e) => !e.inactive).map((e) => e.name),
      reactivated: toReactivate.map((m) => known.get(m.email)?.name ?? m.name),
      renamed,
      alreadyListed: existing.filter((m) => m.active).length,
      deactivated: removed.map((m) => m.name),
      removedIds: removed.map((m) => m.id),
    };
  });

  const { removedIds, ...summary } = result;
  const sessionsReleased = await afterDeactivation(removedIds);
  revalidatePath("/admin/members");
  return { result: { ...summary, sessionsReleased }, rejected };
}

export interface TestCodeState {
  error?: string;
  code?: string;
  email?: string;
  minutes?: number;
}

/**
 * Member test access for officers (#40): a one-time code for an active member,
 * shown only to the signed-in officer and never emailed. Same rules as an
 * emailed code (keyed hash only, single use, 10 minutes, 5 guesses), and making
 * a new one retires the previous code for that member.
 */
export async function createTestAccessCode(_prev: TestCodeState, formData: FormData): Promise<TestCodeState> {
  await requireAdmin();
  const member = await prisma.member.findUnique({ where: { id: String(formData.get("memberId") ?? "") } });
  if (!member?.active) return { error: "Pick an active member first." };
  const code = generateCode();
  const issued = await issueLoginCode(member.email, hashCode(member.email, code), { throttle: false });
  if (!issued.ok) return { error: "Could not create a code. Try again in a moment." };
  return { code, email: member.email, minutes: CODE_TTL_MINUTES };
}
