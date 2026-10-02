"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { addMember, type MemberFormState } from "@/lib/actions/members";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/FormField";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="shrink-0">
      {pending ? "Adding…" : "Add member"}
    </Button>
  );
}

export function AddMemberForm() {
  const [state, formAction] = useActionState(addMember, {} as MemberFormState);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the inputs after a successful add.
  useEffect(() => {
    if (state.added) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <TextInput name="name" placeholder="Full name" autoComplete="off" required />
        <TextInput name="email" type="email" placeholder="Email address" autoComplete="off" required />
        <SubmitButton />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.added && (
        <div className="rounded-xl bg-green-50 p-4 text-sm text-green-700">
          <p>
            Added {state.added.name}. Temporary password, shown only now:{" "}
            <code className="rounded-lg bg-white px-2.5 py-1 font-mono text-foreground">
              {state.added.password}
            </code>
          </p>
          <p className="mt-2 text-xs">
            Give it to them privately. They sign in at /member/login with {state.added.email} and
            then choose their own password.
          </p>
        </div>
      )}
    </form>
  );
}
