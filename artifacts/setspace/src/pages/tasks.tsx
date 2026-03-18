import React, { useState, useRef } from "react";
import {
  useListTasks,
  useListUsers,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import type { Task, User } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, LayoutGrid, List as ListIcon, Clock, CheckCircle2, XCircle, Pencil, Trash2, Paperclip, Link2, X, Upload } from "lucide-react";

type TaskWithDerived = Task & { completedOnTime?: boolean | null };

const COLUMNS = ["To Do", "In Progress", "Review", "Done"] as const;
type Column = typeof COLUMNS[number];

const PRIORITY_STYLES: Record<string, string> = {
  High: "bg-red-500/20 text-red-400",
  Medium: "bg-yellow-500/20 text-yellow-400",
  Low: "bg-blue-500/20 text-blue-400",
};

const COL_ACCENT: Record<Column, string> = {
  "To Do": "border-white/10",
  "In Progress": "border-blue-500/30",
  "Review": "border-yellow-500/30",
  "Done": "border-green-500/30",
};

const COL_HEADER: Record<Column, string> = {
  "To Do": "text-white/60",
  "In Progress": "text-blue-400",
  "Review": "text-yellow-400",
  "Done": "text-green-400",
};

function AssigneeAvatar({ user }: { user: User | null | undefined }) {
  if (!user) return null;
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <div
      className="w-6 h-6 rounded-full bg-primary/30 text-primary flex items-center justify-center text-[10px] font-bold shrink-0"
      title={`${user.firstName} ${user.lastName}`}
    >
      {initials}
    </div>
  );
}

function OnTimeBadge({ task }: { task: TaskWithDerived }) {
  if (task.status !== "Done") return null;
  if (task.completedOnTime === null || task.completedOnTime === undefined) return null;
  return task.completedOnTime ? (
    <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="w-3 h-3" /> On Time
    </span>
  ) : (
    <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
      <XCircle className="w-3 h-3" /> Late
    </span>
  );
}

