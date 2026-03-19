import webPush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

webPush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:admin@setspace.app",
  process.env.VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || "",
);

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body?: string; linkUrl?: string; icon?: string },
) {
  if (!process.env.VAPID_PUBLIC_KEY) return;

  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, userId));

  for (const sub of subs) {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: payload.title,
          body: payload.body ?? "",
          linkUrl: payload.linkUrl ?? "/",
          icon: payload.icon ?? "/images/logo.png",
          badge: "/images/logo.png",
        }),
      );
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, sub.id)).catch(() => {});
      }
    }
  }
}
