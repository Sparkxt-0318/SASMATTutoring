"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { creditMinutesSchema } from "@/lib/validation";
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
  if (!minutes.success) return;

  const request = await prisma.tutoringRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== "CLAIMED" || !request.claimedById) return;
  const memberId = request.claimedById;

  try {
    await prisma.$transaction(async (tx) => {
      // Guard so a double-click can't credit the same session twice.
      const claimed = await tx.tutoringRequest.updateMany({
        where: { id: requestId, status: "CLAIMED" },
        data: { status: "COMPLETED" },
      });
      if (claimed.count !== 1) return;
      await tx.creditLog.create({
        data: {
          requestId,
          memberId,
          minutes: minutes.data,
          status: "APPROVED",
          reviewedAt: new Date(),
        },
      });
    });
  } catch (err) {
    // Unique violation on requestId = already credited; nothing more to do.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
      throw err;
    }
  }

  revalidateCreditPages();
}

/** Undo a credit entered by mistake: the session goes back to the review queue. */
export async function revokeCredit(creditId: string): Promise<void> {
  await requireAdmin();
  const credit = await prisma.creditLog.findUnique({ where: { id: creditId } });
  if (!credit) return;

  await prisma.$transaction([
    prisma.creditLog.delete({ where: { id: creditId } }),
    prisma.tutoringRequest.update({
      where: { id: credit.requestId },
      data: { status: "CLAIMED" },
    }),
  ]);

  revalidateCreditPages();
}
