import type { ComponentProps, ReactNode } from "react";

const inputStyles =
  "w-full rounded-xl border border-hairline bg-white px-4 py-3 text-[15px] text-foreground placeholder:text-faint transition-shadow focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-faint">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function TextInput(props: ComponentProps<"input">) {
  return <input className={inputStyles} {...props} />;
}

export function TextArea(props: ComponentProps<"textarea">) {
  return <textarea className={`${inputStyles} resize-y`} {...props} />;
}

export function Select({ children, ...props }: ComponentProps<"select">) {
  return (
    <select className={`${inputStyles} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%236e6e73%22%20d%3D%22M6%208.5%201.5%204h9z%22/%3E%3C/svg%3E')] bg-[right_1rem_center] bg-no-repeat pr-10`} {...props}>
      {children}
    </select>
  );
}

/** Apple-style segmented control rendered with radio inputs (grade picker). */
export function SegmentedRadios({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: readonly string[];
  defaultValue?: string;
}) {
  return (
    <div className="grid grid-flow-col auto-cols-fr gap-0 rounded-xl bg-surface p-1">
      {options.map((option) => (
        <label key={option} className="relative cursor-pointer">
          <input
            type="radio"
            name={name}
            value={option}
            defaultChecked={option === defaultValue}
            className="peer sr-only"
          />
          <span className="flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-muted transition-all peer-checked:bg-white peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
            {option}
          </span>
        </label>
      ))}
    </div>
  );
}
