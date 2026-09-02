import { PGlite } from "@electric-sql/pglite";
import { mkdirSync } from "node:fs";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type AppDatabase = PgliteDatabase<typeof schema>;

type DatabaseState = {
  db: AppDatabase;
  kind: "pglite" | "postgres";
  pglite?: PGlite;
  postgresClient?: ReturnType<typeof postgres>;
};

const globalDatabase = globalThis as typeof globalThis & { pickleballDatabase?: DatabaseState };

/**
 * Hosted Postgres add-ons do not agree on a name. Vercel's own integration
 * injects POSTGRES_URL, the Neon marketplace one injects DATABASE_URL, and
 * Supabase gives you a plain connection string to paste. Accept all of them so
 * a working database is never rejected over its variable name.
 */
function resolveDatabaseUrl(): string | undefined {
  for (const name of ["DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL"]) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function createDatabase(): DatabaseState {
  const databaseUrl = resolveDatabaseUrl();
  if (databaseUrl) {
    const client = postgres(databaseUrl, {
      // One connection per instance in production: serverless scales by adding
      // instances, so a pool per instance drains a small database's connection
      // limit long before it helps.
      max: 1,
      prepare: false,
    });
    const db = drizzlePostgres(client, { schema }) as unknown as AppDatabase;
    return { db, kind: "postgres", postgresClient: client };
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No database connection string. Set DATABASE_URL (or POSTGRES_URL) on the deployment.",
    );
  }
  mkdirSync("./.data", { recursive: true });
  const pglite = new PGlite("./.data/pickleball");
  return { db: drizzlePglite(pglite, { schema }), kind: "pglite", pglite };
}

export function getDatabaseState(): DatabaseState {
  globalDatabase.pickleballDatabase ??= createDatabase();
  return globalDatabase.pickleballDatabase;
}

export function getDb(): AppDatabase {
  return getDatabaseState().db;
}

export async function closeDatabase() {
  const state = globalDatabase.pickleballDatabase;
  if (!state) return;
  if (state.pglite) await state.pglite.close();
  if (state.postgresClient) await state.postgresClient.end();
  delete globalDatabase.pickleballDatabase;
}
