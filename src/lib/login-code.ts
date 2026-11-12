import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { parseEmailList } from "./email-list";

// Limits (TTL, guesses, request caps) live in constants.ts; the race-safe
// database steps live in race-safe.ts.

/** A fresh random 6-digit PIN (leading zeros allowed), from the OS secure random source. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function key(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  return secret;
}

/**
 * Keyed hash of a code, bound to the email address. A 6-digit code can be brute
 * forced offline from a plain hash, so the key (SESSION_SECRET) stays outside the database.
 */
export function hashCode(email: string, code: string): string {
  return createHmac("sha256", key()).update(`${email}:${code}`).digest("hex");
}

export function codeMatches(email: string, code: string, storedHash: string): boolean {
  const given = Buffer.from(hashCode(email, code), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return given.length === stored.length && timingSafeEqual(given, stored);
}

/**
 * Extra addresses that may sign in even though they are not on the roster yet
 * (OTP_LOGIN_EMAILS, comma separated, usually empty). Active roster members can
 * always sign in. Decoration such as quotes is ignored.
 */
export function otpAllowedEmails(): string[] {
  return parseEmailList(process.env.OTP_LOGIN_EMAILS);
}
