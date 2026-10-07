import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMember } from "@/lib/member-auth";
import { CLUB_NAME } from "@/lib/constants";
import { CodeVerifyForm, CodeRequestForm } from "./CodeForms";

export const metadata: Metadata = {
  title: "Sign in with a code",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MemberCodePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const member = await getMember();
  if (member) redirect(member.mustChangePassword ? "/member/password" : "/member");
  const { email } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-6">
      <p className="mb-6 text-sm font-semibold uppercase tracking-widest text-muted">
        {CLUB_NAME} · Members
      </p>
      <div className="rise-in w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          {email ? "Enter your code" : "Sign in with a code"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {email
            ? `We emailed a 6-digit code to ${email}. It works once and expires in 10 minutes.`
            : "We will email you a new 6-digit code every time. Code sign-in is being tested and is turned on for some addresses only."}
        </p>
        <div className="mt-6">{email ? <CodeVerifyForm email={email} /> : <CodeRequestForm />}</div>
        {email && (
          <p className="mt-5 text-center text-xs text-faint">
            No email?{" "}
            <Link href="/member/code" className="text-muted hover:underline">
              Send a new code
            </Link>
          </p>
        )}
      </div>
      <p className="mt-6 text-xs text-faint">
        <Link href="/member/login" className="text-muted hover:underline">
          Use my password instead
        </Link>
        {" · "}
        <Link href="/" className="text-muted hover:underline">
          Home
        </Link>
      </p>
    </main>
  );
}
