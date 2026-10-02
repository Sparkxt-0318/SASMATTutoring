# MAT Tutoring: Shanghai American School

Peer math tutoring platform for **Mu Alpha Theta** (MAT), SAS's math honor society.

**How it works:** a student requests help through the public form → every active MAT
member gets an email with a personal one-click **Claim** link → the first member to
confirm becomes the tutor (student and tutor are introduced by email). Students
choose the exact date and start/end time of the session when they request it.
**Credit is never automatic:** officers go through the finished sessions once a
week (the Hours tab), and record the minutes each tutor earned. Each member's
progress toward the hours goal is shown as a contribution-style grid (green =
done, blank = still to fill). A weekly digest with the all-time combined total
and per-member hours goes to the officer report inbox every Monday morning.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [Prisma 7](https://prisma.io) + Postgres ([Neon](https://neon.tech) free tier in production)
- [Resend](https://resend.com) for transactional email
- Deployed on [Vercel](https://vercel.com) (free tier), cron schedules in `vercel.json`

## Local development

```bash
npm install
cp .env.example .env        # fill in values (see comments in the file)
npm run db:migrate          # create tables (needs a local Postgres)
npm run db:seed             # seed 3 FAKE dev members
npm run dev                 # http://localhost:3000
```

Keep `EMAIL_DRY_RUN="true"` locally: emails are printed to the dev-server console
instead of being sent. To test real delivery, set `TEST_EMAIL_OVERRIDE` to your own
address: every outbound email is rerouted there with the original recipient noted
in the subject line.

Useful commands:

| Command | What it does |
| --- | --- |
| `npm run db:studio` | Browse/edit the database in Prisma Studio |
| `npm run race-test` | Prove first-click-wins claiming is race-safe |
| `npm run build` | Production build (also runs `prisma generate`) |
| `npm run lint` | ESLint |

## How claiming stays race-safe

`claimRequest` (src/lib/actions/claims.ts) issues a single conditional update,
`UPDATE ... WHERE id = ? AND status = 'OPEN'`, so when several members click at
once, Postgres lets exactly one through; everyone else sees "already claimed".
The claim page performs **zero writes on GET**: email scanners that prefetch
links can never claim a request, because claiming requires pressing the confirm
button (a POST).

## Pages

| Route | Who | Purpose |
| --- | --- | --- |
| `/` | Students | Landing page |
| `/request` | Students | Request form: `@saschina.org` email, grade, course, topic, teacher-help survey question, meeting date + start/end time |
| `/member/login` | Members | Sign in with roster email + password. Dashboard: own progress grid, open requests to claim, my sessions with student contact |
| `/claim/<token>` | Members | Personal claim link from the blast email (no sign in needed; also shows the member's progress grid) |
| `/admin` | Officers | Requests · Hours (weekend credit review) · Members roster · Leaderboard (progress grids) + CSV |

Officers sign in at `/admin` with the shared `ADMIN_PASSWORD`.

**Member logins:** members sign in at `/member/login` with the email on the roster and
a password. Officers issue each member a temporary password in the admin Members tab
("Set up login" or "Reset password", shown once on screen). The member must replace it
with their own on first sign in. A forgotten password is fixed the same way. Five wrong
attempts lock that account for 15 minutes, and deactivating a member or resetting their
password signs them out everywhere immediately. Claim links in emails keep working
without signing in.

## Deploying (officer runbook)

1. **Neon**: create a free project; copy the *pooled* connection string into
   `DATABASE_URL` and the direct one into `DIRECT_URL`.
2. **Resend**: create a free account, get an API key. Verify your sending domain
   (DNS records) when you have one; until then `onboarding@resend.dev` works but
   only delivers to the Resend account owner's inbox (useful safety net for testing).
3. **Vercel**: import this repo, framework preset Next.js. Add every variable from
   `.env.example` in Project Settings → Environment Variables. Set `APP_URL` to the
   production URL, `EMAIL_DRY_RUN` empty/false, and leave `TEST_EMAIL_OVERRIDE`
   set to your own email for the first smoke test, then remove it when everything checks out.
4. Database tables are created automatically: Vercel runs the `vercel-build` script
   (`prisma generate && prisma migrate deploy && next build`), which applies any
   pending migrations to Neon on every deploy. This needs `DIRECT_URL` (the
   non-pooled Neon string) set in Vercel. You can also run `npm run db:deploy`
   by hand with the Neon URLs in `.env`.
5. Add the real member roster in `/admin` → Members. Never commit real emails to
   the seed file.

**Cron jobs** (already configured in `vercel.json`, times are UTC):

- `/api/cron/weekly-report`: Mondays 01:00 UTC (09:00 Shanghai): hours digest to `REPORT_EMAIL`
- `/api/cron/daily`: 22:30 UTC (06:30 Shanghai): expires unclaimed requests whose
  meeting time has already started, and tells the report inbox so you can follow up

Both routes require the `Authorization: Bearer <CRON_SECRET>` header (Vercel sends
it automatically when `CRON_SECRET` is set).

**Email volume:** each request costs roughly `members + 2` emails. Resend's free
tier is 100/day and 3,000/month, so with ~30 members that's about 3 requests per day.
If the club outgrows that, upgrade Resend or trim the roster blast.

## Records

- Credited hours per member (and the combined all-time total) live on
  `/admin/leaderboard`, with CSV export for officer reports. The goal each
  member's grid fills toward is `MEMBER_HOURS_GOAL` (default 20 hours; one square
  = 15 minutes). Change it in the Vercel environment variables.
- Every credit is listed under "Credited" in `/admin/hours`, with an Undo button
  that puts the session back in the review queue.
- The "did your teacher help first?" survey answer is visible to officers only
  (Requests tab); it is never shown to tutors or included in any email.
