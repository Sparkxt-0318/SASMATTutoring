"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { memberSignup, type SignupState } from "@/lib/actions/member";
import { Button } from "@/components/Button";
import { Field, TextInput } from "@/components/FormField";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

export function SignupForm() {
  const [state, formAction] = useActionState(memberSignup, {} as SignupState);
  const errors = state.errors ?? {};
  const values = state.values ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {/* Bot trap: hidden from real people. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      <Field label="Full name" htmlFor="name" error={errors.name}>
        <TextInput
          id="name"
          name="name"
          autoComplete="name"
          defaultValue={values.name}
          placeholder="First and last name"
          required
        />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email}>
        <TextInput
          id="email"
          type="email"
          name="email"
          autoComplete="email"
          defaultValue={values.email}
          placeholder="you@example.com"
          required
        />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password} hint="At least 8 characters.">
        <TextInput id="password" type="password" name="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={errors.confirm}>
        <TextInput id="confirm" type="password" name="confirm" autoComplete="new-password" required />
      </Field>
      {errors.form && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{errors.form}</p>
      )}
      <SubmitButton />
    </form>
  );
}
