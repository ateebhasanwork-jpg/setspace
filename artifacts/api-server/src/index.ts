import app from "./app";
import { seedSchedules } from "./routes/schedules";

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

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  // Seed employee schedules (safe to run on every start — uses upsert)
  seedSchedules().then(() => console.log("[schedules] Seed complete")).catch(console.error);
});
