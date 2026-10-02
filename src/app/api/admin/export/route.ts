import { isAdmin } from "@/lib/auth";
import { csvResponse } from "@/lib/csv";
import { buildHoursCsv } from "@/lib/exports";

export async function GET(): Promise<Response> {
  if (!(await isAdmin())) {
    return new Response("Unauthorized", { status: 401 });
  }
  return csvResponse((await buildHoursCsv()).split("\n"), "mat-tutoring-hours.csv");
}
