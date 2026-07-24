"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { adminLogin, type LoginState } from "@/lib/actions/admin";
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

export function LoginForm() {
  const [state, formAction] = useActionState(adminLogin, {} as LoginState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextInput
        type="password"
        name="password"
        placeholder="Password"
        autoFocus
        autoComplete="current-password"
        required
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
