import "server-only";
import { prisma } from "./db";
import { sendAdminAlert, sendEmail } from "./email";
import { adminAlertEmail, studentIntroEmail, tutorConfirmationEmail } from "@/emails/templates";

/**
 * The single place a request is claimed, used by both the emailed claim link
 * and the member dashboard. Race-safe: one conditional UPDATE guarded on
 * status = OPEN means exactly one concurrent claimer can win. A request whose
 * meeting time has already started can no longer be claimed.
 *
 * Returns true if this member won. The claim stands even if the follow-up
 * emails fail (the member always sees the student's contact details on the
 * site), in which case the officer inbox is alerted.
 */
export async function claimForMember(memberId: string, requestId: string): Promise<boolean> {
  const result = await prisma.tutoringRequest.updateMany({
    where: { id: requestId, status: "OPEN", meetingStart: { gt: new Date() } },
    data: { status: "CLAIMED", claimedById: memberId, claimedAt: new Date() },
  });
  if (result.count !== 1) return false;

  const [request, member] = await Promise.all([
    prisma.tutoringRequest.findUniqueOrThrow({ where: { id: requestId } }),
    prisma.member.findUniqueOrThrow({ where: { id: memberId } }),
  ]);

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

  return true;
}
