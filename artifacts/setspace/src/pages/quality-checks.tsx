import React, { useState } from "react";
import { useListQualityChecks, useCreateQualityCheck, useListTasks, useListUsers, getListQualityChecksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Star, Plus, RefreshCw } from "lucide-react";

export default function QualityChecks() {
  const { data: checks, isLoading } = useListQualityChecks();
  const { data: tasks } = useListTasks();
  const { data: users } = useListUsers();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitterId, setSubmitterId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [revisionCount, setRevisionCount] = useState(0);

  const createMut = useCreateQualityCheck({
    mutation: {
      onSuccess: () => {
        setIsCreateOpen(false);
        setSubmitterId("");
        setTaskId("");
        setRating(5);
        setFeedback("");
        setRevisionCount(0);
        queryClient.invalidateQueries({ queryKey: getListQualityChecksQueryKey() });
      }
    }
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
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Quality Checks</h1>
          <p className="text-muted-foreground mt-1">Review internal submissions and maintain standards.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground rounded-xl shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" /> New Evaluation
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-panel">
            <DialogHeader>
              <DialogTitle>Evaluate Submission</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Employee</label>
                <select required value={submitterId} onChange={e => setSubmitterId(e.target.value)} className="w-full p-2 bg-black/20 border border-white/10 rounded-lg text-sm text-foreground">
                  <option value="">Select Employee...</option>
                  {users?.map(u => <option key={u.id} value={u.id} className="bg-card">{u.firstName} {u.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Linked Task (Optional)</label>
                <select value={taskId} onChange={e => setTaskId(e.target.value)} className="w-full p-2 bg-black/20 border border-white/10 rounded-lg text-sm text-foreground">
                  <option value="">No linked task</option>
                  {tasks?.map(t => <option key={t.id} value={t.id} className="bg-card">{t.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Rating</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(r => (
                    <button type="button" key={r} onClick={() => setRating(r)} className={`p-2 rounded-lg transition-all ${rating >= r ? 'text-yellow-400' : 'text-white/20'}`}>
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Number of Revisions Requested</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setRevisionCount(c => Math.max(0, c - 1))}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-foreground font-bold transition-colors flex items-center justify-center"
                  >−</button>
                  <span className="text-lg font-bold text-foreground w-8 text-center">{revisionCount}</span>
                  <button
                    type="button"
                    onClick={() => setRevisionCount(c => c + 1)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-foreground font-bold transition-colors flex items-center justify-center"
                  >+</button>
                  <span className="text-xs text-muted-foreground ml-1">rounds of revisions needed</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Feedback</label>
                <textarea
                  value={feedback} onChange={e => setFeedback(e.target.value)}
                  className="w-full h-24 p-3 bg-black/20 border border-white/10 rounded-lg text-sm resize-none"
                  placeholder="Constructive feedback..."
                />
              </div>
              <Button type="submit" disabled={createMut.isPending} className="w-full bg-primary text-primary-foreground font-semibold">
                {createMut.isPending ? "Submitting..." : "Submit Evaluation"}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {checks?.map(check => (
            <Card key={check.id} className="glass-panel p-6 hover:border-primary/30 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-primary-foreground shadow-lg">
                    {check.submitter?.firstName?.[0] || 'U'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{check.submitter?.firstName} {check.submitter?.lastName}</h3>
                    <p className="text-xs text-muted-foreground">Evaluated by {check.reviewer?.firstName}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex text-yellow-400">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className={`w-4 h-4 ${i <= check.rating ? "fill-current" : "opacity-20"}`} />
                    ))}
                  </div>
                  {(check.revisionCount ?? 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs text-orange-400 font-medium">
                      <RefreshCw className="w-3 h-3" />
                      {check.revisionCount} revision{(check.revisionCount ?? 0) > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>

              {check.feedback && (
                <div className="bg-black/20 p-4 rounded-xl border border-white/5 mb-4">
                  <p className="text-sm italic text-muted-foreground">"{check.feedback}"</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                  check.status === 'Passed' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                }`}>
                  {check.status}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(check.createdAt).toLocaleDateString()}</span>
              </div>
            </Card>
          ))}
          {checks?.length === 0 && (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-white/10 rounded-2xl">
              <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-display font-bold mb-1">No evaluations yet</h3>
              <p className="text-muted-foreground text-sm">Submit your first quality check to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
