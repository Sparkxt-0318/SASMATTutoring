"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { sendTestEmail, type TestEmailState } from "@/lib/actions/email";
import { Button } from "@/components/Button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Sending…" : "Send test email"}
    </Button>
  );
}

export function TestEmailForm() {
  const [state, formAction] = useActionState(sendTestEmail, {} as TestEmailState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <SubmitButton />
      </div>
      {state.message && (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${
            state.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
