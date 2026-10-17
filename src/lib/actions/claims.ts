"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { claimForMember } from "@/lib/claiming";

/**
 * Claim from the emailed link: the token identifies the member. If this is not
 * a win (someone was faster, cancelled, already started, a clash with another
 * session) the claim page explains what happened.
 */
export async function claimRequest(token: string): Promise<void> {
  const claimToken = await prisma.claimToken.findUnique({ where: { token } });

  // Invalid token: the claim page renders the explanation.
  if (!claimToken) redirect(`/claim/${token}`);

  const outcome = await claimForMember(claimToken.memberId, claimToken.requestId);
  if (outcome === "won") redirect(`/claim/${token}/claimed`);
  redirect(outcome === "overlap" ? `/claim/${token}?clash=1` : `/claim/${token}`);
}
