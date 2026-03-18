import React, { useState, useEffect, useCallback } from "react";
import {
  Folder,
  FileVideo,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Film,
  Home,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface FioProject {
  id: string;
  name: string;
  root_asset_id: string;
  teamName: string;
}

interface FioAsset {
  id: string;
  name: string;
  type: "file" | "folder" | "version_stack";
  filesize?: number;
  filetype?: string;
  duration?: number;
  thumb_url?: string;
  link?: string;
  inserted_at?: string;
}

interface Crumb {
  id: string;
  name: string;
}

function fmtSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtDuration(s?: number) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function AssetIcon({ asset }: { asset: FioAsset }) {
  if (asset.type === "folder") {
    return <Folder className="w-4 h-4 text-yellow-400 flex-shrink-0" />;
  }
  if (asset.thumb_url) {
    return (
      <img
        src={asset.thumb_url}
        alt=""
        className="w-8 h-5 object-cover rounded flex-shrink-0 bg-zinc-800"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return <FileVideo className="w-4 h-4 text-blue-400 flex-shrink-0" />;
}

export default function VideoStudio() {
  const [projects, setProjects] = useState<FioProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<FioProject | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [assets, setAssets] = useState<FioAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<FioAsset | null>(null);
  const [reviewLink, setReviewLink] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [loadingLink, setLoadingLink] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoadingProjects(true);
    setError(null);
    try {
      const statusRes = await fetch(`${BASE}/api/frameio/status`, { credentials: "include" });
      const status = await statusRes.json() as { configured: boolean };
      if (!status.configured) {
        setConfigured(false);
        setLoadingProjects(false);
        return;
      }
      const res = await fetch(`${BASE}/api/frameio/projects`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load projects");
      const data = await res.json() as FioProject[];
      setProjects(data);
      if (data.length > 0) {
        selectProject(data[0]);
      }
    } catch (e) {
      setError("Could not connect to Frame.io. Check your API token.");
    } finally {
      setLoadingProjects(false);
    }
  }

  const loadFolder = useCallback(async (assetId: string) => {
    setLoadingAssets(true);
    setSelectedAsset(null);
    setReviewLink(null);
    try {
      const res = await fetch(`${BASE}/api/frameio/assets/${assetId}/children`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load folder");
      const data = await res.json() as FioAsset[];
      const sorted = [...data].sort((a, b) => {
        if (a.type === "folder" && b.type !== "folder") return -1;
        if (a.type !== "folder" && b.type === "folder") return 1;
        return a.name.localeCompare(b.name);
      });
      setAssets(sorted);
    } catch {
      setAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  function selectProject(project: FioProject) {
    setSelectedProject(project);
    setCrumbs([{ id: project.root_asset_id, name: project.name }]);
    setSelectedAsset(null);
    setReviewLink(null);
    loadFolder(project.root_asset_id);
  }

  function openFolder(asset: FioAsset) {
    setCrumbs(prev => [...prev, { id: asset.id, name: asset.name }]);
    loadFolder(asset.id);
  }

  function navigateCrumb(index: number) {
    const crumb = crumbs[index];
    setCrumbs(prev => prev.slice(0, index + 1));
    loadFolder(crumb.id);
    setSelectedAsset(null);
    setReviewLink(null);
  }

  async function selectFile(asset: FioAsset) {
    setSelectedAsset(asset);
    setReviewLink(null);
    setConfirmDelete(false);
    setLoadingLink(true);
    try {
      const res = await fetch(`${BASE}/api/frameio/assets/${asset.id}/review-link`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { link: string };
        setReviewLink(data.link);
      }
    } catch {
      setReviewLink(null);
    } finally {
      setLoadingLink(false);
    }
  }

  async function deleteFile(asset: FioAsset) {
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}/api/frameio/assets/${asset.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setSelectedAsset(null);
        setReviewLink(null);
        setConfirmDelete(false);
        const currentFolderId = crumbs[crumbs.length - 1]?.id;
        if (currentFolderId) await loadFolder(currentFolderId);
      }
    } catch {
    } finally {
      setDeleting(false);
    }
  }

  function handleAssetClick(asset: FioAsset) {
    if (asset.type === "folder" || asset.type === "version_stack") {
      openFolder(asset);
    } else {
      selectFile(asset);
    }
  }

  const currentCrumb = crumbs[crumbs.length - 1];

  if (!configured) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3 max-w-sm">
          <Film className="w-12 h-12 text-zinc-600 mx-auto" />
          <p className="text-white font-medium">Frame.io not configured</p>
          <p className="text-zinc-400 text-sm">Add your FRAMEIO_API_TOKEN to the Replit secrets to enable this feature.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-zinc-950 overflow-hidden" style={{ fontFamily: "inherit" }}>
      {/* LEFT PANEL — browser */}
      <div className="w-72 flex-shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-950">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
          <Film className="w-4 h-4 text-[#5B53FF]" />
          <span className="text-white font-semibold text-sm tracking-wide">Frame.io</span>
          <button
            onClick={loadProjects}
            className="ml-auto text-zinc-500 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Project selector */}
        <div className="px-3 py-2 border-b border-zinc-800">
          {loadingProjects ? (
            <div className="flex items-center gap-2 text-zinc-500 text-xs py-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading projects…
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-400 text-xs py-1">
              <AlertCircle className="w-3 h-3" /> {error}
            </div>
          ) : (
            <select
              className="w-full bg-zinc-900 border border-zinc-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-[#5B53FF]"
              value={selectedProject?.id || ""}
              onChange={e => {
                const p = projects.find(x => x.id === e.target.value);
                if (p) selectProject(p);
              }}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Breadcrumb */}
        {crumbs.length > 1 && (
          <div className="px-3 py-1.5 border-b border-zinc-800 flex items-center gap-1 flex-wrap">
            {crumbs.map((crumb, i) => (
              <React.Fragment key={crumb.id}>
                {i > 0 && <ChevronRight className="w-3 h-3 text-zinc-600 flex-shrink-0" />}
                <button
                  onClick={() => navigateCrumb(i)}
                  className={`text-xs truncate max-w-[80px] ${
                    i === crumbs.length - 1
                      ? "text-white font-medium cursor-default"
                      : "text-zinc-400 hover:text-white"
                  }`}
                  title={crumb.name}
                >
                  {i === 0 ? <Home className="w-3 h-3" /> : crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Asset list */}
        <div className="flex-1 overflow-y-auto">
          {loadingAssets ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            </div>
          ) : assets.length === 0 ? (
            <div className="text-zinc-600 text-xs text-center py-8 px-4">
              {selectedProject ? "This folder is empty" : "Select a project to browse"}
            </div>
          ) : (
            <div className="py-1">
              {assets.map(asset => {
                const isSelected = selectedAsset?.id === asset.id;
                const isFolder = asset.type === "folder" || asset.type === "version_stack";
                return (
                  <button
                    key={asset.id}
                    onClick={() => handleAssetClick(asset)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors group ${
                      isSelected
                        ? "bg-[#5B53FF]/20 text-white"
                        : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    }`}
                  >
                    <AssetIcon asset={asset} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate font-medium">{asset.name}</div>
                      {!isFolder && (
                        <div className="text-[10px] text-zinc-500 flex gap-1.5">
                          {fmtSize(asset.filesize)}
                          {asset.duration ? <span>{fmtDuration(asset.duration)}</span> : null}
                        </div>
                      )}
                    </div>
                    {isFolder && (
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL — player */}
      <div className="flex-1 flex flex-col bg-black overflow-hidden">
        {selectedAsset ? (
          <>
            {/* Top bar */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 bg-zinc-950 flex-shrink-0">
              <FileVideo className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span className="text-white text-sm font-medium truncate">{selectedAsset.name}</span>
              <div className="flex items-center gap-2 text-zinc-500 text-xs ml-1">
                {selectedAsset.filesize ? <span>{fmtSize(selectedAsset.filesize)}</span> : null}
                {selectedAsset.duration ? <span>{fmtDuration(selectedAsset.duration)}</span> : null}
                {selectedAsset.filetype ? <span>{selectedAsset.filetype}</span> : null}
              </div>
              <div className="ml-auto flex items-center gap-3">
                {reviewLink && (
                  <a
                    href={reviewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in Frame.io
                  </a>
                )}
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => deleteFile(selectedAsset!)}
                      disabled={deleting}
                      className="text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      {deleting ? "Deleting…" : "Confirm Delete"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 transition-colors"
                    title="Delete this file from Frame.io"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Embed */}
            <div className="flex-1 relative">
              {loadingLink ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-7 h-7 animate-spin text-[#5B53FF]" />
                    <span className="text-zinc-500 text-sm">Loading review player…</span>
                  </div>
                </div>
              ) : reviewLink ? (
                <iframe
                  key={reviewLink}
                  src={reviewLink}
                  className="w-full h-full border-none"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <AlertCircle className="w-8 h-8 text-zinc-600" />
                  <div className="text-center">
                    <p className="text-zinc-400 text-sm font-medium">Could not load player</p>
                    <p className="text-zinc-600 text-xs mt-1">
                      The review link may not be available yet. Try opening in Frame.io directly.
                    </p>
                  </div>
                  {selectedAsset.link && (
                    <a
                      href={selectedAsset.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm" className="gap-2 border-zinc-700 text-zinc-300 hover:text-white">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open in Frame.io
                      </Button>
                    </a>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <Film className="w-14 h-14 text-zinc-800" />
            <div>
              <p className="text-zinc-500 font-medium text-sm">
                {selectedProject ? "Select a video to review" : "Choose a project to get started"}
              </p>
              <p className="text-zinc-700 text-xs mt-1">
                Browse folders on the left and click any video to open it here
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
