# MAT Tutoring: Shanghai American School PX

Peer math tutoring platform for **Mu Alpha Theta** (MAT), SAS's math honor society.

**How it works:** a student requests help through the public form and confirms it from
the email we send them (so nobody can request help in someone else's name) → every active MAT
member gets an email with a personal one-click **Claim** link → the first member to
confirm becomes the tutor (student and tutor are introduced by email). Students
choose the exact date and start/end time of the session when they request it.
**Credit is never automatic:** officers go through the finished sessions once a
week (the Hours tab), and record the minutes each tutor earned. Each member's
progress toward the hours goal is shown as a contribution-style grid (green =
done, blank = still to fill). A weekly digest with the all-time combined total
and per-member hours goes to the officer report inbox every Friday night, with a full
JSON backup and CSVs attached.

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
| `npm test` | Unit tests (no database needed) |
| `npm run race-test` | Fire parallel claims, sign-in codes and requests at the database and check every limit holds |
| `npm run build` | Production build (also runs `prisma generate`) |
| `npm run lint` | ESLint |

## How claiming stays race-safe

Every claim (email link, member dashboard, officer Assign) goes through `claimForMember`
(`src/lib/claiming.ts`), which calls `claimRequestRow` in `src/lib/race-safe.ts`. That
issues a single conditional update, `UPDATE ... WHERE id = ? AND status = 'OPEN'`, so when
several members click at once, Postgres lets exactly one through; everyone else sees
"already claimed". A per-member Postgres advisory lock also stops one member from holding
two sessions at the same time. The other count-then-write steps (request form limits,
sign-in codes) use the same kind of lock, and `npm run race-test` checks all of them.
The claim page performs **zero writes on GET**: email scanners that prefetch
links can never claim a request, because claiming requires pressing the confirm
button (a POST).

## Pages

| Route | Who | Purpose |
| --- | --- | --- |
| `/` | Students | Landing page |
| `/request` | Students | Request form: `@saschina.org` email, grade, course, topic, teacher-help survey question, meeting date + start/end time |
| `/member/login` | Members on the list | Type your email, get a one-time PIN by email, sign in. Dashboard: own progress grid, open requests to claim, my sessions with student contact |
| `/request/confirm/<token>` | Students | Confirm link from the student's email; members are emailed only after this. Also shows the request's status later |
| `/claim/<token>` | Members | Personal claim link from the blast email (no sign in needed). The student's contact details show only while that member holds the session |
| `/admin` | Officers | Requests · Hours (weekend credit review) · Members roster · Leaderboard (progress grids) + CSV |

**Member list:** the admin **Members** tab is the member list. Everyone active there
gets the request emails (with a personal Claim link that needs no sign in) and can sign
in. Nobody else can. Add people one at a time, or use **Import a member list**: upload a
CSV (the club attendance sheet works as is, "Name, email" files too) or paste names and
emails. Tick "Make this the whole member list" to deactivate everyone who is not in the
file (refused if any line could not be read, so a typo never removes someone). Deactivating
someone stops their emails, signs them out at once, and gives their upcoming sessions back
to the other members (the student is told).

**Testing the member view:** on the Members tab, "Test the member view" makes a one-time
code for any active member, shown only to the officer and never emailed. Enter it at
`/member/login` on any device.

**Member sign in (emailed one-time PIN only):** there are no member passwords and no
sign-up page. A member types their email, gets a fresh random 6-digit code by email, and
enters it. The code works once, expires after 10 minutes, and is stored only as a keyed
hash. Five wrong guesses destroy it, and a member can request at most 3 codes per 15
minutes and 8 per day (and the whole site at most 40 per hour). Addresses that are not on
the list get no code, but see the same page as members, so the form never reveals who is a
member. It needs working email (see the Gmail section below).

`OTP_LOGIN_EMAILS` (comma separated, usually empty) lists extra addresses that may sign in
even when they are not on the list yet, for example an officer testing the member pages.
The first time one of them signs in, the site asks for a name and adds them to the list.

Officers sign in at `/admin` with the shared `ADMIN_PASSWORD` (use at least 12
characters; changing it signs every officer out). Sign in is limited to 5 tries per 15
minutes from one network, and officers are alerted if many tries fail.

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

**Cron jobs** (already configured in `vercel.json`, times are UTC; on the Hobby plan Vercel
only promises the hour, so a job set for 22:30 runs some time between 22:00 and 22:59):

- `/api/cron/weekly-report`: Fridays 12:00 UTC (Friday 20:00 Shanghai): hours digest to
  `REPORT_EMAIL` with the complete JSON backup plus three CSVs attached (members, every
  session, hours). Survey answers are left out of emailed files.
- `/api/cron/daily`: about 22:30 UTC (06:30 Shanghai): expires unclaimed requests whose
  meeting time has already started (the student is told), tells students whose session
  starts within 24 hours that we are still looking, tidies old unconfirmed requests,
  sign-in codes and claim links, and sends an alert only when something needs
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

**Email volume:** each request costs roughly `members + 3` emails. The site counts every
email it sends per day (UTC) against `EMAIL_DAILY_LIMIT` (default 450 for SMTP/Gmail, 95
for Resend's free tier). Member request emails pause at 80% of it, so sign-in codes and
student emails always have room left; officers get one alert when that happens, and the
paused requests show "Blast incomplete" until you press Resend blast. The Email tab shows
today's count.

## Safety limits and failure handling

- **Spam on the request form:** nothing goes to members until the student confirms from
  their school inbox. One student address can have at most 3 waiting requests and 5 per
  day, and the whole site accepts at most 8 requests per hour and 20 per day. Pressing
  Submit twice saves one request. Limits live in
  `src/lib/constants.ts`.
- **Tutor can't make it:** a member can give a claimed session back from their dashboard
  (only before it starts), and officers can press Reopen in the Requests tab. The student is
  told, and every member is alerted again. Reopen disappears once the meeting starts.
- **Mistakes are undoable:** Cancel, Didn't happen, Undo credit and Deactivate all ask for
  a second click, and the Hours tab lists cancelled sessions from the last 30 days with
  Restore.
- **Mail problems never lose a request:** the request is saved first, the members' emails are
  sent after the student sees the confirmation, and anyone who did not get an email stays
  flagged ("Blast incomplete") until you press Resend blast. Check the Requests tab if
  email has been unreliable.
- **Backups:** Leaderboard has "Full backup (JSON)", the complete restorable record
  (members with active state, every request with exact times and topics, every credit),
  and "Export all sessions", a readable CSV. Download the JSON now and then (for example
  at the end of each term).
- **Restoring from a backup:** use a `mat-backup-*.json` file (the Leaderboard download
  or the weekly report attachment). Point `DATABASE_URL`/`DIRECT_URL` at an EMPTY
  database, run `npm run db:deploy` to apply migrations, then
  `npm run restore -- path/to/mat-backup-YYYY-MM-DD.json`. It refuses any database that
  already has members or requests. Ids, dates and credits come back exactly; members
  sign in again with a new PIN, and unconfirmed requests lose their confirm link.
- **Cron routes** refuse every call if `CRON_SECRET` is not set.

## Records

- Credited hours per member (and the combined all-time total) live on
  `/admin/leaderboard`, with CSV export for officer reports. The goal each
  member's grid fills toward is `MEMBER_HOURS_GOAL` (default 20 hours; one square
  = one hour, and hours beyond the goal show as gold squares on extra rows). Change it in the Vercel environment variables.
- Every credit is listed under "Credited" in `/admin/hours`, with an Undo button
  that puts the session back in the review queue.
- **Check Your Credits:** members' dashboards and the admin Requests page show a card that
  opens the club's credit spreadsheet in a new tab. The link comes from the `CREDITS_URL`
  setting in Vercel, never from the code, because the repository is public and the link is a
  private sharing link. Without it, members see no card and officers see a reminder.
- The "did your teacher help first?" survey answer is visible to officers only
  (Requests tab); it is never shown to tutors or included in any email.
