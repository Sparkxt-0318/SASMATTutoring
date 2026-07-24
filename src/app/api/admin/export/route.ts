import { isAdmin } from "@/lib/auth";
import { getCombinedTotal, getLeaderboard } from "@/lib/stats";
import { minutesToHours } from "@/lib/constants";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function GET(): Promise<Response> {
  if (!(await isAdmin())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [leaderboard, combined] = await Promise.all([getLeaderboard(), getCombinedTotal()]);

  const lines = [
    "Member,Email,Status,Approved Hours,Approved Minutes,Sessions",
    ...leaderboard.map((m) =>
      [
        csvEscape(m.name),
        csvEscape(m.email),
        m.active ? "Active" : "Former",
        minutesToHours(m.totalMinutes),
        String(m.totalMinutes),
        String(m.sessionCount),
      ].join(","),
    ),
    "",
    `Total (all members),,,${minutesToHours(combined.minutes)},${combined.minutes},${combined.sessions}`,
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mat-tutoring-hours.csv"`,
    },
  });
}
