import "server-only";
import { prisma } from "./db";

/**
 * Complete, restorable backup of the tutoring records (issue #20). Loaded back
 * with `npm run restore` (scripts/restore.ts). Secrets are never exported:
 * confirm tokens, claim tokens, login codes and session versions are
 * regenerated or reset instead. Dates are exact ISO timestamps (UTC).
 */
export const BACKUP_FORMAT = "mat-tutoring-backup";
export const BACKUP_VERSION = 1;

export type BackupMember = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: string;
};

export type BackupRequest = {
  id: string;
  studentName: string;
  studentEmail: string;
  gradeLevel: string;
  subject: string;
  topic: string;
  meetingStart: string;
  meetingEnd: string;
  /** Officer-only survey answer: present only in admin downloads, never in emails. */
  receivedTeacherHelp?: boolean | null;
  status: string;
  claimedById: string | null;
  claimedAt: string | null;
  createdAt: string;
  confirmedAt: string | null;
};

export type BackupCredit = {
  id: string;
  requestId: string;
  memberId: string;
  minutes: number;
  notes: string | null;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
};

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  members: BackupMember[];
  requests: BackupRequest[];
  credits: BackupCredit[];
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** includeSurvey adds receivedTeacherHelp; keep it false for anything emailed. */
export async function buildBackupJson(options: { includeSurvey: boolean }): Promise<string> {
  const [members, requests, credits] = await Promise.all([
    prisma.member.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.tutoringRequest.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.creditLog.findMany({ orderBy: { submittedAt: "asc" } }),
  ]);

  const backup: Backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      active: m.active,
      createdAt: m.createdAt.toISOString(),
    })),
    requests: requests.map((r) => ({
      id: r.id,
      studentName: r.studentName,
      studentEmail: r.studentEmail,
      gradeLevel: r.gradeLevel,
      subject: r.subject,
      topic: r.topic,
      meetingStart: r.meetingStart.toISOString(),
      meetingEnd: r.meetingEnd.toISOString(),
      ...(options.includeSurvey ? { receivedTeacherHelp: r.receivedTeacherHelp } : {}),
      status: r.status,
      claimedById: r.claimedById,
      claimedAt: iso(r.claimedAt),
      createdAt: r.createdAt.toISOString(),
      confirmedAt: iso(r.confirmedAt),
    })),
    credits: credits.map((c) => ({
      id: c.id,
      requestId: c.requestId,
      memberId: c.memberId,
      minutes: c.minutes,
      notes: c.notes,
      status: c.status,
      submittedAt: c.submittedAt.toISOString(),
      reviewedAt: iso(c.reviewedAt),
    })),
  };
  return JSON.stringify(backup, null, 2);
}
