/**
 * Verifies first-click-wins claiming is race-safe: fires N concurrent claim
 * attempts (the same conditional UPDATE used by claimRequest in
 * src/lib/actions/claims.ts) against one OPEN request and asserts exactly one
 * wins.
 *
 * Run with: npm run race-test
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CONTENDERS = 5;

async function main() {
  const request = await prisma.tutoringRequest.create({
    data: {
      studentName: "Race Test Student",
      studentEmail: "race-test@saschina.org",
      gradeLevel: "11",
      subject: "AP Calculus BC",
      topic: "Race condition test request",
      meetingStart: new Date(Date.now() + 24 * 60 * 60 * 1000),
      meetingEnd: new Date(Date.now() + 25 * 60 * 60 * 1000),
    },
  });

  const members = await Promise.all(
    Array.from({ length: CONTENDERS }, (_, i) =>
      prisma.member.upsert({
        where: { email: `race-test-${i}@example.com` },
        update: {},
        create: { name: `Race Tester ${i}`, email: `race-test-${i}@example.com` },
      }),
    ),
  );

  const results = await Promise.all(
    members.map((member) =>
      prisma.tutoringRequest.updateMany({
        where: { id: request.id, status: "OPEN", meetingStart: { gt: new Date() } },
        data: { status: "CLAIMED", claimedById: member.id, claimedAt: new Date() },
      }),
    ),
  );

  const winners = results.filter((r) => r.count === 1).length;
  const final = await prisma.tutoringRequest.findUniqueOrThrow({
    where: { id: request.id },
    include: { claimedBy: true },
  });

  console.log(`${CONTENDERS} concurrent claims → ${winners} winner(s)`);
  console.log(`Final status: ${final.status}, claimed by: ${final.claimedBy?.name}`);

  // Clean up test rows.
  await prisma.tutoringRequest.delete({ where: { id: request.id } });
  await prisma.member.deleteMany({ where: { email: { startsWith: "race-test-" } } });

  if (winners !== 1 || final.status !== "CLAIMED" || !final.claimedById) {
    console.error("FAIL: expected exactly 1 winner and a CLAIMED request.");
    process.exit(1);
  }
  console.log("PASS: exactly one concurrent claim succeeded.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
