import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

/**
 * What makes the site installable from a phone's browser: Add to Home Screen
 * on Android and iOS both read this, and the app then opens full screen with
 * its own icon, no address bar.
 *
 * It is not an app store build. There is no APK and no .ipa here - the club
 * runs the same server-backed app, wrapped by the phone's own browser engine.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.legalName,
    short_name: BRAND.name,
    description: BRAND.description,
    // Members open the app to book or to see tonight's rotation, not to read
    // the landing page they have already been sold on.
    start_url: "/play",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f7f5",
    theme_color: "#07272f",
    categories: ["sports", "lifestyle"],
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png" },
      // Android crops a maskable icon to whatever shape the launcher uses.
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
