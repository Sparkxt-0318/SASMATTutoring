import { createHash, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

/** Returns "salt:hash" (both hex). scrypt is built into Node, so no extra dependency. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Spend roughly the same time as a real check, so unknown emails can't be told apart by timing. */
export async function burnPasswordCheck(password: string): Promise<void> {
  await scrypt(password, Buffer.alloc(16), KEY_LENGTH);
}

/**
 * Short value tied to the current password. It goes into the session token, so
 * changing or resetting a password signs out every older session.
 */
export function passwordFingerprint(stored: string): string {
  return createHash("sha256").update(stored).digest("hex").slice(0, 16);
}

// No 0/O/1/l/I so a password read aloud or typed from a message is hard to mix up.
const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Readable temporary password like "k7mpq-x3tn9". */
export function generateTempPassword(): string {
  const pick = () => TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
  const part = () => Array.from({ length: 5 }, pick).join("");
  return `${part()}-${part()}`;
}
