import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { csvResponse, csvRow } from "@/lib/csv";
import { formatDate, formatMeeting, meetingMinutes } from "@/lib/constants";

/** Every request ever made, with tutor and credit. An end-of-year record and a backup. */
export async function GET(): Promise<Response> {
  if (!(await isAdmin())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const requests = await prisma.tutoringRequest.findMany({
    orderBy: { createdAt: "asc" },
    include: { claimedBy: true, credit: true },
  });

  return csvResponse(
    [
      "Requested,Student,Student email,Grade,Course,Meeting,Booked minutes,Status,Tutor,Tutor email,Credited minutes,Teacher helped first",
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
          r.receivedTeacherHelp === null ? "" : r.receivedTeacherHelp ? "Yes" : "No",
        ]),
      ),
    ],
    "mat-tutoring-all-sessions.csv",
  );
}
