/**
 * The database writes that must stay correct when requests arrive at the same
 * moment. Kept free of "server-only" and next/server so scripts/race-test.ts
 * exercises exactly this code.
 *
 * Two tools: a conditional UPDATE (only one caller can match the row), and a
 * transaction-scoped Postgres advisory lock that serializes the few low-volume
 * "count, then write" steps so a limit can never be passed by parallel callers.
 */
import { prisma } from "./db";
import { generateToken } from "./tokens";
import { Prisma } from "@/generated/prisma/client";
import {
  CODE_COOLDOWN_SECONDS,
  CODE_TTL_MINUTES,
  MAX_ACTIVE_REQUESTS_PER_STUDENT,
  MAX_CODES_PER_15_MIN,
  MAX_CODES_PER_DAY,
  MAX_CODES_PER_HOUR_SITE,
  MAX_CODE_ATTEMPTS,
  MAX_REQUESTS_PER_DAY,
  MAX_REQUESTS_PER_HOUR,
  MAX_REQUESTS_PER_STUDENT_PER_DAY,
} from "./constants";

const MINUTE = 60 * 1000;
/** A burst queues behind the lock instead of failing: wait up to 10 s for a turn. */
const TX = { maxWait: 10_000, timeout: 10_000 };
const HOUR = 60 * MINUTE;

