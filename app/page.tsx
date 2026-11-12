import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { EXAMPLE_BRIEF } from "@/lib/cases";
import { FREE_CREDITS } from "@/lib/credit-packs";

export const instant = false;

export default async function LandingPage() {
  const { userId } = await auth();
  const signedIn = Boolean(userId);
  const primaryHref = signedIn ? "/case" : "/sign-up";
  const primaryLabel = signedIn ? "Open the board" : "Start a case";

  return (
    <div className="landing">
      <header className="landing-nav">
        <Link href="/" className="landing-wordmark">
          The Gift Case
        </Link>
        <nav className="landing-nav-links" aria-label="Main">
          <Link href="#how-it-works">How it works</Link>
          {signedIn ? (
            <Link href="/case" className="landing-nav-cta">
              Open the board
            </Link>
          ) : (
            <>
              <Link href="/sign-in">Sign in</Link>
              <Link href="/sign-up" className="landing-nav-cta">
                Start a case
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <p className="landing-kicker">Gift detection, by appointment</p>
            <h1>The gift-finding platform for people who are hard to shop for.</h1>
            <p className="landing-lede">
              The Gift Case is a gift finder run like a noir investigation.
              Tell the detective who you are shopping for, what they love, what
              they cannot stand, and what you want to spend. It pulls out the
              clues, searches a live catalog, and pins real gifts to a
              corkboard — each one tied by red string to the reason it fits.
            </p>
            <div className="landing-actions">
              <Link href={primaryHref} className="landing-go">
                {primaryLabel}
              </Link>
              <Link href="#how-it-works" className="landing-secondary">
                See how it works
              </Link>
            </div>
            <p className="landing-hint">
              {signedIn
                ? "Your board is ready. One witness statement is all it takes to open a case."
                : `After you sign in you land straight on the board. Your first ${FREE_CREDITS} cases are free.`}
            </p>
          </div>

          <figure className="landing-dossier">
            <p className="landing-dossier-tab" aria-hidden="true">
              Case file
            </p>
            <h2>What lands on the board</h2>
            <ul className="landing-dossier-list">
              <li>
                <strong>Clues.</strong> The facts that decide the gift, pulled
                straight from your statement.
              </li>
              <li>
                <strong>Suspects.</strong> Real products from a live catalog,
                filtered to your budget.
              </li>
              <li>
                <strong>Red string.</strong> Every suspect tied to the clues it
                answers.
              </li>
              <li>
                <strong>Notes.</strong> A plain-English reason for each pick, so
                you can defend it.
              </li>
            </ul>
            <blockquote className="landing-sample">
              &ldquo;{EXAMPLE_BRIEF}&rdquo;
            </blockquote>
            <figcaption className="landing-sample-caption">
              Example witness statement
            </figcaption>
          </figure>
        </section>

        <section id="how-it-works" className="landing-how">
          <div className="landing-section-head">
            <p className="landing-kicker">From statement to shortlist</p>
            <h2>How the investigation runs</h2>
          </div>
          <ol className="landing-steps">
            <li className="landing-step">
              <span className="landing-step-no" aria-hidden="true">
                01
              </span>
              <h3>Write the witness statement</h3>
              <p>
                Age, interests, aversions, budget. Write it the way you would
                explain the person to a friend.
              </p>
            </li>
            <li className="landing-step">
              <span className="landing-step-no" aria-hidden="true">
                02
              </span>
              <h3>The detective works the case</h3>
              <p>
                Clues are extracted, a live catalog is searched, and every
                candidate is checked against the brief and the budget.
              </p>
            </li>
            <li className="landing-step">
              <span className="landing-step-no" aria-hidden="true">
                03
              </span>
              <h3>Read the board</h3>
              <p>
                Real gifts pin up as suspects. Click one to read the detective
                notes and follow the red string back to the clue it answers.
              </p>
            </li>
          </ol>
        </section>

        <section className="landing-close">
          <p className="landing-kicker">No generic listicles</p>
          <h2>One person. One statement. A board of real leads.</h2>
          <p>
            Every pick comes with the evidence attached. Cases stay in your
            private archive. Start with {FREE_CREDITS} free cases.
          </p>
          <Link href={primaryHref} className="landing-go">
            {signedIn ? "Open the board" : "Start your first case"}
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <span>The Gift Case</span>
        <span>Gift detection, by appointment.</span>
      </footer>
    </div>
  );
}
