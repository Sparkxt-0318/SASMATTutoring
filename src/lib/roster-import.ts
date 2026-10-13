/**
 * Reads a member list out of whatever an officer uploads or pastes: the club's
 * attendance sheet (a "Name <tab> email" cell followed by attendance columns), a
 * plain "name,email" CSV, "Name <email>" lines, or just emails. Every email found
 * becomes one entry; the name is the text right before it on the same line (or
 * right after it, when the email comes first). Nothing here touches the database.
 */

export interface RosterEntry {
  name: string;
  email: string;
}

export const MAX_IMPORT_ROWS = 1000;

const EMAIL = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const CELL_SPLIT = /[,;\t"|]+/;
const LOOKS_LIKE_NAME = /^\p{L}[\p{L}\p{M} .'-]{1,99}$/u;

function cleanName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/^[\s<>()[\]:'-]+|[\s<>()[\]:-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function pieces(text: string): string[] {
  return text
    .split(CELL_SPLIT)
    .map(cleanName)
    .filter((p) => p.length >= 2 && !p.includes("@"));
}

export function parseRoster(text: string): RosterEntry[] {
  const found = new Map<string, RosterEntry>();
  for (const line of text.replace(/^﻿/, "").split(/\r\n|\n|\r/)) {
    const matches = [...line.matchAll(EMAIL)];
    matches.forEach((match, i) => {
      const email = match[0].toLowerCase().replace(/^['.-]+|['.-]+$/g, "");
      const start = match.index ?? 0;
      const prevEnd = i > 0 ? (matches[i - 1].index ?? 0) + matches[i - 1][0].length : 0;
      const nextStart = i + 1 < matches.length ? (matches[i + 1].index ?? line.length) : line.length;

      const before = pieces(line.slice(prevEnd, start));
      const after = pieces(line.slice(start + match[0].length, nextStart));
      const name =
        before.at(-1) ??
        (prevEnd === 0 && after[0] && LOOKS_LIKE_NAME.test(after[0]) ? after[0] : null) ??
        email.split("@")[0];

      if (!found.has(email)) found.set(email, { name, email });
    });
  }
  return [...found.values()];
}
