import "server-only";
import { prisma } from "./db";
import { csvRow } from "./csv";
import { getCombinedTotal, getLeaderboard } from "./stats";
import { formatDate, formatMeeting, meetingMinutes, minutesToHours } from "./constants";

/** Credited hours per member plus the club total. */
export async function buildHoursCsv(): Promise<string> {
  const [leaderboard, combined] = await Promise.all([getLeaderboard(), getCombinedTotal()]);
  return [
    "Member,Email,Status,Approved Hours,Approved Minutes,Sessions",
    ...leaderboard.map((m) =>
      csvRow([
        m.name,
        m.email,
        m.active ? "Active" : "Former",
        minutesToHours(m.totalMinutes),
        m.totalMinutes,
        m.sessionCount,
      ]),
    ),
    "",
    csvRow(["Total (all members)", "", "", minutesToHours(combined.minutes), combined.minutes, combined.sessions]),
  ].join("\n");
}

/**
 * Every request ever made, with tutor and credit. A readable record; the
 * restorable backup is the JSON in backup.ts. includeSurvey adds the officer-only
 * "Teacher helped first" column, so keep it false for anything emailed.
 */
export async function buildSessionsCsv(options: { includeSurvey: boolean }): Promise<string> {
  const requests = await prisma.tutoringRequest.findMany({
    orderBy: { createdAt: "asc" },
    include: { claimedBy: true, credit: true },
  });
  return [
    "Requested,Student,Student email,Grade,Course,Meeting,Booked minutes,Status,Tutor,Tutor email,Credited minutes" +
      (options.includeSurvey ? ",Teacher helped first" : ""),
    ...requests.map((r) =>
      csvRow([
        formatDate(r.createdAt),
        r.studentName,
        r.studentEmail,
        r.gradeLevel,
        r.subject,
        formatMeeting(r.meetingStart, r.meetingEnd),
        meetingMinutes(r.meetingStart, r.meetingEnd),
        r.status,
        r.claimedBy?.name,
        r.claimedBy?.email,
        r.credit?.status === "APPROVED" ? r.credit.minutes : "",
        ...(options.includeSurvey
          ? [r.receivedTeacherHelp === null ? "" : r.receivedTeacherHelp ? "Yes" : "No"]
          : []),
      ]),
    ),
  ].join("\n");
}

/** The roster, so it can be rebuilt. Never includes passwords or hashes. */
export async function buildMembersCsv(): Promise<string> {
  const members = await prisma.member.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return [
    "Name,Email,Status,Joined",
    ...members.map((m) => csvRow([m.name, m.email, m.active ? "Active" : "Inactive", formatDate(m.createdAt)])),
  ].join("\n");
}
