import Link from "next/link";
import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth";
import { BrandLogo } from "./brand-logo";
import { LogoutButton } from "./logout-button";
import { NavLinks } from "./nav-links";

export function AppShell({
  session,
  variant,
  title,
  subtitle,
  actions,
  children,
}: {
  session: SessionUser;
  variant: "member" | "admin";
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href={variant === "admin" ? "/admin" : "/play"}>
          <BrandLogo subtitle={variant === "admin" ? "Admin console" : "Member"} />
        </Link>
        <NavLinks variant={variant} />
        <div className="sidebar-foot">
          <div className="who">
            <strong style={{ color: "#fff" }}>{session.name}</strong>
            <div style={{ fontSize: 12 }}>{session.email}</div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            {subtitle ? <p className="muted" style={{ fontSize: 13 }}>{subtitle}</p> : null}
          </div>
          {actions ? <div className="row">{actions}</div> : null}
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
