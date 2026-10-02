import { ButtonLink } from "@/components/Button";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { COURSES, CLUB_NAME, SCHOOL_NAME } from "@/lib/constants";

const STEPS = [
  {
    title: "Tell us what you need",
    body: "Fill out a short form with your course, the topic you're stuck on, and the time you'd like to meet.",
  },
  {
    title: "A tutor claims it",
    body: `Every ${CLUB_NAME} member is notified instantly. The first to claim your request becomes your tutor.`,
  },
  {
    title: "Meet and learn",
    body: "You're introduced by email within minutes. Find a time, meet up, get unstuck.",
  },
];

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        {/* Hero */}
        <section className="px-6 pb-24 pt-24 text-center sm:pt-32">
          <div className="mx-auto max-w-3xl">
            <p className="rise-in text-sm font-semibold uppercase tracking-widest text-muted">
              {CLUB_NAME} · {SCHOOL_NAME}
            </p>
            <h1 className="rise-in mt-4 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Math help, from students
              <br className="hidden sm:block" /> who get it.
            </h1>
            <p className="rise-in rise-in-delay-1 mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Free one-on-one tutoring from {SCHOOL_NAME}&rsquo;s math honor society. Any math
              course, any topic. A tutor usually claims your request the same day.
            </p>
            <div className="rise-in rise-in-delay-2 mt-9 flex items-center justify-center gap-4">
              <ButtonLink href="/request" size="lg">
                Request a tutor
              </ButtonLink>
              <a href="#how-it-works" className="text-[17px] text-accent hover:underline">
                How it works <span aria-hidden>›</span>
              </a>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="bg-surface px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
              How it works
            </h2>
            <div className="mt-14 grid gap-10 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <div key={step.title} className="text-center sm:text-left">
                  <span className="text-6xl font-semibold tracking-tight text-hairline">
                    {i + 1}
                  </span>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Courses */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Every math course at SAS.
            </h2>
            <p className="mt-4 text-lg text-muted">
              From IM1 to Multivariable Calculus. Someone in {CLUB_NAME} has aced it.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-2.5">
              {COURSES.map((course) => (
                <span
                  key={course}
                  className="rounded-full border border-hairline px-4 py-1.5 text-sm text-muted"
                >
                  {course}
                </span>
              ))}
            </div>
            <div className="mt-12">
              <ButtonLink href="/request" size="lg">
                Get started
              </ButtonLink>
            </div>
          </div>
        </section>

        {/* Members and officers */}
        <section className="bg-surface px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
              For {CLUB_NAME} members and officers.
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-8 shadow-sm">
                <h3 className="text-xl font-semibold tracking-tight">Are you a member?</h3>
                <p className="mt-3 leading-relaxed text-muted">
                  There is no account to make and nothing to log in to. When a student asks for a
                  tutor, you get an email with your own Claim button. The first member to confirm
                  becomes the tutor. Opening that same link later also shows your hours progress.
                </p>
              </div>
              <div className="rounded-2xl bg-white p-8 shadow-sm">
                <h3 className="text-xl font-semibold tracking-tight">Are you an officer?</h3>
                <p className="mt-3 leading-relaxed text-muted">
                  Sign in to manage the member roster, see every request, record the weekend
                  credit, and track everyone&rsquo;s progress.
                </p>
                <div className="mt-6">
                  <ButtonLink href="/admin" variant="secondary">
                    Officer login
                  </ButtonLink>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
