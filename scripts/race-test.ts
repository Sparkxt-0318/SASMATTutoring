/**
 * Fires parallel calls at the race-safe writes in src/lib/race-safe.ts (the
 * exact functions the app uses) and checks that every limit holds:
 *   1. claim: many members, one request: exactly one wins
 *   2. overlap: one member, two overlapping requests: exactly one is claimed
 *   3. PIN issuance: parallel requests for one address: one code, the rest wait
 *   4. PIN guesses: 50 parallel guesses: at most MAX_CODE_ATTEMPTS are counted
 *   5. PIN use: parallel sign ins with one code: it is used once
 *   6. request form: parallel exact retries save one request, and a burst of
 *      different students never passes the hourly cap
 *
 * Needs Postgres and .env. Test rows use @race-test.invalid addresses and are
 * deleted at the end. Run with: npm run race-test
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import {
  claimRequestRow,
  consumeLoginCode,
  countGuess,
  insertRequest,
  issueLoginCode,
  type NewRequest,
} from "../src/lib/race-safe";
import { MAX_CODE_ATTEMPTS, MAX_REQUESTS_PER_HOUR } from "../src/lib/constants";

const DOMAIN = "@race-test.invalid";
const HOUR = 60 * 60 * 1000;
let failed = false;

function check(ok: boolean, label: string): void {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) failed = true;
}

function newRequest(student: string, startInHours: number, topic = "Race test"): NewRequest {
  const start = new Date(Date.now() + startInHours * HOUR);
  return {
    studentName: "Race Test Student",
    studentEmail: `${student}${DOMAIN}`,
    gradeLevel: "11",
    subject: "AP Calculus BC",
    topic,
    meetingStart: start,
    meetingEnd: new Date(start.getTime() + HOUR),
    receivedTeacherHelp: false,
  };
}

async function openRequest(startInHours: number) {
  const data = newRequest("student", startInHours);
  return prisma.tutoringRequest.create({ data: { ...data, status: "OPEN", confirmedAt: new Date() } });
}

async function cleanup(): Promise<void> {
  await prisma.tutoringRequest.deleteMany({ where: { studentEmail: { endsWith: DOMAIN } } });
  await prisma.loginCode.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  await prisma.member.deleteMany({ where: { email: { endsWith: DOMAIN } } });
}

async function main() {
  await cleanup();
  const members = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      prisma.member.create({ data: { name: `Race Tester ${i}`, email: `member-${i}${DOMAIN}` } }),
    ),
  );

  // 1. Claim race.
  const target = await openRequest(24);
  const claims = await Promise.all(members.map((m) => claimRequestRow(m.id, target.id)));
  check(claims.filter((c) => c === "won").length === 1, `${members.length} parallel claims: one winner`);

  // 2. Overlap race: 48h to 49h and 48.5h to 49.5h, claimed at once by the same member.
  const [a, b] = await Promise.all([openRequest(48), openRequest(48.5)]);
  const overlap = await Promise.all([claimRequestRow(members[0].id, a.id), claimRequestRow(members[0].id, b.id)]);
  check(
    overlap.filter((c) => c === "won").length === 1 && overlap.includes("overlap"),
    `two overlapping claims by one member: ${overlap.join(" and ")}`,
  );

  // 3. PIN issuance race.
  const email = `pin${DOMAIN}`;
  const issued = await Promise.all(Array.from({ length: 10 }, (_, i) => issueLoginCode(email, `hash-${i}`)));
  const live = await prisma.loginCode.count({ where: { email, usedAt: null } });
  check(issued.filter((r) => r.ok).length === 1 && live === 1, "10 parallel code requests: one code issued");

  // 4. PIN guess race.
  const code = issued.find((r) => r.ok);
  const codeId = code && code.ok ? code.id : "";
  const guesses = await Promise.all(Array.from({ length: 50 }, () => countGuess(codeId)));
  const counted = guesses.filter((g) => g !== null).length;
  check(counted === MAX_CODE_ATTEMPTS, `50 parallel guesses: ${counted} counted (limit ${MAX_CODE_ATTEMPTS})`);

  // 5. One code, many parallel sign ins.
  const fresh = await issueLoginCode(`use${DOMAIN}`, "hash-use", { throttle: false });
  const uses = fresh.ok ? await Promise.all(Array.from({ length: 5 }, () => consumeLoginCode(fresh.id))) : [];
  check(uses.filter(Boolean).length === 1, "5 parallel sign ins with one code: used once");

  // 6a. Exact retries (double clicks) save one request.
  const retry = newRequest("retry", 72, "Exact retry");
  const retries = await Promise.all(Array.from({ length: 5 }, () => insertRequest(retry)));
  const saved = await prisma.tutoringRequest.count({ where: { studentEmail: retry.studentEmail } });
  check(saved === 1 && retries.every((r) => r.ok), "5 parallel identical submissions: one request saved");

  // 6b. A burst of different students cannot pass the hourly cap.
  const burst = await Promise.all(
    Array.from({ length: MAX_REQUESTS_PER_HOUR + 4 }, (_, i) => insertRequest(newRequest(`burst-${i}`, 96))),
  );
  const lastHour = await prisma.tutoringRequest.count({ where: { createdAt: { gte: new Date(Date.now() - HOUR) } } });
  check(
    lastHour <= MAX_REQUESTS_PER_HOUR && burst.some((r) => !r.ok),
    `${burst.length} parallel requests: ${lastHour} saved in the last hour (cap ${MAX_REQUESTS_PER_HOUR})`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    failed = true;
  })
  .finally(async () => {
    await cleanup().catch((err) => console.error("Cleanup failed:", err));
    await prisma.$disconnect();
    process.exit(failed ? 1 : 0);
  });
