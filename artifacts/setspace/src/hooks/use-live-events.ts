import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListMessagesQueryKey, getListTasksQueryKey, getListNotificationsQueryKey } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

/**
 * Connects to the SSE /api/events stream and reacts to push events.
 *
 * Group messages:
 *   Instead of invalidating the full list (which refetches all 50 messages),
 *   we read the last known message id from the cache and only fetch
 *   GET /api/messages?since=<lastId> — returning only new rows.
 *   The result is merged into the existing cache without a full refetch.
 *
 * DM events:
 *   Dispatched as a custom window event so DMConversation can do its own
 *   incremental ?since= fetch, keeping the full DM list in local state.
 *
 * All other events (tasks, notifications):
 *   Standard query invalidation — those datasets are small and infrequent.
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

      es.addEventListener("messages", async () => {
        // Read the current cached group messages to find the last id
        const cached = queryClient.getQueryData<Array<{ id: number }>>(getListMessagesQueryKey());
        const lastId = cached && cached.length > 0 ? cached[cached.length - 1].id : null;

        if (lastId && lastId > 0) {
          try {
            const res = await fetch(`${BASE}/api/messages?since=${lastId}`, { credentials: "include" });
            if (res.ok) {
              const newMessages = (await res.json()) as Array<{ id: number }>;
              if (newMessages.length > 0) {
                queryClient.setQueryData(
                  getListMessagesQueryKey(),
                  (old: Array<{ id: number }> | undefined) => {
                    if (!old) return newMessages;
                    const existingIds = new Set(old.map(m => m.id));
                    const toAdd = newMessages.filter(m => !existingIds.has(m.id));
                    return toAdd.length > 0 ? [...old, ...toAdd] : old;
                  }
                );
              }
              return;
            }
          } catch {
            // fall through to invalidation
          }
        }

        // Fallback: full invalidation (handles first load or fetch failure)
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
      });

      es.addEventListener("dm", (e) => {
        try {
          const data = JSON.parse(e.data) as { senderId?: string; receiverId?: string };
          window.dispatchEvent(new CustomEvent("sse:dm", { detail: data }));
        } catch {}
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
