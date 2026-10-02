import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { secretKey } from "./auth";
import { passwordFingerprint } from "./password";
import type { Member } from "@/generated/prisma/client";

const COOKIE_NAME = "mat_member_session";
const SESSION_DAYS = 14;

export async function createMemberSession(member: Pick<Member, "id" | "passwordHash">): Promise<void> {
  const token = await new SignJWT({
    role: "member",
    // Changing or resetting the password changes this, which ends older sessions.
    ph: passwordFingerprint(member.passwordHash ?? ""),
  })
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
 * The signed-in member, or null. Checked against the database on every call so
 * deactivating a member or resetting their password takes effect immediately.
 */
export async function getMember(): Promise<Member | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.role !== "member" || !payload.sub) return null;
    const member = await prisma.member.findUnique({ where: { id: payload.sub } });
    if (!member || !member.active || !member.passwordHash) return null;
    if (payload.ph !== passwordFingerprint(member.passwordHash)) return null;
    return member;
  } catch {
    return null;
  }
}

/** For member pages and member server actions. Sends people to the right place if not ready. */
export async function requireMember(): Promise<Member> {
  const member = await getMember();
  if (!member) redirect("/member/login");
  if (member.mustChangePassword) redirect("/member/password");
  return member;
}
