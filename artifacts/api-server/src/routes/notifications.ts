import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { broadcastSseToUser } from "../lib/sse";
import { getCached, invalidateResult } from "../lib/cache";

const router: IRouter = Router();

const NOTIF_TTL_MS = 30_000;

export function notifKey(userId: string) {
  return `notifications:${userId}`;
}

/**
 * GET /api/notifications
 * Returns unread notifications for the current user (deleted on dismiss).
 */
router.get("/notifications", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const userId = req.user.id;
    const notifs = await getCached(notifKey(userId), NOTIF_TTL_MS, async () => {
      const rows = await db.select().from(notificationsTable)
        .where(eq(notificationsTable.userId, userId))
        .orderBy(desc(notificationsTable.createdAt))
        .limit(50);
      return rows.map(n => ({ ...n, isRead: false, createdAt: n.createdAt.toISOString() }));
    });
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ error: "Failed to list notifications" });
  }
});

/**
 * POST /api/notifications/:notificationId/read
 * Deletes the notification (shown notifications are always unread until dismissed).
 */
router.post("/notifications/:notificationId/read", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const id = parseInt(req.params.notificationId);
    const [notif] = await db.select().from(notificationsTable).where(eq(notificationsTable.id, id));
    if (!notif || notif.userId !== req.user.id) { res.status(404).json({ error: "Notification not found" }); return; }
    await db.delete(notificationsTable).where(eq(notificationsTable.id, id));
    invalidateResult(notifKey(req.user.id));
    broadcastSseToUser(req.user.id, "notifications", { action: "dismissed", id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to dismiss notification" });
  }
});

/**
 * POST /api/notifications/read-all
 * Deletes all notifications for the current user.
 */
router.post("/notifications/read-all", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    await db.delete(notificationsTable).where(eq(notificationsTable.userId, req.user.id));
    invalidateResult(notifKey(req.user.id));
    broadcastSseToUser(req.user.id, "notifications", { action: "dismissed-all" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to dismiss all notifications" });
  }
});

export default router;
