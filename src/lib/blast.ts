import "server-only";
import { prisma } from "./db";
import { generateToken } from "./tokens";
import { sendBatch, sendAdminAlert, type OutboundEmail } from "./email";
import { adminAlertEmail, requestBlastEmail } from "@/emails/templates";

/**
 * Email every active member their personal claim link for a request.
 * Reuses existing ClaimToken rows on resend. Never throws — a failed blast
 * leaves `emailedAt` null (visible in the admin dashboard) and alerts the
 * officer inbox.
 */
export async function sendRequestBlast(requestId: string): Promise<{ sent: number; total: number }> {
  const request = await prisma.tutoringRequest.findUniqueOrThrow({ where: { id: requestId } });
  const members = await prisma.member.findMany({ where: { active: true } });
  if (members.length === 0) {
    await sendAdminAlertFor(
      "No members to notify",
      `A tutoring request (${request.subject}, ${request.studentName}) arrived but the roster has no active members.`,
    );
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

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const emails: OutboundEmail[] = tokens.map((claimToken) => {
    const member = members.find((m) => m.id === claimToken.memberId)!;
    const { subject, html } = requestBlastEmail(request, `${appUrl}/claim/${claimToken.token}`);
    return { to: member.email, subject, html };
  });

  try {
    await sendBatch(emails);
  } catch (err) {
    console.error("Request blast failed:", err);
    await sendAdminAlertFor(
      "Tutoring request email blast failed",
      `The notification blast for a ${request.subject} request from ${request.studentName} could not be sent (${String(
        err,
      )}). Open the admin dashboard and use "Resend blast" to retry.`,
    );
    return { sent: 0, total: members.length };
  }

  const now = new Date();
  await prisma.claimToken.updateMany({
    where: { id: { in: tokens.map((t) => t.id) } },
    data: { emailedAt: now },
  });
  return { sent: members.length, total: members.length };
}

async function sendAdminAlertFor(title: string, message: string): Promise<void> {
  const { subject, html } = adminAlertEmail(title, message);
  await sendAdminAlert(subject, html);
}
