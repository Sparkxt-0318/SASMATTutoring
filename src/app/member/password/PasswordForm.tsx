"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changeMemberPassword, type ChangePasswordState } from "@/lib/actions/member";
import { Button } from "@/components/Button";
import { Field, TextInput } from "@/components/FormField";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Saving…" : "Save password"}
    </Button>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState(changeMemberPassword, {} as ChangePasswordState);
  const errors = state.errors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Field label="New password" htmlFor="password" error={errors.password} hint="At least 8 characters.">
        <TextInput
          id="password"
          type="password"
          name="password"
          autoComplete="new-password"
          autoFocus
          required
        />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={errors.confirm}>
        <TextInput id="confirm" type="password" name="confirm" autoComplete="new-password" required />
      </Field>
      <SubmitButton />
    </form>
  );
}
