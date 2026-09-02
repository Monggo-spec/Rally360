import Image from "next/image";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { getSession } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { CLOSE_HOUR, COURT_COUNT, OPEN_HOUR, PLAYERS_PER_COURT } from "@/lib/config";

const FEATURES = [
  {
    image: BRAND.images.booking,
    title: "Reserve a court in seconds",
    body: `Pick a day, pick an hour, pick one of the ${COURT_COUNT} courts. You only ever see which hours are free - never who booked them.`,
  },
  {
    image: BRAND.images.openPlay,
    title: "Open play that counts properly",
    body: `Every session seats ${PLAYERS_PER_COURT} players per court. Once the seats are gone the next sign-up joins a real waitlist and moves up automatically.`,
  },
  {
    image: BRAND.images.coaching,
    title: "A live board for the lobby TV",
    body: "Cast the court board to any monitor. It shows who is on which court right now and who is next in the queue, and refreshes on its own.",
  },
];

export default async function LandingPage() {
  const session = await getSession();
  const homeHref = session?.role === "admin" ? "/admin" : "/play";

  return (
    <div className="marketing">
      <header className="top-nav">
        <BrandLogo />
        <div className="links">
          <Link className="button quiet small" href="/display">
            Court board
          </Link>
          {session ? (
            <Link className="button small" href={homeHref}>
              Go to my dashboard
            </Link>
          ) : (
            <>
              <Link className="button quiet small" href="/login">
                Sign in
              </Link>
              <Link className="button small" href="/register">
                Create account
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="hero">
        <div>
          <span className="eyebrow">Template site &middot; placeholder branding</span>
          <h1>{BRAND.tagline}</h1>
          <p className="lede">
            {BRAND.legalName} runs {COURT_COUNT} courts from {OPEN_HOUR}:00 to {CLOSE_HOUR}:00 daily, plus
            drop-in open play sessions with a live court board. Members book their own slots; the front desk
            sees everything.
          </p>
          <div className="hero-actions">
            <Link className="button" href={session ? homeHref : "/register"}>
              {session ? "Go to my dashboard" : "Join the club"}
            </Link>
            <Link className="button ghost" href={session ? "/play/book" : "/login"}>
              Book a court
            </Link>
          </div>
        </div>
        <div className="hero-art">
          <Image
            src={BRAND.images.hero}
            alt="Placeholder illustration of a pickleball court"
            width={800}
            height={560}
            priority
          />
        </div>
      </section>

      <section className="stat-strip">
        <div className="card">
          <strong>{COURT_COUNT}</strong>
          <span>Courts, indoor and outdoor</span>
        </div>
        <div className="card">
          <strong>
            {OPEN_HOUR}:00-{CLOSE_HOUR}:00
          </strong>
          <span>Open every day</span>
        </div>
        <div className="card">
          <strong>{PLAYERS_PER_COURT}</strong>
          <span>Players per court, counted exactly</span>
        </div>
        <div className="card">
          <strong>Live</strong>
          <span>Court board for the lobby TV</span>
        </div>
      </section>

      <section className="features">
        {FEATURES.map((feature) => (
          <article className="card feature" key={feature.title}>
            <Image src={feature.image} alt="" width={480} height={300} />
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>

      <footer className="site-foot">
        <div className="inner">
          <div>
            <strong>{BRAND.legalName}</strong>
            <div>{BRAND.addressLines.join(", ")}</div>
            <div>
              {BRAND.phone} &middot; {BRAND.email}
            </div>
          </div>
          <div style={{ maxWidth: "42ch" }}>
            Every name, address, and image on this page is placeholder content. Swap them in{" "}
            <code>src/lib/brand.ts</code> and <code>public/brand/</code>.
          </div>
        </div>
      </footer>
    </div>
  );
}
