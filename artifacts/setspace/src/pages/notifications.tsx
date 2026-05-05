import React from "react";
import { useLocation } from "wouter";
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
  Trash2,
  ClipboardList,
  ArrowRightLeft,
  CheckCircle2,
  MessageSquare,
  Video,
  Calendar,
  Trophy,
  AlertCircle,
  User,
  SmilePlus,
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
      return { icon: <ClipboardList className="w-4 h-4" />, bg: "bg-indigo-50 text-indigo-600 border-indigo-200" };
    case "task_status":
      return { icon: <ArrowRightLeft className="w-4 h-4" />, bg: "bg-blue-50 text-blue-600 border-blue-200" };
    case "task_completed":
      return { icon: <CheckCircle2 className="w-4 h-4" />, bg: "bg-green-50 text-green-600 border-green-200" };
    case "dm":
    case "message":
      return { icon: <MessageSquare className="w-4 h-4" />, bg: "bg-violet-50 text-violet-600 border-violet-200" };
    case "video":
      return { icon: <Video className="w-4 h-4" />, bg: "bg-rose-50 text-rose-600 border-rose-200" };
    case "meeting":
    case "meeting_invite":
      return { icon: <Calendar className="w-4 h-4" />, bg: "bg-amber-50 text-amber-600 border-amber-200" };
    case "achievement":
      return { icon: <Trophy className="w-4 h-4" />, bg: "bg-yellow-50 text-yellow-600 border-yellow-200" };
    case "mention":
      return { icon: <User className="w-4 h-4" />, bg: "bg-cyan-50 text-cyan-600 border-cyan-200" };
    case "reaction":
      return { icon: <SmilePlus className="w-4 h-4" />, bg: "bg-pink-50 text-pink-600 border-pink-200" };
    case "quality_evaluation":
      return { icon: <CheckCircle2 className="w-4 h-4" />, bg: "bg-orange-50 text-orange-600 border-orange-200" };
    case "video_revision":
      return { icon: <Video className="w-4 h-4" />, bg: "bg-red-50 text-red-600 border-red-200" };
    default:
      return { icon: <AlertCircle className="w-4 h-4" />, bg: "bg-muted text-muted-foreground border-border" };
  }
}

export default function Notifications() {
  const { data: notifications, isLoading } = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey() },
  });
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const markReadMut = useMarkNotificationRead({
    mutation: {
      onError: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
    },
  });

  const markAllMut = useMarkAllNotificationsRead({
    mutation: {
      onError: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
    },
  });

  const dismissOne = (id: number) => {
    queryClient.setQueryData(
      getListNotificationsQueryKey(),
      (old: typeof notifications) => old?.filter((n) => n.id !== id) ?? []
    );
    markReadMut.mutate({ notificationId: id });
  };

  const dismissAll = () => {
    queryClient.setQueryData(getListNotificationsQueryKey(), () => []);
    markAllMut.mutate();
  };

  const count = notifications?.length ?? 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold text-foreground">Notifications</h1>
            {count > 0 && (
              <span className="bg-foreground text-background text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center">
                {count}
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">Stay updated on studio activities.</p>
        </div>
        <Button
          variant="outline"
          onClick={dismissAll}
          disabled={markAllMut.isPending || count === 0}
          className="border-border text-muted-foreground hover:text-destructive gap-2 shrink-0"
        >
          <Trash2 className="w-4 h-4" /> Delete all
        </Button>
      </div>

      <Card className="glass-panel overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !count ? (
          <div className="text-center py-20 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium">You're all caught up!</p>
            <p className="text-sm mt-1 opacity-60">Task updates and messages will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications!.map((notif) => {
              const style = getNotifStyle(notif.type);
              const handleRowClick = () => {
                dismissOne(notif.id);
                if (notif.linkUrl) navigate(notif.linkUrl);
              };
              return (
                <div
                  key={notif.id}
                  onClick={handleRowClick}
                  className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted ${
                    notif.linkUrl ? "cursor-pointer" : ""
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${style.bg}`}>
                    {style.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm leading-snug text-foreground font-semibold">{notif.title}</p>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap font-mono shrink-0">
                        {relativeTime(notif.createdAt)}
                      </span>
                    </div>
                    {notif.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.body}</p>
                    )}
                    {notif.linkUrl && (
                      <span className="text-xs text-muted-foreground mt-1 inline-block font-medium">View →</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); dismissOne(notif.id); }}
                    title="Delete notification"
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors mt-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
