import React, { useState } from "react";
import { useListMeetings, useCreateMeeting, useListUsers, getListMeetingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, Plus, Video, Clock, Check } from "lucide-react";

function safeUrl(url: string | null | undefined): string | null {
  if (!url || !url.trim()) return null;
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

export default function Meetings() {
  const { data: meetings, isLoading } = useListMeetings();
  const { data: users } = useListUsers();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState("30");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);

  const resetForm = () => {
    setTitle("");
    setScheduledAt("");
    setDuration("30");
    setMeetingUrl("");
    setSelectedAttendees([]);
  };

  const toggleAttendee = (userId: string) => {
    setSelectedAttendees(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const mut = useCreateMeeting({
    mutation: {
      onMutate: async ({ data }) => {
        await queryClient.cancelQueries({ queryKey: getListMeetingsQueryKey() });
        const previous = queryClient.getQueryData(getListMeetingsQueryKey());
        const taggedUsers = (users || []).filter(u => (data.attendeeIds || []).includes(u.id));
        const optimistic = {
          id: -Date.now(),
          title: data.title,
          scheduledAt: data.scheduledAt,
          duration: data.duration,
          meetingUrl: safeUrl(data.meetingUrl ?? null),
          attendees: taggedUsers,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _optimistic: true,
        };
        queryClient.setQueryData(getListMeetingsQueryKey(), (old: any[]) =>
          old ? [...old, optimistic] : [optimistic]
        );
        setIsCreateOpen(false);
        resetForm();
        return { previous };
      },
      onError: (_err, _vars, ctx: any) => {
        queryClient.setQueryData(getListMeetingsQueryKey(), ctx?.previous);
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
      },
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate({
      data: {
        title,
        scheduledAt: new Date(scheduledAt).toISOString(),
        duration: Number(duration),
        meetingUrl: meetingUrl || undefined,
        attendeeIds: selectedAttendees,
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Meetings</h1>
          <p className="text-muted-foreground mt-1">Schedule and join upcoming sessions.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={open => { setIsCreateOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg">
              <Plus className="w-4 h-4 mr-2" /> Schedule Meeting
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-panel max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Meeting</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input required placeholder="Meeting Title" value={title} onChange={e => setTitle(e.target.value)} className="bg-black/20 border-white/10" />
              <div className="grid grid-cols-2 gap-4">
                <Input required type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="bg-black/20 border-white/10 text-foreground" />
                <Input required type="number" placeholder="Duration (mins)" value={duration} onChange={e => setDuration(e.target.value)} className="bg-black/20 border-white/10" />
              </div>
              <Input placeholder="Meeting Link (Zoom, Meet...)" value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)} className="bg-black/20 border-white/10" />

              {/* Employee picker */}
              {users && users.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Tag Team Members
                    {selectedAttendees.length > 0 && (
                      <span className="ml-2 text-xs text-primary font-normal">{selectedAttendees.length} selected</span>
                    )}
                  </label>
                  <div className="space-y-1 max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2">
                    {users.map(u => {
                      const selected = selectedAttendees.includes(u.id);
                      const initials = `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() || u.username?.[0]?.toUpperCase() || "?";
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleAttendee(u.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${selected ? "bg-primary/20 border border-primary/40" : "hover:bg-white/5 border border-transparent"}`}
                        >
                          <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                            {initials}
                          </div>
                          <span className="flex-1 text-left text-foreground">
                            {u.firstName} {u.lastName}
                            <span className="text-muted-foreground ml-1 text-xs">@{u.username}</span>
                          </span>
                          {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <Button type="submit" disabled={mut.isPending} className="w-full bg-primary text-primary-foreground font-semibold">
                Schedule Event
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {meetings?.map(meeting => {
            const isOptimistic = (meeting as any)._optimistic;
            const safeLink = safeUrl(meeting.meetingUrl);
            const attendees = (meeting as any).attendees as Array<{ id: string; firstName: string; lastName: string; username: string }> | undefined;
            return (
              <Card key={meeting.id} className={`glass-panel p-6 flex flex-col justify-between group hover:border-primary/50 transition-colors ${isOptimistic ? "opacity-60" : ""}`}>
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <span className="text-xs bg-white/10 px-2.5 py-1 rounded-md text-muted-foreground font-semibold">
                      {meeting.duration} min
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-xl mb-1 text-foreground">{meeting.title}</h3>
                  <p className="text-muted-foreground text-sm flex items-center mt-3">
                    <Clock className="w-4 h-4 mr-2 opacity-70" />
                    {new Date(meeting.scheduledAt).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>

                  {/* Tagged attendees */}
                  {attendees && attendees.length > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      {attendees.slice(0, 5).map(a => {
                        const initials = `${a.firstName?.[0] ?? ""}${a.lastName?.[0] ?? ""}`.toUpperCase() || a.username?.[0]?.toUpperCase() || "?";
                        return (
                          <div
                            key={a.id}
                            title={`${a.firstName} ${a.lastName}`}
                            className="w-7 h-7 rounded-full bg-primary/25 border border-primary/40 flex items-center justify-center text-[10px] font-bold text-primary"
                          >
                            {initials}
                          </div>
                        );
                      })}
                      {attendees.length > 5 && (
                        <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                          +{attendees.length - 5}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-white/5">
                  {safeLink ? (
                    <a
                      href={safeLink}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center justify-center py-2.5 bg-white/5 hover:bg-primary/20 text-white rounded-lg transition-colors text-sm font-medium border border-white/10"
                    >
                      <Video className="w-4 h-4 mr-2" /> Join Call
                    </a>
                  ) : (
                    <div className="w-full flex items-center justify-center py-2.5 bg-black/20 text-muted-foreground rounded-lg text-sm border border-white/5 cursor-not-allowed">
                      No Link Provided
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
          {meetings?.length === 0 && (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-white/10 rounded-2xl">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-display font-bold mb-1">No upcoming meetings</h3>
              <p className="text-muted-foreground text-sm">Your schedule is clear.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
