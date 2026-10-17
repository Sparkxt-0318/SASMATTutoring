"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { creditMinutesSchema } from "@/lib/validation";
import { backWithNotice } from "@/lib/notices";
import { Prisma } from "@/generated/prisma/client";

function revalidateCreditPages(): void {
  revalidatePath("/admin/hours");
  revalidatePath("/admin/leaderboard");
  revalidatePath("/admin/requests");
}

/**
 * Officer records credit for a claimed session (done during the weekly
 * weekend review). Credit is never automatic: this is the only way hours are
 * added to a member's total.
 */
export async function awardCredit(requestId: string, formData: FormData): Promise<void> {
  await requireAdmin();

  const minutes = creditMinutesSchema.safeParse(formData.get("minutes"));
  if (!minutes.success) backWithNotice("hours", "credit-invalid");

  const request = await prisma.tutoringRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== "CLAIMED" || !request.claimedById) backWithNotice("hours", "credit-gone");
  const memberId = request.claimedById;

  let credited = false;
  try {
    credited = await prisma.$transaction(async (tx) => {
      // Guard so a double-click can't credit the same session twice.
      const claimed = await tx.tutoringRequest.updateMany({
        where: { id: requestId, status: "CLAIMED" },
        data: { status: "COMPLETED" },
      });
      if (claimed.count !== 1) return false;
      await tx.creditLog.create({
        data: {
          requestId,
          memberId,
          minutes: minutes.data,
          status: "APPROVED",
          reviewedAt: new Date(),
        },
      });
      return true;
    });
  } catch (err) {
    // Unique violation on requestId = already credited; nothing more to do.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
      throw err;
    }
  }

  revalidateCreditPages();
  backWithNotice("hours", credited ? "credited" : "credit-gone");
}

/** Undo a credit entered by mistake: the session goes back to the review queue. */
export async function revokeCredit(creditId: string): Promise<void> {
  await requireAdmin();
  // Guarded like awardCredit: only an approved credit on a completed session,
  // and a double-click removes it once.
  const undone = await prisma.$transaction(async (tx) => {
    const credit = await tx.creditLog.findUnique({ where: { id: creditId } });
    if (!credit || credit.status !== "APPROVED") return false;
    const reopened = await tx.tutoringRequest.updateMany({
      where: { id: credit.requestId, status: "COMPLETED" },
      data: { status: "CLAIMED" },
    });
    if (reopened.count !== 1) return false;
    const removed = await tx.creditLog.deleteMany({ where: { id: creditId } });
    if (removed.count !== 1) throw new Error("Credit vanished during undo");
    return true;
  });

  revalidateCreditPages();
  backWithNotice("hours", undone ? "credit-undone" : "credit-undo-gone");
}
