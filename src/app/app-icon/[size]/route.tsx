import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/**
 * The club mark as a PNG, at the sizes a home-screen install asks for.
 *
 * Generated rather than checked in so the icon follows /public/brand: replace
 * the SVG when the real club artwork exists and every icon follows. Android
 * wants 192 and 512 from the manifest; 180 is what iOS uses for the home
 * screen, and it will not take an SVG.
 */
const SIZES = [180, 192, 512] as const;

export const dynamic = "force-static";

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

export async function GET(_request: Request, context: { params: Promise<{ size: string }> }) {
  const { size } = await context.params;
  const pixels = SIZES.includes(Number(size) as (typeof SIZES)[number]) ? Number(size) : 512;

  // Satori draws an <img>, so the mark travels as a data URI rather than a path.
  const svg = await readFile(path.join(process.cwd(), "public/brand/logo-mark.svg"), "utf8");
  const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#04161b",
        }}
      >
        {/*
          Drawn at 80% on a full-bleed background so the one asset serves as
          both a plain and a maskable icon: Android crops a maskable icon to
          the launcher's shape, and anything in the outer fifth is lost.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={source} width={Math.round(pixels * 0.8)} height={Math.round(pixels * 0.8)} alt="" />
      </div>
    ),
    { width: pixels, height: pixels },
  );
}
