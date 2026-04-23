import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { messagesTable, directMessagesTable, usersTable, messageReactionsTable, dmReactionsTable } from "@workspace/db/schema";
import { eq, or, and, desc, asc, inArray, gt, sql } from "drizzle-orm";
import { broadcastSse } from "../lib/sse";
import { notifyUser } from "../lib/notify";
import { getCachedUsers, getCachedUser, getUserMap, displayName } from "../lib/cache";

const router: IRouter = Router();

/** Parse @mentions, return matched userIds (excluding author). Uses user cache. */
async function extractMentionedUserIds(content: string, authorId: string): Promise<string[]> {
  const matches = content.match(/@([\w.]+)/g);
  if (!matches || matches.length === 0) return [];
  const terms = matches.map(m => m.slice(1).toLowerCase());
  const users = await getCachedUsers();
  const mentioned: string[] = [];
  for (const u of users) {
    if (u.id === authorId) continue;
    const first = (u.firstName ?? "").toLowerCase();
    const last = (u.lastName ?? "").toLowerCase();
    const uname = (u.username ?? "").toLowerCase();
    if (terms.some(t => t === first || t === uname || t === `${first}${last}` || `${first}.${last}` === t)) {
      mentioned.push(u.id);
    }
  }
  return [...new Set(mentioned)];
}

function buildReactionMap(reactions: { messageId?: number; dmId?: number; emoji: string; userId: string }[], key: "messageId" | "dmId") {
  type RGroup = { emoji: string; count: number; userIds: string[] };
  const map: Record<number, Record<string, RGroup>> = {};
  for (const r of reactions) {
    const id = r[key] as number;
    if (!map[id]) map[id] = {};
    if (!map[id][r.emoji]) map[id][r.emoji] = { emoji: r.emoji, count: 0, userIds: [] };
    map[id][r.emoji].count++;
    map[id][r.emoji].userIds.push(r.userId);
  }
  return map;
}

/**
 * GET /api/messages
 *   ?since=<id>  — return only messages with id > since (incremental update)
 *   ?limit=<n>   — max rows on initial load (default 50, max 100)
 *
 * On first load: omit `since`, returns last <limit> messages.
 * On SSE update: pass ?since=<lastKnownId>, returns only new messages.
 */
router.get("/messages", async (req, res) => {
  try {
    const sinceId = req.query.since ? parseInt(req.query.since as string) : null;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    let messages;
    if (sinceId !== null && !isNaN(sinceId)) {
      // Incremental: only messages newer than sinceId
      messages = await db
        .select()
        .from(messagesTable)
        .where(gt(messagesTable.id, sinceId))
        .orderBy(asc(messagesTable.createdAt))
        .limit(50);
    } else {
      // Initial load: most recent <limit> messages, reversed to ascending order
      const rows = await db
        .select()
        .from(messagesTable)
        .orderBy(desc(messagesTable.createdAt))
        .limit(limit);
      messages = rows.reverse();
    }

    if (messages.length === 0) {
      res.json([]);
      return;
    }

    // Fetch users (from cache) and reactions in parallel
    const msgIds = messages.map(m => m.id);
    const [users, reactions] = await Promise.all([
      getCachedUsers(),
      db.select().from(messageReactionsTable).where(inArray(messageReactionsTable.messageId, msgIds)),
    ]);
    const userMap = getUserMap(users);
    const reactionsByMsg = buildReactionMap(reactions as Parameters<typeof buildReactionMap>[0], "messageId");

    res.json(messages.map(m => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      author: m.authorId ? (userMap[m.authorId] ?? null) : null,
      reactions: Object.values(reactionsByMsg[m.id] ?? {}),
    })));
  } catch (err) {
    console.error("[messages] GET /messages error:", err);
    res.status(500).json({ error: "Failed to list messages" });
  }
});

/** POST /api/messages/:id/reactions — toggle a reaction */
router.post("/messages/:id/reactions", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const msgId = parseInt(req.params.id);
    const { emoji } = req.body as { emoji: string };
    if (!emoji) { res.status(400).json({ error: "emoji required" }); return; }

    const [existing] = await db.select().from(messageReactionsTable).where(
      and(
        eq(messageReactionsTable.messageId, msgId),
        eq(messageReactionsTable.userId, req.user.id),
        eq(messageReactionsTable.emoji, emoji),
      )
    );

    if (existing) {
      await db.delete(messageReactionsTable).where(eq(messageReactionsTable.id, existing.id));
    } else {
      await db.insert(messageReactionsTable).values({ messageId: msgId, userId: req.user.id, emoji });

      const [msg] = await db.select({ id: messagesTable.id, authorId: messagesTable.authorId, content: messagesTable.content })
        .from(messagesTable).where(eq(messagesTable.id, msgId));
      if (msg && msg.authorId !== req.user.id) {
        const reactor = await getCachedUser(req.user.id);
        await notifyUser(msg.authorId, {
          type: "reaction",
          title: `${displayName(reactor)} reacted ${emoji} to your message`,
          body: msg.content ? (msg.content.length > 80 ? msg.content.slice(0, 80) + "…" : msg.content) : undefined,
          linkUrl: "/chat",
        }).catch(() => {});
      }
    }

    broadcastSse("messages", { action: "reaction", messageId: msgId });
    res.json({ added: !existing });
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle reaction" });
  }
});

