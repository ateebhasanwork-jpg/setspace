import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useGetCurrentUser,
  useListTasks,
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
  XCircle,
  CalendarDays,
  SlidersHorizontal,
  Trash2,
  Building2,
  Briefcase,
} from "lucide-react";
import type { User } from "@workspace/api-client-react";


const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

type SalaryConfig = {
  basicSalary: number;
  overtimePayment: number;
  dependabilityDeductionAmount: number;
  kpiDeductionAmount: number;
  workingDaysOverride: number | null;
  kpiThreshold: number;
  dependabilityThreshold: number;
} | null;

type SalaryRow = {
  user: User;
  salary: SalaryConfig;
  absences: number;
  workingDays: number;
  kpiThreshold: number;
  dependabilityThreshold: number;
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

type AttendanceRec = { date: string };
type TaskItem = { id: number; title: string; assigneeId: string | null; status: string; completedAt: string | null; dueDate: string | null };

function PersonalPerformanceView({ userId, firstName, month, year, asAdmin, fullName, salaryConfig: salaryConfigProp, trackingStartDate }: {
  userId: string; firstName: string; month: number; year: number; asAdmin?: boolean; fullName?: string;
  salaryConfig?: { workingDaysOverride?: number | null; kpiThreshold?: number; dependabilityThreshold?: number } | null;
  trackingStartDate?: string | null;
}) {
  const { data: allTasks } = useListTasks();
  const { data: attendance = [] } = useQuery<AttendanceRec[]>({
    queryKey: ["attendance-user", userId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/attendance?userId=${userId}`, { credentials: "include" });
      if (res.ok) return res.json();
      return [];
    },
  });

  // For non-admin users, fetch their own salary config to get correct thresholds
  const { data: mySalaryConfig } = useQuery<{ workingDaysOverride: number | null; kpiThreshold: number; dependabilityThreshold: number }>({
    queryKey: ["salary-me"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/salaries/me`, { credentials: "include" });
      if (res.ok) return res.json();
      return { workingDaysOverride: null, kpiThreshold: 2, dependabilityThreshold: 2 };
    },
    enabled: !asAdmin,
  });

  const resolvedConfig = salaryConfigProp ?? mySalaryConfig;
  const kpiThreshold = resolvedConfig?.kpiThreshold ?? 2;
  const dependabilityThreshold = resolvedConfig?.dependabilityThreshold ?? 2;

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // Effective start: max(first of month, kpiTrackingStartDate)
  const trackingDate = trackingStartDate ? new Date(trackingStartDate) : null;
  const effectiveStart: Date = (() => {
    if (trackingDate && !isNaN(trackingDate.getTime())) {
      const tStripped = new Date(trackingDate.getFullYear(), trackingDate.getMonth(), trackingDate.getDate());
      if (tStripped > startDate) return tStripped;
    }
    return new Date(startDate);
  })();

  const doneTasks = ((allTasks as TaskItem[] | undefined) ?? []).filter(t =>
    t.assigneeId === userId && t.status === "Done" && t.completedAt && t.dueDate
  );
  const thisMonthDone = doneTasks.filter(t => {
    const c = new Date(t.completedAt!);
    return c >= startDate && c <= endDate;
  });
  const lateTasks = thisMonthDone.filter(t => {
    const completedDay = new Date(t.completedAt!).toISOString().split("T")[0];
    const dueDay = new Date(t.dueDate!).toISOString().split("T")[0];
    return completedDay > dueDay;
  });

  // Compute working days from effectiveStart (auto Mon–Fri, or override per employee)
  let autoWorkingDays = 0;
  const d = new Date(effectiveStart);
  while (d <= endDate) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) autoWorkingDays++;
    d.setDate(d.getDate() + 1);
  }
  const workingDays = resolvedConfig?.workingDaysOverride ?? autoWorkingDays;

  // Only count past days — don't flag future dates in the current month as absent.
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const effectiveEnd = endDate < today ? endDate : today;

  const presentDates = new Set(
    attendance
      .filter(a => { const dt = new Date(a.date); return dt >= effectiveStart && dt <= effectiveEnd; })
      .map(a => a.date)
  );
  const absentDates: string[] = [];
  const c2 = new Date(effectiveStart);
  while (c2 <= effectiveEnd) {
    const dow = c2.getDay();
    if (dow !== 0 && dow !== 6) {
      const ds = c2.toISOString().split("T")[0];
      if (!presentDates.has(ds)) absentDates.push(ds);
    }
    c2.setDate(c2.getDate() + 1);
  }
  const rawAbsences = absentDates.length;
  // If working days is overridden, cap absences to that value
  const absences = resolvedConfig?.workingDaysOverride != null ? Math.min(rawAbsences, workingDays) : rawAbsences;

  const kpiTriggered = kpiThreshold > 0 && lateTasks.length >= kpiThreshold;
  const depTriggered = dependabilityThreshold > 0 && absences >= dependabilityThreshold;

  return (
    <div className="space-y-6">
      {!asAdmin && (
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Your Performance</h1>
          <p className="text-muted-foreground mt-1 text-sm">{MONTHS[month - 1]} {year} — late deliveries & attendance.</p>
        </div>
      )}
      {asAdmin && (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-600/30 border border-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-200 shrink-0">
            {firstName?.[0]}{fullName?.split(" ")[1]?.[0]}
          </div>
          <div>
            <p className="font-semibold text-foreground">{fullName}</p>
            <p className="text-xs text-muted-foreground">{MONTHS[month - 1]} {year}</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="glass-panel p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${kpiTriggered ? "text-red-400" : "text-muted-foreground"}`} />
            <h3 className="text-sm font-semibold text-foreground">Late Deliveries</h3>
            <span className={`ml-auto text-3xl font-bold ${kpiTriggered ? "text-red-400" : "text-foreground"}`}>{lateTasks.length}</span>
          </div>
          <p className="text-xs text-muted-foreground">KPI deduction triggers at {kpiThreshold}+ late tasks in a month.</p>
          <div className={`text-xs font-semibold px-3 py-2 rounded-lg text-center border ${kpiTriggered ? "bg-red-500/12 text-red-300 border-red-500/25" : "bg-green-500/8 text-green-300 border-green-500/20"}`}>
            {kpiTriggered ? "⚠ KPI deduction triggered" : "✓ No KPI deduction this month"}
          </div>
          {lateTasks.length > 0 && (
            <ul className="space-y-1.5 pt-1">
              {lateTasks.map(t => (
                <li key={t.id} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                  <span className="truncate">{t.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="glass-panel p-5 space-y-3">
          <div className="flex items-center gap-2">
            <UserCheck className={`w-5 h-5 ${depTriggered ? "text-orange-400" : "text-muted-foreground"}`} />
            <h3 className="text-sm font-semibold text-foreground">Absences</h3>
            <span className={`ml-auto text-3xl font-bold ${depTriggered ? "text-orange-400" : "text-foreground"}`}>{absences}</span>
          </div>
          <p className="text-xs text-muted-foreground">Dependability deduction triggers at {dependabilityThreshold}+ absences.</p>
          <div className={`text-xs font-semibold px-3 py-2 rounded-lg text-center border ${depTriggered ? "bg-orange-500/12 text-orange-300 border-orange-500/25" : "bg-green-500/8 text-green-300 border-green-500/20"}`}>
            {depTriggered ? "⚠ Dependability deduction triggered" : "✓ No deduction this month"}
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            {workingDays - absences} / {workingDays} working days attended
          </p>
          {absentDates.length > 0 && (
            <ul className="space-y-1.5 pt-1">
              {absentDates.map(ds => (
                <li key={ds} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <XCircle className="w-3 h-3 text-orange-400 shrink-0" />
                  <span>{new Date(ds + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {!kpiTriggered && !depTriggered && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/8 border border-green-500/20">
          <Award className="w-5 h-5 text-green-400 shrink-0" />
          <p className="text-sm text-green-300 font-medium">
            {asAdmin ? `${firstName} has no deductions this month.` : `Great month, ${firstName}! No deductions triggered.`}
          </p>
        </div>
      )}
    </div>
  );
}

export default function KPIs() {
  const { data: currentUser, isLoading: userLoading } = useGetCurrentUser();

  const isAdminOrHR =
    (currentUser as { role?: string } | undefined)?.role === "admin" ||
    (currentUser as { role?: string } | undefined)?.role === "hr";
  const canSeePayroll = isAdminOrHR;

  const now = new Date();
  const [activeTab, setActiveTab] = useState<"payroll" | "deductions" | "employees" | "settings">("deductions");

  useEffect(() => {
    if (!userLoading && canSeePayroll) {
      setActiveTab("payroll");
    }
  }, [userLoading, canSeePayroll]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [salaryData, setSalaryData] = useState<SalaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editBasic, setEditBasic] = useState("");
  const [editOvertime, setEditOvertime] = useState("");
  const [editDep, setEditDep] = useState("");
  const [editKpi, setEditKpi] = useState("");
  const [editWorkingDays, setEditWorkingDays] = useState("");
  const [editKpiThreshold, setEditKpiThreshold] = useState("");
  const [editDepThreshold, setEditDepThreshold] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [trackingStartDate, setTrackingStartDate] = useState<string | null>(null);
  const [editTrackingDate, setEditTrackingDate] = useState("");
  const [savingTracking, setSavingTracking] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDeleteSalaryId, setConfirmDeleteSalaryId] = useState<string | null>(null);
  const [deletingSalaryId, setDeletingSalaryId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const deleteSalaryConfig = async (userId: string) => {
    setDeletingSalaryId(userId);
    try {
      await fetch(`${BASE}/api/salaries/${userId}`, { method: "DELETE", credentials: "include" });
      setSalaryData(prev => prev.filter(r => r.user.id !== userId || true).map(r =>
        r.user.id === userId
          ? { ...r, salary: null as unknown as typeof r.salary, basicSalary: 0, netSalary: 0, dependabilityDeduction: 0, kpiDeduction: 0, kpiThreshold: 2, dependabilityThreshold: 2 }
          : r
      ));
      setConfirmDeleteSalaryId(null);
      await fetchSalaries();
    } finally {
      setDeletingSalaryId(null);
    }
  };

  const fetchSalaries = useCallback(async () => {
    if (!isAdminOrHR) return;
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${BASE}/api/salaries?month=${month}&year=${year}`, { credentials: "include" });
      if (res.ok) {
        const payload = await res.json();
        setSalaryData(payload.rows ?? payload);
        setTrackingStartDate(payload.trackingStartDate ?? null);
      } else {
        const body = await res.json().catch(() => ({}));
        setFetchError(body?.error ?? `Error ${res.status}`);
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [month, year, isAdminOrHR]);

  useEffect(() => { fetchSalaries(); }, [fetchSalaries]);
  useEffect(() => { setEditTrackingDate(trackingStartDate ?? ""); }, [trackingStartDate]);

  const saveTrackingDate = async () => {
    setSavingTracking(true);
    setTrackingError(null);
    try {
      const res = await fetch(`${BASE}/api/settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kpiTrackingStartDate: editTrackingDate.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setTrackingError(body?.error ?? `Save failed (${res.status})`);
        return;
      }
      setTrackingStartDate(editTrackingDate.trim() || null);
      await fetchSalaries();
    } catch (err) {
      setTrackingError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSavingTracking(false);
    }
  };

  const openEdit = (row: SalaryRow) => {
    setSaveError(null);
    setEditingUserId(row.user.id);
    setEditBasic(String(row.salary?.basicSalary ?? ""));
    setEditOvertime(String(row.salary?.overtimePayment ?? ""));
    setEditDep(String(row.salary?.dependabilityDeductionAmount ?? ""));
    setEditKpi(String(row.salary?.kpiDeductionAmount ?? ""));
    setEditWorkingDays(row.salary?.workingDaysOverride != null ? String(row.salary.workingDaysOverride) : "");
    setEditKpiThreshold(String(row.kpiThreshold));
    setEditDepThreshold(String(row.dependabilityThreshold));
    setEditTitle(row.user.title ?? "");
    setEditDepartment(row.user.department ?? "");
  };

  const saveEdit = async (userId: string) => {
    setSaving(true);
    setSaveError(null);
    try {
      const [salaryRes, userRes] = await Promise.all([
        fetch(`${BASE}/api/salaries/${userId}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            basicSalary: parseInt(editBasic) || 0,
            overtimePayment: parseInt(editOvertime) || 0,
            dependabilityDeductionAmount: parseInt(editDep) || 0,
            kpiDeductionAmount: parseInt(editKpi) || 0,
            workingDaysOverride: editWorkingDays.trim() === "" ? null : parseInt(editWorkingDays) || null,
            kpiThreshold: isNaN(parseInt(editKpiThreshold)) ? 2 : parseInt(editKpiThreshold),
            dependabilityThreshold: isNaN(parseInt(editDepThreshold)) ? 2 : parseInt(editDepThreshold),
          }),
        }),
        fetch(`${BASE}/api/users/${userId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editTitle.trim() || null,
            department: editDepartment.trim() || null,
          }),
        }),
      ]);

      if (!salaryRes.ok) {
        const body = await salaryRes.json().catch(() => ({}));
        setSaveError(body?.error ?? `Save failed (${salaryRes.status})`);
        return;
      }
      if (!userRes.ok) {
        const body = await userRes.json().catch(() => ({}));
        setSaveError(body?.error ?? `Profile update failed (${userRes.status})`);
        return;
      }

      setEditingUserId(null);
      await fetchSalaries();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  };

  if (userLoading) {
    return <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading...</div>;
  }

  if (!isAdminOrHR) {
    const myId = (currentUser as { id?: string } | undefined)?.id ?? "";
    const myFirst = (currentUser as { firstName?: string } | undefined)?.firstName ?? "";
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground">
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1} className="bg-card">{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <PersonalPerformanceView userId={myId} firstName={myFirst} month={month} year={year} trackingStartDate={trackingStartDate} />
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
        <button
          onClick={() => setActiveTab("employees")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "employees"
              ? "bg-indigo-600 text-white shadow"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          }`}
        >
          <span className="flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5" /> Employee View</span>
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "settings"
              ? "bg-indigo-600 text-white shadow"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          }`}
        >
          <span className="flex items-center gap-1.5"><SlidersHorizontal className="w-3.5 h-3.5" /> KPI Settings</span>
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Fetch error */}
      {!loading && fetchError && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>Failed to load salary data: {fetchError}</span>
          <button onClick={fetchSalaries} className="ml-auto text-xs underline underline-offset-2 hover:text-red-300">Retry</button>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>Could not save changes: {saveError}</span>
          <button onClick={() => setSaveError(null)} className="ml-auto text-xs underline underline-offset-2 hover:text-red-300">Dismiss</button>
        </div>
      )}

      {/* ── Payroll Tab ── */}
      {!loading && activeTab === "payroll" && canSeePayroll && (
        <>
          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
              Dependability deducted if absences ≥ threshold
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              KPI deducted if late deliveries ≥ threshold
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
                        <div className="flex items-center gap-1">
                          {confirmDeleteSalaryId === row.user.id ? (
                            <>
                              <button onClick={() => deleteSalaryConfig(row.user.id)} disabled={!!deletingSalaryId}
                                className="text-[11px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20 transition-colors disabled:opacity-50">
                                {deletingSalaryId === row.user.id ? "…" : "Confirm"}
                              </button>
                              <button onClick={() => setConfirmDeleteSalaryId(null)}
                                className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg border border-white/10 transition-colors">
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => openEdit(row)}
                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg transition-colors" title="Edit salary">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setConfirmDeleteSalaryId(row.user.id)}
                                className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Reset salary config">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
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

                    {/* Threshold & working days config */}
                    <div className="pt-2.5 mt-1 border-t border-white/8 space-y-2">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Thresholds & Schedule</p>

                        {/* Working Days */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 text-sky-400" /> Working Days
                          </span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input type="number" value={editWorkingDays} onChange={e => setEditWorkingDays(e.target.value)}
                                className="h-7 w-20 text-xs bg-black/30 border-white/15 text-right" placeholder="auto" />
                              <span className="text-[10px] text-muted-foreground">days/mo</span>
                            </div>
                          ) : (
                            <span className="text-xs text-foreground">
                              {row.salary?.workingDaysOverride != null ? (
                                <span className="text-sky-400 font-semibold">{row.salary.workingDaysOverride} <span className="text-muted-foreground font-normal">(custom)</span></span>
                              ) : (
                                <span className="text-muted-foreground">{row.workingDays} (auto)</span>
                              )}
                            </span>
                          )}
                        </div>

                        {/* Dep Threshold */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-orange-400" /> Dep. triggers at
                          </span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input type="number" value={editDepThreshold} onChange={e => setEditDepThreshold(e.target.value)}
                                className="h-7 w-16 text-xs bg-black/30 border-white/15 text-right" placeholder="2" />
                              <span className="text-[10px] text-muted-foreground">absences</span>
                            </div>
                          ) : (
                            <span className={`text-xs font-semibold ${row.dependabilityThreshold !== 2 ? "text-orange-400" : "text-muted-foreground"}`}>
                              {row.dependabilityThreshold}+ absences
                            </span>
                          )}
                        </div>

                        {/* KPI Threshold */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> KPI triggers at
                          </span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input type="number" value={editKpiThreshold} onChange={e => setEditKpiThreshold(e.target.value)}
                                className="h-7 w-16 text-xs bg-black/30 border-white/15 text-right" placeholder="2" />
                              <span className="text-[10px] text-muted-foreground">late tasks</span>
                            </div>
                          ) : (
                            <span className={`text-xs font-semibold ${row.kpiThreshold !== 2 ? "text-red-400" : "text-muted-foreground"}`}>
                              {row.kpiThreshold}+ late tasks
                            </span>
                          )}
                        </div>
                    </div>

                    {/* Employee Profile */}
                    <div className="pt-2.5 mt-1 border-t border-white/8 space-y-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Employee Profile</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-violet-400" /> Job Title
                        </span>
                        {isEditing ? (
                          <Input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                            className="h-7 w-36 text-xs bg-black/30 border-white/15 text-right" placeholder="e.g. Video Editor" />
                        ) : (
                          <span className="text-xs font-semibold text-foreground">{row.user.title || <span className="text-muted-foreground">—</span>}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-sky-400" /> Department
                        </span>
                        {isEditing ? (
                          <Input value={editDepartment} onChange={e => setEditDepartment(e.target.value)}
                            className="h-7 w-36 text-xs bg-black/30 border-white/15 text-right" placeholder="e.g. Production" />
                        ) : (
                          <span className="text-xs font-semibold text-foreground">{row.user.department || <span className="text-muted-foreground">—</span>}</span>
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
              Dependability — per-employee absence threshold
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              KPI — per-employee late delivery threshold
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
                          row.absences >= row.dependabilityThreshold
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
                          row.lateTasks >= row.kpiThreshold
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

      {/* ── Employee View Tab ── */}
      {!loading && activeTab === "employees" && (
        <>
          {salaryData.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-white/10 rounded-2xl">
              <UserCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground text-sm">No employee data for this period.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {salaryData.map(row => (
                <div key={row.user.id} className="glass-panel rounded-2xl border border-white/8 p-5">
                  <PersonalPerformanceView
                    userId={row.user.id}
                    firstName={row.user.firstName ?? ""}
                    fullName={`${row.user.firstName ?? ""} ${row.user.lastName ?? ""}`.trim()}
                    month={month}
                    year={year}
                    asAdmin
                    salaryConfig={row.salary}
                    trackingStartDate={trackingStartDate}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── KPI Settings Tab ── */}
      {!loading && activeTab === "settings" && (
        <>
          {/* Global: KPI Tracking Start Date */}
          <Card className="glass-panel p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-400" />
              <h3 className="font-semibold text-sm text-foreground">Absence Tracking Start Date</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Absences before this date are ignored in all payroll and performance calculations.
              Leave blank to count from the first day of each month.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={editTrackingDate}
                onChange={e => setEditTrackingDate(e.target.value)}
                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground"
              />
              <button
                onClick={saveTrackingDate}
                disabled={savingTracking}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {savingTracking ? "Saving…" : "Save"}
              </button>
              {editTrackingDate && (
                <button
                  onClick={() => { setEditTrackingDate(""); }}
                  className="px-3 py-2 rounded-lg border border-white/10 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            {trackingError && (
              <p className="text-xs text-red-400">{trackingError}</p>
            )}
            {trackingStartDate && (
              <p className="text-xs text-green-400">
                Currently tracking from {new Date(trackingStartDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </Card>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-sky-400" />
              Working days: leave blank to auto-count Mon–Fri for the month
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
              Thresholds control when deductions are triggered (default: 2)
            </span>
          </div>

          {salaryData.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-white/10 rounded-2xl">
              <SlidersHorizontal className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground text-sm">No employee data yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {salaryData.map((row) => {
                const isEditing = editingUserId === row.user.id;
                return (
                  <Card key={row.user.id} className="glass-panel p-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-600/30 border border-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-200 shrink-0">
                          {row.user.firstName?.[0]}{row.user.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{row.user.firstName} {row.user.lastName}</p>
                          {row.user.title && <p className="text-xs text-muted-foreground">{row.user.title}</p>}
                        </div>
                      </div>
                      {!isEditing ? (
                        <div className="flex items-center gap-1">
                          {confirmDeleteSalaryId === row.user.id ? (
                            <>
                              <button onClick={() => deleteSalaryConfig(row.user.id)} disabled={!!deletingSalaryId}
                                className="text-[11px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20 transition-colors disabled:opacity-50">
                                {deletingSalaryId === row.user.id ? "…" : "Confirm"}
                              </button>
                              <button onClick={() => setConfirmDeleteSalaryId(null)}
                                className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg border border-white/10 transition-colors">
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => openEdit(row)}
                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg transition-colors" title="Edit thresholds">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setConfirmDeleteSalaryId(row.user.id)}
                                className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Reset salary config">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
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

                    <div className="space-y-3">
                      {/* Working Days */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-sky-400" /> Working Days / Month
                        </span>
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              value={editWorkingDays}
                              onChange={e => setEditWorkingDays(e.target.value)}
                              className="h-7 w-20 text-xs bg-black/30 border-white/15 text-right"
                              placeholder="auto"
                            />
                            <span className="text-[10px] text-muted-foreground">days</span>
                          </div>
                        ) : (
                          <span className="text-sm font-semibold">
                            {row.salary?.workingDaysOverride != null
                              ? <span className="text-sky-400">{row.salary.workingDaysOverride} <span className="text-xs font-normal text-muted-foreground">(custom)</span></span>
                              : <span className="text-muted-foreground">{row.workingDays} (auto)</span>
                            }
                          </span>
                        )}
                      </div>

                      {/* Dependability Threshold */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-orange-400" /> Dependability Trigger
                        </span>
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              value={editDepThreshold}
                              onChange={e => setEditDepThreshold(e.target.value)}
                              className="h-7 w-16 text-xs bg-black/30 border-white/15 text-right"
                              placeholder="2"
                            />
                            <span className="text-[10px] text-muted-foreground">absences</span>
                          </div>
                        ) : (
                          <span className={`text-sm font-semibold ${row.dependabilityThreshold !== 2 ? "text-orange-400" : "text-foreground"}`}>
                            {row.dependabilityThreshold}+ absences
                          </span>
                        )}
                      </div>

                      {/* KPI Threshold */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> KPI Trigger
                        </span>
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              value={editKpiThreshold}
                              onChange={e => setEditKpiThreshold(e.target.value)}
                              className="h-7 w-16 text-xs bg-black/30 border-white/15 text-right"
                              placeholder="2"
                            />
                            <span className="text-[10px] text-muted-foreground">late tasks</span>
                          </div>
                        ) : (
                          <span className={`text-sm font-semibold ${row.kpiThreshold !== 2 ? "text-red-400" : "text-foreground"}`}>
                            {row.kpiThreshold}+ late tasks
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Employee Profile */}
                    <div className="pt-2.5 mt-1 border-t border-white/8 space-y-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Employee Profile</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-violet-400" /> Job Title
                        </span>
                        {isEditing ? (
                          <Input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                            className="h-7 w-36 text-xs bg-black/30 border-white/15 text-right" placeholder="e.g. Video Editor" />
                        ) : (
                          <span className="text-sm font-semibold text-foreground">{row.user.title || <span className="text-muted-foreground">—</span>}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-sky-400" /> Department
                        </span>
                        {isEditing ? (
                          <Input value={editDepartment} onChange={e => setEditDepartment(e.target.value)}
                            className="h-7 w-36 text-xs bg-black/30 border-white/15 text-right" placeholder="e.g. Production" />
                        ) : (
                          <span className="text-sm font-semibold text-foreground">{row.user.department || <span className="text-muted-foreground">—</span>}</span>
                        )}
                      </div>
                    </div>

                    {/* Current month status */}
                    <div className={`text-xs px-3 py-2 rounded-xl border text-center font-medium ${
                      row.dependabilityTriggered || row.kpiTriggered
                        ? "bg-red-500/8 border-red-500/20 text-red-300"
                        : "bg-green-500/8 border-green-500/20 text-green-300"
                    }`}>
                      {row.dependabilityTriggered || row.kpiTriggered
                        ? <span className="flex items-center justify-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Deduction active this month</span>
                        : <span className="flex items-center justify-center gap-1.5"><Check className="w-3 h-3" /> No deductions this month</span>
                      }
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
