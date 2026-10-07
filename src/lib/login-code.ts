import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { parseEmailList } from "./email-list";

export const CODE_TTL_MINUTES = 10;
/** Wrong guesses allowed on one code before it is destroyed. */
export const MAX_CODE_ATTEMPTS = 5;
/** Minimum gap between two code requests for the same member. */
export const CODE_COOLDOWN_SECONDS = 45;
/** Request limits: a 6-digit code is only safe if guessing is capped hard. */
export const MAX_CODES_PER_15_MIN = 3;
export const MAX_CODES_PER_DAY = 8;

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
 * Keyed hash of a code, bound to the member. A 6-digit code can be brute forced
 * offline from a plain hash, so the key (SESSION_SECRET) stays outside the database.
 */
export function hashCode(memberId: string, code: string): string {
  return createHmac("sha256", key()).update(`${memberId}:${code}`).digest("hex");
}

export function codeMatches(memberId: string, code: string, storedHash: string): boolean {
  const given = Buffer.from(hashCode(memberId, code), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return given.length === stored.length && timingSafeEqual(given, stored);
}

/**
 * The ONLY emails that can sign in as a member (OTP_LOGIN_EMAILS, comma separated).
 * Empty means nobody can. Decoration such as quotes is ignored.
 */
export function otpAllowedEmails(): string[] {
  return parseEmailList(process.env.OTP_LOGIN_EMAILS);
}
