import React, { useState, useRef, useEffect } from "react";
import { useGetPublicReview, useCreatePublicComment, getGetPublicReviewQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Pause, MessageSquare, Video, Check, X } from "lucide-react";

export default function PublicReview() {
  const { token } = useParams();
  const queryClient = useQueryClient();
  const { data: reviewData, isLoading, error } = useGetPublicReview(token || "");

  const [name, setName] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [activeTimestamp, setActiveTimestamp] = useState<number | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const commentMut = useCreatePublicComment({
    mutation: {
      onSuccess: () => {
        setCommentInput("");
        setActiveTimestamp(null);
        queryClient.invalidateQueries({ queryKey: getGetPublicReviewQueryKey(token || "") });
      }
    }
  });

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const newTime = pct * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    videoRef.current.pause();
    setActiveTimestamp(newTime);
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!name) { alert("Please enter your name."); return; }
    commentMut.mutate({
      token,
      data: { content: commentInput, authorName: name, timestampSeconds: activeTimestamp }
    });
  };

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (error || !reviewData) return <div className="min-h-screen bg-background flex flex-col items-center justify-center text-white"><Video className="w-16 h-16 opacity-20 mb-4" /><h1 className="text-2xl font-display">Invalid or Expired Link</h1></div>;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="p-4 border-b border-white/5 bg-black/20 flex justify-between items-center backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Video className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold tracking-wide">Setspace Review</span>
        </div>
        <div className="text-right">
          <h2 className="font-bold text-sm">{reviewData.projectTitle}</h2>
          <p className="text-xs text-muted-foreground">Version {reviewData.versionNumber}</p>
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-8">
        {/* Video Player */}
        <div className="flex-1 flex flex-col bg-card rounded-2xl border border-white/5 overflow-hidden shadow-2xl relative">
          <div className="flex-1 relative flex flex-col items-center justify-center bg-black">
            <video 
              ref={videoRef}
              src={`/api/storage${reviewData.objectPath}`}
              className="w-full h-full object-contain"
              onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              controls={false}
            />
            
            {/* Timeline */}
            <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/90 to-transparent">
              <div className="flex items-center gap-4 mb-2">
                <button 
                  onClick={() => videoRef.current && (isPlaying ? videoRef.current.pause() : videoRef.current.play())}
                  className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 transition-transform"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                </button>
                <span className="text-white text-sm font-mono font-medium">
                  {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')} / 
                  {Math.floor(duration / 60)}:{(Math.floor(duration % 60)).toString().padStart(2, '0')}
                </span>
                <span className="text-xs text-white/50 ml-auto">Click timeline to add comment</span>
              </div>
              <div className="h-4 bg-white/20 rounded-full relative cursor-pointer overflow-hidden group hover:h-5 transition-all" onClick={handleTimelineClick}>
                <div className="h-full bg-primary absolute top-0 left-0 pointer-events-none" style={{ width: `${(currentTime/duration)*100}%` }} />
                {reviewData.comments.filter(c => c.timestampSeconds !== null).map(c => (
                  <div 
                    key={c.id} 
                    className="absolute top-0 h-full w-1.5 bg-yellow-400 rounded-full z-10 pointer-events-none" 
                    style={{ left: `${(c.timestampSeconds! / duration)*100}%` }} 
                  />
                ))}
                {activeTimestamp !== null && (
                  <div 
                    className="absolute top-0 h-full w-2 bg-white shadow-[0_0_10px_white] rounded-full z-20 pointer-events-none" 
                    style={{ left: `${(activeTimestamp / duration)*100}%` }} 
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Panel */}
        <div className="w-full lg:w-[400px] flex flex-col bg-card rounded-2xl border border-white/5 shadow-xl flex-shrink-0">
          <div className="p-6 border-b border-white/5 bg-black/10">
            <h3 className="font-display font-bold text-xl mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-accent" /> Client Feedback
            </h3>
            <div className="space-y-3">
              <Input 
                placeholder="Your Name" 
                value={name} onChange={e => setName(e.target.value)}
                className="bg-black/20 border-white/10"
              />
              {activeTimestamp !== null && (
                <div className="flex items-center justify-between px-3 py-2 bg-primary/10 rounded-lg border border-primary/20 text-sm">
                  <span className="text-primary font-medium">Timestamp: <span className="font-mono">{Math.floor(activeTimestamp / 60)}:{(Math.floor(activeTimestamp % 60)).toString().padStart(2, '0')}</span></span>
                  <button onClick={() => setActiveTimestamp(null)}><X className="w-4 h-4 text-muted-foreground hover:text-white" /></button>
                </div>
              )}
              <form onSubmit={submitComment} className="flex flex-col gap-2">
                <textarea 
                  value={commentInput} onChange={e => setCommentInput(e.target.value)}
                  placeholder="Type your feedback..." 
                  className="bg-black/20 border border-white/10 focus-visible:ring-1 focus-visible:ring-primary focus:outline-none rounded-lg p-3 text-sm h-24 resize-none"
                  required
                />
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 w-full font-semibold" disabled={commentMut.isPending}>
                  {commentMut.isPending ? "Submitting..." : "Submit Feedback"}
                </Button>
              </form>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {reviewData.comments.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">No feedback provided yet.</div>
            ) : (
              reviewData.comments.map(c => (
                <div key={c.id} className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-bold text-foreground">{c.authorName}</span>
                    {c.timestampSeconds != null && (
                      <button onClick={() => { if(videoRef.current) { videoRef.current.currentTime = c.timestampSeconds as number; setCurrentTime(c.timestampSeconds as number); } }} className="text-xs font-mono bg-black/40 px-2 py-1 rounded text-primary hover:bg-primary hover:text-white transition-colors">
                        {Math.floor((c.timestampSeconds as number) / 60)}:{(Math.floor((c.timestampSeconds as number) % 60)).toString().padStart(2, '0')}
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-foreground/80">{c.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
