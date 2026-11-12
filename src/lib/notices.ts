import { redirect } from "next/navigation";

/**
 * Result messages for officer actions (#9). An action redirects back to its tab
 * with ?notice=<key>&n=<number>, and the tab shows the matching banner. Only
 * these fixed texts can appear: the URL never carries free text.
 */
type Tone = "good" | "warn";
const NOTICES: Record<string, { tone: Tone; text: (n: number) => string }> = {
  cancelled: { tone: "good", text: () => "Cancelled. The student, and the tutor if there was one, are being emailed." },
  "cancelled-past": { tone: "good", text: () => "Marked as not happened. It is listed under Recently cancelled if you need to restore it." },
  "not-cancellable": { tone: "warn", text: () => "That request was already closed, so nothing changed." },
  reopened: { tone: "good", text: () => "Reopened. The student was told, and members are being emailed again." },
  "not-reopenable": {
    tone: "warn",
    text: () => "That session could not be reopened: the meeting has started, or the tutor changed in the meantime.",
  },
  "blast-sent": {
    tone: "good",
    text: (n) => `Sending the request to ${n} member${n === 1 ? "" : "s"} who had not received it yet.`,
  },
  "blast-none": { tone: "good", text: () => "Every active member already has this request. Nothing was sent." },
  "blast-not-open": { tone: "warn", text: () => "That request is no longer open, so nothing was sent." },
  assigned: { tone: "good", text: () => "Assigned. Both intro emails are on their way." },
  "assign-taken": {
    tone: "warn",
    text: () => "Could not assign: the request is no longer open, or its meeting has already started.",
  },
  "assign-overlap": {
    tone: "warn",
    text: () => "That member already has a session at that time. Tick \"Assign anyway\" if you really mean it.",
  },
  "assign-inactive": { tone: "warn", text: () => "That member is not active, so they cannot be assigned." },
  credited: { tone: "good", text: () => "Credit recorded." },
  "credit-invalid": { tone: "warn", text: () => "Enter whole minutes between 5 and 480." },
  "credit-gone": { tone: "warn", text: () => "That session was already credited, or it no longer has a tutor." },
  "credit-undone": { tone: "good", text: () => "Credit removed. The session is back under Ready for credit." },
  "credit-undo-gone": { tone: "warn", text: () => "That credit was already removed." },
  "restored-claimed": { tone: "good", text: () => "Restored. The tutor has the session again." },
  "restored-open": { tone: "good", text: () => "Restored. Members are being emailed about it again." },
  "not-restorable": {
    tone: "warn",
    text: () =>
      "That request cannot be restored: it has no tutor, and its meeting time has passed or the student never confirmed it.",
  },
  deactivated: {
    tone: "good",
    text: (n) =>
      n > 0
        ? `Deactivated. ${n} upcoming session${n === 1 ? "" : "s"} went back to the other members, and the student${n === 1 ? " was" : "s were"} told.`
        : "Deactivated. They are signed out and get no more request emails.",
  },
  reactivated: { tone: "good", text: () => "Reactivated. They get request emails again and can sign in." },
};

const TABS = ["requests", "hours", "members", "leaderboard", "email"] as const;
export type AdminTab = (typeof TABS)[number];

/** End an officer action: go back to the tab with a result message. */
export function backWithNotice(tab: string, notice: string, n?: number): never {
  const safeTab = (TABS as readonly string[]).includes(tab) ? tab : "requests";
  const query = new URLSearchParams({ notice, ...(n !== undefined ? { n: String(n) } : {}) });
  redirect(`/admin/${safeTab}?${query}`);
}

export function noticeFor(key?: string, n?: string): { tone: Tone; text: string } | null {
  const notice = key ? NOTICES[key] : undefined;
  if (!notice) return null;
  return { tone: notice.tone, text: notice.text(Math.max(0, Math.floor(Number(n) || 0))) };
}
