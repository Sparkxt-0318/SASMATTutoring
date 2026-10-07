import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/member-auth";
import { memberLogout } from "@/lib/actions/member";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-50 border-b border-hairline/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="text-[15px] font-semibold tracking-tight">
            MAT <span className="font-normal text-muted">Member</span>
          </Link>
          <div className="flex items-center gap-5">
            <span className="hidden text-sm text-muted sm:inline">{member.name}</span>
            <form action={memberLogout}>
              <button
                type="submit"
                className="text-sm text-muted transition-colors hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
