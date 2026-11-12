import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { shanghaiToday } from "@/lib/constants";
import { RequestForm } from "./RequestForm";

export const metadata: Metadata = {
  title: "Request a tutor",
};

// Rendered per request so the earliest selectable date is always "today".
export const dynamic = "force-dynamic";

export default function RequestPage() {
  return (
    <>
      <Nav />
      <main className="flex-1 bg-surface px-6 py-16">
        <div className="mx-auto max-w-xl">
          <div className="rise-in text-center">
            <h1 className="text-4xl font-semibold tracking-tight">Request a tutor.</h1>
            <p className="mt-3 text-muted">
              Takes about a minute. A Mu Alpha Theta member will reach out by email, usually the
              same day.
            </p>
          </div>
          <div className="rise-in rise-in-delay-1 mt-10 rounded-2xl bg-white p-6 shadow-sm sm:p-10">
            <RequestForm minDate={shanghaiToday()} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
