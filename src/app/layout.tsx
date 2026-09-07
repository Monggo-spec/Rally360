import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ variable: "--font-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
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
