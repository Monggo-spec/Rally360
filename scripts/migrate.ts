import { closeDatabase } from "../src/db/client";
import { ensureDatabase } from "../src/db/migrate";
import { seedClub } from "../src/db/seed";

async function main() {
  await ensureDatabase();
  await seedClub({ demo: process.env.SEED_DEMO_DATA !== "false" });
  console.log("Database is migrated and the seven courts are in place.");
  await closeDatabase();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
