import type { ReactNode } from "react";

/**
 * Two-step destructive action (#6): the first click only reveals the real
 * button, so a stray tap never cancels or deactivates anything. Same pattern
 * as the member dashboard's "Can't make it anymore?".
 */
export function ConfirmButton({
  label,
  confirmLabel,
  action,
  question,
  className = "text-red-600 hover:underline",
  children,
}: {
  label: string;
  confirmLabel: string;
  action: (formData: FormData) => void | Promise<void>;
  question?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <details className="group text-sm">
      <summary className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden ${className}`}>
        <span className="group-open:hidden">{label}</span>
        <span className="hidden text-muted group-open:inline">Never mind</span>
      </summary>
      <form action={action} className="mt-2 flex flex-col items-start gap-2 rounded-xl bg-surface p-3">
        {question && <p className="max-w-[240px] text-xs leading-relaxed text-muted">{question}</p>}
        {children}
        <button
          type="submit"
          className="rounded-full bg-red-600 px-3.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700"
        >
          {confirmLabel}
        </button>
      </form>
    </details>
  );
}
