import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { messagesTable, usersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/messages", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const messages = await db.select().from(messagesTable).orderBy(desc(messagesTable.createdAt)).limit(limit);
    const users = await db.select().from(usersTable);
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    const result = messages.reverse().map(m => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      author: m.authorId ? (userMap[m.authorId] ?? null) : null
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to list messages" });
  }
});

router.post("/messages", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { content, parentId } = req.body;
    const [message] = await db.insert(messagesTable).values({
      content, authorId: req.user.id, parentId: parentId ?? null
    }).returning();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
    res.status(201).json({ ...message, createdAt: message.createdAt.toISOString(), author: user ?? null });
  } catch (err) {
    res.status(500).json({ error: "Failed to create message" });
  }
});

export default router;
