import "server-only";
import { createHmac } from "crypto";
import { headers } from "next/headers";
import { prisma } from "./db";
import { secretKey } from "./auth";
import { sendAdminAlert } from "./email";
import { adminAlertEmail } from "@/emails/templates";

/**
 * Officer sign-in throttle (#3). Every attempt is recorded BEFORE the password is
 * checked, so parallel attempts all count. A correct password clears the address.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 5;
const MAX_SITE = 30;
const ALERT_MARK = "site-alert";
/** Added to every failure, including a wrong password length, so timing says nothing. */
const FAILURE_DELAY_MS = 1000;

/** Keyed hash of the caller's IP (Vercel sets x-forwarded-for). The raw IP is never stored. */
async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHmac("sha256", secretKey()).update(`ip:${ip}`).digest("hex").slice(0, 32);
}

export async function recordAdminAttempt(): Promise<{ ipHash: string; blocked: boolean }> {
  const ipHash = await clientIpHash();
  await prisma.adminLoginAttempt.create({ data: { ipHash } });
  const since = new Date(Date.now() - WINDOW_MS);
  const [forIp, site] = await Promise.all([
    prisma.adminLoginAttempt.count({ where: { ipHash, createdAt: { gte: since } } }),
    prisma.adminLoginAttempt.count({ where: { ipHash: { not: ALERT_MARK }, createdAt: { gte: since } } }),
  ]);
  if (site > MAX_SITE) await alertOnce(since);
  return { ipHash, blocked: forIp > MAX_PER_IP || site > MAX_SITE };
}

/** One alert per window when the site-wide ceiling is hit. */
async function alertOnce(since: Date): Promise<void> {
  const already = await prisma.adminLoginAttempt.count({ where: { ipHash: ALERT_MARK, createdAt: { gte: since } } });
  if (already > 0) return;
  await prisma.adminLoginAttempt.create({ data: { ipHash: ALERT_MARK } });
  const alert = adminAlertEmail(
    "Many failed officer sign-ins",
    `More than ${MAX_SITE} officer sign-in attempts in 15 minutes. Officer sign-in is paused for everyone until it calms down. If this was not you, change ADMIN_PASSWORD in Vercel (that also signs out every officer).`,
  );
  await sendAdminAlert(alert.subject, alert.html);
}

export async function clearAdminAttempts(ipHash: string): Promise<void> {
  await prisma.adminLoginAttempt.deleteMany({ where: { ipHash } });
}

export function failureDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
}
