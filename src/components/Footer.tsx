import Link from "next/link";
import { CLUB_NAME, SCHOOL_NAME } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t border-hairline/60 bg-surface">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-6 py-8 text-center">
        <p className="text-sm text-muted">
          {CLUB_NAME} · {SCHOOL_NAME}
        </p>
        <p className="text-xs text-faint">Free peer tutoring, by students, for students.</p>
        <p className="text-xs text-faint">
          <Link href="/member/signup" className="text-muted underline-offset-2 hover:underline">
            Join as a member
          </Link>
          {" · "}
          <Link href="/member/login" className="text-muted underline-offset-2 hover:underline">
            Member login
          </Link>
          {" · "}
          <Link href="/admin" className="text-muted underline-offset-2 hover:underline">
            Officer login
          </Link>
        </p>
      </div>
    </footer>
  );
}
