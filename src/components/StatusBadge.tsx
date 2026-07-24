const styles: Record<string, { label: string; className: string }> = {
  OPEN: { label: "Open", className: "bg-blue-50 text-accent" },
  CLAIMED: { label: "Claimed", className: "bg-amber-50 text-amber-700" },
  COMPLETED: { label: "Completed", className: "bg-green-50 text-green-700" },
  CANCELLED: { label: "Cancelled", className: "bg-surface text-muted" },
  EXPIRED: { label: "Expired", className: "bg-surface text-muted" },
  PENDING: { label: "Pending", className: "bg-amber-50 text-amber-700" },
  APPROVED: { label: "Approved", className: "bg-green-50 text-green-700" },
  REJECTED: { label: "Rejected", className: "bg-red-50 text-red-600" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = styles[status] ?? { label: status, className: "bg-surface text-muted" };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}
