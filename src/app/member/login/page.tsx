import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMember } from "@/lib/member-auth";
import { CLUB_NAME } from "@/lib/constants";
import { MemberLoginForm } from "./MemberLoginForm";

export const metadata: Metadata = {
  title: "Member sign in",
  robots: { index: false, follow: false },
};

export default async function MemberLoginPage() {
  const member = await getMember();
  if (member) {
    redirect(member.mustChangePassword ? "/member/password" : "/member");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-6">
      <p className="mb-6 text-sm font-semibold uppercase tracking-widest text-muted">
        {CLUB_NAME} · Members
      </p>
      <div className="rise-in w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">Member sign in</h1>
        <p className="mt-2 text-sm text-muted">
          Use the email on the club roster. New here or forgot your password? An officer can give
          you a temporary one.
        </p>
        <div className="mt-6">
          <MemberLoginForm />
        </div>
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
