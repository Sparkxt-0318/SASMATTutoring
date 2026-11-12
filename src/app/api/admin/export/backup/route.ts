import { isAdmin } from "@/lib/auth";
import { buildBackupJson } from "@/lib/backup";

/** Complete JSON backup (with survey answers), restorable with `npm run restore`. */
export async function GET(): Promise<Response> {
  if (!(await isAdmin())) {
    return new Response("Unauthorized", { status: 401 });
  }
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
  return new Response(await buildBackupJson({ includeSurvey: true }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mat-backup-${date}.json"`,
    },
  });
}
