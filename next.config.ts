import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a wasm build with its own filesystem layer; bundling it breaks
  // node:fs path handling at runtime. Keep it external on the server.
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: {
    // The migrator reads ./drizzle from disk at runtime rather than importing
    // it. Today's tracer already picks the .sql files up, but nothing in the
    // code makes that guaranteed, so state the requirement instead of relying
    // on it: without these files a deployed instance cannot migrate.
    "/*": ["./drizzle/**/*"],
  },
  images: {
    // The placeholder artwork in /public/brand is SVG we author ourselves. The
    // CSP + attachment disposition below are the guards Next.js documents for
    // serving SVG through the image optimizer.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
