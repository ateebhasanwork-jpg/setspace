import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

/**
 * GET /api/notifications
 * Limited to the 50 most recent notifications per user.
 * Old notifications beyond 50 are not shown but remain in the DB.
 */
router.get("/notifications", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const notifs = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, req.user.id))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);
    res.json(notifs.map(n => ({ ...n, createdAt: n.createdAt.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: "Failed to list notifications" });
  }
});

router.post("/notifications/:notificationId/read", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const id = parseInt(req.params.notificationId);
    const [notif] = await db.select().from(notificationsTable).where(eq(notificationsTable.id, id));
    if (!notif || notif.userId !== req.user.id) { res.status(404).json({ error: "Notification not found" }); return; }
    const [updated] = await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.id, id)).returning();
    res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark notification read" });
  }
});

router.post("/notifications/read-all", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.userId, req.user.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark all read" });
  }
});

export default router;
