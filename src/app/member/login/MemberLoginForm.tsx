"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { memberLogin, type MemberLoginState } from "@/lib/actions/member";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/FormField";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function MemberLoginForm() {
  const [state, formAction] = useActionState(memberLogin, {} as MemberLoginState);
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
      <TextInput
        type="password"
        name="password"
        placeholder="Password"
        autoComplete="current-password"
        required
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
