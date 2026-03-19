import React, { useState } from "react";
import {
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Check,
  CheckCheck,
  ClipboardList,
  ArrowRightLeft,
  CheckCircle2,
  MessageSquare,
  Video,
  Calendar,
  Trophy,
  AlertCircle,
  User,
} from "lucide-react";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type NotifIconConfig = { icon: React.ReactNode; bg: string };

function getNotifStyle(type: string): NotifIconConfig {
  switch (type) {
    case "task_assigned":
      return { icon: <ClipboardList className="w-4 h-4" />, bg: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" };
    case "task_status":
      return { icon: <ArrowRightLeft className="w-4 h-4" />, bg: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
    case "task_completed":
      return { icon: <CheckCircle2 className="w-4 h-4" />, bg: "bg-green-500/20 text-green-300 border-green-500/30" };
    case "dm":
    case "message":
      return { icon: <MessageSquare className="w-4 h-4" />, bg: "bg-violet-500/20 text-violet-300 border-violet-500/30" };
    case "video":
      return { icon: <Video className="w-4 h-4" />, bg: "bg-rose-500/20 text-rose-300 border-rose-500/30" };
    case "meeting":
    case "meeting_invite":
      return { icon: <Calendar className="w-4 h-4" />, bg: "bg-amber-500/20 text-amber-300 border-amber-500/30" };
    case "achievement":
      return { icon: <Trophy className="w-4 h-4" />, bg: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" };
    case "mention":
      return { icon: <User className="w-4 h-4" />, bg: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" };
    default:
      return { icon: <AlertCircle className="w-4 h-4" />, bg: "bg-white/10 text-muted-foreground border-white/10" };
  }
}

export default function Notifications() {
  const { data: notifications, isLoading } = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey(), refetchInterval: 5000 },
  });
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const markReadMut = useMarkNotificationRead({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
    },
  });

  const markAllMut = useMarkAllNotificationsRead({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
    },
  });

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;
  const displayed = filter === "unread"
    ? notifications?.filter((n) => !n.isRead)
    : notifications;

  return (
    <div className="space-y-6 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold text-foreground">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center">
                {unreadCount}
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">Stay updated on studio activities.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => markAllMut.mutate()}
          disabled={markAllMut.isPending || unreadCount === 0}
          className="bg-black/20 border-white/10 text-muted-foreground hover:text-white gap-2 shrink-0"
        >
          <CheckCheck className="w-4 h-4" /> Mark all read
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-black/20 rounded-xl border border-white/5 w-fit">
        {(["all", "unread"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === tab
                ? "bg-white/10 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "all" ? "All" : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
          </button>
        ))}
      </div>

      {/* List */}
      <Card className="glass-panel overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !displayed?.length ? (
          <div className="text-center py-20 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
            <p className="text-sm mt-1 opacity-60">
              {filter === "unread"
                ? "You're all caught up!"
                : "Task updates and messages will appear here."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {displayed.map((notif) => {
              const style = getNotifStyle(notif.type);
              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                    notif.isRead
                      ? "opacity-55 hover:opacity-75"
                      : "bg-indigo-500/5 hover:bg-indigo-500/8 border-l-2 border-l-indigo-500/60"
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${style.bg}`}>
                    {style.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className={`text-sm leading-snug ${notif.isRead ? "text-muted-foreground" : "text-foreground font-semibold"}`}>
                        {notif.title}
                      </p>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap font-mono shrink-0">
                        {relativeTime(notif.createdAt)}
                      </span>
                    </div>
                    {notif.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {notif.body}
                      </p>
                    )}
                    {notif.linkUrl && !notif.isRead && (
                      <a
                        href={notif.linkUrl}
                        className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 inline-block"
                      >
                        View →
                      </a>
                    )}
                  </div>

                  {/* Mark read */}
                  {!notif.isRead && (
                    <button
                      onClick={() => markReadMut.mutate({ notificationId: notif.id })}
                      disabled={markReadMut.isPending}
                      title="Mark as read"
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-green-400 hover:bg-green-500/10 transition-colors mt-0.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
