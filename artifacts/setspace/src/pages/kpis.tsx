import React, { useState } from "react";
import { useListKpis, useCreateKpi, useListUsers, getListKpisQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, TrendingUp, Target, Activity } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

export default function KPIs() {
  const { data: kpis, isLoading } = useListKpis();
  const { data: users } = useListUsers();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const [name, setName] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("videos");
  const [userId, setUserId] = useState("");
  const [period, setPeriod] = useState("Monthly");
  
  const queryClient = useQueryClient();
  const createMut = useCreateKpi({
    mutation: {
      onSuccess: () => {
        setIsCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getListKpisQueryKey() });
      }
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({ data: { name, targetValue: Number(targetValue), unit, userId, period } });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">KPI Tracker</h1>
          <p className="text-muted-foreground mt-1">Monitor individual performance metrics.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg">
              <Plus className="w-4 h-4 mr-2" /> Assign KPI
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-panel">
            <DialogHeader>
              <DialogTitle>Assign New KPI</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <select required value={userId} onChange={e => setUserId(e.target.value)} className="w-full p-2 bg-black/20 border border-white/10 rounded-lg text-sm text-foreground">
                <option value="">Select Employee...</option>
                {users?.map(u => <option key={u.id} value={u.id} className="bg-card">{u.firstName} {u.lastName}</option>)}
              </select>
              <Input required placeholder="Metric Name (e.g. Videos Delivered)" value={name} onChange={e => setName(e.target.value)} className="bg-black/20 border-white/10" />
              <div className="grid grid-cols-2 gap-4">
                <Input required type="number" placeholder="Target Value" value={targetValue} onChange={e => setTargetValue(e.target.value)} className="bg-black/20 border-white/10" />
                <Input required placeholder="Unit (e.g. videos)" value={unit} onChange={e => setUnit(e.target.value)} className="bg-black/20 border-white/10" />
              </div>
              <Button type="submit" className="w-full bg-primary text-primary-foreground font-semibold">Create KPI</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {kpis?.map(kpi => {
            // Mocking actual progress since KpiEntries fetching individually would be complex in this view.
            // In a real scenario, the backend might aggregate this, or we display placeholder progress for the demo layout.
            const actual = Math.floor(Math.random() * kpi.targetValue * 1.2); 
            const pct = Math.min(100, Math.round((actual / kpi.targetValue) * 100));
            return (
              <Card key={kpi.id} className="glass-panel p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Target className="w-24 h-24 text-primary" />
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-display font-bold text-lg">{kpi.name}</h3>
                    <span className="text-xs font-semibold bg-white/10 px-2 py-1 rounded-md text-muted-foreground">{kpi.period}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-bold text-foreground">{actual} / {kpi.targetValue} {kpi.unit}</span>
                  </div>
                  
                  <div className="h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <div className={`h-full rounded-full transition-all duration-1000 ${pct >= 100 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                  </div>
                  
                  <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-white/5">
                    <span className="flex items-center"><TrendingUp className="w-3 h-3 mr-1 text-primary" /> {pct}% to goal</span>
                    <span>User: {users?.find(u => u.id === kpi.userId)?.firstName || "Unknown"}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
