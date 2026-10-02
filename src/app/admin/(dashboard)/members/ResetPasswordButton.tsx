"use client";

import { useActionState } from "react";
import { resetMemberPassword, type ResetPasswordState } from "@/lib/actions/members";

/** Issues a fresh temporary password and shows it once, right where the officer clicked. */
export function ResetPasswordButton({ memberId, label }: { memberId: string; label: string }) {
  const [state, formAction] = useActionState(
    resetMemberPassword.bind(null, memberId),
    {} as ResetPasswordState,
  );
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <button type="submit" className="text-accent hover:underline">
        {label}
      </button>
      {state.password && (
        <span className="rounded-lg bg-green-50 px-2.5 py-1 font-mono text-xs text-green-700">
          {state.password}
        </span>
      )}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
