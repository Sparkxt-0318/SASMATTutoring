import { noticeFor } from "@/lib/notices";

/** The result banner an officer action leaves behind (see src/lib/notices.ts). */
export function Notice({ notice, n }: { notice?: string; n?: string }) {
  const message = noticeFor(notice, n);
  if (!message) return null;
  return (
    <p
      role="status"
      className={`mb-6 rounded-2xl px-5 py-4 text-sm ${
        message.tone === "good" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {message.text}
    </p>
  );
}

export type NoticeParams = Promise<{ notice?: string; n?: string }>;
