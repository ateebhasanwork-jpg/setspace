import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListMessagesQueryKey, getListTasksQueryKey, getListNotificationsQueryKey } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

/**
 * Connects to the SSE /api/events stream and invalidates the relevant React Query
 * caches the instant the server pushes an event. Falls back gracefully with
 * exponential-backoff reconnect so a blip never leaves the app stale.
 */
export function useLiveEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let retryDelay = 1000;

    const connect = () => {
      es = new EventSource(`${BASE}/api/events`, { withCredentials: true });

      es.addEventListener("connected", () => {
        retryDelay = 1000;
      });

      es.addEventListener("messages", () => {
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
      });

      es.addEventListener("dm", (e) => {
        // Let DMConversation / unread counters react without a raw setInterval round-trip
        try {
          const data = JSON.parse(e.data) as { senderId?: string; receiverId?: string };
          window.dispatchEvent(new CustomEvent("sse:dm", { detail: data }));
        } catch {}
        // Also invalidate DM unread badge
        queryClient.invalidateQueries({ queryKey: ["dm-unread"] });
      });

      es.addEventListener("tasks", () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      });

      es.addEventListener("notifications", () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      });

      es.onerror = () => {
        es?.close();
        es = null;
        reconnectTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 1.5, 30_000);
          connect();
        }, retryDelay);
      };
    };

    connect();

    return () => {
      es?.close();
      clearTimeout(reconnectTimer);
    };
  }, [queryClient]);
}
