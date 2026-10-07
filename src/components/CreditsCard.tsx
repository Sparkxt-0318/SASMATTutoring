/**
 * "Check Your Credits": a card that opens the club's credit spreadsheet in a new
 * tab. Shown on the member dashboard and the officer dashboard.
 */
export function CreditsCard({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
    >
      <div className="flex items-center gap-4">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-progress"
          aria-hidden
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="4" width="14" height="17" rx="2.5" />
            <path d="M9 4.5h6" />
            <path d="m9 13 2.2 2.2L15.5 11" />
          </svg>
        </span>
        <div>
          <p className="text-lg font-semibold tracking-tight">Check Your Credits</p>
          <p className="mt-0.5 text-sm text-muted">See your tutoring hours on the club credit sheet.</p>
        </div>
      </div>
      <span className="shrink-0 text-sm font-medium text-accent group-hover:underline">
        Open <span aria-hidden>↗</span>
      </span>
    </a>
  );
}

/** What officers see before the link has been set up. */
export function CreditsCardMissing() {
  return (
    <div className="rounded-2xl border border-dashed border-hairline bg-white/60 p-6 sm:p-8">
      <p className="text-lg font-semibold tracking-tight">Check Your Credits</p>
      <p className="mt-0.5 text-sm text-muted">
        The credits link is not set up yet. Add the sheet&rsquo;s link as <code>CREDITS_URL</code>{" "}
        in Vercel (Settings, then Environment Variables) and redeploy. Members will not see this
        section until then.
      </p>
    </div>
  );
}
