import React from "react";
import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Check, Video, MessageSquare, Trophy, AlertCircle } from "lucide-react";

export default function Notifications() {
  const { data: notifications, isLoading } = useListNotifications();
  const queryClient = useQueryClient();

  const markReadMut = useMarkNotificationRead({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }) }
  });

  const markAllMut = useMarkAllNotificationsRead({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }) }
  });

  const getIcon = (type: string) => {
    switch(type) {
      case 'video': return <Video className="w-5 h-5 text-primary" />;
      case 'message': return <MessageSquare className="w-5 h-5 text-accent" />;
      case 'achievement': return <Trophy className="w-5 h-5 text-yellow-400" />;
      default: return <AlertCircle className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground mt-1">Stay updated on studio activities.</p>
        </div>
        <Button variant="outline" onClick={() => markAllMut.mutate()} disabled={markAllMut.isPending} className="bg-black/20 border-white/10 text-muted-foreground hover:text-white">
          <Check className="w-4 h-4 mr-2" /> Mark all read
        </Button>
      </div>

      <Card className="glass-panel overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
        ) : notifications?.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>You have no notifications.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {notifications?.map(notif => (
              <div key={notif.id} className={`p-4 sm:p-6 flex items-start gap-4 transition-colors ${notif.isRead ? 'opacity-60 bg-black/10' : 'bg-primary/5 hover:bg-primary/10'}`}>
                <div className="w-10 h-10 rounded-full bg-card border border-white/10 flex items-center justify-center shrink-0 shadow-lg">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-semibold text-foreground">{notif.title}</h4>
                    <span className="text-xs text-muted-foreground font-mono ml-4">
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {notif.body && <p className="text-sm text-muted-foreground">{notif.body}</p>}
                </div>
                {!notif.isRead && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => markReadMut.mutate({ notificationId: notif.id })}
                    className="shrink-0 text-muted-foreground hover:text-green-400 hover:bg-green-500/10 rounded-full"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
