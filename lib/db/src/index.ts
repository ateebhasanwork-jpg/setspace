import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep at most 3 concurrent connections — enough for normal load,
  // minimal when idle.
  max: 3,
  // Release connections that have been idle for 10 seconds.
  // When no users are active the pool drops to 0 held connections.
  idleTimeoutMillis: 10_000,
  // Fail fast if the DB is unreachable rather than queuing forever.
  connectionTimeoutMillis: 5_000,
  // Allow the event loop to drain when all connections are idle.
  allowExitOnIdle: true,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
