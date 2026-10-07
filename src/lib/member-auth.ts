import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { secretKey } from "./auth";
import { otpAllowedEmails } from "./login-code";
import type { Member } from "@/generated/prisma/client";

const COOKIE_NAME = "mat_member_session";
const SESSION_DAYS = 14;

export async function createMemberSession(member: Pick<Member, "id">): Promise<void> {
  const token = await new SignJWT({ role: "member" })
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
 * The signed-in member, or null. Checked against the database on every call, and
 * only addresses on the approved sign-in list (OTP_LOGIN_EMAILS) can ever be a
 * signed-in member. So even if an account or an old session exists for anyone
 * else, it gives them nothing, and taking an address off the list signs that
 * person out immediately.
 */
export async function getMember(): Promise<Member | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.role !== "member" || !payload.sub) return null;
    const member = await prisma.member.findUnique({ where: { id: payload.sub } });
    if (!member || !member.active) return null;
    if (!otpAllowedEmails().includes(member.email)) return null;
    return member;
  } catch {
    return null;
  }
}

/** For member pages and member server actions. */
export async function requireMember(): Promise<Member> {
  const member = await getMember();
  if (!member) redirect("/member/login");
  return member;
}