/** POST /api/messages — send a group chat message */
router.post("/messages", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { content, parentId, attachmentUrl, attachmentName } = req.body;
    if (!content?.trim() && !attachmentUrl) {
      res.status(400).json({ error: "Message must have content or attachment" });
      return;
    }
    const [message] = await db.insert(messagesTable).values({
      content: content ?? "", authorId: req.user.id, parentId: parentId ?? null,
      attachmentUrl: attachmentUrl ?? null, attachmentName: attachmentName ?? null,
    }).returning();

    // User lookup from cache
    const user = await getCachedUser(req.user.id);

    // Detect @mentions and create notifications (cache hit for users list)
    if (content?.trim()) {
      const mentionedIds = await extractMentionedUserIds(content, req.user.id);
      if (mentionedIds.length > 0) {
        const authorName = displayName(user);
        await Promise.all(mentionedIds.map(uid =>
          notifyUser(uid, {
            type: "mention",
            title: `${authorName} mentioned you`,
            body: content.length > 120 ? content.slice(0, 120) + "…" : content,
            linkUrl: "/chat",
          }).catch(() => {})
        ));
      }
    }

    broadcastSse("messages", { action: "created", messageId: message.id });
    res.status(201).json({ ...message, createdAt: message.createdAt.toISOString(), author: user ?? null });
  } catch (err) {
    console.error("[messages] POST /messages error:", err);
    res.status(500).json({ error: "Failed to create message" });
  }
});

/**
 * GET /api/dm/:userId — get DM conversation
 *   ?since=<id>  — return only DMs with id > since (incremental update)
 *
 * On first load: omit `since`, returns last 100 messages.
 * On SSE update: pass ?since=<lastKnownId>, returns only new messages.
 * Mark-as-read is only run on initial load (no `since`) or when there are new messages.
 */
router.get("/dm/:userId", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const me = req.user.id;
    const other = req.params.userId as string;
    const sinceId = req.query.since ? parseInt(req.query.since as string) : null;
    const isIncremental = sinceId !== null && !isNaN(sinceId);

    const conversationFilter = or(
      and(eq(directMessagesTable.senderId, me), eq(directMessagesTable.receiverId, other)),
      and(eq(directMessagesTable.senderId, other), eq(directMessagesTable.receiverId, me))
    );

    let messages;
    if (isIncremental) {
      messages = await db.select().from(directMessagesTable)
        .where(and(conversationFilter, gt(directMessagesTable.id, sinceId!)))
        .orderBy(asc(directMessagesTable.createdAt))
        .limit(50);
    } else {
      const rows = await db.select().from(directMessagesTable)
        .where(conversationFilter)
        .orderBy(desc(directMessagesTable.createdAt))
        .limit(100);
      messages = rows.reverse();
    }

    // Mark as read (only on initial load, or if new messages arrived from other person)
    const hasNewFromOther = messages.some(m => m.senderId === other && !m.isRead);
    if (!isIncremental || hasNewFromOther) {
      db.update(directMessagesTable)
        .set({ isRead: true })
        .where(and(eq(directMessagesTable.senderId, other), eq(directMessagesTable.receiverId, me)))
        .catch(() => {});
    }

    if (messages.length === 0) {
      res.json([]);
      return;
    }

    // Fetch users (cache) and reactions in parallel
    const dmIds = messages.map(m => m.id);
    const [users, reactions] = await Promise.all([
      getCachedUsers(),
      db.select().from(dmReactionsTable).where(inArray(dmReactionsTable.dmId, dmIds)),
    ]);
    const userMap = getUserMap(users);
    const reactionsByDm = buildReactionMap(reactions as Parameters<typeof buildReactionMap>[0], "dmId");

    res.json(messages.map(m => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      sender: userMap[m.senderId] ?? null,
      receiver: userMap[m.receiverId] ?? null,
      reactions: Object.values(reactionsByDm[m.id] ?? {}),
    })));
  } catch (err) {
    console.error("[messages] GET /dm/:userId error:", err);
    res.status(500).json({ error: "Failed to get DMs" });
  }
});

