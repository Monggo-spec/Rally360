"use client";

import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  MonitorPlay,
  Users,
  Volleyball,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MEMBER_LINKS = [
  { href: "/play", label: "Today", icon: LayoutDashboard },
  { href: "/play/book", label: "Book a court", icon: CalendarDays },
  { href: "/play/open-play", label: "Open play", icon: Volleyball },
  { href: "/play/bookings", label: "My schedule", icon: ClipboardList },
] as const;

const ADMIN_LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Reservations", icon: CalendarDays },
  { href: "/admin/open-play", label: "Open play", icon: Volleyball },
  { href: "/admin/waitlist", label: "Waitlist", icon: ListChecks },
  { href: "/admin/courts", label: "Courts", icon: Wrench },
  { href: "/admin/members", label: "Members", icon: Users },
  // The board belongs on a second screen, so it gets its own tab.
  { href: "/display", label: "TV board", icon: MonitorPlay, external: true },
] as const;

export function NavLinks({ variant }: { variant: "member" | "admin" }) {
  const pathname = usePathname();
  const links = variant === "admin" ? ADMIN_LINKS : MEMBER_LINKS;

  return (
    <nav className="nav">
      {links.map((link) => {
        const Icon = link.icon;
        const external = "external" in link && link.external;
        const active =
          !external &&
          (pathname === link.href ||
            (link.href !== "/admin" && link.href !== "/play" && pathname.startsWith(link.href)));
        const body = (
          <>
            <Icon size={18} strokeWidth={2.2} aria-hidden />
            <span>{link.label}</span>
          </>
        );

        return external ? (
          <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
            {body}
          </a>
        ) : (
          <Link key={link.href} href={link.href} className={active ? "active" : undefined}>
            {body}
          </Link>
        );
      })}
    </nav>
  );
}
