"use server";

import { redirect } from "next/navigation";
import { claimForMember, reopenClaimedRequest } from "@/lib/claiming";
import { destroyMemberSession, requireMember } from "@/lib/member-auth";

export async function memberLogout(): Promise<void> {
  await destroyMemberSession();
  redirect("/member/login");
}

/** A tutor can't make a session they claimed: give it back so someone else can take it. */
export async function releaseMyClaim(requestId: string): Promise<void> {
  const member = await requireMember();
  const released = await reopenClaimedRequest(requestId, { onlyMemberId: member.id });
  redirect(`/member?notice=${released ? "released" : "cannot-release"}`);
}

/** Claim an open request straight from the member dashboard. */
export async function claimRequestAsMember(requestId: string): Promise<void> {
  const member = await requireMember();
  const won = await claimForMember(member.id, requestId);
  redirect(`/member?notice=${won ? "claimed" : "taken"}`);
}
