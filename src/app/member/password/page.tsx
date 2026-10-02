import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMember } from "@/lib/member-auth";
import { CLUB_NAME } from "@/lib/constants";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = {
  title: "Choose a password",
  robots: { index: false, follow: false },
};

export default async function MemberPasswordPage() {
  const member = await getMember();
  if (!member) redirect("/member/login");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-6">
      <p className="mb-6 text-sm font-semibold uppercase tracking-widest text-muted">
        {CLUB_NAME} · Members
      </p>
      <div className="rise-in w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          {member.mustChangePassword ? "Choose your password" : "Change password"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {member.mustChangePassword
            ? `Hi ${member.name.split(" ")[0]}, you signed in with a temporary password. Pick one only you know to continue.`
            : "Pick a new password. You will stay signed in on this device."}
        </p>
        <div className="mt-6">
          <PasswordForm />
        </div>
      </div>
      {!member.mustChangePassword && (
        <p className="mt-6 text-xs text-faint">
          <Link href="/member" className="text-muted hover:underline">
            Back to dashboard
          </Link>
        </p>
      )}
    </main>
  );
}
