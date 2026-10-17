/**
 * Loads a JSON backup (from the admin "Full backup" link or the weekly report
 * email, built by src/lib/backup.ts) into the database in DATABASE_URL.
 * Refuses unless that database has no members and no requests, so it can never
 * merge into or overwrite live data. Apply migrations first (npm run db:deploy).
 * Ids and every timestamp are kept; confirm tokens, claim tokens, login codes
 * and sessions are not in backups and start fresh.
 *
 * Run with: npm run restore -- path/to/backup.json
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { CreditStatus, RequestStatus } from "../src/generated/prisma/client";
import type { Backup } from "../src/lib/backup";

function fail(message: string): never {
  console.error(`Restore refused: ${message}`);
  process.exit(1);
}

const date = (s: string) => new Date(s);
const maybeDate = (s: string | null) => (s ? new Date(s) : null);

async function main() {
  const file = process.argv[2];
  if (!file) fail("give the backup file, e.g. npm run restore -- mat-backup-2026-10-17.json");

  let backup: Backup;
  try {
    backup = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    fail(`could not read ${file} as JSON (${(err as Error).message})`);
  }
  if (backup.format !== "mat-tutoring-backup") fail("this is not a MAT tutoring backup file");
  if (backup.version !== 1) fail(`unsupported backup version ${backup.version} (this script reads version 1)`);
  if (![backup.members, backup.requests, backup.credits].every(Array.isArray)) {
    fail("the file is missing its members, requests or credits list");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const [memberCount, requestCount] = await Promise.all([
      prisma.member.count(),
      prisma.tutoringRequest.count(),
    ]);
    if (memberCount > 0 || requestCount > 0) {
      fail(
        `the database already has ${memberCount} member(s) and ${requestCount} request(s). ` +
          "Restore only into an empty database with migrations applied.",
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.member.createMany({
        data: backup.members.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          active: m.active,
          createdAt: date(m.createdAt),
        })),
      });
      await tx.tutoringRequest.createMany({
        data: backup.requests.map((r) => ({
          id: r.id,
          studentName: r.studentName,
          studentEmail: r.studentEmail,
          gradeLevel: r.gradeLevel,
          subject: r.subject,
          topic: r.topic,
          meetingStart: date(r.meetingStart),
          meetingEnd: date(r.meetingEnd),
          receivedTeacherHelp: r.receivedTeacherHelp ?? null,
          status: r.status as RequestStatus,
          claimedById: r.claimedById,
          claimedAt: maybeDate(r.claimedAt),
          createdAt: date(r.createdAt),
          confirmedAt: maybeDate(r.confirmedAt),
          confirmToken: null,
        })),
      });
      await tx.creditLog.createMany({
        data: backup.credits.map((c) => ({
          id: c.id,
          requestId: c.requestId,
          memberId: c.memberId,
          minutes: c.minutes,
          notes: c.notes,
          status: c.status as CreditStatus,
          submittedAt: date(c.submittedAt),
          reviewedAt: maybeDate(c.reviewedAt),
        })),
      });
    });

    console.log(
      `Restored ${backup.members.length} members, ${backup.requests.length} requests, ` +
        `${backup.credits.length} credits (backup from ${backup.exportedAt}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Restore failed, nothing was written:", err);
  process.exit(1);
});
