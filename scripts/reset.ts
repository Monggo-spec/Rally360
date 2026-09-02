import { rm } from "node:fs/promises";

/**
 * Wipes the local PGlite database so the next `pnpm dev` re-seeds a fresh club.
 * Refuses to touch a real Postgres connection.
 */
async function main() {
  if (process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is set. Reset only ever deletes the local PGlite store.");
    process.exit(1);
  }
  await rm("./.data/pickleball", { recursive: true, force: true });
  console.log("Local database removed. Run `pnpm dev` to rebuild and re-seed it.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
