import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/notifications", async (req, res) => {
  try {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const notifs = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, req.user.id))
      .orderBy(notificationsTable.createdAt);
    res.json(notifs.map(n => ({ ...n, createdAt: n.createdAt.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: "Failed to list notifications" });
  }
});

router.post("/notifications/:notificationId/read", async (req, res) => {
  try {
    const id = parseInt(req.params.notificationId);
    const [updated] = await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Notification not found" });
    res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark notification read" });
  }
});

router.post("/notifications/read-all", async (req, res) => {
  try {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.userId, req.user.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark all read" });
  }
});

export default router;
