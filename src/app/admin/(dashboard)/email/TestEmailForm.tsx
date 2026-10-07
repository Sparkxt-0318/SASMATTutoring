"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { sendTestAlert, sendTestEmail, type TestEmailState } from "@/lib/actions/email";
import { Button } from "@/components/Button";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Sending…" : label}
    </Button>
  );
}

export function TestEmailForm({ kind }: { kind: "email" | "alert" }) {
  const [state, formAction] = useActionState(
    kind === "alert" ? sendTestAlert : sendTestEmail,
    {} as TestEmailState,
  );
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <SubmitButton label={kind === "alert" ? "Send test alert to everyone" : "Send test email"} />
      </div>
      {state.message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            state.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}
        >
          <p>{state.message}</p>
          {state.detail && (
            <p className="mt-2 break-words text-xs opacity-70">Technical details: {state.detail}</p>
          )}
        </div>
      )}
    </form>
  );
}
