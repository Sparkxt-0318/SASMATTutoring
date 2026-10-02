import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ButtonLink } from "@/components/Button";

export const metadata: Metadata = {
  title: "Request received",
};

export default function RequestSuccessPage() {
  return (
    <>
      <Nav />
      <main className="flex flex-1 items-center justify-center bg-surface px-6 py-24">
        <div className="rise-in mx-auto max-w-md rounded-2xl bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl">
            ✓
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">Request received.</h1>
          <p className="mt-3 leading-relaxed text-muted">
            Every Mu Alpha Theta member just got a notification. As soon as one claims your
            request, you&rsquo;ll get an email introducing your tutor. Keep an eye on your school
            inbox.
          </p>
          <div className="mt-8">
            <ButtonLink href="/" variant="secondary">
              Back to home
            </ButtonLink>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
