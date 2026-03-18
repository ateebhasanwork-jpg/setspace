import React, { useState, useRef, useEffect } from "react";
import { 
  useGetVideoProject, 
  useCreateVideoVersion,
  useListVideoComments,
  useCreateVideoComment,
  useResolveVideoComment,
  useApproveVideoVersion,
  useRequestVideoRevision,
  useCreateShareToken,
  getGetVideoProjectQueryKey,
  getListVideoCommentsQueryKey
} from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, Upload, Check, X, Link as LinkIcon, MessageSquare, Play, Pause, User as UserIcon, Film } from "lucide-react";
import { Link, useParams } from "wouter";

export default function VideoStudio() {
  const { id } = useParams();
  const projectId = parseInt(id || "0");
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useGetVideoProject(projectId);
  const versions = project?.versions || [];
  
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  useEffect(() => {
    if (versions.length > 0 && !selectedVersionId) {
      setSelectedVersionId(versions[versions.length - 1].id);
    }
  }, [versions, selectedVersionId]);

  const selectedVersion = versions.find(v => v.id === selectedVersionId);
  const { data: comments } = useListVideoComments(selectedVersionId || 0, { query: { queryKey: getListVideoCommentsQueryKey(selectedVersionId || 0), enabled: !!selectedVersionId } });

  // Upload Logic
  const createVersionMut = useCreateVideoVersion({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetVideoProjectQueryKey(projectId) })
    }
  });
  
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (res) => {
      createVersionMut.mutate({
        projectId,
        data: { objectPath: res.objectPath, fileName: res.metadata.name, fileSize: res.metadata.size }
      });
    }
  });

  // Video Player & Comments Logic
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [commentInput, setCommentInput] = useState("");
  const [activeTimestamp, setActiveTimestamp] = useState<number | null>(null);

  const commentMut = useCreateVideoComment({
    mutation: {
      onSuccess: () => {
        setCommentInput("");
        setActiveTimestamp(null);
        queryClient.invalidateQueries({ queryKey: getListVideoCommentsQueryKey(selectedVersionId || 0) });
      }
    }
  });

  const resolveMut = useResolveVideoComment({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListVideoCommentsQueryKey(selectedVersionId || 0) }) }
  });

  const approveMut = useApproveVideoVersion({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetVideoProjectQueryKey(projectId) }) }
  });

  const reviseMut = useRequestVideoRevision({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetVideoProjectQueryKey(projectId) }) }
  });

  const shareMut = useCreateShareToken({
    mutation: {
      onSuccess: (data) => {
        navigator.clipboard.writeText(`${window.location.origin}/review/${data.token}`);
        alert("Public review link copied to clipboard!");
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

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVersionId) return;
    commentMut.mutate({
      versionId: selectedVersionId,
      data: { content: commentInput, timestampSeconds: activeTimestamp }
    });
  };

  if (isLoading) return <div className="flex h-full items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!project) return <div>Project not found.</div>;

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-2xl border border-white/5 shadow-lg">
        <div className="flex items-center gap-4">
          <Link href="/videos">
            <Button variant="ghost" size="icon" className="hover:bg-white/10 rounded-full">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">{project.title}</h1>
            <p className="text-xs text-muted-foreground">{project.clientName || 'Internal Project'}</p>
          </div>
          <div className={`ml-4 px-3 py-1 rounded-full text-xs font-bold ${
            project.status === 'Approved' ? 'bg-green-500/20 text-green-400' :
            project.status === 'Needs Revision' ? 'bg-red-500/20 text-red-400' :
            'bg-blue-500/20 text-blue-400'
          }`}>
            {project.status}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
            value={selectedVersionId || ""}
            onChange={e => setSelectedVersionId(Number(e.target.value))}
          >
            {versions.length === 0 && <option value="">No versions</option>}
            {versions.map(v => (
              <option key={v.id} value={v.id} className="bg-card">Version {v.versionNumber}</option>
            ))}
          </select>

          <label className="cursor-pointer">
            <input type="file" className="hidden" accept="video/*" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
            <div className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm text-foreground">
              {isUploading || createVersionMut.isPending ? (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : <Upload className="w-4 h-4" />}
              Upload New Version
            </div>
          </label>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 gap-6 min-h-0 overflow-hidden">
        {/* Main Video Area */}
        <div className="flex-1 flex flex-col bg-black/40 rounded-2xl border border-white/5 overflow-hidden shadow-2xl relative">
          {selectedVersion ? (
            <div className="flex-1 relative flex flex-col items-center justify-center p-4">
              <video 
                ref={videoRef}
                src={`/api/storage${selectedVersion.objectPath}`}
                className="max-w-full max-h-full rounded-lg shadow-2xl"
                onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                controls={false}
              />
              
              {/* Custom Timeline */}
              <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center gap-4 mb-2">
                  <button 
                    onClick={() => videoRef.current && (isPlaying ? videoRef.current.pause() : videoRef.current.play())}
                    className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white hover:scale-105 transition-transform"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                  </button>
                  <span className="text-white text-sm font-mono tracking-wider font-medium">
                    {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')} / 
                    {Math.floor(duration / 60)}:{(Math.floor(duration % 60)).toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="h-3 bg-white/20 rounded-full relative cursor-pointer overflow-hidden group hover:h-4 transition-all" onClick={handleTimelineClick}>
                  <div className="h-full bg-primary absolute top-0 left-0 pointer-events-none" style={{ width: `${(currentTime/duration)*100}%` }} />
                  {comments?.filter(c => c.timestampSeconds !== null).map(c => (
                    <div 
                      key={c.id} 
                      className="absolute top-0 h-full w-1.5 bg-yellow-400 rounded-full z-10 pointer-events-none" 
                      style={{ left: `${(c.timestampSeconds! / duration)*100}%` }} 
                    />
                  ))}
                  {activeTimestamp !== null && (
                    <div 
                      className="absolute top-0 h-full w-1.5 bg-white shadow-[0_0_8px_white] rounded-full z-20 pointer-events-none" 
                      style={{ left: `${(activeTimestamp / duration)*100}%` }} 
                    />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
              <Film className="w-16 h-16 mb-4 opacity-20" />
              <h3 className="text-xl font-display text-white mb-2">No Versions Yet</h3>
              <p>Upload a video file to begin the review process.</p>
            </div>
          )}
        </div>

        {/* Sidebar / Comments */}
        <div className="w-full lg:w-96 flex flex-col bg-card rounded-2xl border border-white/5 shadow-xl flex-shrink-0">
          <div className="p-4 border-b border-white/5 bg-black/10 flex justify-between items-center">
            <h3 className="font-display font-bold text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" /> Review & Comments
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {comments?.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">No comments on this version.</div>
            )}
            {comments?.map(c => (
              <div key={c.id} className={`p-3 rounded-xl border ${c.isResolved ? 'bg-white/5 border-white/5 opacity-60' : 'bg-primary/5 border-primary/20'} relative group`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${c.authorType === 'client' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-white'}`}>
                      {c.authorName[0]}
                    </div>
                    <span className="text-xs font-semibold text-foreground">{c.authorName}</span>
                    {c.authorType === 'client' && <span className="text-[9px] bg-accent/20 text-accent px-1.5 rounded uppercase tracking-wider">Client</span>}
                  </div>
                  {c.timestampSeconds != null && (
                    <button onClick={() => handleSeek(c.timestampSeconds as number)} className="text-xs font-mono bg-black/40 px-2 py-0.5 rounded text-primary hover:bg-primary hover:text-white transition-colors">
                      {Math.floor((c.timestampSeconds as number) / 60)}:{(Math.floor((c.timestampSeconds as number) % 60)).toString().padStart(2, '0')}
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground/90">{c.content}</p>
                {!c.isResolved && (
                  <button onClick={() => resolveMut.mutate({ commentId: c.id })} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 bg-green-500/20 text-green-400 rounded-md hover:bg-green-500 hover:text-white transition-all">
                    <Check className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {selectedVersion && (
            <div className="p-4 border-t border-white/5 bg-black/10">
              {activeTimestamp !== null && (
                <div className="flex items-center justify-between mb-2 px-2 py-1 bg-primary/10 rounded-md border border-primary/20">
                  <span className="text-xs text-primary font-medium">Adding comment at <span className="font-mono">{Math.floor(activeTimestamp / 60)}:{(Math.floor(activeTimestamp % 60)).toString().padStart(2, '0')}</span></span>
                  <button onClick={() => setActiveTimestamp(null)}><X className="w-3 h-3 text-muted-foreground hover:text-white" /></button>
                </div>
              )}
              <form onSubmit={submitComment} className="flex gap-2 mb-4">
                <Input 
                  value={commentInput} onChange={e => setCommentInput(e.target.value)}
                  placeholder="Type a comment..." 
                  className="bg-black/20 border-white/10 focus-visible:ring-primary"
                  required
                />
                <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 shadow-lg shadow-primary/20"><Check className="w-4 h-4" /></Button>
              </form>

              <div className="grid grid-cols-2 gap-2 pt-4 border-t border-white/5">
                <Button 
                  variant="outline" 
                  className="w-full bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500 hover:text-white"
                  onClick={() => approveMut.mutate({ versionId: selectedVersion.id })}
                  disabled={approveMut.isPending}
                >
                  <Check className="w-4 h-4 mr-2" /> Approve
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500 hover:text-white"
                  onClick={() => reviseMut.mutate({ versionId: selectedVersion.id })}
                  disabled={reviseMut.isPending}
                >
                  <X className="w-4 h-4 mr-2" /> Reject
                </Button>
                <Button 
                  variant="outline" 
                  className="col-span-2 w-full mt-2 bg-accent/10 text-accent border-accent/20 hover:bg-accent hover:text-white"
                  onClick={() => shareMut.mutate({ versionId: selectedVersion.id })}
                  disabled={shareMut.isPending}
                >
                  <LinkIcon className="w-4 h-4 mr-2" /> Generate Client Link
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
