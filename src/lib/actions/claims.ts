"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { claimForMember } from "@/lib/claiming";

/**
 * Claim from the emailed link: the token identifies the member. If this is not
 * a win (someone was faster, cancelled, already started) the claim page
 * re-reads the state and explains what happened.
 */
export async function claimRequest(token: string): Promise<void> {
  const claimToken = await prisma.claimToken.findUnique({
    where: { token },
    include: { member: true },
  });

  // Invalid token or deactivated member: the claim page renders the
  // explanation, so just send them back to it.
  if (!claimToken || !claimToken.member.active) {
    redirect(`/claim/${token}`);
  }

  const won = await claimForMember(claimToken.memberId, claimToken.requestId);
  redirect(won ? `/claim/${token}/claimed` : `/claim/${token}`);
}
