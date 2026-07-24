# MAT Tutoring — Shanghai American School

Peer math tutoring platform for **Mu Alpha Theta** (MAT), SAS's math honor society.

**How it works:** a student requests help through the public form → every active MAT
member gets an email with a personal one-click **Claim** link → the first member to
confirm becomes the tutor (student and tutor are introduced by email) → after the
session the tutor logs the duration → an officer approves it → hours accumulate as
service credit. A weekly digest with the all-time combined total and per-member
hours goes to the officer report inbox every Monday morning.

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

Keep `EMAIL_DRY_RUN="true"` locally — emails are printed to the dev-server console
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

`claimRequest` (src/lib/actions/claims.ts) issues a single conditional update —
`UPDATE ... WHERE id = ? AND status = 'OPEN'` — so when several members click at
once, Postgres lets exactly one through; everyone else sees "already claimed".
The claim page performs **zero writes on GET**: email scanners that prefetch
links can never claim a request, because claiming requires pressing the confirm
button (a POST).

## Pages

| Route | Who | Purpose |
| --- | --- | --- |
| `/` | Students | Landing page |
| `/request` | Students | Request form (requires an `@saschina.org` email) |
| `/claim/<token>` | Members | Personal claim link from the blast email |
| `/complete/<token>` | Tutor | Log the session duration after tutoring |
| `/admin` | Officers | Requests · Hours approval · Members roster · Leaderboard + CSV |

Officers sign in at `/admin` with the shared `ADMIN_PASSWORD`.

## Deploying (officer runbook)

1. **Neon** — create a free project; copy the *pooled* connection string into
   `DATABASE_URL` and the direct one into `DIRECT_URL`.
2. **Resend** — create a free account, get an API key. Verify your sending domain
   (DNS records) when you have one; until then `onboarding@resend.dev` works but
   only delivers to the Resend account owner's inbox (useful safety net for testing).
3. **Vercel** — import this repo, framework preset Next.js. Add every variable from
   `.env.example` in Project Settings → Environment Variables. Set `APP_URL` to the
   production URL, `EMAIL_DRY_RUN` empty/false, and leave `TEST_EMAIL_OVERRIDE`
   set to your own email for the first smoke test — remove it when everything checks out.
4. Run the first migration against Neon: `npm run db:deploy` locally with the Neon
   URLs in `.env`.
5. Add the real member roster in `/admin` → Members. Never commit real emails to
   the seed file.

**Cron jobs** (already configured in `vercel.json`, times are UTC):

- `/api/cron/weekly-report` — Mondays 01:00 UTC (09:00 Shanghai): hours digest to `REPORT_EMAIL`
- `/api/cron/daily` — 22:30 UTC (06:30 Shanghai): expires requests unclaimed for 14 days,
  reminds tutors who haven't logged a session after 7 days

Both routes require the `Authorization: Bearer <CRON_SECRET>` header (Vercel sends
it automatically when `CRON_SECRET` is set).

**Email volume:** each request costs roughly `members + 2` emails. Resend's free
tier is 100/day and 3,000/month — with ~30 members that's about 3 requests per day.
If the club outgrows that, upgrade Resend or trim the roster blast.

## Records

- Approved hours per member (and the combined all-time total) live on
  `/admin/leaderboard`, with CSV export for officer reports.
- Every credit approval is auditable in `/admin/hours` history; rejected logs are
  kept, not deleted.
