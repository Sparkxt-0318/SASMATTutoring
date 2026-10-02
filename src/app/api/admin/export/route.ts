import { isAdmin } from "@/lib/auth";
import { csvResponse, csvRow } from "@/lib/csv";
import { getCombinedTotal, getLeaderboard } from "@/lib/stats";
import { minutesToHours } from "@/lib/constants";

export async function GET(): Promise<Response> {
  if (!(await isAdmin())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [leaderboard, combined] = await Promise.all([getLeaderboard(), getCombinedTotal()]);

  return csvResponse(
    [
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
    ],
    "mat-tutoring-hours.csv",
  );
}
