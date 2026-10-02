"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/requests", label: "Requests" },
  { href: "/admin/hours", label: "Hours" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/leaderboard", label: "Leaderboard" },
  { href: "/admin/email", label: "Email" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="-mb-px flex gap-6">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 pb-2.5 pt-1 text-sm font-medium transition-colors ${
              active
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
