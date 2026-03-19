import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { messagesTable, directMessagesTable, usersTable, messageReactionsTable, dmReactionsTable } from "@workspace/db/schema";
import { eq, or, and, desc, inArray } from "drizzle-orm";
import { broadcastSse } from "../lib/sse";
import { notifyUser } from "../lib/notify";

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

    const msgIds = messages.map(m => m.id);
    const reactions = msgIds.length
      ? await db.select().from(messageReactionsTable).where(inArray(messageReactionsTable.messageId, msgIds))
      : [];

    type ReactionGroup = { emoji: string; count: number; userIds: string[] };
    const reactionsByMsg: Record<number, Record<string, ReactionGroup>> = {};
    for (const r of reactions) {
      if (!reactionsByMsg[r.messageId]) reactionsByMsg[r.messageId] = {};
      if (!reactionsByMsg[r.messageId][r.emoji]) reactionsByMsg[r.messageId][r.emoji] = { emoji: r.emoji, count: 0, userIds: [] };
      reactionsByMsg[r.messageId][r.emoji].count++;
      reactionsByMsg[r.messageId][r.emoji].userIds.push(r.userId);
    }

    const result = messages.reverse().map(m => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      author: m.authorId ? (userMap[m.authorId] ?? null) : null,
      reactions: Object.values(reactionsByMsg[m.id] ?? {}),
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to list messages" });
  }
});

/** POST /api/messages/:id/reactions — toggle a reaction (add or remove) */
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

      // Notify the message author (if it's not themselves)
      const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId));
      if (msg && msg.authorId !== req.user.id) {
        const [reactor] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
        const reactorName = reactor
          ? [reactor.firstName, reactor.lastName].filter(Boolean).join(" ") || reactor.username || "Someone"
          : "Someone";
        await notifyUser(msg.authorId, {
          type: "reaction",
          title: `${reactorName} reacted ${emoji} to your message`,
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

router.post("/messages", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
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
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));

    // Detect @mentions and create notifications
    const mentionedIds = await extractMentionedUserIds(content, req.user.id);
    if (mentionedIds.length > 0) {
      const authorName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Someone"
        : "Someone";
      await Promise.all(mentionedIds.map(uid =>
        notifyUser(uid, {
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

    // Fetch reactions for these DMs
    const dmIds = messages.map(m => m.id);
    type DmReactionGroup = { emoji: string; count: number; userIds: string[] };
    const reactionsByDm: Record<number, Record<string, DmReactionGroup>> = {};
    if (dmIds.length > 0) {
      const reactions = await db.select().from(dmReactionsTable).where(inArray(dmReactionsTable.dmId, dmIds));
      for (const r of reactions) {
        if (!reactionsByDm[r.dmId]) reactionsByDm[r.dmId] = {};
        if (!reactionsByDm[r.dmId][r.emoji]) reactionsByDm[r.dmId][r.emoji] = { emoji: r.emoji, count: 0, userIds: [] };
        reactionsByDm[r.dmId][r.emoji].count++;
        reactionsByDm[r.dmId][r.emoji].userIds.push(r.userId);
      }
    }

    res.json(messages.map(m => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      sender: userMap[m.senderId] ?? null,
      receiver: userMap[m.receiverId] ?? null,
      reactions: Object.values(reactionsByDm[m.id] ?? {}),
    })));
  } catch {
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

      // Notify the DM sender if it's not themselves
      const [dm] = await db.select().from(directMessagesTable).where(eq(directMessagesTable.id, dmId));
      if (dm && dm.senderId !== req.user.id) {
        const [reactor] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
        const reactorName = reactor
          ? [reactor.firstName, reactor.lastName].filter(Boolean).join(" ") || reactor.username || "Someone"
          : "Someone";
        await notifyUser(dm.senderId, {
          type: "reaction",
          title: `${reactorName} reacted ${emoji} to your message`,
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

/** POST /api/dm/:userId — send a DM to a user */
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
    const users = await db.select().from(usersTable);
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    // Create a notification for the receiver
    const sender = userMap[me];
    if (sender) {
      const senderName = [sender.firstName, sender.lastName].filter(Boolean).join(" ") || sender.username || "Someone";
      await notifyUser(other, {
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
