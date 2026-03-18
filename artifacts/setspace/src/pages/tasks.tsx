import React, { useState } from "react";
import { useListTasks, useCreateTask, useUpdateTask, getListTasksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, LayoutGrid, List as ListIcon, Clock } from "lucide-react";

export default function Tasks() {
  const { data: tasks, isLoading } = useListTasks();
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  
  const queryClient = useQueryClient();
  const createMut = useCreateTask({
    mutation: {
      onSuccess: () => {
        setIsCreateOpen(false);
        setTitle("");
        setDescription("");
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      }
    }
  });

  const updateMut = useUpdateTask({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() })
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({ data: { title, description, priority, status: "To Do" } });
  };

  const columns = ["To Do", "In Progress", "Review", "Done"];

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
              className={`p-2 rounded-md transition-colors ${viewMode === "board" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-md transition-colors ${viewMode === "list" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
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
                  <Input required value={title} onChange={e => setTitle(e.target.value)} className="bg-black/20 border-white/10 focus:border-primary" placeholder="Video Edit - Project X" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Description</label>
                  <textarea 
                    value={description} onChange={e => setDescription(e.target.value)} 
                    className="w-full h-24 rounded-md bg-black/20 border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary p-3 text-sm resize-none"
                    placeholder="Details..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Priority</label>
                  <select 
                    value={priority} onChange={e => setPriority(e.target.value)}
                    className="w-full h-10 rounded-md bg-black/20 border border-white/10 text-sm px-3 focus:outline-none focus:border-primary text-foreground"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <Button type="submit" disabled={createMut.isPending} className="w-full rounded-xl mt-2 font-semibold">
                  {createMut.isPending ? "Creating..." : "Create Task"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : viewMode === "board" ? (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-x-auto pb-4">
          {columns.map(col => (
            <div key={col} className="flex flex-col bg-black/10 rounded-2xl p-4 border border-white/5 h-full">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="font-semibold text-foreground">{col}</h3>
                <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-muted-foreground font-medium">
                  {tasks?.filter(t => t.status === col).length || 0}
                </span>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto">
                {tasks?.filter(t => t.status === col).map(task => (
                  <Card key={task.id} className="p-4 bg-card border-white/5 hover:border-primary/40 transition-colors shadow-md cursor-grab active:cursor-grabbing">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm ${
                        task.priority === 'High' ? 'bg-red-500/20 text-red-400' : 
                        task.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 
                        'bg-blue-500/20 text-blue-400'
                      }`}>{task.priority}</span>
                      <select 
                        className="bg-transparent text-xs text-muted-foreground outline-none cursor-pointer"
                        value={task.status}
                        onChange={(e) => updateMut.mutate({ taskId: task.id, data: { status: e.target.value } })}
                      >
                        {columns.map(c => <option key={c} value={c} className="bg-card">{c}</option>)}
                      </select>
                    </div>
                    <h4 className="font-medium text-foreground leading-snug">{task.title}</h4>
                    {task.dueDate && (
                      <div className="flex items-center text-xs text-muted-foreground mt-3 pt-3 border-t border-white/5">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="glass-panel overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-black/20 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 font-medium">Title</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Priority</th>
                <th className="px-6 py-4 font-medium">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {tasks?.map(task => (
                <tr key={task.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{task.title}</td>
                  <td className="px-6 py-4">
                    <select 
                      className="bg-transparent text-sm text-muted-foreground outline-none cursor-pointer p-1 rounded hover:bg-white/10"
                      value={task.status}
                      onChange={(e) => updateMut.mutate({ taskId: task.id, data: { status: e.target.value } })}
                    >
                      {columns.map(c => <option key={c} value={c} className="bg-card">{c}</option>)}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-sm ${
                      task.priority === 'High' ? 'bg-red-500/20 text-red-400' : 
                      task.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 
                      'bg-blue-500/20 text-blue-400'
                    }`}>{task.priority}</span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
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
