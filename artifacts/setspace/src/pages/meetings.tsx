import React, { useState } from "react";
import { useListMeetings, useCreateMeeting, getListMeetingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, Plus, Video, Clock } from "lucide-react";

export default function Meetings() {
  const { data: meetings, isLoading } = useListMeetings();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState("30");
  const [meetingUrl, setMeetingUrl] = useState("");

  const resetForm = () => {
    setTitle("");
    setScheduledAt("");
    setDuration("30");
    setMeetingUrl("");
  };

  const mut = useCreateMeeting({
    mutation: {
      onMutate: async ({ data }) => {
        await queryClient.cancelQueries({ queryKey: getListMeetingsQueryKey() });
        const previous = queryClient.getQueryData(getListMeetingsQueryKey());
        const optimistic = {
          id: -Date.now(),
          title: data.title,
          scheduledAt: data.scheduledAt,
          duration: data.duration,
          meetingUrl: data.meetingUrl ?? null,
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
    mut.mutate({ data: { title, scheduledAt: new Date(scheduledAt).toISOString(), duration: Number(duration), meetingUrl } });
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
          <DialogContent className="glass-panel">
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
                </div>
                <div className="mt-6 pt-4 border-t border-white/5">
                  {meeting.meetingUrl ? (
                    <a href={meeting.meetingUrl} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center py-2.5 bg-white/5 hover:bg-primary/20 text-white rounded-lg transition-colors text-sm font-medium border border-white/10">
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
