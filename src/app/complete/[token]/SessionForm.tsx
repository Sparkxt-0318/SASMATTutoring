"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { logSession, type SessionLogState } from "@/lib/actions/credits";
import { Button } from "@/components/Button";
import { Field, TextArea } from "@/components/FormField";
import { DURATION_OPTIONS, formatMinutes } from "@/lib/constants";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Logging…" : "Log session"}
    </Button>
  );
}

export function SessionForm({ token }: { token: string }) {
  const logWithToken = logSession.bind(null, token);
  const [state, formAction] = useActionState(logWithToken, {} as SessionLogState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Field label="Session length" htmlFor="minutes">
        <div className="grid grid-cols-4 gap-2">
          {DURATION_OPTIONS.map((minutes, i) => (
            <label key={minutes} className="cursor-pointer">
              <input
                type="radio"
                name="minutes"
                value={minutes}
                defaultChecked={i === 3}
                className="peer sr-only"
              />
              <span className="flex items-center justify-center rounded-xl border border-hairline px-2 py-2.5 text-sm font-medium text-muted transition-all peer-checked:border-accent peer-checked:bg-accent/5 peer-checked:text-accent peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                {formatMinutes(minutes)}
              </span>
            </label>
          ))}
        </div>
      </Field>

      <Field label="Notes (optional)" htmlFor="notes" hint="What you covered, for the officers.">
        <TextArea id="notes" name="notes" rows={3} placeholder="e.g. Reviewed chain rule problems from unit 4" />
      </Field>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <SubmitButton />
    </form>
  );
}
