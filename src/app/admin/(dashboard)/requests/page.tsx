import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { blastIncompleteWhere } from "@/lib/blast";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Notice } from "@/components/Notice";
import { cancelRequest, reopenRequest, resendBlast, reassignRequest } from "@/lib/actions/admin";
import { CreditsCard, CreditsCardMissing } from "@/components/CreditsCard";
import { creditsUrl, formatDate, formatMeeting } from "@/lib/constants";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Requests" };

const URGENT_HOURS = 24;
const RECENT_DAYS = 30;
const PAGE_SIZE = 100;

/** Unclaimed and the meeting starts within a day (or has already started). */
function needsTutorSoon(request: { status: string; meetingStart: Date }): boolean {
  return (
    request.status === "OPEN" &&
    request.meetingStart.getTime() - Date.now() < URGENT_HOURS * 60 * 60 * 1000
  );
}

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; n?: string; view?: string; page?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const showAll = params.view === "all";
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const now = new Date();

  // By default only what officers act on: anything still live, plus the last
  // 30 days. "Show older" pages through everything (#38).
  const where: Prisma.TutoringRequestWhereInput = showAll
    ? {}
    : {
        OR: [
          { status: { in: ["UNCONFIRMED", "OPEN", "CLAIMED"] } },
          { createdAt: { gte: new Date(now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000) } },
        ],
      };

  const [requests, total, activeMembers, survey] = await Promise.all([
    prisma.tutoringRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { claimedBy: true },
      ...(showAll ? { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE } : {}),
    }),
    prisma.tutoringRequest.count({ where }),
    prisma.member.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    // Survey: each student counts once, with their latest answer (#28).
    prisma.tutoringRequest.findMany({
      where: { receivedTeacherHelp: { not: null }, status: { not: "UNCONFIRMED" } },
      orderBy: { createdAt: "desc" },
      distinct: ["studentEmail"],
      select: { receivedTeacherHelp: true },
    }),
  ]);
  const incomplete = new Set(
    (
      await prisma.tutoringRequest.findMany({
        where: { id: { in: requests.map((r) => r.id) }, ...blastIncompleteWhere(now) },
        select: { id: true },
      })
    ).map((r) => r.id),
  );

  const creditsLink = creditsUrl();
  const teacherFirst = survey.filter((r) => r.receivedTeacherHelp).length;
  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="mb-8">
        {creditsLink ? <CreditsCard href={creditsLink} /> : <CreditsCardMissing />}
      </div>

      <Notice notice={params.notice} n={params.n} />

      <h1 className="text-3xl font-semibold tracking-tight">Requests</h1>
      <p className="mt-1 text-sm text-muted">
        {showAll
          ? "Every tutoring request, newest first."
          : `Open and claimed requests, plus everything from the last ${RECENT_DAYS} days, newest first.`}{" "}
        Unclaimed requests whose meeting starts within {URGENT_HOURS} hours are flagged.{" "}
        <Link href={showAll ? "/admin/requests" : "/admin/requests?view=all"} className="text-accent hover:underline">
          {showAll ? "Show recent only" : "Show older"}
        </Link>
      </p>
      {survey.length > 0 && (
        <p className="mt-1 text-sm text-muted">
          Survey: {teacherFirst} of {survey.length} student{survey.length === 1 ? "" : "s"} got
          help from their teacher before asking us (each student counted once, latest answer).
        </p>
      )}

      {requests.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white p-12 text-center shadow-sm">
          <p className="text-muted">No requests yet. They&rsquo;ll appear here as students submit the form.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline/60 text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3.5 font-semibold">Student</th>
                <th className="px-4 py-3.5 font-semibold">Course</th>
                <th className="px-4 py-3.5 font-semibold">Meeting</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">Tutor</th>
                <th className="px-4 py-3.5 font-semibold">Requested</th>
                <th className="px-4 py-3.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const isUrgent = needsTutorSoon(request);
                const blastIncomplete = incomplete.has(request.id);
                const ahead = request.meetingStart > now;
                return (
                  <tr key={request.id} className="border-b border-hairline/40 last:border-0 align-top">
                    <td className="px-4 py-4">
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
                    <td className="px-4 py-4">{request.subject}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-muted">
                      {formatMeeting(request.meetingStart, request.meetingEnd)}
                    </td>
                    <td className="px-4 py-4">
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
                    <td className="px-4 py-4">{request.claimedBy?.name ?? "None yet"}</td>
                    <td className="px-4 py-4 text-muted">
                      {formatDate(request.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-start gap-2">
                        {request.status === "UNCONFIRMED" && (
                          <p className="text-xs text-muted">Waiting for the student to confirm.</p>
                        )}
                        {request.status === "OPEN" && (
                          <>
                            <form action={resendBlast.bind(null, request.id)}>
                              <button type="submit" className="text-accent hover:underline">
                                Resend blast
                              </button>
                            </form>
                            {ahead && (
                              <form
                                action={reassignRequest.bind(null, request.id)}
                                className="flex flex-col items-start gap-1.5"
                              >
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <select
                                    name="memberId"
                                    defaultValue=""
                                    required
                                    aria-label="Member to assign"
                                    className="rounded-lg border border-hairline bg-white px-2 py-1 text-xs"
                                  >
                                    <option value="" disabled>
                                      Assign to...
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
                                </div>
                                <label className="flex items-center gap-1.5 text-xs text-muted">
                                  <input type="checkbox" name="allowOverlap" />
                                  Assign anyway if they are busy then
                                </label>
                              </form>
                            )}
                          </>
                        )}
                        {request.status === "CLAIMED" && ahead && (
                          <form action={reopenRequest.bind(null, request.id)}>
                            <button type="submit" className="text-accent hover:underline">
                              Reopen
                            </button>
                          </form>
                        )}
                        {["UNCONFIRMED", "OPEN", "CLAIMED"].includes(request.status) && (
                          <ConfirmButton
                            label="Cancel"
                            confirmLabel="Cancel request"
                            question={
                              ahead && request.status !== "UNCONFIRMED"
                                ? "The student, and the tutor if there is one, will be emailed."
                                : "Nobody is emailed."
                            }
                            action={cancelRequest.bind(null, request.id, "requests")}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAll && pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-4 text-sm" aria-label="Pages">
          {page > 1 && (
            <Link href={`/admin/requests?view=all&page=${page - 1}`} className="text-accent hover:underline">
              Newer
            </Link>
          )}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link href={`/admin/requests?view=all&page=${page + 1}`} className="text-accent hover:underline">
              Older
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
