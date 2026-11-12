/** Shown at once while a tab loads, so navigation never looks stuck (#13). */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 rounded-lg bg-hairline/60" />
      <div className="mt-3 h-4 w-80 max-w-full rounded bg-hairline/40" />
      <div className="mt-8 h-40 rounded-2xl bg-white shadow-sm" />
      <div className="mt-4 h-40 rounded-2xl bg-white shadow-sm" />
    </div>
  );
}
