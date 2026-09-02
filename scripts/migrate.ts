import { closeDatabase } from "../src/db/client";
import { ensureDatabase } from "../src/db/migrate";
import { seedClub } from "../src/db/seed";

/**
 * Applies migrations and plants the seven courts. Run by `pnpm db:migrate`
 * locally and by `pnpm vercel-build` on every deploy, so a serverless instance
 * never has to migrate on its first request.
 */
async function main() {
  // Mirrors ensureAppReady: production never gets demo members, whatever
  // SEED_DEMO_DATA happens to say. Forgetting to set it must not put fifteen
  // accounts with a published password into a real club's database.
  const demo = process.env.NODE_ENV !== "production" && process.env.SEED_DEMO_DATA !== "false";

  await ensureDatabase();
  await seedClub({ demo });

  console.log(
    demo
      ? "Database migrated, seven courts in place, demo members seeded."
      : "Database migrated and the seven courts are in place. No demo data.",
  );
  await closeDatabase();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
