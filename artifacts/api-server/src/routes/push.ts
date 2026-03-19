import { Router } from "express";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

/** GET /api/push/vapid-public-key — expose the public VAPID key to the frontend */
router.get("/push/vapid-public-key", (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) { res.status(503).json({ error: "Push not configured" }); return; }
  res.json({ key });
});

/** POST /api/push/subscribe — save a push subscription for the current user */
router.post("/push/subscribe", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { endpoint, keys } = req.body as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: "Invalid subscription" });
      return;
    }
    await db
      .insert(pushSubscriptionsTable)
      .values({ userId: req.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth })
      .onConflictDoNothing();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

/** DELETE /api/push/subscribe — remove a subscription */
router.delete("/push/subscribe", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { endpoint } = req.body as { endpoint: string };
    if (endpoint) {
      await db.delete(pushSubscriptionsTable).where(
        and(eq(pushSubscriptionsTable.userId, req.user.id), eq(pushSubscriptionsTable.endpoint, endpoint))
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove subscription" });
  }
});

export default router;
