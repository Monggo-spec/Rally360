import { ensureDatabase } from "./migrate";
import { seedClub } from "./seed";

let bootstrapPromise: Promise<void> | undefined;

/**
 * Whether to plant the demo members and sessions.
 *
 * Off in production unless SEED_DEMO_DATA is exactly "true". That opt-in exists
 * so a hosted copy can be handed to somebody to try, and it has a real cost:
 * the demo password is printed in the README, so anybody who finds the URL can
 * sign in as the club admin. Turn it off before the club depends on this.
 */
function shouldSeedDemoData() {
  if (process.env.SEED_DEMO_DATA === "true") return true;
  if (process.env.SEED_DEMO_DATA === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * Runs once per server process: applies migrations, then plants the seven
 * courts, and the demo people when they are asked for.
 */
export function ensureAppReady() {
  bootstrapPromise ??= (async () => {
    await ensureDatabase();
    await seedClub({ demo: shouldSeedDemoData() });
  })();
  return bootstrapPromise;
}
