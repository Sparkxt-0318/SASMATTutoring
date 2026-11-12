import "server-only";
import { prisma } from "./db";
import { generateToken } from "./tokens";
import { appUrl } from "./constants";
import { sendBatch, sendAdminAlert, type OutboundEmail } from "./email";
import { EmailBudgetError } from "./email-budget";
import { adminAlertEmail, requestBlastEmail } from "@/emails/templates";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Who a blast goes to:
 *  - "all": every active member (a newly confirmed request).
 *  - "reopened": every active member, after clearing the old sent markers so a
 *    failed reopen blast shows as incomplete (#8).
 *  - "unsent": only active members who have not been emailed this request yet
 *    (the officer's Resend blast), so nobody gets it twice.
 */
export type BlastMode = "all" | "reopened" | "unsent";

/**
 * Email active members their personal claim link for a request. Reuses existing
 * ClaimToken rows. Never throws for a failed send: members whose email could not
 * be sent keep `emailedAt` null (visible in the admin dashboard) and the officer
 * inbox is alerted. Counts as "bulk" against the daily email budget.
 */
export async function sendRequestBlast(
  requestId: string,
  options: { mode?: BlastMode } = {},
): Promise<{ sent: number; total: number }> {
  const mode = options.mode ?? "all";
  const request = await prisma.tutoringRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (mode === "reopened") {
    await prisma.claimToken.updateMany({ where: { requestId }, data: { emailedAt: null } });
  }

  const members = await prisma.member.findMany({
    where: {
      active: true,
      ...(mode === "unsent" ? { claimTokens: { none: { requestId, emailedAt: { not: null } } } } : {}),
    },
  });
  if (members.length === 0) {
    if (mode !== "unsent") {
      await sendAdminAlertFor(
        "No members to notify",
        `A tutoring request (${request.subject}, ${request.studentName}) arrived but the roster has no active members.`,
      );
    }
    return { sent: 0, total: 0 };
  }

  const tokens = await Promise.all(
    members.map((member) =>
      prisma.claimToken.upsert({
        where: { requestId_memberId: { requestId, memberId: member.id } },
        update: {},
        create: { requestId, memberId: member.id, token: generateToken() },
      }),
    ),
  );

  const siteUrl = appUrl();
  const emails: OutboundEmail[] = tokens.map((claimToken) => {
    const member = members.find((m) => m.id === claimToken.memberId)!;
    const { subject, html } = requestBlastEmail(
      request,
      `${siteUrl}/claim/${claimToken.token}`,
      mode === "reopened",
    );
    return { to: member.email, subject, html };
  });

  let sentIndexes: number[];
  try {
    sentIndexes = await sendBatch(emails, "bulk");
  } catch (err) {
    console.error("Request blast failed:", err);
    // A full budget already sent its own once-a-day alert.
    if (!(err instanceof EmailBudgetError)) {
      await sendAdminAlertFor(
        "Tutoring request email blast failed",
        `The notification blast for a ${request.subject} request from ${request.studentName} could not be sent (${String(
          err,
        )}). Open the admin dashboard and use "Resend blast" to retry.`,
      );
    }
    return { sent: 0, total: members.length };
  }

  await prisma.claimToken.updateMany({
    where: { id: { in: sentIndexes.map((i) => tokens[i].id) } },
    data: { emailedAt: new Date() },
  });

  if (sentIndexes.length < members.length) {
    const failed = members.length - sentIndexes.length;
    await sendAdminAlertFor(
      "Some member emails could not be sent",
      `${failed} of ${members.length} members did not get the ${request.subject} request from ${request.studentName}. Open the admin dashboard and use "Resend blast" to retry.`,
    );
  }
  return { sent: sentIndexes.length, total: members.length };
}

async function sendAdminAlertFor(title: string, message: string): Promise<void> {
  const { subject, html } = adminAlertEmail(title, message);
  await sendAdminAlert(subject, html);
}

/** Time a new or reopened blast gets before it can count as incomplete. */
const BLAST_GRACE_MS = 15 * 60 * 1000;

/**
 * OPEN requests whose blast did not reach every active member: some active
 * member's token is unsent, or no token exists at all (the blast died before
 * creating any). Requests confirmed in the last 15 minutes are still sending.
 */
export function blastIncompleteWhere(now = new Date()): Prisma.TutoringRequestWhereInput {
  return {
    status: "OPEN",
    confirmedAt: { lt: new Date(now.getTime() - BLAST_GRACE_MS) },
    OR: [
      { claimTokens: { some: { emailedAt: null, member: { active: true } } } },
      { claimTokens: { none: {} } },
    ],
  };
}
