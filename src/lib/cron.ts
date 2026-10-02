import { timingSafeEqual } from "crypto";

/**
 * Cron routes accept only "Authorization: Bearer <CRON_SECRET>". If the secret
 * is not configured, NOTHING is authorized (never compare against the string
 * "Bearer undefined").
 */
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
