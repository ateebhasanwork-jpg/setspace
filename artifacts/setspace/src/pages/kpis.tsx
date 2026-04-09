import React, { useState, useEffect, useCallback } from "react";
import {
  useGetCurrentUser,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Wallet,
  AlertTriangle,
  Award,
  Pencil,
  Check,
  X,
  RefreshCw,
  Clock3,
  TrendingDown,
  UserCheck,
} from "lucide-react";
import type { User } from "@workspace/api-client-react";

const PAYROLL_USERNAMES = ["ateebhasanwork", "laiba"];

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

type SalaryRow = {
  user: User;
  salary: { basicSalary: number; overtimePayment: number; dependabilityDeductionAmount: number; kpiDeductionAmount: number } | null;
  absences: number;
  workingDays: number;
  lateTasks: number;
  dependabilityTriggered: boolean;
  kpiTriggered: boolean;
  basicSalary: number;
  overtimePayment: number;
  dependabilityDeduction: number;
  kpiDeduction: number;
  netSalary: number;
};

function formatPKR(n: number): string {
  return `PKR ${n.toLocaleString()}`;
}

export default function KPIs() {
  const { data: currentUser } = useGetCurrentUser();

  const username = (currentUser as { username?: string } | undefined)?.username ?? "";
  const isAdminOrHR =
    (currentUser as { role?: string } | undefined)?.role === "admin" ||
    (currentUser as { role?: string } | undefined)?.role === "hr";
  const canSeePayroll = PAYROLL_USERNAMES.includes(username);

  const now = new Date();
  const [activeTab, setActiveTab] = useState<"payroll" | "deductions">(canSeePayroll ? "payroll" : "deductions");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [salaryData, setSalaryData] = useState<SalaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editBasic, setEditBasic] = useState("");
  const [editOvertime, setEditOvertime] = useState("");
  const [editDep, setEditDep] = useState("");
  const [editKpi, setEditKpi] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchSalaries = useCallback(async () => {
    if (!isAdminOrHR) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/salaries?month=${month}&year=${year}`, { credentials: "include" });
      if (res.ok) setSalaryData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [month, year, isAdminOrHR]);

  useEffect(() => { fetchSalaries(); }, [fetchSalaries]);

  const openEdit = (row: SalaryRow) => {
    setEditingUserId(row.user.id);
    setEditBasic(String(row.salary?.basicSalary ?? ""));
    setEditOvertime(String(row.salary?.overtimePayment ?? ""));
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
          overtimePayment: parseInt(editOvertime) || 0,
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

  if (!isAdminOrHR) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <TrendingDown className="w-10 h-10 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground text-sm">No data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">KPI & Payroll</h1>
          <p className="text-muted-foreground mt-1">Salary breakdown and deduction tracking.</p>
        </div>
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
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-black/20 border border-white/10 rounded-xl w-fit">
        {canSeePayroll && (
          <button
            onClick={() => setActiveTab("payroll")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "payroll"
                ? "bg-indigo-600 text-white shadow"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <span className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Payroll</span>
          </button>
        )}
        <button
          onClick={() => setActiveTab("deductions")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "deductions"
              ? "bg-indigo-600 text-white shadow"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          }`}
        >
          <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Deductions</span>
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── Payroll Tab ── */}
      {!loading && activeTab === "payroll" && canSeePayroll && (
        <>
          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
              Dependability deducted if 2+ absences in month
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              KPI deducted if 2+ late deliveries in month
            </span>
          </div>

          {salaryData.length === 0 ? (
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
                    {/* Employee header */}
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

                    {/* Salary rows */}
                    <div className="space-y-2.5">
                      {/* Basic Salary */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Wallet className="w-3.5 h-3.5 text-indigo-400" /> Basic Salary
                        </span>
                        {isEditing ? (
                          <Input type="number" value={editBasic} onChange={e => setEditBasic(e.target.value)}
                            className="h-7 w-28 text-xs bg-black/30 border-white/15 text-right" placeholder="0" />
                        ) : (
                          <span className="text-sm font-semibold text-foreground">{formatPKR(row.basicSalary)}</span>
                        )}
                      </div>

                      {/* Overtime */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Clock3 className="w-3.5 h-3.5 text-teal-400" /> Overtime
                        </span>
                        {isEditing ? (
                          <Input type="number" value={editOvertime} onChange={e => setEditOvertime(e.target.value)}
                            className="h-7 w-28 text-xs bg-black/30 border-white/15 text-right" placeholder="0" />
                        ) : (
                          <span className={`text-sm font-semibold ${row.overtimePayment > 0 ? "text-teal-400" : "text-muted-foreground"}`}>
                            {row.overtimePayment > 0 ? `+ ${formatPKR(row.overtimePayment)}` : "—"}
                          </span>
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
                          <Input type="number" value={editDep} onChange={e => setEditDep(e.target.value)}
                            className="h-7 w-28 text-xs bg-black/30 border-white/15 text-right" placeholder="0" />
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
                          <Input type="number" value={editKpi} onChange={e => setEditKpi(e.target.value)}
                            className="h-7 w-28 text-xs bg-black/30 border-white/15 text-right" placeholder="0" />
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
          )}
        </>
      )}

      {/* ── Deductions Tab ── */}
      {!loading && activeTab === "deductions" && (
        <>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
              Dependability triggered at 2+ absences
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              KPI triggered at 2+ late deliveries
            </span>
          </div>

          {salaryData.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-white/10 rounded-2xl">
              <UserCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground text-sm">No data for this period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="pb-3 pr-4 text-xs text-muted-foreground font-medium">Employee</th>
                    <th className="pb-3 px-4 text-xs text-muted-foreground font-medium text-center">Absences</th>
                    <th className="pb-3 px-4 text-xs text-muted-foreground font-medium text-center">Dependability</th>
                    <th className="pb-3 px-4 text-xs text-muted-foreground font-medium text-center">Late Deliveries</th>
                    <th className="pb-3 pl-4 text-xs text-muted-foreground font-medium text-center">KPI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {salaryData.map(row => (
                    <tr key={row.user.id} className="group hover:bg-white/2 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-600/25 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-200 shrink-0">
                            {row.user.firstName?.[0]}{row.user.lastName?.[0]}
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-sm">{row.user.firstName} {row.user.lastName}</p>
                            {row.user.title && <p className="text-xs text-muted-foreground">{row.user.title}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Absences count */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold ${
                          row.absences >= 2
                            ? "bg-orange-500/15 border border-orange-500/25 text-orange-300"
                            : "bg-white/5 border border-white/10 text-muted-foreground"
                        }`}>
                          {row.absences}
                        </span>
                      </td>

                      {/* Dependability status */}
                      <td className="py-3 px-4 text-center">
                        {row.dependabilityTriggered ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> Triggered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-white/4 border border-white/8 px-2.5 py-1 rounded-full">
                            <Check className="w-3 h-3 text-green-500" /> Clear
                          </span>
                        )}
                      </td>

                      {/* Late deliveries count */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold ${
                          row.lateTasks >= 2
                            ? "bg-red-500/15 border border-red-500/25 text-red-300"
                            : "bg-white/5 border border-white/10 text-muted-foreground"
                        }`}>
                          {row.lateTasks}
                        </span>
                      </td>

                      {/* KPI status */}
                      <td className="py-3 pl-4 text-center">
                        {row.kpiTriggered ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> Triggered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-white/4 border border-white/8 px-2.5 py-1 rounded-full">
                            <Check className="w-3 h-3 text-green-500" /> Clear
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
