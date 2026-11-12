# MAT Tutoring: Shanghai American School PX

Free peer math tutoring from **Mu Alpha Theta** (MAT), SAS's math honor society. Students
ask for help online, MAT members claim the session, and officers record the hours.

## How it works

1. A student fills in the request form: course, topic, and the exact date and time they
   want to meet.
2. They get an email at their school address and press **Confirm**. Until then nothing
   is sent, so nobody can request help in someone else's name.
3. Every active MAT member gets an email with a personal **Claim** button. The first
   member to confirm becomes the tutor, and the student and tutor are introduced by email.
4. After the session, officers record the time the tutor earned. **Credit is never
   automatic.**

## For students

- Go to the site and press **Request a tutor**. Use your `@saschina.org` email.
- Check your inbox (and Junk) for the confirmation email and press **Confirm my
  request**. The same link shows your request's status later.
- You get an email when a tutor claims it. If nobody has claimed it about a day before
  the session, we tell you we are still looking. If the time passes with no tutor, or an
  officer cancels it, we email you too.
- Pressing Submit twice is fine: you only get one request. You can have at most 3 waiting
  requests at a time.

## For members

- **Getting requests:** every new request arrives by email with a Claim button. Claim only
  if you can make the time. If someone beat you to it, the page says so.
- **Signing in:** go to `/member/login`, type your email, and enter the 6-digit code we
  send you. There are no passwords. A code works once and lasts 10 minutes. Only members
  on the club's list can sign in.
- **Your dashboard** shows open requests you can claim, your sessions with the student's
  contact details, and your progress toward the hours goal as a grid (one square per hour,
  extra hours in gold).
- **Can't make it?** Give the session back from your dashboard before it starts. The
  student is told and the other members are emailed again.
- You cannot claim two sessions that overlap.
- **Check Your Credits** on the dashboard opens the club's credit spreadsheet.

## For officers

Sign in at `/admin` with the shared officer password. The tabs:

