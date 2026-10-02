import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMember } from "@/lib/member-auth";
import { CLUB_NAME, signupMode } from "@/lib/constants";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Join as a member",
  robots: { index: false, follow: false },
};

// Read the sign-up mode on every request, not at build time.
export const dynamic = "force-dynamic";

export default async function MemberSignupPage() {
  const member = await getMember();
  if (member) {
    redirect(member.mustChangePassword ? "/member/password" : "/member");
  }
  const roster = signupMode() === "roster";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-12">
      <p className="mb-6 text-sm font-semibold uppercase tracking-widest text-muted">
        {CLUB_NAME} · Members
      </p>
      <div className="rise-in w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-muted">
          {roster
            ? "Use the email address the club has on its member list."
            : "Join the tutors. You will get an email whenever a student asks for help."}
        </p>
        <div className="mt-6">
          <SignupForm />
        </div>
      </div>
      <p className="mt-6 text-xs text-faint">
        Already have an account?{" "}
        <Link href="/member/login" className="text-muted hover:underline">
          Sign in
        </Link>
        {" · "}
        <Link href="/" className="text-muted hover:underline">
          Home
        </Link>
      </p>
    </main>
  );
}
