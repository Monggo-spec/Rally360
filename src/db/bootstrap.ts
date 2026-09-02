import { ensureDatabase } from "./migrate";
import { seedClub } from "./seed";

let bootstrapPromise: Promise<void> | undefined;

/**
 * Runs once per server process: applies migrations, then plants the seven
 * courts. Demo members and sessions only land outside production.
 */
export function ensureAppReady() {
  bootstrapPromise ??= (async () => {
    await ensureDatabase();
    await seedClub({ demo: process.env.NODE_ENV !== "production" && process.env.SEED_DEMO_DATA !== "false" });
  })();
  return bootstrapPromise;
}
