import { randomBytes } from "crypto";

export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}
