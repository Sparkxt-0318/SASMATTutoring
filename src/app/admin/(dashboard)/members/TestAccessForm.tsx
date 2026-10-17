"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createTestAccessCode, type TestCodeState } from "@/lib/actions/members";
import { Button } from "@/components/Button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="shrink-0">
      {pending ? "Creating..." : "Create access code"}
    </Button>
  );
}

/** Lets an officer open the member view as a chosen member (#40). The code is shown here, never emailed. */
export function TestAccessForm({ members }: { members: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState(createTestAccessCode, {} as TestCodeState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold tracking-tight">Test the member view</h2>
        <p className="mt-0.5 text-sm text-muted">
          Get a one-time code to sign in as a member, on any device. It works once, for 10 minutes,
          and is never emailed.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          name="memberId"
          defaultValue=""
          required
          aria-label="Member"
          className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
        >
          <option value="" disabled>
            Choose a member
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <SubmitButton />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state.code && state.email && (
        <div role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-700">
          <p>
            Code: <span className="font-mono text-lg font-semibold tracking-widest">{state.code}</span>
          </p>
          <p className="mt-1">
            Open{" "}
            <a
              href={`/member/login?email=${encodeURIComponent(state.email)}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline"
            >
              the member sign-in page
            </a>{" "}
            and enter it within {state.minutes} minutes. Making another code replaces this one.
          </p>
        </div>
      )}
    </form>
  );
}
