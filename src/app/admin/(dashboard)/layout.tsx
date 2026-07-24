import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { adminLogout } from "@/lib/actions/admin";
import { AdminTabs } from "@/components/AdminTabs";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-50 border-b border-hairline/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-[15px] font-semibold tracking-tight">
            MAT <span className="font-normal text-muted">Admin</span>
          </Link>
          <form action={adminLogout}>
            <button type="submit" className="text-sm text-muted transition-colors hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
        <div className="mx-auto max-w-6xl px-6">
          <AdminTabs />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
