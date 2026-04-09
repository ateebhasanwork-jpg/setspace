import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { sendPushToUser } from "./push";
import { broadcastSseToUser } from "./sse";
import { invalidateResult } from "./cache";

interface NotifyPayload {
  type: string;
  title: string;
  body?: string;
  linkUrl?: string;
}

/**
 * Insert a notification row, push via SSE to the target user, and fire a Web Push.
 * Use this instead of raw db.insert(notificationsTable) everywhere.
 */
export async function notifyUser(userId: string, payload: NotifyPayload) {
  const [notif] = await db.insert(notificationsTable).values({ userId, ...payload }).returning();

  // Drop the per-user cache so the next fetch sees the new notification
  invalidateResult(`notifications:${userId}`);

  // Instantly update the bell badge for the target user if they're connected
  broadcastSseToUser(userId, "notifications", { notifId: notif.id });

  sendPushToUser(userId, {
    title: payload.title,
    body: payload.body,
    linkUrl: payload.linkUrl,
  }).catch(() => {});

  return notif;
}
