"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { checkAdminPassword, createAdminSession, destroyAdminSession, requireAdmin } from "@/lib/auth";
import { clearAdminAttempts, failureDelay, recordAdminAttempt } from "@/lib/admin-throttle";
import { sendRequestBlast } from "@/lib/blast";
import { claimForMember, reopenClaimedRequest, sendIntroEmails } from "@/lib/claiming";
import { reportEmail, sendEmail } from "@/lib/email";
import { backWithNotice } from "@/lib/notices";
import { requestCancelledStudentEmail, requestCancelledTutorEmail } from "@/emails/templates";

export interface LoginState {
  error?: string;
}

export async function adminLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const attempt = await recordAdminAttempt();
  if (attempt.blocked) {
    await failureDelay();
    return { error: "Too many sign-in attempts. Please wait 15 minutes and try again." };
  }
  if (!checkAdminPassword(password)) {
    await failureDelay();
    return { error: "Incorrect password." };
  }
  await clearAdminAttempts(attempt.ipHash);
  await createAdminSession();
  redirect("/admin/requests");
}

export async function adminLogout(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}

function revalidateRequestPages(): void {
  revalidatePath("/admin/requests");
  revalidatePath("/admin/hours");
}

/**
 * Cancel a request (Requests tab) or mark a claimed session as not happened
 * (Hours tab, same action). For a meeting still ahead, the student and the
 * tutor are emailed (#7); a past one is just closed. Restore undoes it (#6).
 */
export async function cancelRequest(requestId: string, from: string): Promise<void> {
  await requireAdmin();
  const request = await prisma.tutoringRequest.findUnique({
    where: { id: requestId },
    include: { claimedBy: true },
  });
  const result = await prisma.tutoringRequest.updateMany({
    where: { id: requestId, status: { in: ["UNCONFIRMED", "OPEN", "CLAIMED"] } },
    data: { status: "CANCELLED" },
  });
  revalidateRequestPages();
  if (!request || result.count !== 1) backWithNotice(from, "not-cancellable");

  const ahead = request.meetingStart.getTime() > Date.now();
  if (ahead && request.status !== "UNCONFIRMED") {
    after(async () => {
      const notices = [];
      const student = requestCancelledStudentEmail(request);
      notices.push(
        sendEmail({ to: request.studentEmail, subject: student.subject, html: student.html, replyTo: reportEmail() ?? undefined }),
      );
      if (request.status === "CLAIMED" && request.claimedBy) {
        const tutor = requestCancelledTutorEmail(request, request.claimedBy.name);
        notices.push(sendEmail({ to: request.claimedBy.email, subject: tutor.subject, html: tutor.html }));
      }
      const results = await Promise.allSettled(notices);
      for (const r of results) if (r.status === "rejected") console.error("Cancel notice failed:", r.reason);
    });
  }
  backWithNotice(from, ahead ? "cancelled" : "cancelled-past");
}

/**
 * Undo a cancel (#6). A session that still has its tutor goes back to CLAIMED
 * (and both are introduced again if the meeting is ahead); one without a tutor
 * goes back to OPEN and is blasted again, if the meeting is still ahead and
 * the student had confirmed it.
 */
export async function restoreRequest(requestId: string): Promise<void> {
  await requireAdmin();
  const request = await prisma.tutoringRequest.findUnique({
    where: { id: requestId },
    include: { claimedBy: true },
  });
  if (!request || request.status !== "CANCELLED") backWithNotice("hours", "not-restorable");
  const ahead = request.meetingStart.getTime() > Date.now();

  // An inactive tutor does not get the session back; it goes to the pool instead.
  if (request.claimedBy?.active) {
    const result = await prisma.tutoringRequest.updateMany({
      where: { id: requestId, status: "CANCELLED" },
      data: { status: "CLAIMED" },
    });
    revalidateRequestPages();
    if (result.count !== 1) backWithNotice("hours", "not-restorable");
    const tutor = request.claimedBy;
    if (ahead) after(() => sendIntroEmails(request, tutor));
    backWithNotice("hours", "restored-claimed");
  }

  // A request the student never confirmed never goes to members.
  if (!ahead || !request.confirmedAt) backWithNotice("hours", "not-restorable");
  const result = await prisma.tutoringRequest.updateMany({
    where: { id: requestId, status: "CANCELLED" },
    data: { status: "OPEN", claimedById: null, claimedAt: null },
  });
  revalidateRequestPages();
  if (result.count !== 1) backWithNotice("hours", "not-restorable");
  after(async () => {
    try {
      await sendRequestBlast(requestId, { mode: "reopened" });
    } catch (err) {
      console.error("Blast after restore crashed:", err);
    }
  });
  backWithNotice("hours", "restored-open");
}

/** Put a claimed session back in the pool (e.g. the tutor stopped responding). */
export async function reopenRequest(requestId: string): Promise<void> {
  await requireAdmin();
  const reopened = await reopenClaimedRequest(requestId);
  revalidateRequestPages();
  backWithNotice("requests", reopened ? "reopened" : "not-reopenable");
}

/** Email the request to active members who do not have it yet (#8), after the response (#36). */
export async function resendBlast(requestId: string): Promise<void> {
  await requireAdmin();
  const request = await prisma.tutoringRequest.findUnique({ where: { id: requestId } });
  if (request?.status !== "OPEN") backWithNotice("requests", "blast-not-open");

  const remaining = await prisma.member.count({
    where: { active: true, claimTokens: { none: { requestId, emailedAt: { not: null } } } },
  });
  if (remaining === 0) backWithNotice("requests", "blast-none");
  after(async () => {
    try {
      await sendRequestBlast(requestId, { mode: "unsent" });
    } catch (err) {
      console.error("Resend blast crashed:", err);
    }
  });
  revalidatePath("/admin/requests");
  backWithNotice("requests", "blast-sent", remaining);
}

/**
 * Assign an OPEN request to a member (e.g. a tutor volunteered in person). Same
 * rules and intro emails as a normal claim (#9): active member, meeting still
 * ahead, no overlapping session unless the officer ticks "Assign anyway" (#27).
 */
export async function reassignRequest(requestId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) backWithNotice("requests", "assign-inactive");
  const outcome = await claimForMember(memberId, requestId, {
    allowOverlap: formData.get("allowOverlap") === "on",
  });
  revalidateRequestPages();
  backWithNotice(
    "requests",
    { won: "assigned", taken: "assign-taken", overlap: "assign-overlap", inactive: "assign-inactive" }[outcome],
  );
}
