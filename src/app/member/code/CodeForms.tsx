"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestLoginCode, verifyLoginCode, type CodeState } from "@/lib/actions/login-code";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/FormField";

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

export function CodeRequestForm() {
  const [state, formAction] = useActionState(requestLoginCode, {} as CodeState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextInput
        type="email"
        name="email"
        placeholder="Email"
        autoComplete="email"
        autoFocus
        required
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Submit label="Email me a code" busy="Sending…" />
    </form>
  );
}

export function CodeVerifyForm({ email }: { email: string }) {
  const [state, formAction] = useActionState(verifyLoginCode, {} as CodeState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="email" value={email} />
      <TextInput
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={7}
        placeholder="123456"
        aria-label="6-digit code"
        autoFocus
        required
        className="text-center font-mono text-2xl tracking-[0.4em]"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Submit label="Sign in" busy="Checking…" />
    </form>
  );
}
