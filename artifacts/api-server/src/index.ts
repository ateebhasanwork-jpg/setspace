import app from "./app";
import { seedSchedules } from "./routes/schedules";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function runMigrations() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS salaries (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      basic_salary INTEGER NOT NULL DEFAULT 0,
      overtime_payment INTEGER NOT NULL DEFAULT 0,
      dependability_deduction_amount INTEGER NOT NULL DEFAULT 0,
      kpi_deduction_amount INTEGER NOT NULL DEFAULT 0,
      working_days_override INTEGER,
      kpi_threshold INTEGER NOT NULL DEFAULT 2,
      dependability_threshold INTEGER NOT NULL DEFAULT 2,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("[migrations] Tables ready");
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  runMigrations().catch(console.error);
  seedSchedules().then(() => console.log("[schedules] Seed complete")).catch(console.error);
});
