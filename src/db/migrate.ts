import path from "node:path";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { getDatabaseState } from "./client";

let migrationPromise: Promise<void> | undefined;

export function ensureDatabase(): Promise<void> {
  migrationPromise ??= (async () => {
    const state = getDatabaseState();
    const migrationsFolder = path.join(process.cwd(), "drizzle");
    if (state.kind === "pglite") {
      await migratePglite(state.db, { migrationsFolder });
    } else {
      await migratePostgres(state.db as never, { migrationsFolder });
    }
  })();
  return migrationPromise;
}
