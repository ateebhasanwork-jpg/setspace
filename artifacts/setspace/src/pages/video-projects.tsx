import React, { useState } from "react";
import { useListVideoProjects, useCreateVideoProject, getListVideoProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Video, Building2, Layers } from "lucide-react";
import { Link } from "wouter";

export default function VideoProjects() {
  const { data: projects, isLoading } = useListVideoProjects();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  
  const queryClient = useQueryClient();
  const createMut = useCreateVideoProject({
    mutation: {
      onSuccess: () => {
        setIsCreateOpen(false);
        setTitle("");
        setClientName("");
        setDescription("");
        queryClient.invalidateQueries({ queryKey: getListVideoProjectsQueryKey() });
      }
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({ data: { title, clientName, description } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Video Studio</h1>
          <p className="text-muted-foreground mt-1">Manage, review, and collaborate on video deliverables.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 rounded-xl font-semibold px-6">
              <Plus className="w-4 h-4 mr-2" /> New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-panel border-white/10 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-display">Create Video Project</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Project Title</label>
                <Input required value={title} onChange={e => setTitle(e.target.value)} className="bg-black/20 border-white/10" placeholder="Q3 Marketing Ad" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Client Name (Optional)</label>
                <Input value={clientName} onChange={e => setClientName(e.target.value)} className="bg-black/20 border-white/10" placeholder="Acme Corp" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Description</label>
                <textarea 
                  value={description} onChange={e => setDescription(e.target.value)} 
                  className="w-full h-24 rounded-md bg-black/20 border border-white/10 p-3 text-sm resize-none"
                  placeholder="Notes for the editors..."
                />
              </div>
              <Button type="submit" disabled={createMut.isPending} className="w-full rounded-xl mt-2 font-semibold">
                {createMut.isPending ? "Creating..." : "Create Project"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects?.map(proj => (
            <Link key={proj.id} href={`/videos/${proj.id}`}>
              <Card className="glass-panel overflow-hidden hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all cursor-pointer group flex flex-col h-full">
                <div className="aspect-video bg-black/40 border-b border-white/5 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Video className="w-12 h-12 text-muted-foreground/30 group-hover:scale-110 group-hover:text-primary/50 transition-all duration-500" />
                  <div className="absolute bottom-3 left-3 flex gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md text-xs font-semibold text-white border border-white/10 flex items-center shadow-lg">
                      <Layers className="w-3 h-3 mr-1.5" /> 
                      {proj.latestVersionNumber ? `v${proj.latestVersionNumber}` : 'No versions'}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold shadow-lg border border-white/10 backdrop-blur-md ${
                      proj.latestVersionStatus === 'approved' ? 'bg-green-500/20 text-green-400' :
                      proj.latestVersionStatus === 'needs_revision' ? 'bg-red-500/20 text-red-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {proj.latestVersionStatus === 'approved' ? 'Approved' :
                       proj.latestVersionStatus === 'needs_revision' ? 'Needs Revision' :
                       proj.latestVersionStatus ?? 'In Progress'}
                    </span>
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-display font-bold text-lg text-foreground mb-1 line-clamp-1">{proj.title}</h3>
                    {proj.clientName && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Building2 className="w-3.5 h-3.5 mr-1.5" />
                        {proj.clientName}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-xs text-muted-foreground">
                    <span>Updated {new Date(proj.updatedAt).toLocaleDateString()}</span>
                    <span className="text-primary group-hover:underline font-medium">Open Studio →</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          {projects?.length === 0 && (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-white/10 rounded-2xl">
              <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-display font-bold text-foreground mb-2">No Projects Yet</h3>
              <p className="text-muted-foreground">Create your first video project to start reviewing.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
