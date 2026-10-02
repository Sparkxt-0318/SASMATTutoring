import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { cancelRequest, resendBlast, reassignRequest } from "@/lib/actions/admin";
import { formatDate, formatMeeting } from "@/lib/constants";

export const metadata: Metadata = { title: "Requests" };

const URGENT_HOURS = 24;

/** Unclaimed and the meeting starts within a day (or has already started). */
function needsTutorSoon(request: { status: string; meetingStart: Date }): boolean {
  return (
    request.status === "OPEN" &&
    request.meetingStart.getTime() - Date.now() < URGENT_HOURS * 60 * 60 * 1000
  );
}

export default async function AdminRequestsPage() {
  const [requests, activeMembers] = await Promise.all([
    prisma.tutoringRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        claimedBy: true,
        claimTokens: { select: { emailedAt: true } },
      },
    }),
    prisma.member.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  // Survey: how many students already tried their teacher first (answered requests only).
  const answered = requests.filter((r) => r.receivedTeacherHelp !== null);
  const teacherFirst = answered.filter((r) => r.receivedTeacherHelp).length;

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Requests</h1>
      <p className="mt-1 text-sm text-muted">
        Every tutoring request, newest first. Unclaimed requests whose meeting starts within{" "}
        {URGENT_HOURS} hours are flagged.
      </p>
      {answered.length > 0 && (
        <p className="mt-1 text-sm text-muted">
          Survey: {teacherFirst} of {answered.length} student{answered.length === 1 ? "" : "s"} got
          help from their teacher before asking us.
        </p>
      )}

      {requests.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white p-12 text-center shadow-sm">
          <p className="text-muted">No requests yet. They&rsquo;ll appear here as students submit the form.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline/60 text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3.5 font-semibold">Student</th>
                <th className="px-5 py-3.5 font-semibold">Course</th>
                <th className="px-5 py-3.5 font-semibold">Meeting</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 font-semibold">Tutor</th>
                <th className="px-5 py-3.5 font-semibold">Requested</th>
                <th className="px-5 py-3.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const isUrgent = needsTutorSoon(request);
                const blastIncomplete =
                  request.status === "OPEN" &&
                  (request.claimTokens.length === 0 ||
                    request.claimTokens.some((t) => t.emailedAt === null));
                return (
                  <tr key={request.id} className="border-b border-hairline/40 last:border-0 align-top">
                    <td className="px-5 py-4">
                      <p className="font-medium text-foreground">{request.studentName}</p>
                      <p className="text-xs text-muted">
                        {request.studentEmail} · Grade {request.gradeLevel}
                      </p>
                      {request.receivedTeacherHelp !== null && (
                        <p className="mt-0.5 text-xs text-faint">
                          Teacher helped first: {request.receivedTeacherHelp ? "Yes" : "No"}
                        </p>
                      )}
                      <p className="mt-1 max-w-[220px] truncate text-xs text-faint" title={request.topic}>
                        {request.topic}
                      </p>
                    </td>
                    <td className="px-5 py-4">{request.subject}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-muted">
                      {formatMeeting(request.meetingStart, request.meetingEnd)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1.5">
                        <StatusBadge status={request.status} />
                        {isUrgent && (
                          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                            Needs a tutor
                          </span>
                        )}
                        {blastIncomplete && (
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                            Blast incomplete
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">{request.claimedBy?.name ?? "None yet"}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-muted">
                      {formatDate(request.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      {request.status === "OPEN" && (
                        <div className="flex flex-col items-start gap-2">
                          <form action={resendBlast.bind(null, request.id)}>
                            <button type="submit" className="text-accent hover:underline">
                              Resend blast
                            </button>
                          </form>
                          <form
                            action={async (formData: FormData) => {
                              "use server";
                              const memberId = String(formData.get("memberId") ?? "");
                              if (memberId) await reassignRequest(request.id, memberId);
                            }}
                            className="flex items-center gap-1.5"
                          >
                            <select
                              name="memberId"
                              defaultValue=""
                              className="rounded-lg border border-hairline bg-white px-2 py-1 text-xs"
                            >
                              <option value="" disabled>
                                Assign to…
                              </option>
                              {activeMembers.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.name}
                                </option>
                              ))}
                            </select>
                            <button type="submit" className="text-accent hover:underline">
                              Assign
                            </button>
                          </form>
                          <form action={cancelRequest.bind(null, request.id)}>
                            <button type="submit" className="text-red-600 hover:underline">
                              Cancel
                            </button>
                          </form>
                        </div>
                      )}
                      {request.status === "CLAIMED" && (
                        <form action={cancelRequest.bind(null, request.id)}>
                          <button type="submit" className="text-red-600 hover:underline">
                            Cancel
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
