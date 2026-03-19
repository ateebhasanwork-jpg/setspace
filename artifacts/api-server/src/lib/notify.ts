import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { sendPushToUser } from "./push";

interface NotifyPayload {
  type: string;
  title: string;
  body?: string;
  linkUrl?: string;
}

/**
 * Insert a notification row AND fire a Web Push to the user's subscribed devices.
 * Use this instead of raw db.insert(notificationsTable) everywhere.
 */
export async function notifyUser(userId: string, payload: NotifyPayload) {
  const [notif] = await db.insert(notificationsTable).values({ userId, ...payload }).returning();

  sendPushToUser(userId, {
    title: payload.title,
    body: payload.body,
    linkUrl: payload.linkUrl,
  }).catch(() => {});

  return notif;
}
