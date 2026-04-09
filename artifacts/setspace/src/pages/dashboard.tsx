import React, { useMemo, useState } from "react";
import {
  useListTasks,
  useGetTodayAttendance,
  useGetLeaderboard,
  useListQualityChecks,
  useListUsers,
  useListAttendance,
} from "@workspace/api-client-react";
import type { Task, User, AttendanceRecord } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Card } from "@/components/ui/card";
import {
  CheckSquare,
  Clock,
  Star,
  TimerOff,
  Lock,
  Users,
  CheckCircle2,
  Minus,
  Trophy,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { Link } from "wouter";

type TaskWithDerived = Task & { completedOnTime?: boolean | null; assignee?: User | null };
type ARecord = AttendanceRecord & {
  totalSeconds: number;
  isLate: boolean;
  lateMinutes: number;
  scheduledShiftHours: number;
};

/* ── helpers ─────────────────────────────────────────────────── */
function initials(u: { firstName?: string | null; lastName?: string | null }) {
  return `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase();
}

function inMonth(dateStr: string | null | undefined, year: number, month: number) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function fmtHrs(seconds: number) {
  const h = seconds / 3600;
  return h.toFixed(1) + "h";
}

function StarRating({ value, size = "sm" }: { value: number | null; size?: "sm" | "md" }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  const sz = size === "md" ? "w-4 h-4" : "w-3 h-3";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`${sz} ${s <= Math.round(value) ? "text-yellow-400 fill-yellow-400" : "text-white/15"}`} />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{value.toFixed(1)}</span>
    </div>
  );
}

function OnTimeChip({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-xs text-muted-foreground">—</span>;
  const cls = rate >= 80 ? "text-green-400" : rate >= 60 ? "text-yellow-400" : "text-red-400";
  return <span className={`font-semibold ${cls}`}>{rate}%</span>;
}

/* ── MONTH PICKER ────────────────────────────────────────────── */
function MonthPicker({
  year, month, onChange,
}: {
  year: number; month: number; onChange: (y: number, m: number) => void;
}) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const prev = () => { const d = new Date(year, month - 2); onChange(d.getFullYear(), d.getMonth() + 1); };
  const next = () => { const d = new Date(year, month); if (d <= new Date()) onChange(d.getFullYear(), d.getMonth() + 1); };
  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth() + 1;
  return (
    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
      <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
      <button onClick={prev} className="text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft className="w-4 h-4" /></button>
      <span className="text-sm font-semibold w-24 text-center">{months[month - 1]} {year}</span>
      <button onClick={next} disabled={isCurrentMonth} className={`transition-colors ${isCurrentMonth ? "opacity-20 cursor-default" : "text-muted-foreground hover:text-foreground"}`}>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ── EMPLOYEE ATTENDANCE DETAIL (expanded row) ──────────────── */
function EmployeeAttendanceDetail({
  records,
  totalHours,
  basicHours,
  overtimeHours,
  lateCount,
}: {
  records: ARecord[];
  totalHours: number;
  basicHours: number;
  overtimeHours: number;
  lateCount: number;
}) {
  return (
    <div className="border-t border-white/5 bg-white/2">
      {/* Summary chips */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-white/5">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Month Summary</span>
        <span className="text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1">
          <span className="text-foreground font-semibold">{records.length}</span>
          <span className="text-muted-foreground ml-1">day{records.length !== 1 ? "s" : ""}</span>
        </span>
        <span className="text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1">
          <span className="text-foreground font-semibold">{totalHours.toFixed(1)}h</span>
          <span className="text-muted-foreground ml-1">total</span>
        </span>
        <span className="text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1">
          <span className="text-blue-400 font-semibold">{basicHours.toFixed(1)}h</span>
          <span className="text-muted-foreground ml-1">basic</span>
        </span>
        <span className={`text-xs border rounded-lg px-2.5 py-1 ${overtimeHours > 0 ? "bg-purple-500/10 border-purple-500/20" : "bg-white/5 border-white/10"}`}>
          <span className={`font-semibold ${overtimeHours > 0 ? "text-purple-400" : "text-muted-foreground"}`}>{overtimeHours.toFixed(1)}h</span>
          <span className="text-muted-foreground ml-1">overtime</span>
        </span>
        {lateCount > 0 && (
          <span className="text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1">
            <span className="text-red-400 font-semibold">{lateCount}</span>
            <span className="text-muted-foreground ml-1">late</span>
          </span>
        )}
      </div>

      {/* Day-by-day table */}
      {records.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-5">No attendance records this month</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-white/5 bg-white/2">
                <th className="px-5 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-center font-medium">Clock In</th>
                <th className="px-4 py-2 text-center font-medium">Clock Out</th>
                <th className="px-4 py-2 text-center font-medium">Total</th>
                <th className="px-4 py-2 text-center font-medium">Basic</th>
                <th className="px-4 py-2 text-center font-medium">Overtime</th>
                <th className="px-4 py-2 text-left font-medium">Punctuality</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const hrs = r.totalSeconds / 3600;
                const sched = r.scheduledShiftHours ?? 4;
                const basic = Math.min(hrs, sched);
                const ot = Math.max(0, hrs - sched);
                return (
                  <tr key={r.id} className="border-b border-white/4 hover:bg-white/2">
                    <td className="px-5 py-2.5 font-medium">{fmtDate(r.date)}</td>
                    <td className="px-4 py-2.5 text-center">{fmtTime(r.clockIn)}</td>
                    <td className="px-4 py-2.5 text-center text-muted-foreground">{fmtTime(r.clockOut)}</td>
                    <td className="px-4 py-2.5 text-center font-semibold">
                      {hrs > 0 ? fmtHrs(r.totalSeconds) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center text-blue-400">{basic > 0 ? basic.toFixed(1) + "h" : "—"}</td>
                    <td className="px-4 py-2.5 text-center">
                      {ot > 0 ? (
                        <span className="text-purple-400 font-semibold">+{ot.toFixed(1)}h</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.isLate ? (
                        <span className="flex items-center gap-1 text-red-400">
                          <AlertCircle className="w-3 h-3" />
                          Late {r.lateMinutes}m
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-green-400">
                          <CheckCircle2 className="w-3 h-3" />
                          On time
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ADMIN / HR DASHBOARD
══════════════════════════════════════════════════════════════ */
function AdminDashboard() {
  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const { data: allTasks } = useListTasks();
  const { data: allQC } = useListQualityChecks({});
  const { data: users } = useListUsers();
  const { data: allAttendance } = useListAttendance({});
  const { data: leaderboard } = useGetLeaderboard({ month: selMonth, year: selYear });

  const todayStr = now.toISOString().split("T")[0];

  const tasks = useMemo(() => (allTasks as TaskWithDerived[] | undefined) ?? [], [allTasks]);

  const periodTasks = useMemo(() => tasks.filter(t =>
    inMonth(t.completedAt ?? null, selYear, selMonth)
  ), [tasks, selYear, selMonth]);

  const periodQC = useMemo(() => (allQC ?? []).filter(q =>
    inMonth(q.createdAt, selYear, selMonth)
  ), [allQC, selYear, selMonth]);

  const periodAttendance = useMemo(() => ((allAttendance ?? []) as ARecord[]).filter(a =>
    inMonth(a.date, selYear, selMonth)
  ), [allAttendance, selYear, selMonth]);

  const todayAttendance = useMemo(() => ((allAttendance ?? []) as ARecord[]).filter(a => a.date === todayStr), [allAttendance, todayStr]);

  // Aggregate KPIs for period
  const doneWithDate = periodTasks.filter(t => t.completedOnTime !== null && t.completedOnTime !== undefined);
  const onTimeCount = doneWithDate.filter(t => t.completedOnTime === true).length;
  const onTimeRate = doneWithDate.length > 0 ? Math.round((onTimeCount / doneWithDate.length) * 100) : null;
  const avgRating = periodQC.length > 0 ? periodQC.reduce((s, q) => s + q.rating, 0) / periodQC.length : null;
  const activeTasks = tasks.filter(t => t.status !== "Done");

  // Per-employee stats
  const teamStats = useMemo(() => (users ?? []).map(u => {
    const uTasks = tasks.filter(t => t.assigneeId === u.id);
    const uPeriodDone = periodTasks.filter(t => t.assigneeId === u.id);
    const uDoneWithDate = uPeriodDone.filter(t => t.completedOnTime !== null && t.completedOnTime !== undefined);
    const uOnTime = uDoneWithDate.filter(t => t.completedOnTime === true).length;
    const uRate = uDoneWithDate.length > 0 ? Math.round((uOnTime / uDoneWithDate.length) * 100) : null;

    const uQCs = periodQC.filter(q => q.submitterId === u.id);
    const uRating = uQCs.length > 0 ? uQCs.reduce((s, q) => s + q.rating, 0) / uQCs.length : null;

    const uAttd = periodAttendance.filter(a => a.userId === u.id);
    const daysPresent = uAttd.length;
    const lateCount = uAttd.filter(a => a.isLate).length;

    const totalSeconds = uAttd.reduce((sum, a) => sum + (a.totalSeconds ?? 0), 0);
    const totalHours = totalSeconds / 3600;

    const basicSeconds = uAttd.reduce((sum, a) => {
      const sched = (a.scheduledShiftHours ?? 4) * 3600;
      return sum + Math.min(a.totalSeconds ?? 0, sched);
    }, 0);
    const basicHours = basicSeconds / 3600;
    const overtimeHours = Math.max(0, totalHours - basicHours);

    const todayRec = todayAttendance.find(a => a.userId === u.id);
    const clockedIn = !!todayRec?.clockIn && !todayRec?.clockOut;
    const shiftDone = !!todayRec?.clockIn && !!todayRec?.clockOut;

    return {
      user: u,
      tasksAssigned: uTasks.length,
      tasksDone: uPeriodDone.length,
      onTimeRate: uRate,
      avgRating: uRating,
      daysPresent,
      totalHours,
      basicHours,
      overtimeHours,
      lateCount,
      clockedIn,
      shiftDone,
      todayRec,
      uAttd,
    };
  }), [users, tasks, periodTasks, periodQC, periodAttendance, todayAttendance]);

  const isCurrentMonth = selYear === now.getFullYear() && selMonth === now.getMonth() + 1;

  const colCount = isCurrentMonth ? 9 : 8;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Overview</h1>
          <p className="text-muted-foreground mt-1">Agency performance at a glance.</p>
        </div>
        <MonthPicker year={selYear} month={selMonth} onChange={(y, m) => { setSelYear(y); setSelMonth(m); setExpandedUserId(null); }} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-panel p-5 space-y-1 hover:border-white/20 transition-colors">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Tasks</p>
          <p className="text-3xl font-display font-bold">{activeTasks.length}</p>
          <p className="text-xs text-muted-foreground">{tasks.filter(t => t.status === "Done").length} total completed</p>
        </Card>

        <Card className="glass-panel p-5 space-y-1 hover:border-white/20 transition-colors">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">On-Time Delivery</p>
          <p className={`text-3xl font-display font-bold ${onTimeRate === null ? "text-muted-foreground" : onTimeRate >= 80 ? "text-green-400" : onTimeRate >= 60 ? "text-yellow-400" : "text-red-400"}`}>
            {onTimeRate !== null ? `${onTimeRate}%` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">{doneWithDate.length > 0 ? `${onTimeCount}/${doneWithDate.length} tasks on time` : "No completed tasks"}</p>
        </Card>

        <Card className="glass-panel p-5 space-y-1 hover:border-white/20 transition-colors">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Quality</p>
          <p className="text-3xl font-display font-bold text-yellow-400">
            {avgRating !== null ? <>{avgRating.toFixed(1)}<span className="text-lg text-muted-foreground">/5</span></> : "—"}
          </p>
          <p className="text-xs text-muted-foreground">{periodQC.length} review{periodQC.length !== 1 ? "s" : ""} this period</p>
        </Card>

        <Card className="glass-panel p-5 space-y-1 hover:border-white/20 transition-colors">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Team Attendance</p>
          <p className="text-3xl font-display font-bold">{periodAttendance.length}</p>
          <p className="text-xs text-muted-foreground">clock-ins this period</p>
        </Card>
      </div>

      {/* Team Performance Table */}
      <Card className="glass-panel overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-lg font-display font-bold">Team Performance</h2>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">Click a row for attendance detail</p>
            <span className="text-xs text-muted-foreground px-3 py-1 bg-white/5 rounded-lg border border-white/5">
              {isCurrentMonth ? "Month to date" : "Full month data"}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-white/5 bg-white/2">
                <th className="px-5 py-3 text-left font-medium">Employee</th>
                <th className="px-4 py-3 text-center font-medium">Days In</th>
                <th className="px-4 py-3 text-center font-medium">Total Hrs</th>
                <th className="px-4 py-3 text-center font-medium">Basic Hrs</th>
                <th className="px-4 py-3 text-center font-medium">Overtime</th>
                <th className="px-4 py-3 text-center font-medium">Late</th>
                <th className="px-4 py-3 text-center font-medium">Tasks</th>
                <th className="px-4 py-3 text-center font-medium">On-Time</th>
                <th className="px-4 py-3 text-left font-medium">Quality</th>
                {isCurrentMonth && <th className="px-4 py-3 text-left font-medium">Today</th>}
              </tr>
            </thead>
            <tbody>
              {teamStats.length === 0 && (
                <tr><td colSpan={colCount} className="px-5 py-12 text-center text-muted-foreground">No team members yet</td></tr>
              )}
              {teamStats.map(({ user: u, tasksAssigned, tasksDone, onTimeRate: uRate, avgRating: uRating, daysPresent, totalHours, basicHours, overtimeHours, lateCount, clockedIn, shiftDone, todayRec, uAttd }) => {
                const isExpanded = expandedUserId === u.id;
                return (
                  <React.Fragment key={u.id}>
                    <tr
                      onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                      className={`border-b border-white/5 cursor-pointer transition-colors ${isExpanded ? "bg-white/4" : "hover:bg-white/2"}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">{initials(u)}</div>
                          <div>
                            <p className="font-semibold">{u.firstName} {u.lastName}</p>
                            <p className="text-xs text-muted-foreground">{u.title || u.role}</p>
                          </div>
                          {isExpanded
                            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground ml-1" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1 opacity-40" />}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="font-semibold">{daysPresent}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {totalHours > 0 ? (
                          <><span className="font-semibold">{totalHours.toFixed(1)}</span><span className="text-xs text-muted-foreground">h</span></>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {basicHours > 0 ? (
                          <span className="text-blue-400 font-semibold">{basicHours.toFixed(1)}h</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {overtimeHours > 0 ? (
                          <span className="text-purple-400 font-semibold">+{overtimeHours.toFixed(1)}h</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {lateCount > 0 ? (
                          <span className="text-red-400 font-semibold">{lateCount}×</span>
                        ) : (
                          <span className="text-green-400 font-semibold text-xs">✓</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="font-semibold">{tasksDone}</span>
                        <span className="text-xs text-muted-foreground">/{tasksAssigned}</span>
                      </td>
                      <td className="px-4 py-4 text-center"><OnTimeChip rate={uRate} /></td>
                      <td className="px-4 py-4"><StarRating value={uRating} /></td>
                      {isCurrentMonth && (
                        <td className="px-4 py-4">
                          {clockedIn ? (
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                              <span className="text-xs text-green-400 font-medium">{fmtTime(todayRec?.clockIn)}</span>
                            </div>
                          ) : shiftDone ? (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                              <span className="text-xs text-blue-400">Done</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Absent</span>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={colCount}>
                          <EmployeeAttendanceDetail
                            records={uAttd}
                            totalHours={totalHours}
                            basicHours={basicHours}
                            overtimeHours={overtimeHours}
                            lateCount={lateCount}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard snapshot */}
        <Card className="glass-panel p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-lg font-display font-bold">Leaderboard</h2>
            </div>
            <Link href="/leaderboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Full Board</Link>
          </div>
          <div className="space-y-2">
            {(leaderboard ?? []).slice(0, 5).map((e, i) => (
              <div key={e.userId} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${i === 0 ? "bg-yellow-400/5 border-yellow-400/20" : "bg-white/3 border-white/5"}`}>
                <span className={`w-6 text-center font-bold text-sm ${i === 0 ? "text-yellow-400" : i === 1 ? "text-white/60" : i === 2 ? "text-orange-400/60" : "text-muted-foreground"}`}>#{e.rank}</span>
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">{initials({ firstName: e.user?.firstName, lastName: e.user?.lastName })}</div>
                <span className="font-medium text-sm flex-1">{e.user?.firstName} {e.user?.lastName}</span>
                <span className="text-xs font-mono text-muted-foreground">{e.score} pts</span>
              </div>
            ))}
            {!leaderboard?.length && <p className="text-center text-sm text-muted-foreground py-6">No data for this period</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   EMPLOYEE PERSONAL DASHBOARD
══════════════════════════════════════════════════════════════ */
function EmployeeDashboard({ userId }: { userId: string }) {
  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);

  const { data: allTasks } = useListTasks();
  const { data: allQC } = useListQualityChecks({});
  const { data: myAttendanceToday } = useGetTodayAttendance();
  const { data: allAttendance } = useListAttendance({});
  const { data: leaderboard } = useGetLeaderboard({ month: selMonth, year: selYear });
  const { user: authUser } = useAuth();

  const tasks = (allTasks as TaskWithDerived[] | undefined) ?? [];
  const myTasks = tasks.filter(t => t.assigneeId === userId);
  const myActiveTasks = myTasks.filter(t => t.status !== "Done");
  const myDone = myTasks.filter(t => t.status === "Done");
  const myDoneWithDate = myDone.filter(t => t.completedOnTime !== null && t.completedOnTime !== undefined);
  const myOnTime = myDoneWithDate.filter(t => t.completedOnTime === true).length;
  const myOnTimeRate = myDoneWithDate.length > 0 ? Math.round((myOnTime / myDoneWithDate.length) * 100) : null;

  const myQCs = (allQC ?? []).filter(q => q.submitterId === userId);
  const myAvgRating = myQCs.length > 0 ? myQCs.reduce((s, q) => s + q.rating, 0) / myQCs.length : null;

  const myRank = leaderboard?.find(e => e.userId === userId)?.rank ?? null;

  // Monthly attendance
  const myMonthAttendance = useMemo(() =>
    ((allAttendance ?? []) as ARecord[]).filter(a => a.userId === userId && inMonth(a.date, selYear, selMonth))
  , [allAttendance, userId, selYear, selMonth]);

  const myTotalHours = myMonthAttendance.reduce((s, a) => s + (a.totalSeconds ?? 0) / 3600, 0);
  const myBasicHours = myMonthAttendance.reduce((s, a) => {
    const sched = (a.scheduledShiftHours ?? 4) * 3600;
    return s + Math.min(a.totalSeconds ?? 0, sched) / 3600;
  }, 0);
  const myOvertimeHours = Math.max(0, myTotalHours - myBasicHours);
  const myLateCount = myMonthAttendance.filter(a => a.isLate).length;

  const isCurrentMonth = selYear === now.getFullYear() && selMonth === now.getMonth() + 1;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">My Performance</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {authUser?.firstName}.</p>
        </div>
        <MonthPicker year={selYear} month={selMonth} onChange={(y, m) => { setSelYear(y); setSelMonth(m); }} />
      </div>

      {/* Personal KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-panel p-5 space-y-1 hover:border-white/20 transition-colors">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Tasks Done</p>
          <p className="text-3xl font-display font-bold">{myDone.length}</p>
          <p className="text-xs text-muted-foreground">{myActiveTasks.length} still active</p>
        </Card>

        <Card className="glass-panel p-5 space-y-1 hover:border-white/20 transition-colors">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">On-Time Rate</p>
          <p className={`text-3xl font-display font-bold ${myOnTimeRate === null ? "text-muted-foreground" : myOnTimeRate >= 80 ? "text-green-400" : myOnTimeRate >= 60 ? "text-yellow-400" : "text-red-400"}`}>
            {myOnTimeRate !== null ? `${myOnTimeRate}%` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">{myDoneWithDate.length > 0 ? `${myOnTime}/${myDoneWithDate.length} on time` : "No completed tasks yet"}</p>
        </Card>

        <Card className="glass-panel p-5 space-y-1 hover:border-white/20 transition-colors">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Quality Rating</p>
          <p className="text-3xl font-display font-bold text-yellow-400">
            {myAvgRating !== null ? <>{myAvgRating.toFixed(1)}<span className="text-lg text-muted-foreground">/5</span></> : "—"}
          </p>
          <p className="text-xs text-muted-foreground">{myQCs.length} review{myQCs.length !== 1 ? "s" : ""} received</p>
        </Card>

        <Card className="glass-panel p-5 space-y-1 hover:border-white/20 transition-colors">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Today</p>
          <p className={`text-xl font-display font-bold ${myAttendanceToday?.clockIn ? "text-green-400" : "text-muted-foreground"}`}>
            {myAttendanceToday?.clockIn && !myAttendanceToday?.clockOut ? "Clocked In" : myAttendanceToday?.clockIn && myAttendanceToday?.clockOut ? "Shift Done" : "Not In"}
          </p>
          {myAttendanceToday?.clockIn && (
            <p className="text-xs text-muted-foreground">
              {fmtTime(myAttendanceToday.clockIn)}
              {myAttendanceToday.clockOut ? ` – ${fmtTime(myAttendanceToday.clockOut)}` : ""}
            </p>
          )}
        </Card>
      </div>

      {/* Attendance Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="glass-panel p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Days Present</p>
          <p className="text-2xl font-display font-bold">{myMonthAttendance.length}</p>
          <p className="text-xs text-muted-foreground">{isCurrentMonth ? "this month" : "that month"}</p>
        </Card>
        <Card className="glass-panel p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Hours Worked</p>
          <p className="text-2xl font-display font-bold">{myTotalHours.toFixed(1)}<span className="text-base text-muted-foreground">h</span></p>
          <p className="text-xs text-blue-400">{myBasicHours.toFixed(1)}h basic</p>
        </Card>
        <Card className="glass-panel p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Overtime</p>
          <p className={`text-2xl font-display font-bold ${myOvertimeHours > 0 ? "text-purple-400" : "text-muted-foreground"}`}>
            {myOvertimeHours > 0 ? `+${myOvertimeHours.toFixed(1)}h` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">beyond scheduled</p>
        </Card>
        <Card className="glass-panel p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Late Days</p>
          <p className={`text-2xl font-display font-bold ${myLateCount > 0 ? "text-red-400" : "text-green-400"}`}>
            {myLateCount > 0 ? myLateCount : "0"}
          </p>
          <p className="text-xs text-muted-foreground">{myLateCount === 0 ? "perfect punctuality" : `out of ${myMonthAttendance.length} days`}</p>
        </Card>
      </div>

      {/* Attendance history */}
      <Card className="glass-panel overflow-hidden">
        <div className="flex items-center gap-3 p-5 border-b border-white/5">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-lg font-display font-bold">Attendance History</h2>
          <span className="text-xs text-muted-foreground px-2.5 py-1 bg-white/5 rounded-lg border border-white/5 ml-auto">
            {myMonthAttendance.length} record{myMonthAttendance.length !== 1 ? "s" : ""}
          </span>
        </div>
        {myMonthAttendance.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">No attendance records for this month</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-white/5 bg-white/2">
                  <th className="px-5 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-center font-medium">Clock In</th>
                  <th className="px-4 py-3 text-center font-medium">Clock Out</th>
                  <th className="px-4 py-3 text-center font-medium">Total</th>
                  <th className="px-4 py-3 text-center font-medium">Basic</th>
                  <th className="px-4 py-3 text-center font-medium">Overtime</th>
                  <th className="px-4 py-3 text-left font-medium">Punctuality</th>
                </tr>
              </thead>
              <tbody>
                {[...myMonthAttendance].reverse().map(r => {
                  const hrs = r.totalSeconds / 3600;
                  const sched = r.scheduledShiftHours ?? 4;
                  const basic = Math.min(hrs, sched);
                  const ot = Math.max(0, hrs - sched);
                  return (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/2">
                      <td className="px-5 py-3.5 font-medium">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3.5 text-center">{fmtTime(r.clockIn)}</td>
                      <td className="px-4 py-3.5 text-center text-muted-foreground">{fmtTime(r.clockOut)}</td>
                      <td className="px-4 py-3.5 text-center font-semibold">
                        {hrs > 0 ? fmtHrs(r.totalSeconds) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-center text-blue-400">{basic > 0 ? basic.toFixed(1) + "h" : "—"}</td>
                      <td className="px-4 py-3.5 text-center">
                        {ot > 0 ? <span className="text-purple-400 font-semibold">+{ot.toFixed(1)}h</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {r.isLate ? (
                          <span className="flex items-center gap-1 text-xs text-red-400">
                            <AlertCircle className="w-3 h-3" /> Late {r.lateMinutes}m
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <CheckCircle2 className="w-3 h-3" /> On time
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Active Tasks */}
        <Card className="glass-panel p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-lg font-display font-bold">My Tasks</h2>
            </div>
            <Link href="/tasks" className="text-xs text-muted-foreground hover:text-foreground transition-colors">View All</Link>
          </div>
          <div className="space-y-2">
            {myActiveTasks.slice(0, 6).map(task => (
              <div key={task.id} className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/5">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{task.title}</p>
                  {task.dueDate && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      Due {new Date(task.dueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <span className={`ml-2 shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                  task.priority === "High" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                  task.priority === "Medium" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                  "bg-white/5 text-muted-foreground border-white/10"
                }`}>{task.priority}</span>
              </div>
            ))}
            {myActiveTasks.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">All caught up! No active tasks.</p>
            )}
          </div>
        </Card>

        {/* My Quality Ratings */}
        <Card className="glass-panel p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-lg font-display font-bold">My Ratings</h2>
            </div>
            <Link href="/quality" className="text-xs text-muted-foreground hover:text-foreground transition-colors">View All</Link>
          </div>
          <div className="space-y-2">
            {myQCs.slice(0, 5).map(qc => (
              <div key={qc.id} className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/5">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{new Date(qc.createdAt).toLocaleDateString()}</p>
                  {qc.feedback && <p className="text-sm text-foreground/80 truncate mt-0.5 max-w-[180px]">{qc.feedback}</p>}
                </div>
                <StarRating value={qc.rating} size="md" />
              </div>
            ))}
            {myQCs.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No ratings yet.</p>}
          </div>
        </Card>
      </div>

      {/* Leaderboard — rankings only */}
      <Card className="glass-panel overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-lg font-display font-bold">Team Leaderboard</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {selYear === now.getFullYear() && selMonth === now.getMonth() + 1
              ? now.toLocaleString("default", { month: "long", year: "numeric" })
              : new Date(selYear, selMonth - 1).toLocaleString("default", { month: "long", year: "numeric" })}
          </span>
        </div>
        <div className="divide-y divide-white/5">
          {(leaderboard ?? []).map((e, i) => {
            const isMe = e.userId === userId;
            return (
              <div key={e.userId} className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${isMe ? "bg-white/5" : "hover:bg-white/2"}`}>
                <span className={`w-8 text-center font-bold ${i === 0 ? "text-yellow-400" : i === 1 ? "text-white/50" : i === 2 ? "text-orange-400/60" : "text-muted-foreground"}`}>
                  #{e.rank}
                </span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isMe ? "bg-white text-black" : "bg-white/10"}`}>
                  {initials({ firstName: e.user?.firstName, lastName: e.user?.lastName })}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${isMe ? "text-foreground" : "text-foreground/80"}`}>
                    {e.user?.firstName} {e.user?.lastName}
                    {isMe && <span className="ml-2 text-[10px] bg-white/10 text-muted-foreground px-1.5 py-0.5 rounded-full uppercase tracking-wider">You</span>}
                  </p>
                </div>
                <span className="text-sm font-mono font-semibold tabular-nums">{e.score} pts</span>
                {i < 3 && <span className="text-lg">{["🥇","🥈","🥉"][i]}</span>}
              </div>
            );
          })}
          {!leaderboard?.length && <p className="text-center text-sm text-muted-foreground py-8">No rankings yet this month.</p>}
        </div>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ROOT — decides which view to show
══════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { user: authUser } = useAuth();
  const isAdminOrHr = authUser?.role === "admin" || authUser?.role === "hr";

  if (!authUser) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (isAdminOrHr) return <AdminDashboard />;

  if (authUser.id) return <EmployeeDashboard userId={authUser.id} />;

  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-24">
      <Lock className="w-9 h-9 text-muted-foreground" />
      <p className="text-muted-foreground">Access restricted.</p>
    </div>
  );
}
