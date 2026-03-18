import React, { useState } from "react";
import { useListQualityChecks, useCreateQualityCheck, useListTasks, useListUsers, getListQualityChecksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Star, Plus, CheckCircle } from "lucide-react";

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

  const createMut = useCreateQualityCheck({
    mutation: {
      onSuccess: () => {
        setIsCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getListQualityChecksQueryKey() });
      }
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({ data: { submitterId, taskId: taskId ? Number(taskId) : undefined, rating, feedback, status: rating >= 4 ? "Passed" : "Needs Revision" }});
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
            <Button className="bg-primary text-white rounded-xl shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" /> New Evaluation
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-panel">
            <DialogHeader>
              <DialogTitle>Evaluate Submission</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <select required value={submitterId} onChange={e => setSubmitterId(e.target.value)} className="w-full p-2 bg-black/20 border border-white/10 rounded-lg text-sm text-foreground">
                <option value="">Select Employee...</option>
                {users?.map(u => <option key={u.id} value={u.id} className="bg-card">{u.firstName} {u.lastName}</option>)}
              </select>
              <select value={taskId} onChange={e => setTaskId(e.target.value)} className="w-full p-2 bg-black/20 border border-white/10 rounded-lg text-sm text-foreground">
                <option value="">Select Task (Optional)...</option>
                {tasks?.map(t => <option key={t.id} value={t.id} className="bg-card">{t.title}</option>)}
              </select>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Rating (1-5)</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(r => (
                    <button type="button" key={r} onClick={() => setRating(r)} className={`p-2 rounded-lg transition-all ${rating >= r ? 'text-yellow-400' : 'text-white/20'}`}>
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                </div>
              </div>
              <textarea 
                value={feedback} onChange={e => setFeedback(e.target.value)} 
                className="w-full h-24 p-3 bg-black/20 border border-white/10 rounded-lg text-sm resize-none"
                placeholder="Constructive feedback..."
              />
              <Button type="submit" disabled={createMut.isPending} className="w-full bg-primary text-white font-semibold">Submit Evaluation</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {checks?.map(check => (
          <Card key={check.id} className="glass-panel p-6 hover:border-primary/30 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white shadow-lg">
                  {check.submitter?.firstName?.[0] || 'U'}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{check.submitter?.firstName} {check.submitter?.lastName}</h3>
                  <p className="text-xs text-muted-foreground">Evaluated by {check.reviewer?.firstName}</p>
                </div>
              </div>
              <div className="flex text-yellow-400">
                {[...Array(check.rating)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
              </div>
            </div>
            
            <div className="bg-black/20 p-4 rounded-xl border border-white/5 mb-4">
              <p className="text-sm italic text-muted-foreground">"{check.feedback || 'No written feedback provided.'}"</p>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                check.status === 'Passed' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {check.status}
              </span>
              <span className="text-xs text-muted-foreground">{new Date(check.createdAt).toLocaleDateString()}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
