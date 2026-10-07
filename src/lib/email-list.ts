/**
 * Parse a setting that holds email addresses (OTP_LOGIN_EMAILS, EXTRA_ALERT_EMAILS,
 * REPORT_EMAIL). People paste these into Vercel with all sorts of decoration: quotes
 * copied from .env.example, angle brackets, a trailing comma or full stop, stray
 * spaces or line breaks. All of that is stripped, so the address still matches.
 * Result is lower case, valid-looking, and without duplicates.
 */
const EDGE = /^[\s"'`<>()[\]​-‍﻿]+|[\s"'`<>()[\]​-‍﻿.]+$/g;
const SHAPE = /^[^@\s"'<>]+@[^@\s"'<>]+\.[^@\s"'<>]+$/;

export function parseEmailList(raw: string | null | undefined): string[] {
  const found = (raw ?? "")
    .split(/[,;\s]+/)
    .map((entry) => entry.replace(EDGE, "").toLowerCase())
    .filter((entry) => SHAPE.test(entry));
  return [...new Set(found)];
}
