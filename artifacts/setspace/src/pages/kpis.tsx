import React, { useState, useEffect, useCallback } from "react";
import {
  useListUsers,
  useListTasks,
  useListQualityChecks,
  useGetCurrentUser,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Wallet,
  AlertTriangle,
  Award,
  Pencil,
  Check,
  X,
  BarChart3,
  CheckCircle2,
  XCircle,
  Star,
  RefreshCw,
} from "lucide-react";
import type { User } from "@workspace/api-client-react";

type TaskWithDerived = { assigneeId?: string | null; status?: string; completedAt?: string | null; dueDate?: string | null; completedOnTime?: boolean | null };

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

type SalaryRow = {
  user: User;
  salary: { basicSalary: number; dependabilityDeductionAmount: number; kpiDeductionAmount: number } | null;
  absences: number;
  workingDays: number;
  lateTasks: number;
  dependabilityTriggered: boolean;
  kpiTriggered: boolean;
  basicSalary: number;
  dependabilityDeduction: number;
  kpiDeduction: number;
  netSalary: number;
};

function formatPKR(n: number): string {
  return `PKR ${n.toLocaleString()}`;
}

function PercentBar({ value, threshold }: { value: number; threshold: number }) {
  const pct = Math.min(100, Math.round(value));
  return (
    <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
      <div
        className={`h-full rounded-full transition-all duration-700 ${pct >= threshold ? "bg-green-500" : "bg-red-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function KPIs() {
  const { data: users } = useListUsers();
  const { data: tasks } = useListTasks();
  const { data: qualityChecks } = useListQualityChecks();
  const { data: currentUser } = useGetCurrentUser();

  const isManager =
    (currentUser as { role?: string } | undefined)?.role === "admin" ||
    (currentUser as { role?: string } | undefined)?.role === "hr";

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [salaryData, setSalaryData] = useState<SalaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editBasic, setEditBasic] = useState("");
  const [editDep, setEditDep] = useState("");
  const [editKpi, setEditKpi] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchSalaries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/salaries?month=${month}&year=${year}`, { credentials: "include" });
      if (res.ok) setSalaryData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { fetchSalaries(); }, [fetchSalaries]);

  const openEdit = (row: SalaryRow) => {
    setEditingUserId(row.user.id);
    setEditBasic(String(row.salary?.basicSalary ?? ""));
    setEditDep(String(row.salary?.dependabilityDeductionAmount ?? ""));
    setEditKpi(String(row.salary?.kpiDeductionAmount ?? ""));
  };

  const saveEdit = async (userId: string) => {
    setSaving(true);
    try {
      await fetch(`${BASE}/api/salaries/${userId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basicSalary: parseInt(editBasic) || 0,
          dependabilityDeductionAmount: parseInt(editDep) || 0,
          kpiDeductionAmount: parseInt(editKpi) || 0,
        }),
      });
      setEditingUserId(null);
      fetchSalaries();
    } finally {
      setSaving(false);
    }
  };

  // Editor Performance — computed from tasks & quality checks (same as before)
  const editorStats = (users ?? []).map((u: User) => {
    const doneTasks = ((tasks ?? []) as TaskWithDerived[]).filter(
      t => t.assigneeId === u.id && t.status === "Done"
    );
    const totalDone = doneTasks.length;
    const hitDeadlines = doneTasks.filter(t => t.completedOnTime === true).length;
    const missedDeadlines = doneTasks.filter(t => t.completedOnTime === false).length;
    const deadlineHitRate = totalDone > 0 ? (hitDeadlines / totalDone) * 100 : null;

    const userChecks = (qualityChecks ?? []).filter(c => c.submitterId === u.id);
    const totalChecks = userChecks.length;
    const passedChecks = userChecks.filter(c => c.rating >= 4).length;
    const qualityPassRate = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : null;

    return { user: u, totalDone, hitDeadlines, missedDeadlines, deadlineHitRate, totalChecks, passedChecks, qualityPassRate };
  }).filter(s => s.totalDone > 0 || s.totalChecks > 0);

  return (
    <div className="space-y-10">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">KPI & Payroll</h1>
          <p className="text-muted-foreground mt-1">Salary breakdown with automatic deduction triggers.</p>
        </div>
        {isManager && (
          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground"
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1} className="bg-card">{m}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground"
            >
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={fetchSalaries}
              disabled={loading}
              className="p-2 rounded-lg border border-white/10 bg-black/20 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        )}
      </div>

      {/* ── Deduction rule legend ── */}
      {isManager && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
            Dependability deducted if 2+ absences in month
          </span>
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            KPI deducted if 2+ late task submissions in month
          </span>
        </div>
      )}

      {/* ── Salary cards ── */}
      {isManager && (
        loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : salaryData.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-white/10 rounded-2xl">
            <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground">No salary data yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {salaryData.map((row) => {
              const isEditing = editingUserId === row.user.id;
              return (
                <Card key={row.user.id} className="glass-panel p-5 space-y-4">
                  {/* Employee name + edit */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-600/30 border border-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-200 shrink-0">
                        {row.user.firstName?.[0]}{row.user.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">
                          {row.user.firstName} {row.user.lastName}
                        </p>
                        {row.user.title && (
                          <p className="text-xs text-muted-foreground">{row.user.title}</p>
                        )}
                      </div>
                    </div>
                    {!isEditing ? (
                      <button
                        onClick={() => openEdit(row)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg transition-colors"
                        title="Edit salary"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          onClick={() => saveEdit(row.user.id)}
                          disabled={saving}
                          className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingUserId(null)}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Salary components */}
                  <div className="space-y-2.5">
                    {/* Basic Salary */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-indigo-400" /> Basic Salary
                      </span>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editBasic}
                          onChange={e => setEditBasic(e.target.value)}
                          className="h-7 w-28 text-xs bg-black/30 border-white/15 text-right"
                          placeholder="0"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-foreground">{formatPKR(row.basicSalary)}</span>
                      )}
                    </div>

                    {/* Dependability Deduction */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs flex items-center gap-1.5 ${row.dependabilityTriggered ? "text-orange-400" : "text-muted-foreground"}`}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Dependability
                        {row.dependabilityTriggered && (
                          <span className="ml-1 text-[10px] bg-orange-500/15 border border-orange-500/25 px-1.5 py-0.5 rounded-full">
                            {row.absences} absent
                          </span>
                        )}
                      </span>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editDep}
                          onChange={e => setEditDep(e.target.value)}
                          className="h-7 w-28 text-xs bg-black/30 border-white/15 text-right"
                          placeholder="0"
                        />
                      ) : (
                        <span className={`text-sm font-semibold ${row.dependabilityTriggered ? "text-orange-400" : "text-muted-foreground"}`}>
                          {row.dependabilityTriggered ? `− ${formatPKR(row.dependabilityDeduction)}` : "— not triggered"}
                        </span>
                      )}
                    </div>

                    {/* KPI Deduction */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs flex items-center gap-1.5 ${row.kpiTriggered ? "text-red-400" : "text-muted-foreground"}`}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        KPI Payment
                        {row.kpiTriggered && (
                          <span className="ml-1 text-[10px] bg-red-500/15 border border-red-500/25 px-1.5 py-0.5 rounded-full">
                            {row.lateTasks} late
                          </span>
                        )}
                      </span>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editKpi}
                          onChange={e => setEditKpi(e.target.value)}
                          className="h-7 w-28 text-xs bg-black/30 border-white/15 text-right"
                          placeholder="0"
                        />
                      ) : (
                        <span className={`text-sm font-semibold ${row.kpiTriggered ? "text-red-400" : "text-muted-foreground"}`}>
                          {row.kpiTriggered ? `− ${formatPKR(row.kpiDeduction)}` : "— not triggered"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Net total */}
                  <div className={`flex items-center justify-between pt-3 border-t ${row.dependabilityTriggered || row.kpiTriggered ? "border-red-500/20" : "border-white/10"}`}>
                    <span className="text-sm font-bold text-foreground">Net Salary</span>
                    <span className={`text-lg font-display font-bold ${row.dependabilityTriggered || row.kpiTriggered ? "text-red-400" : "text-green-400"}`}>
                      {formatPKR(row.netSalary)}
                    </span>
                  </div>

                  {/* Status badge */}
                  <div className={`text-xs font-medium px-3 py-2 rounded-xl border text-center ${
                    !row.dependabilityTriggered && !row.kpiTriggered
                      ? "bg-green-500/8 border-green-500/20 text-green-300"
                      : "bg-red-500/8 border-red-500/20 text-red-300"
                  }`}>
                    {!row.dependabilityTriggered && !row.kpiTriggered
                      ? <span className="flex items-center justify-center gap-1.5"><Award className="w-3.5 h-3.5" /> Full salary — no deductions</span>
                      : <span className="flex items-center justify-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Deductions applied this month</span>
                    }
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* ── Editor Performance Section (for all users) ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-indigo-400" />
          <h2 className="text-xl font-display font-bold text-foreground">Editor Performance</h2>
          <span className="text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded-full border border-white/10">
            Auto-computed from tasks &amp; quality checks
          </span>
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />Deadline goal: ≥ 90% on time
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />Quality goal: ≥ 80% rated 4+ stars
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
            {editorStats.map(({ user, totalDone, hitDeadlines, missedDeadlines, deadlineHitRate, totalChecks, passedChecks, qualityPassRate }) => {
              const bonusDeducted = missedDeadlines >= 2;
              const meetsDeadlineGoal = deadlineHitRate !== null && deadlineHitRate >= 90;
              const meetsQualityGoal = qualityPassRate !== null && qualityPassRate >= 80;
              return (
                <Card key={user.id} className="glass-panel p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-600/30 border border-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-300 shrink-0">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{user.firstName} {user.lastName}</p>
                        {user.title && <p className="text-xs text-muted-foreground">{user.title}</p>}
                      </div>
                    </div>
                    {bonusDeducted ? (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> KPI Deducted
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
                        <Award className="w-3 h-3" /> Bonus Eligible
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Deadline Rate</span>
                      <span className="font-semibold text-foreground">
                        {deadlineHitRate !== null ? `${Math.round(deadlineHitRate)}%` : "—"}
                        <span className="text-muted-foreground font-normal"> ({hitDeadlines}/{totalDone})</span>
                      </span>
                    </div>
                    {deadlineHitRate !== null && <PercentBar value={deadlineHitRate} threshold={90} />}
                    {missedDeadlines > 0 && (
                      <p className="text-[11px] text-red-400 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />{missedDeadlines} missed{missedDeadlines >= 2 ? " — KPI deducted" : ""}
                      </p>
                    )}
                  </div>

                  {totalChecks > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1"><Star className="w-3.5 h-3.5" /> Quality Rate</span>
                        <span className="font-semibold text-foreground">
                          {qualityPassRate !== null ? `${Math.round(qualityPassRate)}%` : "—"}
                          <span className="text-muted-foreground font-normal"> ({passedChecks}/{totalChecks})</span>
                        </span>
                      </div>
                      {qualityPassRate !== null && <PercentBar value={qualityPassRate} threshold={80} />}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
