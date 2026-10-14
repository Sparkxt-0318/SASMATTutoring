import Link from "next/link";
import { HomeButton } from "./HomeButton";

const loginLink = "text-sm text-muted transition-colors hover:text-foreground";

/** Frosted, sticky top navigation shared by the public pages. */
export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline/60 bg-white/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <HomeButton />
          <Link href="/" className="hidden text-[15px] font-semibold tracking-tight text-foreground sm:inline">
            MAT <span className="font-normal text-muted">Tutoring</span>
          </Link>
        </div>
        <div className="flex items-center gap-3 sm:gap-5">
          <Link href="/member/login" className={loginLink}>
            Member login
          </Link>
          <Link href="/admin" className={`hidden sm:inline ${loginLink}`}>
            Officer login
          </Link>
          <Link
            href="/request"
            className="whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-white sm:px-4 transition-colors hover:bg-accent-hover"
          >
            Request a tutor
          </Link>
        </div>
      </nav>
    </header>
  );
}
