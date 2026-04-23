import React, { useState } from "react";
import {
  useListQualityChecks,
  useCreateQualityCheck,
  useListTasks,
  useListUsers,
  useGetCurrentUser,
  getListQualityChecksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Star, Plus, RefreshCw, Trash2, Link2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const MONTHS = [
  "All Time",
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export default function QualityChecks() {
  const { data: checks, isLoading, isFetching } = useListQualityChecks();
  const { data: tasks } = useListTasks();
  const { data: users } = useListUsers();
  const { data: currentUser } = useGetCurrentUser();
  const queryClient = useQueryClient();

  const isManager =
    (currentUser as { role?: string } | undefined)?.role === "admin" ||
    (currentUser as { role?: string } | undefined)?.role === "hr";

  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitterId, setSubmitterId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [revisionCount, setRevisionCount] = useState(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListQualityChecksQueryKey() });

  const createMut = useCreateQualityCheck({
    mutation: {
      onSuccess: () => {
        setIsCreateOpen(false);
        setSubmitterId("");
        setTaskId("");
        setRating(5);
        setFeedback("");
        setRevisionCount(0);
        invalidate();
      },
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({
      data: {
        submitterId,
        taskId: taskId ? Number(taskId) : undefined,
        rating,
        feedback,
        status: rating >= 4 ? "Passed" : "Needs Revision",
        revisionCount,
      },
    });
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`${BASE}/api/quality-checks/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      invalidate();
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // Filter + sort: newest first, then apply month filter
  const sortedChecks = checks
    ? [...checks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  const filteredChecks = filterMonth === 0
    ? sortedChecks
    : sortedChecks.filter(c => {
        const d = new Date(c.createdAt);
        return d.getFullYear() === filterYear && d.getMonth() + 1 === filterMonth;
      });

  const taskMap = React.useMemo(() => {
    const m: Record<number, string> = {};
    for (const t of tasks ?? []) m[t.id] = t.title;
    return m;
  }, [tasks]);

  // Only show tasks that haven't been evaluated yet in the New Evaluation dialog
  const evaluatedTaskIds = React.useMemo(() => {
    const ids = new Set<number>();
    for (const c of checks ?? []) {
      if (c.taskId != null) ids.add(c.taskId);
    }
    return ids;
  }, [checks]);

  const unevaluatedTasks = React.useMemo(
    () =>
      (tasks ?? []).filter((t) => {
        if (evaluatedTaskIds.has(t.id)) return false;
        if ((t as { status?: string }).status !== "Done") return false;
        if (submitterId && (t as { assigneeId?: string | null }).assigneeId !== submitterId) return false;
        return true;
      }),
    [tasks, evaluatedTaskIds, submitterId]
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Quality Checks</h1>
          <p className="text-muted-foreground mt-1">
            Review internal submissions and maintain standards.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: getListQualityChecksQueryKey() })}
            disabled={isFetching}
            className="p-2 rounded-lg border border-white/10 bg-black/20 hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${isFetching ? "animate-spin" : ""}`} />
          </button>
          {isManager && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                <Plus className="w-4 h-4 mr-2" /> New Evaluation
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel">
              <DialogHeader>
                <DialogTitle>Evaluate Submission</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Employee
                  </label>
                  <select
                    required
                    value={submitterId}
                    onChange={(e) => { setSubmitterId(e.target.value); setTaskId(""); }}
                    className="w-full p-2 bg-black/20 border border-white/10 rounded-lg text-sm text-foreground"
                  >
                    <option value="">Select Employee...</option>
                    {users?.map((u) => (
                      <option key={u.id} value={u.id} className="bg-card">
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Linked Task (Optional)
                  </label>
                  <select
                    value={taskId}
                    onChange={(e) => setTaskId(e.target.value)}
                    className="w-full p-2 bg-black/20 border border-white/10 rounded-lg text-sm text-foreground"
                  >
                    <option value="">No linked task</option>
                    {unevaluatedTasks.map((t) => (
                      <option key={t.id} value={t.id} className="bg-card">
                        {t.title}
                      </option>
                    ))}
                    {unevaluatedTasks.length === 0 && (
                      <option disabled value="" className="bg-card text-muted-foreground">
                        {submitterId
                          ? "No completed, unevaluated tasks for this employee"
                          : "Select an employee to see their tasks"}
                      </option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((r) => (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setRating(r)}
                        className={`p-2 rounded-lg transition-all ${rating >= r ? "text-yellow-400" : "text-white/20"}`}
                      >
                        <Star className="w-6 h-6 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Number of Revisions Requested
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setRevisionCount((c) => Math.max(0, c - 1))}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-foreground font-bold transition-colors flex items-center justify-center"
                    >
                      −
                    </button>
                    <span className="text-lg font-bold text-foreground w-8 text-center">
                      {revisionCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRevisionCount((c) => c + 1)}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-foreground font-bold transition-colors flex items-center justify-center"
                    >
                      +
                    </button>
                    <span className="text-xs text-muted-foreground ml-1">rounds of revisions</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Feedback
                  </label>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="w-full h-24 p-3 bg-black/20 border border-white/10 rounded-lg text-sm resize-none"
                    placeholder="Constructive feedback..."
                  />
                </div>
                <Button
                  type="submit"
                  disabled={createMut.isPending}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  {createMut.isPending ? "Submitting..." : "Submit Evaluation"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      {/* Month filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Filter:</span>
        <button
          onClick={() => setFilterMonth(0)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filterMonth === 0 ? "bg-indigo-600 text-white border-indigo-500" : "bg-black/20 border-white/10 text-muted-foreground hover:text-foreground"}`}
        >
          All Time
        </button>
        {MONTHS.slice(1).map((m, i) => (
          <button
            key={i + 1}
            onClick={() => setFilterMonth(i + 1)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filterMonth === i + 1 ? "bg-indigo-600 text-white border-indigo-500" : "bg-black/20 border-white/10 text-muted-foreground hover:text-foreground"}`}
          >
            {m.slice(0, 3)}
          </button>
        ))}
        <select
          value={filterYear}
          onChange={e => setFilterYear(Number(e.target.value))}
          className="text-xs bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-foreground"
        >
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredChecks.map((check) => {
            const linkedTask = check.taskId ? taskMap[check.taskId] : null;
            return (
              <Card
                key={check.id}
                className="glass-panel p-6 hover:border-indigo-500/30 transition-colors relative"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600/30 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-200 shadow-lg">
                      {check.submitter?.firstName?.[0] || "U"}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {check.submitter?.firstName} {check.submitter?.lastName}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Evaluated by {check.reviewer?.firstName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex text-yellow-400">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${i <= check.rating ? "fill-current" : "opacity-20"}`}
                          />
                        ))}
                      </div>
                      {(check.revisionCount ?? 0) > 0 && (
                        <div className="flex items-center gap-1 text-xs text-orange-400 font-medium">
                          <RefreshCw className="w-3 h-3" />
                          {check.revisionCount} revision
                          {(check.revisionCount ?? 0) > 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                    {isManager && (
                      confirmDeleteId === check.id ? (
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => handleDelete(check.id)}
                            disabled={deletingId === check.id}
                            className="text-[11px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20 transition-colors disabled:opacity-50"
                          >
                            {deletingId === check.id ? "…" : "Confirm"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg border border-white/10 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(check.id)}
                          className="ml-2 p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                          title="Delete evaluation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Linked task */}
                {linkedTask && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-indigo-500/8 border border-indigo-500/20 rounded-lg">
                    <Link2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="text-xs font-medium text-indigo-300 truncate">{linkedTask}</span>
                  </div>
                )}

                {check.feedback && (
                  <div className="bg-black/20 p-4 rounded-xl border border-white/5 mb-4">
                    <p className="text-sm italic text-muted-foreground">"{check.feedback}"</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <span
                    className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                      check.status === "Passed"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-orange-500/20 text-orange-400"
                    }`}
                  >
                    {check.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(check.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </Card>
            );
          })}
          {filteredChecks.length === 0 && (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-white/10 rounded-2xl">
              <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-display font-bold mb-1">No evaluations found</h3>
              <p className="text-muted-foreground text-sm">
                {filterMonth !== 0 ? "Try changing the month filter or select 'All Time'." : "Submit your first quality check to get started."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