export default function Tasks() {
  const { data: tasks, isLoading } = useListTasks({ query: { refetchInterval: 2000 } });
  const { data: users } = useListUsers();
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [editingTask, setEditingTask] = useState<TaskWithDerived | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("Medium");
  const [editStatus, setEditStatus] = useState("To Do");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editExternalLink, setEditExternalLink] = useState("");
  const [editAttachmentUrl, setEditAttachmentUrl] = useState("");
  const [editAttachmentName, setEditAttachmentName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Create form extra fields
  const [externalLink, setExternalLink] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [uploading, setUploading] = useState(false);

  // Drag state
  const [dragOverCol, setDragOverCol] = useState<Column | null>(null);
  const draggingTaskId = useRef<number | null>(null);

  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

  async function uploadFile(file: File): Promise<{ url: string; name: string } | null> {
    setUploading(true);
    try {
      const res = await fetch(`${BASE}/api/storage/upload`, {
        method: "POST",
        headers: { "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name) },
        body: file,
        credentials: "include",
      });
      if (!res.ok) return null;
      const data = await res.json() as { objectPath: string };
      return { url: data.objectPath, name: file.name };
    } catch {
      return null;
    } finally {
      setUploading(false);
    }
  }

  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });

  const createMut = useCreateTask({
    mutation: {
      onSuccess: () => {
        setIsCreateOpen(false);
        setTitle(""); setDescription(""); setPriority("Medium"); setAssigneeId(""); setDueDate("");
        invalidate();
      },
    },
  });

  const updateMut = useUpdateTask({
    mutation: { onSuccess: () => invalidate() },
  });

  const editMut = useUpdateTask({
    mutation: {
      onSuccess: () => {
        setEditingTask(null);
        setConfirmDelete(false);
        invalidate();
      },
    },
  });

  const deleteMut = useDeleteTask({
    mutation: {
      onSuccess: () => {
        setEditingTask(null);
        setConfirmDelete(false);
        invalidate();
      },
    },
  });

  function openEdit(task: TaskWithDerived) {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditPriority(task.priority ?? "Medium");
    setEditStatus(task.status ?? "To Do");
    setEditAssigneeId(task.assigneeId ?? "");
    setEditDueDate(task.dueDate ? task.dueDate.split("T")[0] : "");
    setEditExternalLink((task as Task & { externalLink?: string }).externalLink ?? "");
    setEditAttachmentUrl((task as Task & { attachmentUrl?: string }).attachmentUrl ?? "");
    setEditAttachmentName((task as Task & { attachmentName?: string }).attachmentName ?? "");
    setConfirmDelete(false);
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({
      data: {
        title,
        description: description || undefined,
        priority,
        status: "To Do",
        assigneeId: assigneeId || null,
        dueDate: dueDate || null,
        externalLink: externalLink || undefined,
        attachmentUrl: attachmentUrl || undefined,
        attachmentName: attachmentName || undefined,
      } as Parameters<typeof createMut.mutate>[0]["data"],
    });
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    editMut.mutate({
      taskId: editingTask.id,
      data: {
        title: editTitle,
        description: editDescription || undefined,
        priority: editPriority,
        status: editStatus,
        assigneeId: editAssigneeId || null,
        dueDate: editDueDate || null,
        externalLink: editExternalLink || undefined,
        attachmentUrl: editAttachmentUrl || undefined,
        attachmentName: editAttachmentName || undefined,
      } as Parameters<typeof editMut.mutate>[0]["data"],
    });
  };

  // ── Drag & Drop handlers (optimistic updates for smooth feel) ──
  function onDragStart(e: React.DragEvent, taskId: number) {
    draggingTaskId.current = taskId;
    e.dataTransfer.effectAllowed = "move";
    (e.currentTarget as HTMLElement).style.opacity = "0.4";
  }

  function onDragEnter(e: React.DragEvent, col: Column) {
    e.preventDefault();
    setDragOverCol(col);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDragLeave(e: React.DragEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { clientX, clientY } = e;
    if (
      clientX <= rect.left || clientX >= rect.right ||
      clientY <= rect.top || clientY >= rect.bottom
    ) {
      setDragOverCol(null);
    }
  }

  function onDrop(e: React.DragEvent, col: Column) {
    e.preventDefault();
    setDragOverCol(null);
    const id = draggingTaskId.current;
    if (id === null) return;
    const task = (tasks as TaskWithDerived[] | undefined)?.find(t => t.id === id);
    if (!task || task.status === col) { draggingTaskId.current = null; return; }

    // Optimistic update — card moves immediately
    queryClient.setQueryData(getListTasksQueryKey(), (old: TaskWithDerived[] | undefined) =>
      old?.map(t => t.id === id ? { ...t, status: col } : t)
    );

    updateMut.mutate(
      { taskId: id, data: { status: col } },
      { onError: () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }) }
    );
    draggingTaskId.current = null;
  }

  function onDragEnd(e: React.DragEvent) {
    (e.currentTarget as HTMLElement).style.opacity = "";
    setDragOverCol(null);
    draggingTaskId.current = null;
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Task Management</h1>
          <p className="text-muted-foreground mt-1">Track deliverables and assignments.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-black/20 p-1 rounded-lg border border-white/5">
            <button
              onClick={() => setViewMode("board")}
              className={`p-2 rounded-md transition-colors ${viewMode === "board" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-md transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 rounded-xl font-semibold px-6">
                <Plus className="w-4 h-4 mr-2" /> New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-white/10 sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-2xl font-display">Create Task</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Title</label>
                  <Input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-black/20 border-white/10 focus:border-primary"
                    placeholder="Video Edit – Project X"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full h-24 rounded-md bg-black/20 border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary p-3 text-sm resize-none"
                    placeholder="Details..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full h-10 rounded-md bg-black/20 border border-white/10 text-sm px-3 focus:outline-none focus:border-primary text-foreground"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Due Date</label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="bg-black/20 border-white/10 focus:border-primary text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Assign To</label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full h-10 rounded-md bg-black/20 border border-white/10 text-sm px-3 focus:outline-none focus:border-primary text-foreground"
                  >
                    <option value="">— Unassigned —</option>
                    {users?.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                        {u.title ? ` (${u.title})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" /> External Link
                  </label>
                  <Input
                    type="url"
                    value={externalLink}
                    onChange={e => setExternalLink(e.target.value)}
                    className="bg-black/20 border-white/10 focus:border-primary text-sm"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5" /> Attachment
                  </label>
                  {attachmentUrl ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-black/20 border border-white/10 rounded-md text-sm">
                      <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate flex-1 text-foreground">{attachmentName}</span>
                      <button type="button" onClick={() => { setAttachmentUrl(""); setAttachmentName(""); }} className="text-muted-foreground hover:text-red-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className={`flex items-center gap-2 px-3 py-2 border border-dashed border-white/20 rounded-md cursor-pointer hover:border-primary/50 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                      {uploading ? <><div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" /><span className="text-sm text-muted-foreground">Uploading…</span></> : <><Upload className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-sm text-muted-foreground">Click to upload file</span></>}
                      <input type="file" className="hidden" onChange={async e => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const result = await uploadFile(f);
                        if (result) { setAttachmentUrl(result.url); setAttachmentName(result.name); }
                      }} />
                    </label>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={createMut.isPending || uploading}
                  className="w-full rounded-xl mt-2 font-semibold"
                >
                  {createMut.isPending ? "Creating..." : "Create Task"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Edit Task Dialog ── */}
      <Dialog open={!!editingTask} onOpenChange={(open) => { if (!open) { setEditingTask(null); setConfirmDelete(false); } }}>
        <DialogContent className="glass-panel border-white/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display">Edit Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Title</label>
              <Input
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-black/20 border-white/10 focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full h-20 rounded-md bg-black/20 border border-white/10 focus:border-primary p-3 text-sm resize-none"
                placeholder="Details..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full h-10 rounded-md bg-black/20 border border-white/10 text-sm px-3 focus:outline-none focus:border-primary text-foreground"
                >
                  {COLUMNS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Priority</label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  className="w-full h-10 rounded-md bg-black/20 border border-white/10 text-sm px-3 focus:outline-none focus:border-primary text-foreground"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Due Date</label>
                <Input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="bg-black/20 border-white/10 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Assign To</label>
                <select
                  value={editAssigneeId}
                  onChange={(e) => setEditAssigneeId(e.target.value)}
                  className="w-full h-10 rounded-md bg-black/20 border border-white/10 text-sm px-3 focus:outline-none focus:border-primary text-foreground"
                >
                  <option value="">— Unassigned —</option>
                  {users?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" /> External Link
              </label>
              <Input
                type="url"
                value={editExternalLink}
                onChange={e => setEditExternalLink(e.target.value)}
                className="bg-black/20 border-white/10 focus:border-primary text-sm"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" /> Attachment
              </label>
              {editAttachmentUrl ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-black/20 border border-white/10 rounded-md text-sm">
                  <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate flex-1 text-foreground">{editAttachmentName}</span>
                  <button type="button" onClick={() => { setEditAttachmentUrl(""); setEditAttachmentName(""); }} className="text-muted-foreground hover:text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className={`flex items-center gap-2 px-3 py-2 border border-dashed border-white/20 rounded-md cursor-pointer hover:border-primary/50 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                  {uploading ? <><div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" /><span className="text-sm text-muted-foreground">Uploading…</span></> : <><Upload className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-sm text-muted-foreground">Click to upload file</span></>}
                  <input type="file" className="hidden" onChange={async e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const result = await uploadFile(f);
                    if (result) { setEditAttachmentUrl(result.url); setEditAttachmentName(result.name); }
                  }} />
                </label>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={editMut.isPending || uploading} className="flex-1 rounded-xl font-semibold">
                {editMut.isPending ? "Saving..." : "Save Changes"}
              </Button>
              {confirmDelete ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deleteMut.isPending}
                    onClick={() => editingTask && deleteMut.mutate({ taskId: editingTask.id })}
                    className="rounded-xl font-semibold"
                  >
                    {deleteMut.isPending ? "Deleting..." : "Confirm Delete"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)} className="rounded-xl">
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : viewMode === "board" ? (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const colTasks = (tasks as TaskWithDerived[] | undefined)?.filter((t) => t.status === col) ?? [];
            const isOver = dragOverCol === col;
            return (
              <div
                key={col}
                className={`flex flex-col rounded-2xl p-4 border transition-colors h-full ${
                  isOver
                    ? "bg-white/8 border-primary/50 ring-1 ring-primary/30"
                    : `bg-black/10 ${COL_ACCENT[col]}`
                }`}
                onDragEnter={(e) => onDragEnter(e, col)}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, col)}
              >
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className={`font-semibold ${COL_HEADER[col]}`}>{col}</h3>
                  <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-muted-foreground font-medium">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto min-h-[60px]">
                  {colTasks.map((task) => (
                    <Card
                      key={task.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, task.id)}
                      onDragEnd={onDragEnd}
                      className="p-4 bg-card border-white/5 hover:border-primary/40 transition-colors shadow-md group cursor-grab active:cursor-grabbing active:opacity-60 active:scale-95"
                      onClick={() => openEdit(task)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span
                          className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm ${PRIORITY_STYLES[task.priority] ?? "bg-white/10 text-muted-foreground"}`}
                        >
                          {task.priority}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(task); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10 text-muted-foreground"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                      <h4 className="font-medium text-foreground leading-snug mb-2">{task.title}</h4>
                      {((task as Task & { externalLink?: string }).externalLink || (task as Task & { attachmentUrl?: string }).attachmentUrl) && (
                        <div className="flex items-center gap-2 mt-2">
                          {(task as Task & { externalLink?: string }).externalLink && (
                            <a href={(task as Task & { externalLink?: string }).externalLink!} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full">
                              <Link2 className="w-2.5 h-2.5" /> Link
                            </a>
                          )}
                          {(task as Task & { attachmentUrl?: string }).attachmentUrl && (
                            <span className="flex items-center gap-1 text-[10px] text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full">
                              <Paperclip className="w-2.5 h-2.5" /> {(task as Task & { attachmentName?: string }).attachmentName || "File"}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                        <div className="flex items-center gap-2">
                          <AssigneeAvatar user={task.assignee} />
                          {task.assignee && (
                            <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                              {task.assignee.firstName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <OnTimeBadge task={task} />
                          {task.dueDate && task.status !== "Done" && (
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Clock className="w-3 h-3 mr-1" />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                  {isOver && colTasks.length === 0 && (
                    <div className="h-16 rounded-xl border-2 border-dashed border-primary/40 flex items-center justify-center">
                      <span className="text-xs text-primary/60">Drop here</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="glass-panel overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-black/20 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 font-medium">Title</th>
                <th className="px-6 py-4 font-medium">Assignee</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Priority</th>
                <th className="px-6 py-4 font-medium">Due Date</th>
                <th className="px-6 py-4 font-medium">On Time</th>
                <th className="px-6 py-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(tasks as TaskWithDerived[] | undefined)?.map((task) => (
                <tr key={task.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 font-medium text-foreground">{task.title}</td>
                  <td className="px-6 py-4">
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <AssigneeAvatar user={task.assignee} />
                        <span className="text-sm text-foreground">
                          {task.assignee.firstName} {task.assignee.lastName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      className="bg-transparent text-sm text-muted-foreground outline-none cursor-pointer p-1 rounded hover:bg-white/10"
                      value={task.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateMut.mutate({ taskId: task.id, data: { status: e.target.value } })
                      }
                    >
                      {COLUMNS.map((c) => (
                        <option key={c} value={c} className="bg-card">
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-sm ${PRIORITY_STYLES[task.priority] ?? "bg-white/10 text-muted-foreground"}`}
                    >
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <OnTimeBadge task={task} />
                    {task.status !== "Done" && <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => openEdit(task)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
