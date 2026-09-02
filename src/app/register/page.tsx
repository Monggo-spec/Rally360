import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { RegisterForm } from "@/components/register-form";
import { getSession } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { COURT_COUNT } from "@/lib/config";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect(session.role === "admin" ? "/admin" : "/play");

  return (
    <div className="auth">
      <aside className="auth-hero">
        <Link href="/">
          <BrandLogo subtitle="Pickleball Club" />
        </Link>
        <div className="stack">
          <h2>Book {COURT_COUNT} courts from your phone.</h2>
          <p>
            New members get instant access to court reservations and open play sign-ups. No approval queue.
          </p>
        </div>
        <Image src={BRAND.images.booking} alt="" width={480} height={300} />
      </aside>

      <section className="auth-panel">
        <div className="auth-box">
          <div>
            <span className="eyebrow">New member</span>
            <h1>Create your account</h1>
          </div>
          <RegisterForm />
        </div>
      </section>
    </div>
  );
}
