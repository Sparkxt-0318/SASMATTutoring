import { prisma } from "./db";
import type { DigestData, DigestMemberRow } from "@/emails/templates";

export interface MemberTotals {
  memberId: string;
  name: string;
  email: string;
  active: boolean;
  totalMinutes: number;
  sessionCount: number;
}

/** Credited hours per member (includes inactive members with history). Summed in the database. */
export async function getLeaderboard(): Promise<MemberTotals[]> {
  const [members, totals] = await Promise.all([
    prisma.member.findMany({ select: { id: true, name: true, email: true, active: true } }),
    prisma.creditLog.groupBy({
      by: ["memberId"],
      where: { status: "APPROVED" },
      _sum: { minutes: true },
      _count: true,
    }),
  ]);
  const byMember = new Map(totals.map((t) => [t.memberId, t]));
  return members
    .map((m) => ({
      memberId: m.id,
      name: m.name,
      email: m.email,
      active: m.active,
      totalMinutes: byMember.get(m.id)?._sum.minutes ?? 0,
      sessionCount: byMember.get(m.id)?._count ?? 0,
    }))
    .filter((m) => m.active || m.totalMinutes > 0)
    .sort((a, b) => b.totalMinutes - a.totalMinutes || a.name.localeCompare(b.name));
}

/** Combined all-time credited minutes across every member. */
export async function getCombinedTotal(): Promise<{ minutes: number; sessions: number }> {
  const result = await prisma.creditLog.aggregate({
    where: { status: "APPROVED" },
    _sum: { minutes: true },
    _count: true,
  });
  return { minutes: result._sum.minutes ?? 0, sessions: result._count };
}

/** One member's credited minutes (for their personal progress grid). */
export async function getMemberMinutes(memberId: string): Promise<number> {
  const result = await prisma.creditLog.aggregate({
    where: { memberId, status: "APPROVED" },
    _sum: { minutes: true },
  });
  return result._sum.minutes ?? 0;
}

/** Claimed sessions whose meeting time has passed but haven't been credited yet. */
export async function countAwaitingCredit(): Promise<number> {
  return prisma.tutoringRequest.count({
    where: { status: "CLAIMED", meetingEnd: { lt: new Date() } },
  });
}

/** Everything the weekly digest email needs. */
export async function getDigestData(since: Date): Promise<DigestData> {
  const [leaderboard, combined, awaitingCreditCount, weekCredits] = await Promise.all([
    getLeaderboard(),
    getCombinedTotal(),
    countAwaitingCredit(),
    prisma.creditLog.groupBy({
      by: ["memberId"],
      where: { status: "APPROVED", reviewedAt: { gte: since } },
      _sum: { minutes: true },
    }),
  ]);

  const weekByMember = new Map(weekCredits.map((c) => [c.memberId, c._sum.minutes ?? 0]));

  const members: DigestMemberRow[] = leaderboard.map((m) => ({
    name: m.active ? m.name : `${m.name} (former)`,
    totalMinutes: m.totalMinutes,
    sessionCount: m.sessionCount,
    weekMinutes: weekByMember.get(m.memberId) ?? 0,
  }));

  return {
    totalMinutesAllTime: combined.minutes,
    totalSessionsAllTime: combined.sessions,
    weekMinutes: weekCredits.reduce((sum, c) => sum + (c._sum.minutes ?? 0), 0),
    awaitingCreditCount,
    members,
  };
}
