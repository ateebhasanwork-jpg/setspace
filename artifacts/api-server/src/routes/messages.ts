import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { messagesTable, directMessagesTable, usersTable, notificationsTable } from "@workspace/db/schema";
import { eq, or, and, desc } from "drizzle-orm";
import { broadcastSse } from "../lib/sse";

const router: IRouter = Router();

/** Parse @mentions from message content, return matched userIds (excluding author) */
async function extractMentionedUserIds(content: string, authorId: string): Promise<string[]> {
  const matches = content.match(/@([\w.]+)/g);
  if (!matches || matches.length === 0) return [];
  const terms = matches.map(m => m.slice(1).toLowerCase());
  const users = await db.select().from(usersTable);
  const mentioned: string[] = [];
  for (const u of users) {
    if (u.id === authorId) continue;
    const first = (u.firstName ?? "").toLowerCase();
    const last = (u.lastName ?? "").toLowerCase();
    const username = (u.username ?? "").toLowerCase();
    if (terms.some(t => t === first || t === username || t === `${first}${last}` || `${first}.${last}` === t)) {
      mentioned.push(u.id);
    }
  }
  return [...new Set(mentioned)];
}

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

    // Detect @mentions and create notifications
    const mentionedIds = await extractMentionedUserIds(content, req.user.id);
    if (mentionedIds.length > 0) {
      const authorName = user ? `${user.firstName} ${user.lastName}`.trim() : "Someone";
      await Promise.all(mentionedIds.map(uid =>
        db.insert(notificationsTable).values({
          userId: uid,
          type: "mention",
          title: `${authorName} mentioned you`,
          body: content.length > 120 ? content.slice(0, 120) + "…" : content,
          linkUrl: "/chat",
        }).catch(() => {})
      ));
    }

    broadcastSse("messages", { action: "created", messageId: message.id });
    res.status(201).json({ ...message, createdAt: message.createdAt.toISOString(), author: user ?? null });
  } catch (err) {
    res.status(500).json({ error: "Failed to create message" });
  }
});

/** GET /api/dm/:userId — get DM conversation with a user */
router.get("/dm/:userId", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const me = req.user.id;
    const other = req.params.userId as string;
    const messages = await db.select().from(directMessagesTable)
      .where(or(
        and(eq(directMessagesTable.senderId, me), eq(directMessagesTable.receiverId, other)),
        and(eq(directMessagesTable.senderId, other), eq(directMessagesTable.receiverId, me))
      ))
      .orderBy(directMessagesTable.createdAt)
      .limit(100);

    const users = await db.select().from(usersTable);
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    await db.update(directMessagesTable)
      .set({ isRead: true })
      .where(and(eq(directMessagesTable.senderId, other), eq(directMessagesTable.receiverId, me)));

    res.json(messages.map(m => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      sender: userMap[m.senderId] ?? null,
      receiver: userMap[m.receiverId] ?? null,
    })));
  } catch {
    res.status(500).json({ error: "Failed to get DMs" });
  }
});

/** POST /api/dm/:userId — send a DM to a user */
router.post("/dm/:userId", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const me = req.user.id;
    const other = req.params.userId as string;
    const { content } = req.body;
    if (!content?.trim()) { res.status(400).json({ error: "content required" }); return; }
    const [msg] = await db.insert(directMessagesTable).values({
      content: content.trim(),
      senderId: me,
      receiverId: other,
    }).returning();
    const users = await db.select().from(usersTable);
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    // Create a notification for the receiver
    const sender = userMap[me];
    if (sender) {
      const senderName = `${sender.firstName} ${sender.lastName}`.trim();
      await db.insert(notificationsTable).values({
        userId: other,
        type: "dm",
        title: `New message from ${senderName}`,
        body: content.trim().length > 100 ? content.trim().slice(0, 100) + "…" : content.trim(),
        linkUrl: "/chat",
      }).catch(() => {});
    }

    broadcastSse("dm", { senderId: me, receiverId: other });
    res.status(201).json({ ...msg, createdAt: msg.createdAt.toISOString(), sender: userMap[me] ?? null, receiver: userMap[other] ?? null });
  } catch {
    res.status(500).json({ error: "Failed to send DM" });
  }
});

/** GET /api/dm-unread — count of unread DMs for current user */
router.get("/dm-unread", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const me = req.user.id;
    const unread = await db.select().from(directMessagesTable)
      .where(and(eq(directMessagesTable.receiverId, me), eq(directMessagesTable.isRead, false)));

    const countsBySender: Record<string, number> = {};
    for (const m of unread) {
      countsBySender[m.senderId] = (countsBySender[m.senderId] || 0) + 1;
    }
    res.json({ total: unread.length, bySender: countsBySender });
  } catch {
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

export default router;