/** Held until the surrounding transaction ends. */
async function lock(tx: Prisma.TransactionClient, key: string): Promise<void> {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${key}))`;
}

// ---------------------------------------------------------------- claiming

export type ClaimOutcome = "won" | "taken" | "overlap";

/**
 * Claim an OPEN request for a member. The UPDATE guarded on status OPEN lets
 * exactly one concurrent claimer win, and a meeting that has started cannot be
 * claimed. A per-member lock makes the overlap check (#27) hold even when the
 * same member claims two overlapping sessions at once. Touching end to start
 * is not an overlap.
 */
export async function claimRequestRow(
  memberId: string,
  requestId: string,
  options: { allowOverlap?: boolean } = {},
): Promise<ClaimOutcome> {
  return prisma.$transaction(async (tx) => {
    await lock(tx, `claim:${memberId}`);
    const target = await tx.tutoringRequest.findUnique({
      where: { id: requestId },
      select: { status: true, meetingStart: true, meetingEnd: true },
    });
    if (!target || target.status !== "OPEN") return "taken";
    if (!options.allowOverlap) {
      const clashes = await tx.tutoringRequest.count({
        where: {
          claimedById: memberId,
          status: "CLAIMED",
          meetingStart: { lt: target.meetingEnd },
          meetingEnd: { gt: target.meetingStart },
        },
      });
      if (clashes > 0) return "overlap";
    }
    const now = new Date();
    const result = await tx.tutoringRequest.updateMany({
      where: { id: requestId, status: "OPEN", meetingStart: { gt: now } },
      data: { status: "CLAIMED", claimedById: memberId, claimedAt: now },
    });
    return result.count === 1 ? "won" : "taken";
  }, TX);
}

// ---------------------------------------------------------------- sign-in codes

export type IssueOutcome = { ok: true; id: string } | { ok: false; reason: "cooldown" | "limit" | "busy" };

/**
 * Store a new sign-in code for an address and retire every older one, under one
 * site-wide lock so the cooldown, per-address caps and the site-wide hourly cap
 * all hold under parallel requests (#2, #5). `throttle: false` is for codes an
 * officer creates (#40), which are never emailed.
 */
export async function issueLoginCode(
  email: string,
  codeHash: string,
  options: { pendingName?: string; throttle?: boolean } = {},
): Promise<IssueOutcome> {
  return prisma.$transaction(async (tx) => {
    await lock(tx, "login-code");
    const now = Date.now();
    if (options.throttle !== false) {
      const [recent, today, siteHour, latest] = await Promise.all([
        tx.loginCode.count({ where: { email, createdAt: { gte: new Date(now - 15 * MINUTE) } } }),
        tx.loginCode.count({ where: { email, createdAt: { gte: new Date(now - 24 * HOUR) } } }),
        tx.loginCode.count({ where: { createdAt: { gte: new Date(now - HOUR) } } }),
        tx.loginCode.findFirst({ where: { email }, orderBy: { createdAt: "desc" } }),
      ]);
      if (latest && now - latest.createdAt.getTime() < CODE_COOLDOWN_SECONDS * 1000) {
        return { ok: false, reason: "cooldown" };
      }
      if (recent >= MAX_CODES_PER_15_MIN || today >= MAX_CODES_PER_DAY) return { ok: false, reason: "limit" };
      if (siteHour >= MAX_CODES_PER_HOUR_SITE) return { ok: false, reason: "busy" };
    }
    // Only the newest code can ever work.
    await tx.loginCode.updateMany({ where: { email, usedAt: null }, data: { usedAt: new Date(now) } });
    const row = await tx.loginCode.create({
      data: {
        email,
        codeHash,
        pendingName: options.pendingName ?? null,
        expiresAt: new Date(now + CODE_TTL_MINUTES * MINUTE),
      },
    });
    return { ok: true, id: row.id };
  }, TX);
}

/** The address's newest code, used or not: an older code never becomes usable again. */
export function newestLoginCode(email: string) {
  return prisma.loginCode.findFirst({ where: { email }, orderBy: { createdAt: "desc" } });
}

/**
 * Count one guess BEFORE comparing (#2). A single conditional UPDATE, so fifty
 * parallel guesses still count as fifty and at most MAX_CODE_ATTEMPTS get
 * through. Returns this guess's number, or null if the code takes no more guesses.
 */
export async function countGuess(codeId: string): Promise<number | null> {
  try {
    const row = await prisma.loginCode.update({
      where: {
        id: codeId,
        usedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: MAX_CODE_ATTEMPTS },
      },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return row.attempts;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return null;
    throw err;
  }
}

/** Burn a code after a correct guess. Only one of several racing requests wins. */
export async function consumeLoginCode(codeId: string): Promise<boolean> {
  const burned = await prisma.loginCode.updateMany({
    where: { id: codeId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  return burned.count === 1;
}

// ---------------------------------------------------------------- tutoring requests

export interface NewRequest {
  studentName: string;
  studentEmail: string;
  gradeLevel: string;
  subject: string;
  topic: string;
  meetingStart: Date;
  meetingEnd: Date;
  receivedTeacherHelp: boolean;
}

export type InsertOutcome =
  | { ok: true; confirmToken: string; duplicate: boolean }
  | { ok: false; reason: "active" | "student-day" | "busy" };

/**
 * Save a new (unconfirmed) request. The exact-retry check, every cap and the
 * insert run under one lock, so parallel submissions can neither double up nor
 * pass the caps (#21, #39). An exact retry of a waiting request (same address,
 * course, meeting time and topic) returns that request instead of a new one;
 * any other request is saved, subject to the caps.
 */
export async function insertRequest(data: NewRequest): Promise<InsertOutcome> {
  return prisma.$transaction(async (tx) => {
    await lock(tx, "tutoring-request");
    const now = Date.now();
    const waiting = { in: ["UNCONFIRMED", "OPEN", "CLAIMED"] as ("UNCONFIRMED" | "OPEN" | "CLAIMED")[] };

    const retry = await tx.tutoringRequest.findFirst({
      where: {
        studentEmail: data.studentEmail,
        subject: data.subject,
        topic: data.topic,
        meetingStart: data.meetingStart,
        meetingEnd: data.meetingEnd,
        status: waiting,
      },
    });
    if (retry?.confirmToken) return { ok: true, confirmToken: retry.confirmToken, duplicate: true };

    const [activeForStudent, dayForStudent, hourOverall, dayOverall] = await Promise.all([
      tx.tutoringRequest.count({
        where: { studentEmail: data.studentEmail, status: waiting, meetingEnd: { gt: new Date(now) } },
      }),
      tx.tutoringRequest.count({
        where: { studentEmail: data.studentEmail, createdAt: { gte: new Date(now - 24 * HOUR) } },
      }),
      tx.tutoringRequest.count({ where: { createdAt: { gte: new Date(now - HOUR) } } }),
      tx.tutoringRequest.count({ where: { createdAt: { gte: new Date(now - 24 * HOUR) } } }),
    ]);
    if (activeForStudent >= MAX_ACTIVE_REQUESTS_PER_STUDENT) return { ok: false, reason: "active" };
    if (dayForStudent >= MAX_REQUESTS_PER_STUDENT_PER_DAY) return { ok: false, reason: "student-day" };
    if (hourOverall >= MAX_REQUESTS_PER_HOUR || dayOverall >= MAX_REQUESTS_PER_DAY) {
      return { ok: false, reason: "busy" };
    }

    const confirmToken = generateToken();
    await tx.tutoringRequest.create({ data: { ...data, status: "UNCONFIRMED", confirmToken } });
    return { ok: true, confirmToken, duplicate: false };
  }, TX);
}
