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

/** Approved hours per member (includes inactive members with history). */
export async function getLeaderboard(): Promise<MemberTotals[]> {
  const members = await prisma.member.findMany({
    include: {
      credits: { where: { status: "APPROVED" }, select: { minutes: true } },
    },
  });
  return members
    .map((m) => ({
      memberId: m.id,
      name: m.name,
      email: m.email,
      active: m.active,
      totalMinutes: m.credits.reduce((sum, c) => sum + c.minutes, 0),
      sessionCount: m.credits.length,
    }))
    .filter((m) => m.active || m.totalMinutes > 0)
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}

/** Combined all-time approved minutes across every member. */
export async function getCombinedTotal(): Promise<{ minutes: number; sessions: number }> {
  const result = await prisma.creditLog.aggregate({
    where: { status: "APPROVED" },
    _sum: { minutes: true },
    _count: true,
  });
  return { minutes: result._sum.minutes ?? 0, sessions: result._count };
}

/** Everything the weekly digest email needs. */
export async function getDigestData(since: Date): Promise<DigestData> {
  const [leaderboard, combined, pendingCount, weekCredits] = await Promise.all([
    getLeaderboard(),
    getCombinedTotal(),
    prisma.creditLog.count({ where: { status: "PENDING" } }),
    prisma.creditLog.findMany({
      where: { status: "APPROVED", reviewedAt: { gte: since } },
      select: { memberId: true, minutes: true },
    }),
  ]);

  const weekByMember = new Map<string, number>();
  for (const credit of weekCredits) {
    weekByMember.set(credit.memberId, (weekByMember.get(credit.memberId) ?? 0) + credit.minutes);
  }

  const members: DigestMemberRow[] = leaderboard.map((m) => ({
    name: m.active ? m.name : `${m.name} (former)`,
    totalMinutes: m.totalMinutes,
    sessionCount: m.sessionCount,
    weekMinutes: weekByMember.get(m.memberId) ?? 0,
  }));

  return {
    totalMinutesAllTime: combined.minutes,
    totalSessionsAllTime: combined.sessions,
    weekMinutes: weekCredits.reduce((sum, c) => sum + c.minutes, 0),
    pendingCount,
    members,
  };
}
