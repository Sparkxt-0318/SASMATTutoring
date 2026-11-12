import { prisma } from "./db";

/**
 * Daily send budget (#5). Gmail stops a mailbox for up to a day after about 500
 * emails, and Resend's free plan allows 100 a day, so every real send is counted
 * per UTC day before it goes out. Member blasts ("bulk") may only use part of the
 * limit, so sign-in codes, intros and alerts always have room left.
 */
export type EmailKind = "bulk" | "essential";

/** Share of the daily limit that member blasts may use. */
export const BULK_SHARE = 0.8;

export class EmailBudgetError extends Error {
  constructor(kind: EmailKind) {
    super(
      kind === "bulk"
        ? "Daily email budget for member blasts is used up. Blasts resume tomorrow (UTC); sign-in codes and intros still go out."
        : "Daily email budget is used up. Sending resumes tomorrow (UTC).",
    );
    this.name = "EmailBudgetError";
  }
}

/** EMAIL_DAILY_LIMIT, or a safe default for the provider in use. */
export function dailyEmailLimit(provider: "smtp" | "resend"): number {
  const configured = Math.floor(Number(process.env.EMAIL_DAILY_LIMIT));
  if (configured > 0) return configured;
  return provider === "smtp" ? 450 : 95;
}

export function budgetDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Reserve `count` sends for today, all or nothing. One atomic statement, so
 * parallel senders can never push the total past the cap together.
 */
export async function reserveEmails(count: number, kind: EmailKind, limit: number): Promise<boolean> {
  const cap = kind === "bulk" ? Math.floor(limit * BULK_SHARE) : limit;
  if (count > cap) return false;
  const day = budgetDay();
  const rows = await prisma.$queryRaw<{ sent: number }[]>`
    INSERT INTO "EmailBudget" ("day", "sent") VALUES (${day}, ${count})
    ON CONFLICT ("day") DO UPDATE SET "sent" = "EmailBudget"."sent" + ${count}
    WHERE "EmailBudget"."sent" + ${count} <= ${cap}
    RETURNING "sent"`;
  return rows.length === 1;
}

/** True exactly once per day: the caller should alert officers that blasts paused. */
export async function claimBudgetAlert(): Promise<boolean> {
  const result = await prisma.emailBudget.updateMany({
    where: { day: budgetDay(), alertedAt: null },
    data: { alertedAt: new Date() },
  });
  return result.count === 1;
}

export async function sentToday(): Promise<number> {
  const row = await prisma.emailBudget.findUnique({ where: { day: budgetDay() } });
  return row?.sent ?? 0;
}
