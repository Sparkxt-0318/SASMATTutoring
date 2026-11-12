import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ButtonLink } from "@/components/Button";

export const metadata: Metadata = {
  title: "Check your email",
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
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">Check your email.</h1>
          <p className="mt-3 leading-relaxed text-muted">
            We sent a confirmation link to your school inbox. Press <strong>Confirm my request</strong>{" "}
            in that email and every Mu Alpha Theta member is told right away. As soon as one claims
            it, you&rsquo;ll get an email introducing your tutor.
          </p>
          <p className="mt-3 text-sm text-faint">
            Nothing there after a few minutes? Check your Junk folder.
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
