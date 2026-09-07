import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/components/login-form";
import { shouldSeedDemoData } from "@/db/bootstrap";
import { DEMO_PASSWORD } from "@/db/seed";
import { getSession } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.role === "admin" ? "/admin" : "/play");

  return (
    <div className="auth">
      <aside className="auth-hero">
        <Link href="/">
          <BrandLogo subtitle="Pickleball Club" />
        </Link>
        <div className="stack">
          <h2>Your court, your hour, your crew.</h2>
          <p>
            Sign in to reserve one of the seven courts or grab a seat in tonight&apos;s open play rotation.
          </p>
        </div>
        <Image src={BRAND.images.openPlay} alt="" width={480} height={300} />
      </aside>

      <section className="auth-panel">
        <div className="auth-box">
          <div>
            <span className="eyebrow">Member access</span>
            <h1>Welcome back</h1>
          </div>
          <LoginForm />
          {/*
            Only where those accounts actually exist. Printed unconditionally it
            hands a password to every visitor of a real club's sign-in page, and
            offers logins that were never seeded.
          */}
          {shouldSeedDemoData() ? (
            <p className="demo-note">
              <strong>Demo accounts.</strong> Admin: <code>admin@example.com</code>. Member:{" "}
              <code>ana@example.com</code>. Password for both: <code>{DEMO_PASSWORD}</code>.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
