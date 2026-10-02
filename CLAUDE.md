# MAT Tutoring platform

Peer tutoring app for Mu Alpha Theta at Shanghai American School. Students submit
the public form (including the exact meeting date/start/end time); all active
members are emailed personal claim links; first click wins. Credit is NEVER
automatic: officers record it weekly in the admin Hours tab (`awardCredit` in
`src/lib/actions/credits.ts`); tutors do not self-log. Progress is shown as a
contribution-style grid (`src/components/ProgressGrid.tsx`, goal =
`MEMBER_HOURS_GOAL`). See README.md for the full runbook.

## Style rules

- NEVER use em dashes (or en dashes) anywhere: UI copy, emails, code comments,
  docs, commit messages, or replies. Use commas, colons, periods, or "to" for
  ranges instead. Check with a search for the characters before committing.
- Design stays Apple-style: simple, sleek, modern, lots of white space.

## Key facts

- Next.js App Router + TypeScript + Tailwind 4. Prisma 7 (client generated into
  `src/generated/prisma`, gitignored; run `npx prisma generate` after install).
- DB URLs live in `prisma.config.ts` (Prisma 7 style), not in `schema.prisma`.
  App connects through `@prisma/adapter-pg` in `src/lib/db.ts`.
- Mutations are server actions in `src/lib/actions/`. Every admin action calls
  `requireAdmin()` itself; the admin layout check alone is not enough.
- Claiming must stay race-safe: a conditional `updateMany` guarded on
  `status: "OPEN"` (see `src/lib/actions/claims.ts`). Never claim on GET:
  email scanners prefetch links.
- Prisma 7 does not regenerate the client after `migrate dev`; run
  `npx prisma generate` yourself. Vercel builds with `vercel-build`, which also
  runs `prisma migrate deploy`.
- Two separate logins: officers use the shared `ADMIN_PASSWORD` (`src/lib/auth.ts`),
  members use roster email + their own password (`src/lib/member-auth.ts`,
  `src/lib/password.ts`, scrypt, no extra dependency). Officers issue temporary
  passwords for resets; members create their own accounts at `/member/signup`
  (`memberSignup`, mode set by `MEMBER_SIGNUP` open|roster via `signupMode()`). Member sessions are
  re-checked against the database on every request. Every member server action
  must call `requireMember()`. Claiming (email link and dashboard) goes through
  `claimForMember` in `src/lib/claiming.ts`.
- Slow work (member email blasts, reopen notices) runs inside `after()` from
  `next/server` so users never wait on the mail server. Cron routes must use
  `cronAuthorized()` (`src/lib/cron.ts`), never compare to the raw env var.
  CSV exports must go through `src/lib/csv.ts` (defuses spreadsheet formulas).
  The public request form is rate limited in `src/lib/actions/requests.ts`.
- Meeting times are entered in Shanghai time (fixed +08:00) and stored as UTC;
  helpers live in `src/lib/constants.ts`. `receivedTeacherHelp` is survey data
  for officers only; never show it to tutors or put it in emails.
- Emails: `src/lib/email.ts` honors `EMAIL_DRY_RUN` (log only) and
  `TEST_EMAIL_OVERRIDE` (reroute everything). Keep dry-run on in dev; never put
  real member emails in `prisma/seed.ts`.
- Verify changes with `npm run lint`, `npx tsc --noEmit`, `npm run build`, and
  `npm run race-test` (needs Postgres running and `.env` configured).
