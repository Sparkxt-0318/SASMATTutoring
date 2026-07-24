"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { sessionLogSchema } from "@/lib/validation";
import { Prisma } from "@/generated/prisma/client";

export interface SessionLogState {
  error?: string;
}

/** Tutor logs a completed session via their /complete/[token] link. */
export async function logSession(
  token: string,
  _prev: SessionLogState,
  formData: FormData,
): Promise<SessionLogState> {
  const claimToken = await prisma.claimToken.findUnique({
    where: { token },
    include: { request: true },
  });
  if (
    !claimToken ||
    claimToken.request.claimedById !== claimToken.memberId ||
    claimToken.request.status !== "CLAIMED"
  ) {
    // Already logged / not the winner / bad token — the page explains.
    redirect(`/complete/${token}`);
  }

  const parsed = sessionLogSchema.safeParse({
    minutes: formData.get("minutes"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  try {
    await prisma.$transaction([
      prisma.creditLog.create({
        data: {
          requestId: claimToken.requestId,
          memberId: claimToken.memberId,
          minutes: parsed.data.minutes,
          notes: parsed.data.notes,
        },
      }),
      prisma.tutoringRequest.update({
        where: { id: claimToken.requestId },
        data: { status: "COMPLETED" },
      }),
    ]);
  } catch (err) {
    // Unique violation on requestId = a concurrent double-submit; the page
    // will show "already logged".
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
      throw err;
    }
  }

  redirect(`/complete/${token}`);
}

/** Admin approves or rejects a pending credit. */
export async function reviewCredit(creditId: string, decision: "APPROVED" | "REJECTED"): Promise<void> {
  await requireAdmin();
  await prisma.creditLog.update({
    where: { id: creditId, status: "PENDING" },
    data: { status: decision, reviewedAt: new Date() },
  });
  revalidatePath("/admin/hours");
  revalidatePath("/admin/leaderboard");
}
