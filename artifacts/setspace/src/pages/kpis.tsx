import React, { useState } from "react";
import {
  useListKpis,
  useCreateKpi,
  useListUsers,
  useListKpiEntries,
  useListTasks,
  useListQualityChecks,
  getListKpisQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Plus,
  TrendingUp,
  Target,
  CheckCircle2,
  XCircle,
  Star,
  AlertTriangle,
  Award,
  BarChart3,
} from "lucide-react";
import type { Task, User } from "@workspace/api-client-react";

type TaskWithDerived = Task & { completedOnTime?: boolean | null };

function PercentBar({
  value,
  threshold,
  className = "",
}: {
  value: number;
  threshold: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.round(value));
  const good = pct >= threshold;
  return (
    <div className={`h-2 bg-black/40 rounded-full overflow-hidden border border-white/5 ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ${
          good ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function KPIs() {
  const { data: kpis, isLoading } = useListKpis();
  const { data: users } = useListUsers();
  const { data: kpiEntries } = useListKpiEntries();
  const { data: tasks } = useListTasks();
  const { data: qualityChecks } = useListQualityChecks();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [name, setName] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("videos");
  const [userId, setUserId] = useState("");

  const queryClient = useQueryClient();
  const createMut = useCreateKpi({
    mutation: {
      onSuccess: () => {
        setIsCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getListKpisQueryKey() });
      },
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({ data: { name, targetValue: Number(targetValue), unit, userId, period: "Monthly" } });
  };

  const actualByKpi = (kpiEntries ?? []).reduce<Record<number, number>>((acc, entry) => {
    acc[entry.kpiId] = (acc[entry.kpiId] ?? 0) + entry.actualValue;
    return acc;
  }, {});

  // ── Editor Performance computation ──────────────────────────────
  const editorStats = (users ?? []).map((u: User) => {
    const doneTasks = (tasks as TaskWithDerived[] | undefined ?? []).filter(
      (t) => t.assigneeId === u.id && t.status === "Done"
    );
    const totalDone = doneTasks.length;
    const hitDeadlines = doneTasks.filter((t) => t.completedOnTime === true).length;
    const missedDeadlines = doneTasks.filter((t) => t.completedOnTime === false).length;
    const deadlineHitRate = totalDone > 0 ? (hitDeadlines / totalDone) * 100 : null;

    const userChecks = (qualityChecks ?? []).filter(
      (c) => c.submitterId === u.id
    );
    const totalChecks = userChecks.length;
    const passedChecks = userChecks.filter((c) => c.rating >= 4).length;
    const qualityPassRate = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : null;

    const bonusDeducted = missedDeadlines >= 2;
    const meetsQualityGoal =
      qualityPassRate !== null && qualityPassRate >= 80;
    const meetsDeadlineGoal =
      deadlineHitRate !== null && deadlineHitRate >= 90;

    return {
      user: u,
      totalDone,
      hitDeadlines,
      missedDeadlines,
      deadlineHitRate,
      totalChecks,
      passedChecks,
      qualityPassRate,
      bonusDeducted,
      meetsQualityGoal,
      meetsDeadlineGoal,
    };
  }).filter((s) => s.totalDone > 0 || s.totalChecks > 0);

  return (
    <div className="space-y-8">
      {/* Header */}
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
              <select
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full p-2 bg-black/20 border border-white/10 rounded-lg text-sm text-foreground"
              >
                <option value="">Select Employee...</option>
                {users?.map((u) => (
                  <option key={u.id} value={u.id} className="bg-card">
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </select>
              <Input
                required
                placeholder="Metric Name (e.g. Videos Delivered)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-black/20 border-white/10"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  required
                  type="number"
                  placeholder="Target Value"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  className="bg-black/20 border-white/10"
                />
                <Input
                  required
                  placeholder="Unit (e.g. videos)"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="bg-black/20 border-white/10"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground font-semibold"
              >
                Create KPI
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Manual KPI cards */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : kpis && kpis.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {kpis.map((kpi) => {
            const actual = actualByKpi[kpi.id] ?? 0;
            const pct =
              kpi.targetValue > 0
                ? Math.min(100, Math.round((actual / kpi.targetValue) * 100))
                : 0;
            return (
              <Card key={kpi.id} className="glass-panel p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Target className="w-24 h-24 text-primary" />
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-display font-bold text-lg">{kpi.name}</h3>
                    <span className="text-xs font-semibold bg-white/10 px-2 py-1 rounded-md text-muted-foreground">
                      {kpi.period}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-bold text-foreground">
                      {actual} / {kpi.targetValue} {kpi.unit}
                    </span>
                  </div>
                  <div className="h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        pct >= 100
                          ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                          : "bg-primary"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-white/5">
                    <span className="flex items-center">
                      <TrendingUp className="w-3 h-3 mr-1 text-primary" /> {pct}% to goal
                    </span>
                    <span>
                      {users?.find((u) => u.id === kpi.userId)?.firstName ?? "Unknown"}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* ── Editor Performance Section ─────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-indigo-400" />
          <h2 className="text-xl font-display font-bold text-foreground">Editor Performance</h2>
          <span className="text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded-full border border-white/10">
            Auto-computed from tasks &amp; quality checks
          </span>
        </div>

        {/* Goal thresholds legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            Deadline goal: ≥ 90% on time
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            Quality goal: ≥ 80% rated 4+ stars
          </span>
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
            Bonus deducted if 2+ deadlines missed
          </span>
        </div>

        {editorStats.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-white/10 rounded-2xl">
            <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm">
              Performance data will appear once tasks are completed and evaluations are submitted.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {editorStats.map(
              ({
                user,
                totalDone,
                hitDeadlines,
                missedDeadlines,
                deadlineHitRate,
                totalChecks,
                passedChecks,
                qualityPassRate,
                bonusDeducted,
                meetsQualityGoal,
                meetsDeadlineGoal,
              }) => (
                <Card key={user.id} className="glass-panel p-5 space-y-4">
                  {/* Name + bonus status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-600/30 border border-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-300 shrink-0">
                        {user.firstName?.[0]}
                        {user.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">
                          {user.firstName} {user.lastName}
                        </p>
                        {user.title && (
                          <p className="text-xs text-muted-foreground">{user.title}</p>
                        )}
                      </div>
                    </div>
                    {bonusDeducted ? (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> Bonus Deducted
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
                        <Award className="w-3 h-3" /> Bonus Eligible
                      </span>
                    )}
                  </div>

                  {/* Deadline performance */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Deadline Rate
                      </span>
                      <span className="font-semibold text-foreground">
                        {deadlineHitRate !== null
                          ? `${Math.round(deadlineHitRate)}%`
                          : "—"}{" "}
                        <span className="text-muted-foreground font-normal">
                          ({hitDeadlines}/{totalDone} tasks)
                        </span>
                      </span>
                    </div>
                    {deadlineHitRate !== null && (
                      <PercentBar value={deadlineHitRate} threshold={90} />
                    )}
                    {missedDeadlines > 0 && (
                      <p className="text-[11px] text-red-400 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        {missedDeadlines} missed deadline{missedDeadlines > 1 ? "s" : ""}
                        {missedDeadlines >= 2 && " — bonus deducted"}
                      </p>
                    )}
                    {deadlineHitRate !== null && (
                      <p className={`text-[11px] ${meetsDeadlineGoal ? "text-green-400" : "text-yellow-400"}`}>
                        {meetsDeadlineGoal ? "✓ Meets 90% deadline goal" : "✗ Below 90% deadline goal"}
                      </p>
                    )}
                  </div>

                  {/* Quality performance */}
                  {totalChecks > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Star className="w-3.5 h-3.5" /> Quality Pass Rate
                        </span>
                        <span className="font-semibold text-foreground">
                          {qualityPassRate !== null
                            ? `${Math.round(qualityPassRate)}%`
                            : "—"}{" "}
                          <span className="text-muted-foreground font-normal">
                            ({passedChecks}/{totalChecks} evals)
                          </span>
                        </span>
                      </div>
                      {qualityPassRate !== null && (
                        <PercentBar value={qualityPassRate} threshold={80} />
                      )}
                      {qualityPassRate !== null && (
                        <p className={`text-[11px] ${meetsQualityGoal ? "text-green-400" : "text-yellow-400"}`}>
                          {meetsQualityGoal
                            ? "✓ Meets 80% quality goal"
                            : "✗ Below 80% quality goal"}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Overall verdict */}
                  <div
                    className={`text-xs font-medium px-3 py-2 rounded-xl border ${
                      !bonusDeducted && meetsDeadlineGoal && meetsQualityGoal
                        ? "bg-green-500/8 border-green-500/20 text-green-300"
                        : bonusDeducted
                        ? "bg-red-500/8 border-red-500/20 text-red-300"
                        : "bg-yellow-500/8 border-yellow-500/20 text-yellow-300"
                    }`}
                  >
                    {!bonusDeducted && meetsDeadlineGoal && (totalChecks === 0 || meetsQualityGoal)
                      ? "On track — all KPI goals met"
                      : bonusDeducted
                      ? `KPI Bonus deducted — ${missedDeadlines} missed deadline${missedDeadlines > 1 ? "s" : ""}`
                      : "Needs improvement — some goals not met"}
                  </div>
                </Card>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
