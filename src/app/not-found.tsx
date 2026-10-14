import Link from "next/link";
import { SimpleHeader } from "@/components/HomeButton";

export default function NotFound() {
  return (
    <>
      <SimpleHeader />
      <main className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center bg-surface px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-muted">This page doesn&rsquo;t exist or has moved.</p>
        <Link
          href="/"
          className="mt-6 rounded-full bg-accent px-6 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Go home
        </Link>
      </main>
    </>
  );
}
