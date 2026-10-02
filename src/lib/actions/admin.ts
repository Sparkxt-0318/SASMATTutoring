"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { checkAdminPassword, createAdminSession, destroyAdminSession, requireAdmin } from "@/lib/auth";
import { sendRequestBlast } from "@/lib/blast";
import { reopenClaimedRequest } from "@/lib/claiming";
import { sendEmail } from "@/lib/email";
import { studentIntroEmail, tutorConfirmationEmail } from "@/emails/templates";

export interface LoginState {
  error?: string;
}

export async function adminLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  if (!checkAdminPassword(password)) {
    return { error: "Incorrect password." };
  }
  await createAdminSession();
  redirect("/admin/requests");
}

export async function adminLogout(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}

export async function cancelRequest(requestId: string): Promise<void> {
  await requireAdmin();
  await prisma.tutoringRequest.updateMany({
    where: { id: requestId, status: { in: ["OPEN", "CLAIMED"] } },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/admin/requests");
  revalidatePath("/admin/hours");
}

/** Put a claimed session back in the pool (e.g. the tutor stopped responding). */
export async function reopenRequest(requestId: string): Promise<void> {
  await requireAdmin();
  await reopenClaimedRequest(requestId);
  revalidatePath("/admin/requests");
  revalidatePath("/admin/hours");
}

export async function resendBlast(requestId: string): Promise<void> {
  await requireAdmin();
  const request = await prisma.tutoringRequest.findUnique({ where: { id: requestId } });
  if (request?.status === "OPEN") {
    await sendRequestBlast(requestId);
  }
  revalidatePath("/admin/requests");
}

/**
 * Manually assign an OPEN request to a member (e.g. a tutor volunteered in
 * person). Sends the same tutor/student intro emails as a normal claim.
 */
export async function reassignRequest(requestId: string, memberId: string): Promise<void> {
  await requireAdmin();
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return;

  const result = await prisma.tutoringRequest.updateMany({
    where: { id: requestId, status: "OPEN" },
    data: { status: "CLAIMED", claimedById: memberId, claimedAt: new Date() },
  });
  if (result.count !== 1) return;
  revalidatePath("/admin/hours");

  const request = await prisma.tutoringRequest.findUniqueOrThrow({ where: { id: requestId } });

  try {
    const tutorEmail = tutorConfirmationEmail(request, member.name);
    const studentEmail = studentIntroEmail(request, member.name, member.email);
    await Promise.all([
      sendEmail({ to: member.email, subject: tutorEmail.subject, html: tutorEmail.html, replyTo: request.studentEmail }),
      sendEmail({ to: request.studentEmail, subject: studentEmail.subject, html: studentEmail.html, replyTo: member.email }),
    ]);
  } catch (err) {
    console.error("Reassign emails failed:", err);
  }

  revalidatePath("/admin/requests");
}
