"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { importMembers, type ImportState } from "@/lib/actions/members";
import { Button } from "@/components/Button";
import { TextArea } from "@/components/FormField";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="self-start">
      {pending ? "Importing…" : "Import"}
    </Button>
  );
}

function names(list: string[]): string {
  return list.length > 12 ? `${list.slice(0, 12).join(", ")} and ${list.length - 12} more` : list.join(", ");
}

export function ImportMembersForm() {
  const [state, formAction] = useActionState(importMembers, {} as ImportState);
  const formRef = useRef<HTMLFormElement>(null);
  const result = state.result;

  // Clear the file and text after a successful import.
  useEffect(() => {
    if (state.result) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Import a member list</h2>
        <p className="mt-1 text-sm text-muted">
          Upload a CSV, such as the attendance sheet, or paste names and emails. Everyone found
          is added to the list below.
        </p>
      </div>
      <input
        type="file"
        name="file"
        accept=".csv,.txt,text/csv,text/plain"
        aria-label="Member list file"
        className="text-sm text-muted file:mr-4 file:rounded-full file:border-0 file:bg-surface file:px-4 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-hairline/60"
      />
      <TextArea
        name="text"
        rows={3}
        aria-label="Or paste names and emails"
        placeholder={"Or paste here, one person per line:\nJane Doe, jane01px2030@saschina.org"}
      />
      <label className="flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" name="replace" className="mt-0.5 h-4 w-4 shrink-0 accent-accent" />
        <span>
          Make this the whole member list. Everyone not in it is deactivated: they stop getting
          request emails and can no longer sign in. You can reactivate anyone later.
        </span>
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state.rejected && state.rejected.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">
            {state.rejected.length === 1 ? "1 line was" : `${state.rejected.length} lines were`} not imported:
          </p>
          <ul className="mt-2 space-y-1 break-words">
            {state.rejected.map((row) => (
              <li key={row.line}>
                Line {row.line}: {row.text} <span className="text-amber-700/80">({row.reason})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {result && (
        <div className="space-y-1 rounded-xl bg-green-50 p-4 text-sm text-green-700">
          <p>
            {result.added.length > 0
              ? `Added ${result.added.length}: ${names(result.added)}.`
              : "No new members were added."}
          </p>
          {result.reactivated.length > 0 && (
            <p>
              Reactivated {result.reactivated.length}: {names(result.reactivated)}.
            </p>
          )}
          {result.alreadyListed > 0 && <p>{result.alreadyListed} already on the list.</p>}
          {result.renamed.length > 0 && (
            <p>
              Renamed {result.renamed.length}: {names(result.renamed)}.
            </p>
          )}
          {result.deactivated.length > 0 && (
            <p>
              Deactivated {result.deactivated.length}: {names(result.deactivated)}.
            </p>
          )}
          {result.sessionsReleased > 0 && (
            <p>
              {result.sessionsReleased === 1
                ? "1 upcoming session went back to the pool."
                : `${result.sessionsReleased} upcoming sessions went back to the pool.`}
            </p>
          )}
        </div>
      )}
      <SubmitButton />
    </form>
  );
}
