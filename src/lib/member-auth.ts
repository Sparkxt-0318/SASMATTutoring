import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { secretKey } from "./auth";
import type { Member } from "@/generated/prisma/client";

const COOKIE_NAME = "mat_member_session";
const SESSION_DAYS = 14;

export async function createMemberSession(member: Pick<Member, "id" | "sessionVersion">): Promise<void> {
  // sv must match the member row, so a deactivation ends this session for good (#32).
  // Sessions from before sv existed count as version 0.
  const token = await new SignJWT({ role: "member", sv: member.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(member.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroyMemberSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * The signed-in member, or null. Checked against the database on every request,
 * so deactivating someone in the Members tab signs them out immediately, and the
 * session stays dead even if they are reactivated later. Cached per request, so
 * a layout and its page share one lookup.
 */
export const getMember = cache(async (): Promise<Member | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.role !== "member" || !payload.sub) return null;
    const member = await prisma.member.findUnique({ where: { id: payload.sub } });
    if (!member || !member.active || (payload.sv ?? 0) !== member.sessionVersion) return null;
    return member;
  } catch {
    return null;
  }
});

/** For member pages and member server actions. */
export async function requireMember(): Promise<Member> {
  const member = await getMember();
  if (!member) redirect("/member/login");
  return member;
}
