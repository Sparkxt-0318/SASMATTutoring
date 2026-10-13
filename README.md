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
and per-member hours goes to the officer report inbox every Friday night, with a CSV
backup of the whole system attached.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [Prisma 7](https://prisma.io) + Postgres ([Neon](https://neon.tech) free tier in production)
- Email through [Resend](https://resend.com) or any SMTP mailbox (school or Gmail account),
  picked automatically (a club Gmail account needs just two settings)
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
| `/member/login` | Members on the list | Type your email, get a one-time PIN by email, sign in. Dashboard: own progress grid, open requests to claim, my sessions with student contact |
| `/claim/<token>` | Members | Personal claim link from the blast email (no sign in needed; also shows the member's progress grid) |
| `/admin` | Officers | Requests · Hours (weekend credit review) · Members roster · Leaderboard (progress grids) + CSV |

Officers sign in at `/admin` with the shared `ADMIN_PASSWORD`.

**Member list:** the admin **Members** tab is the member list. Everyone active there
gets the request emails (with a personal Claim link that needs no sign in) and can sign
in. Nobody else can. Add people one at a time, or use **Import a member list**: upload a
CSV (the club attendance sheet works as is, "Name, email" files too) or paste names and
emails. Tick "Make this the whole member list" to deactivate everyone who is not in the
file. Deactivating someone stops their emails and signs them out at once.

**Member sign in (emailed one-time PIN only):** there are no member passwords and no
sign-up page. A member types their email, gets a fresh random 6-digit code by email, and
enters it. The code works once, expires after 10 minutes, and is stored only as a keyed
hash. Five wrong guesses destroy it, and a member can request at most 3 codes per 15
minutes and 8 per day. Emails that are not on the list are refused and get no code. It
needs working email (see the Gmail section below).

`OTP_LOGIN_EMAILS` (comma separated, usually empty) lists extra addresses that may sign in
even when they are not on the list yet, for example an officer testing the member pages.
The first time one of them signs in, the site asks for a name and adds them to the list.

Officers sign in at `/admin` with the shared `ADMIN_PASSWORD`.

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
5. Add the real member list in `/admin` → Members (Import a member list takes the
   attendance CSV). Never commit real emails to the repository or the seed file.

**Cron jobs** (already configured in `vercel.json`, times are UTC):

- `/api/cron/weekly-report`: Fridays 12:00 UTC (Friday 20:00 Shanghai): hours digest to
  `REPORT_EMAIL` with three CSV backups attached (members, every session, hours)
- `/api/cron/daily`: 22:30 UTC (06:30 Shanghai): expires unclaimed requests whose
  meeting time has already started, and sends an alert only when something needs
  attention (a request starting within 24 hours with no tutor, or member emails that
  did not go out)

**Who gets which email:** the weekly report with backup files goes to `REPORT_EMAIL`
only. Alert emails (failures, "needs attention", expired requests) go to `REPORT_EMAIL`
plus everyone in `EXTRA_ALERT_EMAILS` (comma separated), each as their own email. Use
the Email tab in `/admin` to send a test to the whole alert list.

Both routes require the `Authorization: Bearer <CRON_SECRET>` header (Vercel sends
it automatically when `CRON_SECRET` is set).

**Sending email with a club Gmail account (recommended):**

1. Create a Gmail account for the club (it needs a phone number to verify).
2. In that account, turn on 2-Step Verification (Google Account, Security).
3. Create an app password: Google Account, Security, App passwords (or go to
   myaccount.google.com/apppasswords). Name it "MAT site" and copy the 16 letters.
4. In Vercel, Settings, Environment Variables, add `SMTP_USER` = the Gmail address and
   `SMTP_PASSWORD` = the app password (spaces are fine). Delete `EMAIL_PROVIDER` if it says
   `resend`. Nothing else is needed: the site uses smtp.gmail.com and sends from that address.
5. Redeploy, then press **Send test email** in the admin **Email** tab.

Other mailboxes work too: also set `SMTP_HOST` (Microsoft 365 is `smtp.office365.com`, but
many schools turn off this kind of sign-in) and `SMTP_PORT`. If a test fails, the Email tab
says why. Gmail sends up to about 500 emails a day.

**Email volume:** each request costs roughly `members + 2` emails. Resend's free
tier is 100/day and 3,000/month, so with ~30 members that's about 3 requests per day.
If the club outgrows that, upgrade Resend or trim the roster blast.

## Safety limits and failure handling

- **Spam on the request form:** one student address can have at most 3 waiting requests
  and 5 per day, and the whole site accepts at most 30 requests per hour. Limits live in
  `src/lib/constants.ts`.
- **Tutor can't make it:** a member can give a claimed session back from their dashboard
  (only before it starts), and officers can press Reopen in the Requests tab. The student is
  told, and every member is alerted again.
- **Mail problems never lose a request:** the request is saved first, the members' emails are
  sent after the student sees the confirmation, and anyone who did not get an email stays
  flagged ("Blast incomplete") until you press Resend blast. Check the Requests tab if
  email has been unreliable.
- **Backups:** Leaderboard has "Export all sessions", a CSV of every request, tutor and
  credit. Download it now and then (for example at the end of each term).
- **Cron routes** refuse every call if `CRON_SECRET` is not set.

## Records

- Credited hours per member (and the combined all-time total) live on
  `/admin/leaderboard`, with CSV export for officer reports. The goal each
  member's grid fills toward is `MEMBER_HOURS_GOAL` (default 20 hours; one square
  = 15 minutes). Change it in the Vercel environment variables.
- Every credit is listed under "Credited" in `/admin/hours`, with an Undo button
  that puts the session back in the review queue.
- **Check Your Credits:** members' dashboards and the admin Requests page show a card that
  opens the club's credit spreadsheet in a new tab. The link comes from the `CREDITS_URL`
  setting in Vercel, never from the code, because the repository is public and the link is a
  private sharing link. Without it, members see no card and officers see a reminder.
- The "did your teacher help first?" survey answer is visible to officers only
  (Requests tab); it is never shown to tutors or included in any email.
