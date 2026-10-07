import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMember } from "@/lib/member-auth";
import { CLUB_NAME } from "@/lib/constants";
import { CodeRequestForm, CodeVerifyForm } from "./CodeForms";

export const metadata: Metadata = {
  title: "Member sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MemberLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  if (await getMember()) redirect("/member");
  const { email } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-6">
      <p className="mb-6 text-sm font-semibold uppercase tracking-widest text-muted">
        {CLUB_NAME} · Members
      </p>
      <div className="rise-in w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          {email ? "Enter your code" : "Member sign in"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {email
            ? `We emailed a 6-digit code to ${email}. It works once and expires in 10 minutes.`
            : "Enter your email and we will send you a one-time code. It is new every time."}
        </p>
        <div className="mt-6">{email ? <CodeVerifyForm email={email} /> : <CodeRequestForm />}</div>
        {email && (
          <p className="mt-5 text-center text-xs text-faint">
            No email?{" "}
            <Link href="/member/login" className="text-muted hover:underline">
              Send a new code
            </Link>
          </p>
        )}
      </div>
      <p className="mt-6 text-xs text-faint">
        Officer?{" "}
        <Link href="/admin/login" className="text-muted hover:underline">
          Officer login
        </Link>
        {" · "}
        <Link href="/" className="text-muted hover:underline">
          Home
        </Link>
      </p>
    </main>
  );
}
