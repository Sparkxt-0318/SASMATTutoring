import Link from "next/link";

/** A clear way back to the start page, shown in the top bar of every page. */
export function HomeButton() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-sm font-medium text-foreground transition-colors hover:bg-hairline/60"
    >
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
        <path d="M10.7 2.3a1 1 0 0 0-1.4 0l-7 7A1 1 0 0 0 3 11h1v6a1 1 0 0 0 1 1h3.5v-4.5h3V18H15a1 1 0 0 0 1-1v-6h1a1 1 0 0 0 .7-1.7l-7-7Z" />
      </svg>
      Home
    </Link>
  );
}

/** Top bar for pages that have no other navigation (sign in, claim links, not found). */
export function SimpleHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline/60 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-6">
        <HomeButton />
        <span className="text-[15px] font-semibold tracking-tight">
          MAT <span className="font-normal text-muted">Tutoring</span>
        </span>
      </div>
    </header>
  );
}
