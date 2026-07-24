# MAT Tutoring platform

Peer tutoring app for Mu Alpha Theta at Shanghai American School. Students submit
the public form; all active members are emailed personal claim links; first click
wins; tutors log hours; officers approve them. See README.md for the full runbook.

## Key facts

- Next.js App Router + TypeScript + Tailwind 4. Prisma 7 (client generated into
  `src/generated/prisma`, gitignored — run `npx prisma generate` after install).
- DB URLs live in `prisma.config.ts` (Prisma 7 style), not in `schema.prisma`.
  App connects through `@prisma/adapter-pg` in `src/lib/db.ts`.
- Mutations are server actions in `src/lib/actions/`. Every admin action calls
  `requireAdmin()` itself — the admin layout check alone is not enough.
- Claiming must stay race-safe: a conditional `updateMany` guarded on
  `status: "OPEN"` (see `src/lib/actions/claims.ts`). Never claim on GET —
  email scanners prefetch links.
- Emails: `src/lib/email.ts` honors `EMAIL_DRY_RUN` (log only) and
  `TEST_EMAIL_OVERRIDE` (reroute everything). Keep dry-run on in dev; never put
  real member emails in `prisma/seed.ts`.
- Verify changes with `npm run lint`, `npx tsc --noEmit`, `npm run build`, and
  `npm run race-test` (needs Postgres running and `.env` configured).
