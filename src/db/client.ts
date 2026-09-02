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

function createDatabase(): DatabaseState {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    const client = postgres(databaseUrl, {
      max: process.env.NODE_ENV === "production" ? 4 : 1,
      prepare: false,
    });
    const db = drizzlePostgres(client, { schema }) as unknown as AppDatabase;
    return { db, kind: "postgres", postgresClient: client };
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production.");
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