/** POST /api/dm-reactions/:dmId — toggle a reaction on a DM */
router.post("/dm-reactions/:dmId", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const dmId = parseInt(req.params.dmId);
    const { emoji } = req.body;
    if (!emoji || typeof emoji !== "string") { res.status(400).json({ error: "emoji required" }); return; }

    const [existing] = await db.select().from(dmReactionsTable).where(
      and(eq(dmReactionsTable.dmId, dmId), eq(dmReactionsTable.userId, req.user.id), eq(dmReactionsTable.emoji, emoji))
    );
    if (existing) {
      await db.delete(dmReactionsTable).where(eq(dmReactionsTable.id, existing.id));
    } else {
      await db.insert(dmReactionsTable).values({ dmId, userId: req.user.id, emoji });

      const [dm] = await db.select({ id: directMessagesTable.id, senderId: directMessagesTable.senderId, content: directMessagesTable.content })
        .from(directMessagesTable).where(eq(directMessagesTable.id, dmId));
      if (dm && dm.senderId !== req.user.id) {
        const reactor = await getCachedUser(req.user.id);
        await notifyUser(dm.senderId, {
          type: "reaction",
          title: `${displayName(reactor)} reacted ${emoji} to your message`,
          body: dm.content ? (dm.content.length > 80 ? dm.content.slice(0, 80) + "…" : dm.content) : undefined,
          linkUrl: "/chat",
        }).catch(() => {});
      }
    }
    broadcastSse("dm", { action: "reaction", dmId });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to toggle DM reaction" });
  }
});

/** POST /api/dm/:userId — send a DM */
router.post("/dm/:userId", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const me = req.user.id;
    const other = req.params.userId as string;
    const { content, attachmentUrl, attachmentName } = req.body;
    if (!content?.trim() && !attachmentUrl) { res.status(400).json({ error: "content or attachment required" }); return; }

    const [msg] = await db.insert(directMessagesTable).values({
      content: content?.trim() ?? "",
      senderId: me,
      receiverId: other,
      attachmentUrl: attachmentUrl ?? null,
      attachmentName: attachmentName ?? null,
    }).returning();

    // Both users from cache — no extra DB query
    const [sender, receiver] = await Promise.all([
      getCachedUser(me),
      getCachedUser(other),
    ]);

    await notifyUser(other, {
      type: "dm",
      title: `New message from ${displayName(sender)}`,
      body: (content?.trim() ?? "").length > 100
        ? content.trim().slice(0, 100) + "…"
        : content?.trim() ?? "",
      linkUrl: "/chat",
    }).catch(() => {});

    broadcastSse("dm", { senderId: me, receiverId: other });
    res.status(201).json({
      ...msg,
      createdAt: msg.createdAt.toISOString(),
      sender: sender ?? null,
      receiver: receiver ?? null,
    });
  } catch (err) {
    console.error("[messages] POST /dm/:userId error:", err);
    res.status(500).json({ error: "Failed to send DM" });
  }
});

/** DELETE /api/messages/:id — delete a group message (own or admin) */
router.delete("/messages/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const msgId = parseInt(req.params.id);
    if (isNaN(msgId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId)).limit(1);
    if (!msg) { res.status(404).json({ error: "Not found" }); return; }
    if (msg.authorId !== req.user.id && req.user.role !== "admin") {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    await db.delete(messagesTable).where(eq(messagesTable.id, msgId));
    broadcastSse("messages", { action: "deleted", messageId: msgId });
    res.json({ ok: true });
  } catch (err) {
    console.error("[messages] DELETE /messages/:id error:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

/** DELETE /api/dm/message/:id — delete a DM (own or admin) */
router.delete("/dm/message/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const dmId = parseInt(req.params.id);
    if (isNaN(dmId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const [dm] = await db.select().from(directMessagesTable).where(eq(directMessagesTable.id, dmId)).limit(1);
    if (!dm) { res.status(404).json({ error: "Not found" }); return; }
    if (dm.senderId !== req.user.id && req.user.role !== "admin") {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    await db.delete(directMessagesTable).where(eq(directMessagesTable.id, dmId));
    broadcastSse("dm", { senderId: dm.senderId, receiverId: dm.receiverId, action: "deleted", dmId });
    res.json({ ok: true });
  } catch (err) {
    console.error("[messages] DELETE /dm/message/:id error:", err);
    res.status(500).json({ error: "Failed to delete DM" });
  }
});

/**
 * GET /api/dm-unread — unread DM counts for current user.
 * Returns aggregate counts only (no message content transferred).
 */
router.get("/dm-unread", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const me = req.user.id;
    const rows = await db
      .select({
        senderId: directMessagesTable.senderId,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(directMessagesTable)
      .where(and(eq(directMessagesTable.receiverId, me), eq(directMessagesTable.isRead, false)))
      .groupBy(directMessagesTable.senderId);

    const bySender: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      bySender[r.senderId] = r.count;
      total += r.count;
    }
    res.json({ total, bySender });
  } catch {
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

export default router;
