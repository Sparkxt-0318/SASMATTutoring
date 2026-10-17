import Link from "next/link";
import type { ReactNode } from "react";
import { CLUB_NAME } from "@/lib/constants";
import { SimpleHeader } from "./HomeButton";

/** Minimal centered layout for email-link pages (claim, student confirmation). */
export function TokenShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <>
      <SimpleHeader />
      <main className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center bg-surface px-6 py-16">
        <p className="mb-6 text-sm font-semibold uppercase tracking-widest text-muted">
          {CLUB_NAME} · Tutoring
        </p>
        {children}
        {footer && <div className="mt-5 flex w-full justify-center">{footer}</div>}
        <p className="mt-8 text-xs text-faint">
          <Link href="/" className="hover:text-muted transition-colors">
            MAT Tutoring home
          </Link>
        </p>
      </main>
    </>
  );
}

export function TokenCard({
  icon,
  title,
  body,
  linkHref,
  linkLabel,
}: {
  icon: string;
  title: string;
  body: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="rise-in w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-sm">
      <div className="text-4xl" aria-hidden>
        {icon}
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 leading-relaxed text-muted">{body}</p>
      {linkHref && linkLabel && (
        <Link
          href={linkHref}
          className="mt-6 inline-block rounded-full bg-accent px-6 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-accent-hover"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

export function InvalidTokenCard() {
  return (
    <TokenShell>
      <TokenCard
        icon="🔗"
        title="This link has expired"
        body="Links stop working once a request is closed or removed, and a mistyped link never works. If you copied it from an email, try the button in the email instead."
      />
    </TokenShell>
  );
}
