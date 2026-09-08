import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ variable: "--font-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  // Add to Home Screen reads these. iOS ignores the manifest's icons and takes
  // the apple-touch-icon instead, which is why 180 is generated separately.
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/app-icon/192", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/app-icon/180", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  // The installed app runs under the notch and the home indicator, so the shell
  // has to be allowed to reach them - see the safe-area padding in globals.css.
  viewportFit: "cover",
  themeColor: "#07272f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable}>
      {/*
       * Browser extensions write their own attributes onto <body> before React
       * hydrates - Grammarly adds data-gr-ext-installed, password managers and
       * translators do the same. React sees attributes the server never sent
       * and reports a hydration mismatch the app cannot fix.
       *
       * This only covers <body>'s own attributes, not its subtree, so a real
       * mismatch inside the app still surfaces.
       */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
