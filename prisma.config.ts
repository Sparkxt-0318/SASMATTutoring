import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // The CLI (migrations, studio) uses this URL; prefer the direct
    // (non-pooled) connection. The app itself connects via the pg adapter
    // in src/lib/db.ts using the pooled DATABASE_URL.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
