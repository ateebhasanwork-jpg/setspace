import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Folder,
  FolderOpen,
  FileVideo,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Loader2,
  RefreshCw,
  Film,
  Home,
  AlertCircle,
  Trash2,
  Upload,
  FolderPlus,
  Settings,
  X,
  Check,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetCurrentUser } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

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
  _children?: FioAsset[];
  _expanded?: boolean;
  _loading?: boolean;
}

interface Status {
  configured: boolean;
  rootAssetId: string | null;
  rootAssetName: string | null;
}

function fmtSize(b?: number) {
  if (!b) return "";
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}
function fmtDur(s?: number) {
  if (!s) return "";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/* ── Setup screen ──────────────────────────────────────────────── */
function SetupScreen({ onSave, isAdmin }: { onSave: (id: string, name: string) => void; isAdmin: boolean }) {
  const [assetId, setAssetId] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const id = assetId.trim();
    if (!id) { setError("Paste a Frame.io asset ID first."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/frameio/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootAssetId: id, rootAssetName: name.trim() || "My Projects" }),
        credentials: "include",
      });
      if (!res.ok) { setError("Could not save. Check the asset ID."); return; }
      onSave(id, name.trim() || "My Projects");
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#111] text-white p-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <Film className="w-8 h-8 text-[#5B53FF]" />
          <span className="text-2xl font-bold tracking-tight">Frame.io Studio</span>
        </div>

        {!isAdmin ? (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 text-center space-y-3">
            <Settings className="w-10 h-10 text-zinc-500 mx-auto" />
            <p className="text-zinc-300 font-medium">Not configured yet</p>
            <p className="text-zinc-500 text-sm">Ask your admin to connect Frame.io to get started.</p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 space-y-5">
            <div>
              <h2 className="font-semibold text-lg mb-1">Connect your Frame.io project</h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Open your Frame.io project, copy the UUID from the URL:
                <br />
                <code className="text-[#5B53FF] text-xs bg-black/40 px-2 py-0.5 rounded mt-1 inline-block">
                  app.frame.io/projects/<strong>YOUR-ASSET-ID</strong>/files
                </code>
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide block mb-1.5">Root Asset ID</label>
              <Input
                value={assetId}
                onChange={e => setAssetId(e.target.value)}
                placeholder="e.g. 3f2504e0-4f89-11d3-9a0c-0305e82c3301"
                className="bg-black border-zinc-700 text-white font-mono text-sm focus:border-[#5B53FF] focus-visible:ring-[#5B53FF]"
                onKeyDown={e => e.key === "Enter" && save()}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide block mb-1.5">Display name (optional)</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="My Projects"
                className="bg-black border-zinc-700 text-white text-sm focus:border-[#5B53FF] focus-visible:ring-[#5B53FF]"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button
              onClick={save}
              disabled={saving || !assetId.trim()}
              className="w-full bg-[#5B53FF] hover:bg-[#4a43e8] text-white font-semibold"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Connecting…</> : "Connect Frame.io"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Tree node ────────────────────────────────────────────────── */
function TreeNode({
  asset,
  depth,
  selected,
  onSelect,
  onToggle,
  loading,
}: {
  asset: FioAsset;
  depth: number;
  selected: string | null;
  onSelect: (a: FioAsset) => void;
  onToggle: (a: FioAsset) => void;
  loading: boolean;
}) {
  const isFolder = asset.type === "folder" || asset.type === "version_stack";
  const isSelected = selected === asset.id;

  return (
    <div>
      <button
        onClick={() => isFolder ? onToggle(asset) : onSelect(asset)}
        className={`w-full flex items-center gap-1.5 px-2 py-[5px] text-left text-xs rounded transition-colors group
          ${isSelected ? "bg-[#5B53FF]/20 text-white" : "text-zinc-300 hover:bg-zinc-800 hover:text-white"}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {isFolder ? (
          <>
            <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0 text-zinc-500">
              {asset._loading ? <Loader2 className="w-3 h-3 animate-spin" /> :
               asset._expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
            {asset._expanded
              ? <FolderOpen className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
              : <Folder className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
          </>
        ) : (
          <>
            <span className="w-3.5 h-3.5 shrink-0" />
            {asset.thumb_url
              ? <img src={asset.thumb_url} className="w-5 h-3.5 object-cover rounded shrink-0 bg-zinc-800" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} alt="" />
              : <FileVideo className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
          </>
        )}
        <span className="truncate flex-1">{asset.name}</span>
        {!isFolder && asset.filesize ? <span className="text-zinc-600 text-[10px] shrink-0">{fmtSize(asset.filesize)}</span> : null}
      </button>
      {isFolder && asset._expanded && (
        <div>
          {(asset._children ?? []).map(child => (
            <TreeNode key={child.id} asset={child} depth={depth + 1} selected={selected} onSelect={onSelect} onToggle={onToggle} loading={loading} />
          ))}
          {asset._expanded && !asset._loading && (asset._children ?? []).length === 0 && (
            <div className="text-zinc-600 text-[10px] py-1" style={{ paddingLeft: `${22 + (depth + 1) * 14}px` }}>Empty folder</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────── */
export default function VideoStudio() {
  const { data: user } = useGetCurrentUser();
  const isAdmin = (user as { role?: string } | undefined)?.role === "admin" || (user as { role?: string } | undefined)?.role === "hr";

  const [status, setStatus] = useState<Status | null>(null);
  const [rootId, setRootId] = useState<string | null>(null);
  const [rootName, setRootName] = useState("Frame.io");
  const [tree, setTree] = useState<FioAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<FioAsset | null>(null);
  const [reviewLink, setReviewLink] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);
  const [loadingRoot, setLoadingRoot] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploadingTo, setUploadingTo] = useState<string | null>(null); // folderId
  const [uploadProgress, setUploadProgress] = useState("");
  const [newFolderFor, setNewFolderFor] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  /* fetch status on mount */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BASE}/api/frameio/status`, { credentials: "include" });
        if (!res.ok) return;
        const s = await res.json() as Status;
        setStatus(s);
        if (s.configured && s.rootAssetId) {
          setRootId(s.rootAssetId);
          setRootName(s.rootAssetName || "Frame.io");
        }
      } catch {}
    })();
  }, []);

  /* load children of an asset */
  const loadChildren = useCallback(async (assetId: string): Promise<FioAsset[]> => {
    try {
      const res = await fetch(`${BASE}/api/frameio/assets/${assetId}/children`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json() as FioAsset[];
      return data.sort((a, b) => {
        if (a.type === "folder" && b.type !== "folder") return -1;
        if (a.type !== "folder" && b.type === "folder") return 1;
        return a.name.localeCompare(b.name);
      });
    } catch { return []; }
  }, []);

  /* load root */
  useEffect(() => {
    if (!rootId) return;
    setLoadingRoot(true);
    loadChildren(rootId).then(children => {
      setTree(children.map(c => ({ ...c, _expanded: false, _children: undefined })));
      setLoadingRoot(false);
    });
  }, [rootId, loadChildren]);

  /* toggle folder expand */
  const toggleFolder = useCallback(async (target: FioAsset) => {
    const expand = !target._expanded;

    const updateNode = (nodes: FioAsset[], id: string, patch: Partial<FioAsset>): FioAsset[] =>
      nodes.map(n => {
        if (n.id === id) return { ...n, ...patch };
        if (n._children) return { ...n, _children: updateNode(n._children, id, patch) };
        return n;
      });

    if (expand && !target._children) {
      setTree(t => updateNode(t, target.id, { _expanded: true, _loading: true }));
      const children = await loadChildren(target.id);
      setTree(t => updateNode(t, target.id, { _loading: false, _children: children.map(c => ({ ...c, _expanded: false })) }));
    } else {
      setTree(t => updateNode(t, target.id, { _expanded: expand }));
    }
  }, [loadChildren]);

  /* select file */
  const selectFile = useCallback(async (asset: FioAsset) => {
    setSelectedAsset(asset);
    setReviewLink(null);
    setConfirmDelete(false);
    setLoadingLink(true);
    try {
      const res = await fetch(`${BASE}/api/frameio/assets/${asset.id}/review-link`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json() as { link: string };
        setReviewLink(d.link);
      }
    } catch {} finally {
      setLoadingLink(false);
    }
  }, []);

  /* delete selected file */
  const deleteFile = async () => {
    if (!selectedAsset) return;
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}/api/frameio/assets/${selectedAsset.id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setSelectedAsset(null);
        setReviewLink(null);
        setConfirmDelete(false);
        if (rootId) {
          const children = await loadChildren(rootId);
          setTree(children.map(c => ({ ...c, _expanded: false })));
        }
      }
    } catch {} finally {
      setDeleting(false);
    }
  };

  /* upload file to a folder */
  const uploadFile = async (file: File, folderId: string) => {
    setUploadingTo(folderId);
    setUploadProgress("Uploading…");
    try {
      const res = await fetch(`${BASE}/api/frameio/assets/${folderId}/upload`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
        body: file,
        credentials: "include",
      });
      if (res.ok) {
        setUploadProgress("Done!");
        setTimeout(() => { setUploadingTo(null); setUploadProgress(""); }, 1500);
        // Refresh the folder in the tree
        refreshFolderInTree(folderId);
      } else {
        setUploadProgress("Upload failed.");
        setTimeout(() => { setUploadingTo(null); setUploadProgress(""); }, 2000);
      }
    } catch {
      setUploadProgress("Error.");
      setTimeout(() => { setUploadingTo(null); setUploadProgress(""); }, 2000);
    }
  };

  /* create folder */
  const createNewFolder = async (parentId: string) => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const res = await fetch(`${BASE}/api/frameio/assets/${parentId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim() }),
        credentials: "include",
      });
      if (res.ok) {
        setNewFolderFor(null);
        setNewFolderName("");
        refreshFolderInTree(parentId);
      }
    } catch {} finally {
      setCreatingFolder(false);
    }
  };

  /* refresh a specific folder's children in the tree */
  const refreshFolderInTree = useCallback(async (folderId: string) => {
    if (folderId === rootId) {
      const children = await loadChildren(rootId!);
      setTree(children.map(c => ({ ...c, _expanded: false })));
      return;
    }
    const children = await loadChildren(folderId);
    const update = (nodes: FioAsset[]): FioAsset[] =>
      nodes.map(n => {
        if (n.id === folderId) return { ...n, _children: children.map(c => ({ ...c, _expanded: false })) };
        if (n._children) return { ...n, _children: update(n._children) };
        return n;
      });
    setTree(t => update(t));
  }, [rootId, loadChildren]);

  /* ── Render ──────────────────────────────────────────────────── */
  if (!status) {
    return (
      <div className="flex items-center justify-center h-full bg-[#111]">
        <Loader2 className="w-7 h-7 animate-spin text-[#5B53FF]" />
      </div>
    );
  }

  if (!status.configured) {
    return (
      <div className="flex items-center justify-center h-full bg-[#111]">
        <div className="text-center text-zinc-500 space-y-3">
          <Film className="w-10 h-10 mx-auto text-zinc-700" />
          <p className="text-white font-medium">Frame.io not configured</p>
          <p className="text-sm">Add your FRAMEIO_API_TOKEN to Replit secrets.</p>
        </div>
      </div>
    );
  }

  if (!rootId || showSettings) {
    return (
      <div className="h-full bg-[#111]">
        {showSettings && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800">
            <button onClick={() => setShowSettings(false)} className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>
        )}
        <SetupScreen
          isAdmin={isAdmin ?? false}
          onSave={(id, name) => {
            setRootId(id);
            setRootName(name);
            setShowSettings(false);
          }}
        />
      </div>
    );
  }

  /* current folder = the folder containing the selected asset (or root) */
  const currentFolderId = rootId;

  return (
    <div className="flex h-full bg-[#111] overflow-hidden text-white" style={{ fontFamily: "inherit" }}>
      {/* Hidden file input for uploads */}
      <input
        ref={uploadRef}
        type="file"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f && uploadingTo) uploadFile(f, uploadingTo);
          e.target.value = "";
        }}
      />

      {/* ── LEFT: File tree ───────────────────────────────── */}
      <div className="w-64 flex-shrink-0 border-r border-zinc-800 flex flex-col bg-[#111] min-h-0">
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-zinc-800 flex items-center gap-2">
          <Film className="w-4 h-4 text-[#5B53FF] shrink-0" />
          <span className="text-sm font-semibold truncate flex-1">{rootName}</span>
          <div className="flex items-center gap-1">
            <button
              title="New folder at root"
              onClick={() => { setNewFolderFor(rootId); setNewFolderName(""); }}
              className="p-1 text-zinc-500 hover:text-white rounded transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            <button
              title="Upload to root"
              onClick={() => { setUploadingTo(rootId); setTimeout(() => uploadRef.current?.click(), 50); }}
              className="p-1 text-zinc-500 hover:text-white rounded transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            <button
              title="Refresh"
              onClick={() => rootId && loadChildren(rootId).then(c => setTree(c.map(x => ({ ...x, _expanded: false }))))}
              className="p-1 text-zinc-500 hover:text-white rounded transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {isAdmin && (
              <button
                title="Change root project"
                onClick={() => setShowSettings(true)}
                className="p-1 text-zinc-500 hover:text-white rounded transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* New folder at root prompt */}
        {newFolderFor === rootId && (
          <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2">
            <FolderPlus className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <input
              autoFocus
              className="flex-1 bg-transparent border-b border-[#5B53FF] text-white text-xs outline-none py-0.5"
              placeholder="Folder name"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") createNewFolder(rootId!); if (e.key === "Escape") setNewFolderFor(null); }}
            />
            <button onClick={() => createNewFolder(rootId!)} disabled={creatingFolder} className="text-[#5B53FF] hover:text-white">
              {creatingFolder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setNewFolderFor(null)} className="text-zinc-500 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Upload status */}
        {uploadProgress && (
          <div className="px-3 py-1.5 bg-[#5B53FF]/10 border-b border-[#5B53FF]/20 text-xs text-[#5B53FF]">
            {uploadProgress}
          </div>
        )}

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-1">
          {loadingRoot ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            </div>
          ) : tree.length === 0 ? (
            <div className="text-zinc-600 text-xs text-center py-8 px-4">
              This project is empty.<br />Upload a file to get started.
            </div>
          ) : (
            tree.map(asset => (
              <TreeNode
                key={asset.id}
                asset={asset}
                depth={0}
                selected={selectedAsset?.id ?? null}
                onSelect={selectFile}
                onToggle={toggleFolder}
                loading={false}
              />
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT: Player ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-black overflow-hidden min-w-0">
        {selectedAsset ? (
          <>
            {/* Top bar */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 bg-zinc-950 shrink-0">
              <FileVideo className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-white text-sm font-medium truncate">{selectedAsset.name}</span>
              <div className="flex items-center gap-2 text-zinc-500 text-xs ml-1">
                {selectedAsset.filesize ? <span>{fmtSize(selectedAsset.filesize)}</span> : null}
                {selectedAsset.duration ? <span>{fmtDur(selectedAsset.duration)}</span> : null}
                {selectedAsset.filetype ? <span className="uppercase">{selectedAsset.filetype}</span> : null}
              </div>
              <div className="ml-auto flex items-center gap-3">
                {reviewLink && (
                  <a href={reviewLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> Open in Frame.io
                  </a>
                )}
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <button onClick={deleteFile} disabled={deleting}
                      className="text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded flex items-center gap-1.5 disabled:opacity-50">
                      {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      {deleting ? "Deleting…" : "Confirm"}
                    </button>
                    <button onClick={() => setConfirmDelete(false)} className="text-xs text-zinc-400 hover:text-white">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
              </div>
            </div>

            {/* Embed */}
            <div className="flex-1 relative overflow-hidden">
              {loadingLink ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#5B53FF]" />
                  <span className="text-zinc-500 text-sm">Loading review player…</span>
                </div>
              ) : reviewLink ? (
                <iframe
                  key={reviewLink}
                  src={reviewLink}
                  className="absolute inset-0 w-full h-full border-none"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <AlertCircle className="w-8 h-8 text-zinc-600" />
                  <div className="text-center">
                    <p className="text-zinc-400 text-sm font-medium">Player unavailable</p>
                    <p className="text-zinc-600 text-xs mt-1">The review link couldn't be generated.</p>
                  </div>
                  {selectedAsset.link && (
                    <a href={selectedAsset.link} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-2 border-zinc-700 text-zinc-300 hover:text-white">
                        <ExternalLink className="w-3.5 h-3.5" /> Open in Frame.io
                      </Button>
                    </a>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty state — show upload prompt */
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-8">
            <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Film className="w-10 h-10 text-zinc-700" />
            </div>
            <div>
              <p className="text-zinc-300 font-semibold text-lg">Select a video to review</p>
              <p className="text-zinc-600 text-sm mt-1">Click any file in the tree on the left, or upload one now</p>
            </div>
            <label className="flex items-center gap-2 px-5 py-2.5 bg-[#5B53FF] hover:bg-[#4a43e8] text-white text-sm font-medium rounded-lg cursor-pointer transition-colors">
              <Upload className="w-4 h-4" /> Upload to Frame.io
              <input type="file" className="hidden" onChange={async e => {
                const f = e.target.files?.[0];
                if (f && rootId) await uploadFile(f, rootId);
                e.target.value = "";
              }} />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
