import { isAdmin } from "@/lib/auth";
import { csvResponse } from "@/lib/csv";
import { buildSessionsCsv } from "@/lib/exports";

/** Every request ever made, with tutor and credit. An end-of-year record and a backup. */
export async function GET(): Promise<Response> {
  if (!(await isAdmin())) {
    return new Response("Unauthorized", { status: 401 });
  }
  return csvResponse((await buildSessionsCsv()).split("\n"), "mat-tutoring-all-sessions.csv");
}
