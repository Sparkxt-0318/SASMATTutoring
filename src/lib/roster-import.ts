/**
 * Reads a member list out of whatever an officer uploads or pastes: the club's
 * attendance sheet (a "Name <tab> email" row or cell followed by attendance
 * columns), a plain "name,email" CSV (comma, tab or semicolon separated, with
 * normal CSV quoting), the members backup CSV ("Name,Email,Status,Joined"),
 * "Name <email>" lines, email-first rows ("jane@x.com, Jane Doe"), or just emails.
 *
 * Each line is split into fields by CSV rules, then each field into words. A word
 * with "@" must be a complete valid address (after stripping surrounding <> or a
 * leading mailto:); nothing is ever cut out of a longer string, so a bad address
 * rejects its whole line instead of becoming a different mailbox (#19). The name
 * is the text right before the address on the same line (or right after it, when
 * the address comes first), else the address's local part. Lines without "@"
 * (headers, notes, blanks) are skipped. Nothing here touches the database.
 */
import { z } from "zod";

export interface RosterEntry {
  name: string;
  email: string;
  /** false when the name was derived from the email's local part */
  nameGiven: boolean;
  /** the line had a field exactly "Inactive" (case-insensitive), as in the members backup CSV */
  inactive: boolean;
}

export interface RejectedRow {
  /** 1-based line number */
  line: number;
  /** the raw line, trimmed, at most 200 chars */
  text: string;
  reason: string;
}

export const MAX_IMPORT_ROWS = 1000;

// Same check memberSchema uses, so imported addresses match hand-added ones.
const EMAIL = z.regexes.email;
// Spreadsheet cells that are never names (status and attendance values).
const NOT_A_NAME = new Set(["active", "inactive", "true", "false", "yes", "no"]);
const LOOKS_LIKE_NAME = /^\p{L}[\p{L}\p{M} .,'-]{1,99}$/u;

type Item = { kind: "text"; value: string } | { kind: "email"; value: string };

/** Splits one line into fields: CSV quoting, separator is tab, else comma, else semicolon (outside quotes). */
function splitFields(line: string): string[] {
  let unquoted = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) unquoted += ch;
  }
  const sep = ["\t", ",", ";"].find((s) => unquoted.includes(s));

  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === sep) {
      fields.push(field);
      field = "";
    } else if (ch === '"' && field.trim() === "") {
      // Opening quote (spaces before it are allowed, as in `a@x.com, "Doe, Jane"`).
      field = "";
      quoted = true;
    } else field += ch;
  }
  fields.push(field);
  return fields;
}

function cleanName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/^[\s<>()[\]:;,"-]+|[\s<>()[\]:;,"-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function isNameCandidate(name: string): boolean {
  return name.length >= 2 && /\p{L}/u.test(name) && !NOT_A_NAME.has(name.toLowerCase());
}

/** The address a word stands for, or null. Only decoration around the whole word is removed. */
function readAddress(word: string): string | null {
  const bare = word.replace(/^<(.*)>$/, "$1").replace(/^mailto:/i, "");
  return EMAIL.test(bare) ? bare.toLowerCase() : null;
}

function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

export function parseRoster(text: string): { entries: RosterEntry[]; rejected: RejectedRow[] } {
  const found = new Map<string, RosterEntry>();
  const rejected: RejectedRow[] = [];

  text
    .replace(/^\uFEFF/, "")
    .split(/\r\n|\n|\r/)
    .forEach((line, index) => {
      if (!line.includes("@")) return;
      const fields = splitFields(line).map((f) => f.trim());
      const inactive = fields.some((f) => f.toLowerCase() === "inactive");

      // Text and addresses in order. Words in one field join into one text item.
      const items: Item[] = [];
      let bad: string | null = null;
      for (const field of fields) {
        let words: string[] = [];
        const flush = () => {
          if (words.length) items.push({ kind: "text", value: words.join(" ") });
          words = [];
        };
        // "Jane Doe<jane@x.com>" -> "Jane Doe", "<jane@x.com>"
        for (const word of field.replace(/<([^<>\s]*@[^<>\s]*)>/g, " <$1> ").split(/\s+/)) {
          if (!word.includes("@")) {
            if (word) words.push(word);
            continue;
          }
          flush();
          const email = readAddress(word);
          if (email) items.push({ kind: "email", value: email });
          else bad ??= word;
        }
        flush();
      }

      if (bad !== null || !items.some((item) => item.kind === "email")) {
        rejected.push({
          line: index + 1,
          text: shorten(line.trim(), 200),
          reason: bad === null ? "No email address found" : `"${shorten(bad, 80)}" is not a valid email address`,
        });
        return;
      }

      let lastEmail = -1;
      items.forEach((item, i) => {
        if (item.kind !== "email") return;
        const before = items.slice(lastEmail + 1, i).map((t) => cleanName(t.value));
        const nextEmail = items.findIndex((t, j) => j > i && t.kind === "email");
        const after = items.slice(i + 1, nextEmail === -1 ? undefined : nextEmail).map((t) => cleanName(t.value));
        const first = lastEmail === -1;
        lastEmail = i;

        const name =
          before.filter(isNameCandidate).at(-1) ??
          (first && after[0] && isNameCandidate(after[0]) && LOOKS_LIKE_NAME.test(after[0])
            ? after[0]
            : null);
        if (!found.has(item.value)) {
          found.set(item.value, {
            name: name ?? item.value.split("@")[0],
            email: item.value,
            nameGiven: name !== null,
            inactive,
          });
        }
      });
    });

  return { entries: [...found.values()], rejected };
}
