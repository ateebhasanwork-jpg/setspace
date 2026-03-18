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
import { ChevronLeft, Upload, Check, X, Link as LinkIcon, MessageSquare, Play, Pause, Film, MapPin, Copy, ExternalLink, Clock } from "lucide-react";
import { Link, useParams } from "wouter";

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

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
  const { data: comments } = useListVideoComments(selectedVersionId || 0, {
    query: { queryKey: getListVideoCommentsQueryKey(selectedVersionId || 0), enabled: !!selectedVersionId, refetchInterval: 5000 }
  });

  // Upload Logic
  const createVersionMut = useCreateVideoVersion({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetVideoProjectQueryKey(projectId) })
    }
  });
  
  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (res) => {
      createVersionMut.mutate({
        projectId,
        data: { objectPath: res.objectPath, fileName: res.metadata.name, fileSize: res.metadata.size }
      });
    }
  });

  // Video Player
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Comments
  const [commentInput, setCommentInput] = useState("");
  const [activeTimestamp, setActiveTimestamp] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

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
        const url = `${window.location.origin}/review/${data.token}`;
        navigator.clipboard.writeText(url);
        queryClient.invalidateQueries({ queryKey: getGetVideoProjectQueryKey(projectId) });
      }
    }
  });

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
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

  const pinCurrentTime = () => {
    setActiveTimestamp(currentTime);
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVersionId || !commentInput.trim()) return;
    commentMut.mutate({
      versionId: selectedVersionId,
      data: { content: commentInput, timestampSeconds: activeTimestamp }
    });
  };

  const copyShareLink = (token: string) => {
    const url = `${window.location.origin}/review/${token}`;
    navigator.clipboard.writeText(url);
  };

  const openShareLink = (token: string) => {
    window.open(`${window.location.origin}/review/${token}`, "_blank");
  };

  const handleCopyWithFeedback = (versionId: number, token: string) => {
    copyShareLink(token);
    setCopiedId(versionId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sortedComments = [...(comments || [])].sort((a, b) => {
    const at = a.timestampSeconds ?? Infinity;
    const bt = b.timestampSeconds ?? Infinity;
    return at - bt;
  });

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
        
        <label className={`cursor-pointer ${isUploading || createVersionMut.isPending ? "pointer-events-none" : ""}`}>
          <input type="file" className="hidden" accept="video/*" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} disabled={isUploading || createVersionMut.isPending} />
          <div className="flex flex-col w-full sm:min-w-[160px] bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm text-foreground overflow-hidden">
            <div className="flex items-center gap-2">
              {isUploading || createVersionMut.isPending ? (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
              ) : <Upload className="w-4 h-4 shrink-0" />}
              <span>
                {createVersionMut.isPending ? "Saving..." : isUploading ? `Uploading ${progress}%` : "Upload New Version"}
              </span>
            </div>
            {isUploading && (
              <div className="mt-2 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        </label>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 gap-6 min-h-0 overflow-hidden">
        {/* Main Video Area */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {/* Video Player */}
          <div className="flex-1 flex flex-col bg-black/40 rounded-2xl border border-white/5 overflow-hidden shadow-2xl relative min-h-0">
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
                      {fmtTime(currentTime)} / {fmtTime(duration)}
                    </span>
                    <span className="text-xs text-white/50">Click timeline to pin a comment timestamp</span>
                  </div>
                  <div className="h-3 bg-white/20 rounded-full relative cursor-pointer overflow-visible group hover:h-4 transition-all" onClick={handleTimelineClick}>
                    <div className="h-full bg-primary rounded-full absolute top-0 left-0 pointer-events-none" style={{ width: `${duration ? (currentTime/duration)*100 : 0}%` }} />
                    {sortedComments.filter(c => c.timestampSeconds != null).map(c => (
                      <button 
                        key={c.id}
                        title={`${fmtTime(c.timestampSeconds!)} — ${c.content}`}
                        onClick={e => { e.stopPropagation(); handleSeek(c.timestampSeconds!); }}
                        className="absolute -top-1 h-5 w-1.5 bg-yellow-400 rounded-full z-10 hover:bg-yellow-300 hover:scale-125 transition-transform" 
                        style={{ left: `${duration ? (c.timestampSeconds! / duration)*100 : 0}%` }} 
                      />
                    ))}
                    {activeTimestamp !== null && (
                      <div 
                        className="absolute -top-1 h-5 w-1.5 bg-white shadow-[0_0_8px_white] rounded-full z-20 pointer-events-none" 
                        style={{ left: `${duration ? (activeTimestamp / duration)*100 : 0}%` }} 
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

          {/* Version List with Share Links */}
          <div className="bg-card rounded-2xl border border-white/5 p-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Film className="w-4 h-4" /> Versions & Share Links
            </h3>
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No versions uploaded yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {[...versions].reverse().map(v => (
                  <div 
                    key={v.id} 
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${selectedVersionId === v.id ? 'bg-primary/10 border-primary/30' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}
                    onClick={() => setSelectedVersionId(v.id)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${selectedVersionId === v.id ? 'bg-primary text-white' : 'bg-white/10 text-foreground'}`}>
                      {v.versionNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Version {v.versionNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">{v.fileName || "video"}</p>
                    </div>
                    <div className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      v.status === 'Approved' ? 'bg-green-500/20 text-green-400' :
                      v.status === 'Needs Revision' ? 'bg-red-500/20 text-red-400' :
                      'bg-white/10 text-muted-foreground'
                    }`}>
                      {v.status || 'Pending'}
                    </div>
                    {/* Share link actions */}
                    {v.shareToken ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          title="Copy share link"
                          onClick={e => { e.stopPropagation(); handleCopyWithFeedback(v.id, v.shareToken!); }}
                          className={`p-1.5 rounded-lg transition-colors ${copiedId === v.id ? 'bg-green-500/20 text-green-400' : 'bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground'}`}
                        >
                          {copiedId === v.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          title="Open in new tab"
                          onClick={e => { e.stopPropagation(); openShareLink(v.shareToken!); }}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        title="Generate share link"
                        onClick={e => { e.stopPropagation(); shareMut.mutate({ versionId: v.id }); }}
                        disabled={shareMut.isPending}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-accent/20 text-muted-foreground hover:text-accent transition-colors shrink-0"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Comments Sidebar */}
        <div className="w-full lg:w-96 flex flex-col bg-card rounded-2xl border border-white/5 shadow-xl flex-shrink-0">
          <div className="p-4 border-b border-white/5 bg-black/10">
            <h3 className="font-display font-bold text-lg flex items-center gap-2 mb-1">
              <MessageSquare className="w-5 h-5 text-primary" /> Comments
            </h3>
            {selectedVersion && (
              <p className="text-xs text-muted-foreground">Version {selectedVersion.versionNumber} · sorted by timestamp</p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {sortedComments.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No comments yet. Pause the video and click the timeline or use the pin button below.
              </div>
            )}
            {sortedComments.map(c => (
              <div key={c.id} className={`p-3 rounded-xl border ${c.isResolved ? 'bg-white/5 border-white/5 opacity-50' : 'bg-primary/5 border-primary/20'} relative group`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${c.authorType === 'client' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-white'}`}>
                      {c.authorName[0]}
                    </div>
                    <span className="text-xs font-semibold text-foreground">{c.authorName}</span>
                    {c.authorType === 'client' && <span className="text-[9px] bg-accent/20 text-accent px-1.5 rounded uppercase tracking-wider">Client</span>}
                  </div>
                  {c.timestampSeconds != null && (
                    <button 
                      onClick={() => handleSeek(c.timestampSeconds as number)} 
                      className="text-xs font-mono bg-yellow-400/10 border border-yellow-400/30 px-2 py-0.5 rounded text-yellow-400 hover:bg-yellow-400 hover:text-black transition-colors flex items-center gap-1 shrink-0"
                    >
                      <MapPin className="w-3 h-3" />
                      {fmtTime(c.timestampSeconds as number)}
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed">{c.content}</p>
                {!c.isResolved && (
                  <button 
                    onClick={() => resolveMut.mutate({ commentId: c.id })} 
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 bg-green-500/20 text-green-400 rounded-md hover:bg-green-500 hover:text-white transition-all"
                    title="Mark resolved"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {selectedVersion && (
            <div className="p-4 border-t border-white/5 bg-black/10">
              {/* Timestamp pin indicator */}
              <div className="flex items-center gap-2 mb-3">
                {activeTimestamp !== null ? (
                  <div className="flex-1 flex items-center justify-between px-3 py-2 bg-yellow-400/10 rounded-lg border border-yellow-400/30">
                    <span className="text-xs text-yellow-400 font-medium flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      Pinned at <span className="font-mono">{fmtTime(activeTimestamp)}</span>
                    </span>
                    <button onClick={() => setActiveTimestamp(null)}>
                      <X className="w-3 h-3 text-yellow-400/70 hover:text-yellow-400" />
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center px-3 py-2 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> No timestamp — comment will be general
                    </span>
                  </div>
                )}
                <button
                  onClick={pinCurrentTime}
                  title="Pin to current video time"
                  className="shrink-0 p-2 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 hover:bg-yellow-400 hover:text-black transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={submitComment} className="flex gap-2 mb-4">
                <Input 
                  value={commentInput} onChange={e => setCommentInput(e.target.value)}
                  placeholder={activeTimestamp !== null ? `Comment at ${fmtTime(activeTimestamp)}…` : "Add a general comment…"}
                  className="bg-black/20 border-white/10 focus-visible:ring-primary"
                  required
                />
                <Button type="submit" size="icon" disabled={commentMut.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 shadow-lg shadow-primary/20">
                  <Check className="w-4 h-4" />
                </Button>
              </form>

              <div className="grid grid-cols-2 gap-2">
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
