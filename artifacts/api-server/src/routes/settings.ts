import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminOrHR } from "../middleware/roles";

const router: IRouter = Router();

/** GET /api/settings — returns all app settings as { key: value } */
router.get("/settings", requireAdminOrHR, async (_req, res) => {
  try {
    const rows = await db.select().from(appSettingsTable);
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    res.json(out);
  } catch {
    res.status(500).json({ error: "Failed to load settings" });
  }
});

/** PATCH /api/settings — upsert or delete settings (admin/HR only) */
router.patch("/settings", requireAdminOrHR, async (req, res) => {
  try {
    const updates = req.body as Record<string, string | null>;
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        await db.delete(appSettingsTable).where(eq(appSettingsTable.key, key));
      } else {
        await db
          .insert(appSettingsTable)
          .values({ key, value })
          .onConflictDoUpdate({
            target: appSettingsTable.key,
            set: { value, updatedAt: new Date() },
          });
      }
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

export default router;
