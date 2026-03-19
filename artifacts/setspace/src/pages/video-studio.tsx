import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Film,
  Plus,
  Loader2,
  ExternalLink,
  Check,
  X,
  Trash2,
  Link,
  ChevronRight,
  PlayCircle,
  AlertCircle,
  Edit2,
  ThumbsUp,
  RotateCcw,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetCurrentUser } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

/* ── Types ────────────────────────────────────────────────────── */
interface VideoProject {
  id: number;
  title: string;
  clientName: string | null;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  latestVersionId: number | null;
  latestVersionNumber: number | null;
  latestVersionStatus: string | null;
}

interface VideoVersion {
  id: number;
  projectId: number;
  versionNumber: number;
  fileName: string;
  fileSize: number;
  status: string;
  framioReviewLink: string | null;
  framioSyncStatus: string;
  createdAt: string;
  uploadedBy: { firstName: string; lastName: string } | null;
}

interface ProjectDetail extends VideoProject {
  versions: VideoVersion[];
}

/* ── Helpers ──────────────────────────────────────────────────── */
function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-zinc-700 text-zinc-300" },
    approved: { label: "Approved", cls: "bg-green-900/60 text-green-300" },
    needs_revision: { label: "Needs Revision", cls: "bg-orange-900/60 text-orange-300" },
    active: { label: "Active", cls: "bg-blue-900/60 text-blue-300" },
    completed: { label: "Completed", cls: "bg-green-900/60 text-green-300" },
    archived: { label: "Archived", cls: "bg-zinc-800 text-zinc-500" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-zinc-700 text-zinc-300" };
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

/* ── New Project Dialog ───────────────────────────────────────── */
function NewProjectDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (p: VideoProject) => void }) {
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!title.trim()) { setErr("Title is required."); return; }
    setSaving(true); setErr("");
    try {
      const res = await fetch(`${BASE}/api/video-projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), clientName: client.trim() || null, description: desc.trim() || null }),
        credentials: "include",
      });
      if (!res.ok) { setErr("Failed to create project."); return; }
      const p = await res.json() as VideoProject;
      onCreate(p);
    } catch { setErr("Network error."); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">New Project</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 font-medium uppercase tracking-wide block mb-1.5">Project Title *</label>
            <Input autoFocus value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Brand Video Q2"
              className="bg-zinc-800 border-zinc-600 text-white focus:border-[#5B53FF] focus-visible:ring-[#5B53FF]"
              onKeyDown={e => e.key === "Enter" && submit()} />
          </div>
          <div>
            <label className="text-xs text-zinc-400 font-medium uppercase tracking-wide block mb-1.5">Client Name</label>
            <Input value={client} onChange={e => setClient(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="bg-zinc-800 border-zinc-600 text-white focus:border-[#5B53FF] focus-visible:ring-[#5B53FF]" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 font-medium uppercase tracking-wide block mb-1.5">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
              placeholder="Project notes…"
              className="w-full bg-zinc-800 border border-zinc-600 text-white text-sm rounded-md px-3 py-2 outline-none resize-none focus:border-[#5B53FF]" />
          </div>
          {err && <p className="text-red-400 text-sm">{err}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="ghost" onClick={onClose} className="flex-1 border border-zinc-600 text-zinc-300 hover:text-white">Cancel</Button>
          <Button onClick={submit} disabled={saving || !title.trim()} className="flex-1 bg-[#5B53FF] hover:bg-[#4a43e8] text-white font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Create Project
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Add Review Link Dialog ───────────────────────────────────── */
function AddLinkDialog({ projectId, onClose, onAdd }: { projectId: number; onClose: () => void; onAdd: (v: VideoVersion) => void }) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    const trimmed = url.trim();
    if (!trimmed) { setErr("Paste a Frame.io review link."); return; }
    if (!trimmed.includes("frame.io") && !trimmed.includes("f.io")) { setErr("This doesn't look like a Frame.io link."); return; }
    setSaving(true); setErr("");
    try {
      const res = await fetch(`${BASE}/api/video-projects/${projectId}/versions/from-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewLink: trimmed, label: label.trim() || null }),
        credentials: "include",
      });
      if (!res.ok) { setErr("Failed to save link."); return; }
      const v = await res.json() as VideoVersion;
      onAdd(v);
    } catch { setErr("Network error."); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">Add Frame.io Review Link</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-zinc-400 text-sm mb-5 leading-relaxed">
          In Frame.io, open a video → click <strong className="text-white">Share</strong> → <strong className="text-white">Copy Review Link</strong>. Paste it below.
        </p>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 font-medium uppercase tracking-wide block mb-1.5">Frame.io Review URL *</label>
            <Input autoFocus value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://f.io/… or https://app.frame.io/reviews/…"
              className="bg-zinc-800 border-zinc-600 text-white font-mono text-sm focus:border-[#5B53FF] focus-visible:ring-[#5B53FF]"
              onKeyDown={e => e.key === "Enter" && submit()} />
          </div>
          <div>
            <label className="text-xs text-zinc-400 font-medium uppercase tracking-wide block mb-1.5">Label / Version Name</label>
            <Input value={label} onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Final Cut V3"
              className="bg-zinc-800 border-zinc-600 text-white focus:border-[#5B53FF] focus-visible:ring-[#5B53FF]" />
          </div>
          {err && <p className="text-red-400 text-sm">{err}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="ghost" onClick={onClose} className="flex-1 border border-zinc-600 text-zinc-300 hover:text-white">Cancel</Button>
          <Button onClick={submit} disabled={saving || !url.trim()} className="flex-1 bg-[#5B53FF] hover:bg-[#4a43e8] text-white font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link className="w-4 h-4 mr-2" />}Add Link
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────── */
export default function VideoStudio() {
  const { data: user } = useGetCurrentUser();
  const isAdmin = (user as { role?: string } | undefined)?.role === "admin" || (user as { role?: string } | undefined)?.role === "hr";

  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<VideoVersion | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);
  const [confirmDeleteVersion, setConfirmDeleteVersion] = useState<number | null>(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<number | null>(null);

  /* load projects */
  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/video-projects`, { credentials: "include" });
      if (res.ok) setProjects(await res.json());
    } finally { setLoadingProjects(false); }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  /* load project detail */
  const loadProject = useCallback(async (id: number) => {
    setLoadingProject(true);
    setSelectedVersion(null);
    try {
      const res = await fetch(`${BASE}/api/video-projects/${id}`, { credentials: "include" });
      if (res.ok) {
        const detail = await res.json() as ProjectDetail;
        setSelectedProject(detail);
        // auto-select latest version with a review link
        const withLink = detail.versions.filter(v => v.framioReviewLink).reverse();
        if (withLink.length > 0) setSelectedVersion(withLink[0]);
      }
    } finally { setLoadingProject(false); }
  }, []);

  /* approve version */
  const approveVersion = async (versionId: number) => {
    setApprovingId(versionId);
    try {
      const res = await fetch(`${BASE}/api/video-versions/${versionId}/approve`, { method: "POST", credentials: "include" });
      if (res.ok && selectedProject) {
        const updated = await res.json() as VideoVersion;
        setSelectedProject(p => p ? { ...p, versions: p.versions.map(v => v.id === versionId ? { ...v, ...updated } : v) } : p);
        setSelectedVersion(v => v?.id === versionId ? { ...v, ...updated } : v);
      }
    } finally { setApprovingId(null); }
  };

  /* request revision */
  const requestRevision = async (versionId: number) => {
    try {
      const res = await fetch(`${BASE}/api/video-versions/${versionId}/request-revision`, { method: "POST", credentials: "include" });
      if (res.ok && selectedProject) {
        const updated = await res.json() as VideoVersion;
        setSelectedProject(p => p ? { ...p, versions: p.versions.map(v => v.id === versionId ? { ...v, ...updated } : v) } : p);
        setSelectedVersion(v => v?.id === versionId ? { ...v, ...updated } : v);
      }
    } catch {}
  };

  /* delete version */
  const deleteVersion = async (versionId: number) => {
    setDeletingId(versionId);
    try {
      const res = await fetch(`${BASE}/api/video-versions/${versionId}`, { method: "DELETE", credentials: "include" });
      if (res.ok && selectedProject) {
        setSelectedProject(p => p ? { ...p, versions: p.versions.filter(v => v.id !== versionId) } : p);
        if (selectedVersion?.id === versionId) setSelectedVersion(null);
        setConfirmDeleteVersion(null);
      }
    } finally { setDeletingId(null); }
  };

  /* delete project */
  const deleteProject = async (projectId: number) => {
    setDeletingProjectId(projectId);
    try {
      const res = await fetch(`${BASE}/api/video-projects/${projectId}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setProjects(ps => ps.filter(p => p.id !== projectId));
        if (selectedProject?.id === projectId) { setSelectedProject(null); setSelectedVersion(null); }
        setConfirmDeleteProject(null);
      }
    } finally { setDeletingProjectId(null); }
  };

  const versionCount = (p: VideoProject) => {
    if (selectedProject?.id === p.id) return selectedProject.versions.length;
    return null;
  };

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="flex flex-1 min-h-0 bg-[#0e0e0e] text-white overflow-hidden" style={{ fontFamily: "inherit" }}>

      {/* ── LEFT: Project list ─────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 border-r border-zinc-800 flex flex-col bg-[#111]">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
          <Film className="w-4 h-4 text-[#5B53FF] shrink-0" />
          <span className="font-semibold text-sm flex-1">Video Studio</span>
          <button onClick={() => setShowNewProject(true)}
            className="p-1 text-zinc-500 hover:text-[#5B53FF] rounded transition-colors" title="New project">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto py-1">
          {loadingProjects ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
          ) : projects.length === 0 ? (
            <div className="text-center py-10 px-4 space-y-2">
              <FolderOpen className="w-8 h-8 mx-auto text-zinc-700" />
              <p className="text-zinc-500 text-sm">No projects yet</p>
              <button onClick={() => setShowNewProject(true)} className="text-[#5B53FF] text-xs hover:underline">Create one</button>
            </div>
          ) : (
            projects.map(p => (
              <button key={p.id} onClick={() => { setSelectedProject(null); loadProject(p.id); }}
                className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 border-b border-zinc-800/50 transition-colors group
                  ${selectedProject?.id === p.id ? "bg-[#5B53FF]/15 border-l-2 border-l-[#5B53FF]" : "hover:bg-zinc-800/50"}`}>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5B53FF]/30 to-purple-900/40 flex items-center justify-center shrink-0 mt-0.5">
                  <Film className="w-4 h-4 text-[#5B53FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate text-white">{p.title}</div>
                  {p.clientName && <div className="text-zinc-400 text-xs truncate">{p.clientName}</div>}
                  <div className="flex items-center gap-2 mt-1">
                    {statusBadge(p.status)}
                    {p.latestVersionNumber && (
                      <span className="text-[10px] text-zinc-500">v{p.latestVersionNumber}</span>
                    )}
                  </div>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 text-zinc-600 shrink-0 mt-1 transition-transform ${selectedProject?.id === p.id ? "rotate-90" : ""}`} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {!selectedProject && !loadingProject ? (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 flex items-center justify-center mx-auto">
                <Film className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-zinc-400 font-medium">Select a project</p>
              <p className="text-zinc-600 text-sm max-w-xs">Choose a project from the sidebar to review videos, or create a new one.</p>
              <Button onClick={() => setShowNewProject(true)} className="mt-2 bg-[#5B53FF] hover:bg-[#4a43e8] text-white text-sm">
                <Plus className="w-4 h-4 mr-2" /> New Project
              </Button>
            </div>
          </div>
        ) : loadingProject ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-[#5B53FF]" />
          </div>
        ) : selectedProject && (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Project header */}
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-4 shrink-0 bg-[#111]">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-white font-semibold text-base truncate">{selectedProject.title}</h2>
                  {statusBadge(selectedProject.status)}
                </div>
                {selectedProject.clientName && (
                  <p className="text-zinc-400 text-xs mt-0.5">{selectedProject.clientName}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" onClick={() => setShowAddLink(true)}
                  className="bg-[#5B53FF] hover:bg-[#4a43e8] text-white text-xs h-8 px-3">
                  <Link className="w-3.5 h-3.5 mr-1.5" /> Add Review Link
                </Button>
                {isAdmin && (
                  confirmDeleteProject === selectedProject.id ? (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteProject(null)}
                        className="text-zinc-400 hover:text-white h-8 px-2 text-xs">Cancel</Button>
                      <Button size="sm" onClick={() => deleteProject(selectedProject.id)}
                        disabled={deletingProjectId === selectedProject.id}
                        className="bg-red-600 hover:bg-red-500 text-white h-8 px-3 text-xs">
                        {deletingProjectId === selectedProject.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete Project"}
                      </Button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteProject(selectedProject.id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 rounded transition-colors" title="Delete project">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Main area: version list + player */}
            <div className="flex-1 flex overflow-hidden">

              {/* Version list (left of player) */}
              <div className="w-56 flex-shrink-0 border-r border-zinc-800 flex flex-col bg-[#0e0e0e]">
                <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Versions</span>
                  <span className="text-xs text-zinc-600">{selectedProject.versions.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                  {selectedProject.versions.length === 0 ? (
                    <div className="text-center py-8 px-3 space-y-2">
                      <PlayCircle className="w-7 h-7 mx-auto text-zinc-700" />
                      <p className="text-zinc-500 text-xs">No videos yet</p>
                      <button onClick={() => setShowAddLink(true)}
                        className="text-[#5B53FF] text-xs hover:underline">Add a review link</button>
                    </div>
                  ) : (
                    [...selectedProject.versions].reverse().map(v => (
                      <button key={v.id} onClick={() => setSelectedVersion(v)}
                        className={`w-full text-left px-3 py-2.5 border-b border-zinc-800/50 transition-colors group
                          ${selectedVersion?.id === v.id ? "bg-[#5B53FF]/15 border-l-2 border-l-[#5B53FF]" : "hover:bg-zinc-800/40"}`}>
                        <div className="flex items-start gap-2">
                          <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold
                            ${v.framioReviewLink ? "bg-[#5B53FF]/20 text-[#5B53FF]" : "bg-zinc-800 text-zinc-500"}`}>
                            v{v.versionNumber}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-xs font-medium truncate">{v.fileName}</div>
                            <div className="flex items-center gap-1.5 mt-1">
                              {statusBadge(v.status)}
                              {v.framioReviewLink && (
                                <span className="text-[9px] text-[#5B53FF] flex items-center gap-0.5">
                                  <Link className="w-2.5 h-2.5" />fio
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Admin controls on hover */}
                        {isAdmin && (
                          <div className="mt-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {v.status !== "approved" && (
                              <button onClick={e => { e.stopPropagation(); approveVersion(v.id); }}
                                disabled={approvingId === v.id}
                                className="flex-1 text-[10px] bg-green-900/40 hover:bg-green-800/60 text-green-300 rounded px-1.5 py-1 flex items-center justify-center gap-1">
                                {approvingId === v.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5" />}
                                Approve
                              </button>
                            )}
                            {v.status !== "needs_revision" && (
                              <button onClick={e => { e.stopPropagation(); requestRevision(v.id); }}
                                className="flex-1 text-[10px] bg-orange-900/40 hover:bg-orange-800/60 text-orange-300 rounded px-1.5 py-1 flex items-center justify-center gap-1">
                                <RotateCcw className="w-2.5 h-2.5" />Revise
                              </button>
                            )}
                            {confirmDeleteVersion === v.id ? (
                              <button onClick={e => { e.stopPropagation(); deleteVersion(v.id); }}
                                disabled={deletingId === v.id}
                                className="text-[10px] bg-red-700 hover:bg-red-600 text-white rounded px-1.5 py-1">
                                {deletingId === v.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : "Sure?"}
                              </button>
                            ) : (
                              <button onClick={e => { e.stopPropagation(); setConfirmDeleteVersion(v.id); }}
                                className="text-[10px] bg-zinc-800 hover:bg-red-900/40 text-zinc-400 hover:text-red-300 rounded px-1.5 py-1">
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Player panel */}
              <div className="flex-1 flex flex-col bg-black overflow-hidden">
                {!selectedVersion ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-3">
                      <PlayCircle className="w-12 h-12 mx-auto text-zinc-700" />
                      <p className="text-zinc-500 text-sm">Select a version to review</p>
                    </div>
                  </div>
                ) : !selectedVersion.framioReviewLink ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-4 px-6">
                      <AlertCircle className="w-10 h-10 mx-auto text-zinc-600" />
                      <div>
                        <p className="text-zinc-300 font-medium">No Frame.io review link</p>
                        <p className="text-zinc-500 text-sm mt-1">This version doesn't have a review link attached yet.</p>
                      </div>
                      {isAdmin && (
                        <Button onClick={() => setShowAddLink(true)} size="sm"
                          className="bg-[#5B53FF] hover:bg-[#4a43e8] text-white">
                          <Link className="w-4 h-4 mr-2" /> Add Review Link
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Player top bar */}
                    <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-950 shrink-0">
                      <PlayCircle className="w-4 h-4 text-[#5B53FF] shrink-0" />
                      <span className="text-white text-sm font-medium truncate">{selectedVersion.fileName}</span>
                      <div className="flex items-center gap-2 ml-auto">
                        {statusBadge(selectedVersion.status)}
                        {isAdmin && selectedVersion.status !== "approved" && (
                          <button onClick={() => approveVersion(selectedVersion.id)}
                            disabled={approvingId === selectedVersion.id}
                            className="flex items-center gap-1.5 text-xs bg-green-900/40 hover:bg-green-800/60 text-green-300 px-2.5 py-1 rounded-full transition-colors">
                            {approvingId === selectedVersion.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <ThumbsUp className="w-3 h-3" />}
                            Approve
                          </button>
                        )}
                        {isAdmin && selectedVersion.status !== "needs_revision" && (
                          <button onClick={() => requestRevision(selectedVersion.id)}
                            className="flex items-center gap-1.5 text-xs bg-orange-900/40 hover:bg-orange-800/60 text-orange-300 px-2.5 py-1 rounded-full transition-colors">
                            <RotateCcw className="w-3 h-3" />Request Revision
                          </button>
                        )}
                        <a href={selectedVersion.framioReviewLink} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />Open in Frame.io
                        </a>
                      </div>
                    </div>
                    {/* Embedded player */}
                    <iframe
                      key={selectedVersion.id}
                      src={selectedVersion.framioReviewLink}
                      className="flex-1 w-full border-0"
                      allow="fullscreen; autoplay"
                      title={selectedVersion.fileName}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showNewProject && (
        <NewProjectDialog
          onClose={() => setShowNewProject(false)}
          onCreate={p => {
            setProjects(ps => [p, ...ps]);
            setShowNewProject(false);
            loadProject(p.id);
          }}
        />
      )}
      {showAddLink && selectedProject && (
        <AddLinkDialog
          projectId={selectedProject.id}
          onClose={() => setShowAddLink(false)}
          onAdd={v => {
            setSelectedProject(p => p ? { ...p, versions: [...p.versions, v] } : p);
            setSelectedVersion(v);
            setShowAddLink(false);
          }}
        />
      )}
    </div>
  );
}