- **Requests:** open and claimed requests plus the last 30 days ("Show older" for the
  rest).
  - "Needs a tutor" marks requests starting within 24 hours that nobody has claimed.
  - "Awaiting student" means the student has not confirmed yet.
  - **Assign** gives a request to a member directly. Tick "Assign anyway" to allow a
    clash with another of their sessions.
  - **Reopen** puts a claimed session back up for members, until the meeting starts.
  - **Resend blast** emails only the members who did not get a request ("Blast
    incomplete").
- **Hours:** once a week, go through the finished sessions and press **Award credit**
  (it defaults to the booked length), or **Didn't happen**. Credited sessions can be
  undone. Cancelled sessions from the last 30 days are listed with **Restore**.
- **Members:** the member list.
  - Add people one at a time, or import the club attendance sheet (CSV, or paste names
    and emails). Lines that could not be read are listed so you can fix them.
  - "Make this the whole member list" deactivates everyone not in the file. It is
    refused if any line could not be read, so a typo never removes someone.
  - **Deactivate** stops a member's emails, signs them out at once, and gives their
    upcoming sessions back to the other members (the students are told).
  - **Test the member view** makes a one-time code for any active member. It is shown
    only to you and never emailed. Enter it at `/member/login` on any device.
- **Leaderboard:** credited hours per member and the all-time total. Download the hours,
  every session (CSV), or a **Full backup (JSON)**.
- **Email:** shows how the site sends email and how many emails went out today, with
  buttons to send a test email and a test alert.

Destructive buttons (Cancel, Didn't happen, Undo, Deactivate) ask for a second click,
and every action shows a message saying what happened.

**What officers receive by email:**

- Every Friday evening, a weekly report goes to `REPORT_EMAIL`. It has the hours totals,
  plus a full backup and CSVs attached.
- Alerts go to `REPORT_EMAIL` and anyone in `EXTRA_ALERT_EMAILS`. You get one when:
  - a request starts within 24 hours with no tutor;
  - member emails did not all go out;
  - requests expired;
  - something failed.

The "did your teacher help first?" survey answer is for officers only. It is never
shown to tutors or put in any email.

## Setting up the site (officer runbook)

The site runs on Vercel (free) with a Neon Postgres database (free).

1. **Neon:** create a free project, ideally in an Asia-Pacific region such as Singapore
   (closest to Shanghai). Copy the *pooled* connection string into `DATABASE_URL` and the
   direct one into `DIRECT_URL`.
2. **Vercel:** import this repo (framework preset Next.js) and add every variable from
   `.env.example` under Settings, Environment Variables.
   - Set `APP_URL` to the site's address.
   - Leave `EMAIL_DRY_RUN` empty.
   - For the first test, set `TEST_EMAIL_OVERRIDE` to your own email. Every email then
     goes to you. Remove it once everything works.
3. **Region:** in `vercel.json`, add `"regions": ["sin1"]` (or the Vercel region closest
   to your Neon database). Pages load much faster when the two are close.
4. **Deploy.** Database tables are created and updated automatically on every deploy.
5. **Members:** add the real member list in the admin **Members** tab. Never put real
   names or emails in the repository: it is public.

**Sending email with a club Gmail account (recommended):**

1. Create a Gmail account for the club and turn on 2-Step Verification (Google Account,
   Security).
2. Create an app password at myaccount.google.com/apppasswords. Name it "MAT site" and
   copy the 16 letters.
3. In Vercel, set `SMTP_USER` to the Gmail address and `SMTP_PASSWORD` to the app
   password. Delete `EMAIL_PROVIDER` if it says `resend`. Nothing else is needed.
4. Redeploy, then press **Send test email** in the admin **Email** tab. If it fails, the
   tab explains why.

Other mailboxes work too: also set `SMTP_HOST` and `SMTP_PORT`. Microsoft 365 is
`smtp.office365.com`, but many schools block this kind of sign in. Resend (with
`RESEND_API_KEY`) also works, but until a domain is verified it only delivers to the
Resend account owner.

**Email limits:**
- Each request costs about one email per member, plus a few more.
- The site counts every email per day against `EMAIL_DAILY_LIMIT`. The default is 450 for
  Gmail/SMTP (Gmail allows about 500) and 95 for Resend's free tier.
- At 80% of the limit, member request emails pause for the day, so sign-in codes and
  student emails still get through. Officers get one alert. The paused requests show
  "Blast incomplete" until you press Resend blast.

**Other settings:**
- `ADMIN_PASSWORD`, the officer password:
  - Use at least 12 characters.
  - Changing it signs every officer out.
  - Sign in allows 5 tries per 15 minutes from one network.
- `CREDITS_URL` is the club's credit spreadsheet link. It is kept in Vercel, not in the
  code, because the repository is public.
- `MEMBER_HOURS_GOAL` is the hours each member works toward (default 20).
- `OTP_LOGIN_EMAILS` lists extra addresses that may sign in without being on the list
  (usually empty). The first time one of them signs in, the site asks for a name.
- `CRON_SECRET` protects the scheduled jobs. They refuse to run without it.

**Scheduled jobs** (set up in `vercel.json`; Vercel's free plan only promises the hour):
- **Weekly report:** Fridays at about 20:00 Shanghai time.
- **Daily cleanup:** at about 06:30 Shanghai time. It:
  - closes requests whose time passed with no tutor, and tells the students;
  - warns students whose session is within a day and still has no tutor;
  - tidies old data;
  - alerts officers if something needs attention.

**Backups and restoring:**
- Download **Full backup (JSON)** from the Leaderboard now and then, for example at the
  end of each term. The weekly report also attaches one.
- To restore, point `DATABASE_URL` and `DIRECT_URL` at an **empty** database. Then run
  `npm run db:deploy` and `npm run restore -- path/to/mat-backup-YYYY-MM-DD.json`.
  - It refuses a database that already has data.
  - Members, requests, times and credits come back exactly.
  - Members sign in again with a new code. Requests that were never confirmed need to be
    submitted again.

## For developers

**Stack:**
- [Next.js](https://nextjs.org) (App Router), TypeScript and Tailwind CSS.
- [Prisma 7](https://prisma.io) with Postgres ([Neon](https://neon.tech) in production).
- Email through [Resend](https://resend.com) or any SMTP mailbox, picked automatically.
- Hosted on [Vercel](https://vercel.com).

```bash
npm install
cp .env.example .env        # fill in values (see comments in the file)
npm run db:migrate          # create tables (needs a local Postgres)
npm run db:seed             # seed 3 FAKE dev members
npm run dev                 # http://localhost:3000
```

**Email when running locally:**
- Keep `EMAIL_DRY_RUN="true"`. Emails are then printed to the dev server console instead
  of being sent, so you can copy sign-in codes and confirm links from there.
- To test real delivery, set `TEST_EMAIL_OVERRIDE` to your own address. Every email is
  rerouted to you, with the original recipient noted in the subject.

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests (no database needed) |
| `npm run race-test` | Fires parallel claims, sign-in codes and requests at the database and checks every limit holds |
| `npm run db:studio` | Browse and edit the database in Prisma Studio |
| `npm run build` | Production build |
| `npm run lint` | ESLint |

**How claiming stays first-click-wins:**
- Every claim goes through `claimForMember` (`src/lib/claiming.ts`). That covers the email
  link, the member dashboard and officer Assign.
- It calls `claimRequestRow` in `src/lib/race-safe.ts`, a single conditional update
  (`... WHERE status = 'OPEN'`). When several members click at once, exactly one wins.
- A per-member Postgres advisory lock stops overlapping sessions.
- The request form limits and sign-in codes use the same kind of lock. `npm run
  race-test` checks all of them.
- Links never claim or change anything on a plain visit (GET). Email scanners that open
  links cannot claim a request: claiming needs a button press.

**Limits:**
- All limits live in `src/lib/constants.ts`.
- Request form: per student, 3 waiting requests and 5 per day. Site-wide, 8 per hour and
  20 per day.
- Sign-in codes: 3 per 15 minutes and 8 per day for each address, and 40 per hour
  site-wide.
- A code is stored only as a keyed hash, and 5 wrong guesses end it.

See `CLAUDE.md` for the code rules and key facts.
