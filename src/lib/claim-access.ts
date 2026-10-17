import { isPast } from "./constants";

/**
 * Whether a claim link may show the student's contact details (#18), shared by
 * both claim routes so a deep link cannot skip a check: the link's member is
 * still active and holds the session, and the meeting has not ended (the same
 * rule as the member dashboard). Cancelled, expired and completed sessions show
 * their status instead.
 */
export function canSeeStudentDetails(
  token: { memberId: string; member: { active: boolean } },
  request: { status: string; claimedById: string | null; meetingEnd: Date },
): boolean {
  return (
    token.member.active &&
    request.status === "CLAIMED" &&
    request.claimedById === token.memberId &&
    !isPast(request.meetingEnd)
  );
}
