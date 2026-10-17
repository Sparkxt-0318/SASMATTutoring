import "server-only";
import { after } from "next/server";
import { prisma } from "./db";
import { reportEmail, sendAdminAlert, sendEmail } from "./email";
import { sendRequestBlast } from "./blast";
import { claimRequestRow, type ClaimOutcome } from "./race-safe";
import {
  adminAlertEmail,
  studentIntroEmail,
  tutorConfirmationEmail,
  tutorReleasedEmail,
} from "@/emails/templates";
import type { Member, TutoringRequest } from "@/generated/prisma/client";

/**
 * A tutor can no longer make a claimed session (or an officer reopens it, or
 * the tutor is deactivated): put it back in the pool. Only works while the
 * meeting is still in the future. Tells the student, then alerts every member again.
 * Pass `onlyMemberId` so a member can only release their own claim.
 *
 * The update is pinned to the claim that was read (tutor and claim time), so a
 * slow reopen can never remove a different tutor who claimed in between (#23).
 */
export async function reopenClaimedRequest(
  requestId: string,
  options: { onlyMemberId?: string } = {},
): Promise<boolean> {
  const before = await prisma.tutoringRequest.findUnique({
    where: { id: requestId },
    include: { claimedBy: true },
  });
  if (!before || !before.claimedBy || before.status !== "CLAIMED") return false;
  if (options.onlyMemberId && before.claimedById !== options.onlyMemberId) return false;

  const result = await prisma.tutoringRequest.updateMany({
    where: {
      id: requestId,
      status: "CLAIMED",
      claimedById: before.claimedById,
      claimedAt: before.claimedAt,
      meetingStart: { gt: new Date() },
    },
    data: { status: "OPEN", claimedById: null, claimedAt: null },
  });
  if (result.count !== 1) return false;

  // Emails go out after the response so the page does not wait on the mail server.
  const tutorName = before.claimedBy.name;
  after(async () => {
    try {
      const notice = tutorReleasedEmail(before, tutorName);
      await sendEmail({
        to: before.studentEmail,
        subject: notice.subject,
        html: notice.html,
        replyTo: reportEmail() ?? undefined,
      });
    } catch (err) {
      console.error("Student notice after reopen failed:", err);
    }
    try {
      await sendRequestBlast(requestId, { mode: "reopened" });
    } catch (err) {
      console.error("Blast after reopen crashed:", err);
    }
  });
  return true;
}

export type AssignOutcome = ClaimOutcome | "inactive";

/**
 * The single place a request gets a tutor: the emailed claim link, the member
 * dashboard, and an officer's Assign all come here. The member must be active,
 * the meeting must not have started, and the member must not already hold an
 * overlapping session (officers can pass `allowOverlap`). See claimRequestRow
 * in race-safe.ts for why concurrent claims are safe.
 *
 * On a win, both intro emails go out after the response (#36). The claim stands
 * even if they fail (the member always sees the student's contact on the site),
 * in which case the officer inbox is alerted.
 */
export async function claimForMember(
  memberId: string,
  requestId: string,
  options: { allowOverlap?: boolean } = {},
): Promise<AssignOutcome> {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member?.active) return "inactive";

  const outcome = await claimRequestRow(memberId, requestId, options);
  if (outcome !== "won") return outcome;

  after(async () => {
    const request = await prisma.tutoringRequest.findUniqueOrThrow({ where: { id: requestId } });
    await sendIntroEmails(request, member);
  });
  return "won";
}

/** Introduce tutor and student by email; alert officers if that fails. Never throws. */
export async function sendIntroEmails(request: TutoringRequest, member: Member): Promise<void> {
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
    console.error("Intro emails failed:", err);
    const alert = adminAlertEmail(
      "Intro emails failed",
      `${member.name} has the ${request.subject} request from ${request.studentName}, but the confirmation/intro emails failed to send (${String(
        err,
      )}). You may want to connect them manually: tutor ${member.email}, student ${request.studentEmail}.`,
    );
    await sendAdminAlert(alert.subject, alert.html);
  }
}
