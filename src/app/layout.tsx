import type { Metadata } from "next";
import "./globals.css";
import { CLUB_NAME, SCHOOL_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    default: `MAT Tutoring — ${SCHOOL_NAME}`,
    template: "%s — MAT Tutoring",
  },
  description: `Free peer math tutoring from ${CLUB_NAME} at ${SCHOOL_NAME}. Request help and get matched with a student tutor.`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
