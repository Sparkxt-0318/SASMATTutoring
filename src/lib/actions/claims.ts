"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { sendEmail, sendAdminAlert } from "@/lib/email";
import { adminAlertEmail, studentIntroEmail, tutorConfirmationEmail } from "@/emails/templates";

/**
 * Attempt to claim a request for the member behind this token.
 * Race-safe: a single conditional UPDATE guarded on status = OPEN means
 * exactly one concurrent claimer can win. A request whose meeting time has
 * already started can no longer be claimed.
 */
export async function claimRequest(token: string): Promise<void> {
  const claimToken = await prisma.claimToken.findUnique({
    where: { token },
    include: { member: true, request: true },
  });

  // Invalid token or deactivated member: the claim page renders the
  // explanation — just send them back to it.
  if (!claimToken || !claimToken.member.active) {
    redirect(`/claim/${token}`);
  }

  const result = await prisma.tutoringRequest.updateMany({
    where: { id: claimToken.requestId, status: "OPEN", meetingStart: { gt: new Date() } },
    data: {
      status: "CLAIMED",
      claimedById: claimToken.memberId,
      claimedAt: new Date(),
    },
  });

  if (result.count !== 1) {
    // Lost the race (or request was cancelled/expired/already started) — the
    // page re-reads state and shows what happened.
    redirect(`/claim/${token}`);
  }

  // The claim stands even if these emails fail — the success page always
  // shows the student's contact info, so email is not the only channel.
  const { request, member } = claimToken;
  try {
    const tutorEmail = tutorConfirmationEmail(request, member.name);
    const studentEmail = studentIntroEmail(request, member.name, member.email);
    await Promise.all([
      sendEmail({
        to: member.email,
        subject: tutorEmail.subject,
        html: tutorEmail.html,
        replyTo: request.studentEmail,
      }),
      sendEmail({
        to: request.studentEmail,
        subject: studentEmail.subject,
        html: studentEmail.html,
        replyTo: member.email,
      }),
    ]);
  } catch (err) {
    console.error("Post-claim emails failed:", err);
    const alert = adminAlertEmail(
      "Post-claim emails failed",
      `${member.name} claimed the ${request.subject} request from ${request.studentName}, but the confirmation/intro emails failed to send (${String(
        err,
      )}). You may want to connect them manually: tutor ${member.email}, student ${request.studentEmail}.`,
    );
    await sendAdminAlert(alert.subject, alert.html);
  }

  redirect(`/claim/${token}/claimed`);
}
