/**
 * TEMPLATE BRANDING.
 *
 * Everything user-visible about the club's identity lives here so the whole
 * site can be re-skinned from one file. Swap these strings (and the matching
 * SVG files in /public/brand) when the real club name and artwork exist.
 */
export const BRAND = {
  name: "Rally360",
  shortName: "R360",
  legalName: "Rally360 Pickleball Club",
  tagline: "Seven courts. Open play all week. Book in ten seconds.",
  description:
    "Court reservations, open play sessions, and a live court board for the club TV.",
  addressLines: ["123 Placeholder Ave.", "Barangay Sample, Metro Manila"],
  phone: "+63 900 000 0000",
  email: "hello@example.com",
  /** Placeholder artwork. Replace the files, keep the paths. */
  images: {
    logo: "/brand/logo-mark.svg",
    hero: "/brand/hero-court.svg",
    openPlay: "/brand/open-play.svg",
    booking: "/brand/booking.svg",
    coaching: "/brand/coaching.svg",
    avatar: "/brand/avatar.svg",
  },
} as const;
