/**
 * Dev seed: creates a few FAKE members so the flows can be tested locally.
 * Never put real member emails here; use aliases you control.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEV_MEMBERS = [
  { name: "Alice Zhang", email: "dev+alice@example.com" },
  { name: "Ben Park", email: "dev+ben@example.com" },
  { name: "Chloe Wu", email: "dev+chloe@example.com" },
];

async function main() {
  for (const member of DEV_MEMBERS) {
    await prisma.member.upsert({
      where: { email: member.email },
      update: {},
      create: member,
    });
  }
  console.log(`Seeded ${DEV_MEMBERS.length} dev members.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
