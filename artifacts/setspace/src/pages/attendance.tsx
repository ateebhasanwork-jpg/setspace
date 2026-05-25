import React, { useEffect, useState } from "react";
import {
  useListAttendance,
  useGetTodayAttendance,
  useClockIn,
  useClockOut,
  useGetCurrentUser,
  getListAttendanceQueryKey,
  getGetTodayAttendanceQueryKey,
  type AttendanceRecord,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Clock, LogIn, LogOut, Calendar as CalIcon,
  TimerReset, Trash2, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, TrendingUp, Timer,
} from "lucide-react";

type AttendanceWithExtra = AttendanceRecord & {
  accumulatedSeconds?: number;
  lastClockIn?: string | null;
  totalSeconds?: number;
  isLate?: boolean;
  lateMinutes?: number;
  scheduledShiftHours?: number;
};

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function formatSeconds(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function formatHoursCompact(secs: number): string {
  if (secs <= 0) return "0h 00m";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function LiveTimer({
  accumulatedSeconds,
  lastClockIn,
}: {
  accumulatedSeconds: number;
  lastClockIn: string | null;
}) {
  const sessionStart = lastClockIn ? new Date(lastClockIn) : null;
  const getTotal = () => {
    if (!sessionStart) return accumulatedSeconds;
    const elapsed = Math.floor((Date.now() - sessionStart.getTime()) / 1000);
    return accumulatedSeconds + elapsed;
  };
  const [total, setTotal] = useState(getTotal);

  useEffect(() => {
    if (!sessionStart) return;
    const id = setInterval(() => setTotal(getTotal()), 1000);
    return () => clearInterval(id);
  }, [lastClockIn, accumulatedSeconds]);

  return (
    <div className="text-4xl font-mono font-bold text-foreground tracking-widest tabular-nums">
      {formatSeconds(total)}
    </div>
  );
}

const MONTHS: Record<string, string> = {
  "01": "January", "02": "February", "03": "March", "04": "April",
  "05": "May", "06": "June", "07": "July", "08": "August",
  "09": "September", "10": "October", "11": "November", "12": "December",
};

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${color}`}>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold font-mono text-foreground">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

export default function Attendance() {
  const queryClient = useQueryClient();
  const { data: records, isLoading } = useListAttendance();
  const { data: today } = useGetTodayAttendance({
    query: { queryKey: getGetTodayAttendanceQueryKey() },
  });
  const { data: currentUser } = useGetCurrentUser();

  const isManager =
    (currentUser as { role?: string } | undefined)?.role === "admin" ||
    (currentUser as { role?: string } | undefined)?.role === "hr" ||
    (currentUser as { role?: string } | undefined)?.role === "coordinator";

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  const toggleMonth = (key: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
  };

  const clockInMut = useClockIn({ mutation: { onSuccess: invalidate } });
  const clockOutMut = useClockOut({ mutation: { onSuccess: invalidate } });

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`${BASE}/api/attendance/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      invalidate();
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const isActivelyIn = !!today?.clockIn && !today?.clockOut;
  const todayEx = today as AttendanceWithExtra | undefined;
  const accumulatedSeconds: number = todayEx?.accumulatedSeconds ?? 0;
  const lastClockIn: string | null = todayEx?.lastClockIn ?? today?.clockIn ?? null;

  // Group records by YYYY-MM, newest first
  const grouped = React.useMemo(() => {
    if (!records) return [];
    const map = new Map<string, typeof records>();
    for (const rec of [...records].reverse()) {
      const key = rec.date.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(rec);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [records]);

  // Current month stats (for the logged-in user's own records)
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const myRecords = (records ?? []).filter(r =>
    (r as AttendanceWithExtra & { userId?: string }).userId === (currentUser as { id?: string } | undefined)?.id ||
    r.user?.firstName !== undefined
  );
  const thisMonthRecs = grouped.find(([k]) => k === currentMonthKey)?.[1] ?? [];
  const thisMonthPresent = thisMonthRecs.length;
  const thisMonthHours = thisMonthRecs.reduce((sum, r) => {
    const ex = r as AttendanceWithExtra;
    return sum + (ex.totalSeconds ?? ex.accumulatedSeconds ?? 0);
  }, 0);
  const thisMonthLate = thisMonthRecs.filter(r => (r as AttendanceWithExtra).isLate).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Attendance</h1>
        <p className="text-muted-foreground mt-1">Clock in and out to track your work hours.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Clock Card ── */}
        <Card className="glass-panel p-7 flex flex-col items-center text-center gap-5 lg:sticky lg:top-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-display font-bold">Today's Session</h2>
          </div>

          {!today?.clockIn ? (
            <div className="space-y-4 w-full">
              <div className="px-4 py-6 bg-muted border border-border rounded-2xl text-muted-foreground text-sm">
                <CalIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                You haven't clocked in yet today.
              </div>
              <Button
                onClick={() => clockInMut.mutate()}
                disabled={clockInMut.isPending}
                className="w-full bg-foreground hover:bg-foreground/80 text-background rounded-xl h-12 text-base font-semibold"
              >
                <LogIn className="w-5 h-5 mr-2" /> Clock In
              </Button>
            </div>
          ) : (
            <div className="space-y-3 w-full">
              {/* Clock-in time */}
              <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-left">
                <p className="text-emerald-700 dark:text-emerald-400 font-semibold text-xs uppercase tracking-wider mb-0.5">Clocked In At</p>
                <p className="text-base font-mono font-bold text-foreground">{new Date(today.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>

              {/* Late warning */}
              {todayEx?.isLate && (
                <div className="px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-left">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <div>
                    <p className="text-red-600 font-semibold text-sm">Late arrival</p>
                    <p className="text-xs text-muted-foreground">{todayEx.lateMinutes} min after scheduled time</p>
                  </div>
                </div>
              )}

              {/* Timer */}
              <div className="py-5 rounded-2xl bg-muted border border-border flex flex-col items-center gap-1">
                <span className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
                  <Timer className="w-3 h-3" /> Time Worked Today
                </span>
                {isActivelyIn ? (
                  <LiveTimer accumulatedSeconds={accumulatedSeconds} lastClockIn={lastClockIn} />
                ) : (
                  <div className="text-4xl font-mono font-bold text-muted-foreground tracking-widest tabular-nums">
                    {formatSeconds(accumulatedSeconds)}
                  </div>
                )}
                <span className={`text-xs mt-1 font-semibold flex items-center gap-1 ${isActivelyIn ? "text-emerald-600" : "text-amber-600"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActivelyIn ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                  {isActivelyIn ? "Currently working" : "Session paused"}
                </span>
              </div>

              {/* Scheduled shift info */}
              {todayEx?.scheduledShiftHours && (
                <p className="text-xs text-muted-foreground text-center">
                  Scheduled shift: {todayEx.scheduledShiftHours}h
                </p>
              )}

              {isActivelyIn ? (
                <Button
                  onClick={() => clockOutMut.mutate()}
                  disabled={clockOutMut.isPending}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg h-12 text-base font-semibold"
                >
                  <LogOut className="w-5 h-5 mr-2" /> Clock Out
                </Button>
              ) : (
                <>
                  <div className="px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-left">
                    <p className="text-blue-700 dark:text-blue-400 font-semibold text-xs uppercase tracking-wider mb-0.5">Last Clock Out</p>
                    <p className="text-base font-mono font-bold text-foreground">{new Date(today.clockOut!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <Button
                    onClick={() => clockInMut.mutate()}
                    disabled={clockInMut.isPending}
                    className="w-full bg-foreground hover:bg-foreground/80 text-background rounded-xl h-12 text-base font-semibold"
                  >
                    <TimerReset className="w-5 h-5 mr-2" /> Resume Session
                  </Button>
                </>
              )}
            </div>
          )}
        </Card>

        {/* ── Right Column ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* This month summary */}
          {!isLoading && thisMonthRecs.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label="Days Present"
                value={String(thisMonthPresent)}
                sub="this month"
                color="border-border bg-card"
              />
              <StatCard
                label="Hours Worked"
                value={formatHoursCompact(thisMonthHours)}
                sub="this month"
                color="border-border bg-card"
              />
              <StatCard
                label="Late Arrivals"
                value={String(thisMonthLate)}
                sub={thisMonthLate === 0 ? "perfect record!" : "this month"}
                color={thisMonthLate === 0 ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20" : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"}
              />
            </div>
          )}

          {/* Records */}
          {isLoading ? (
            <Card className="glass-panel p-8 flex justify-center">
              <div className="w-8 h-8 border-4 border-foreground border-t-transparent rounded-full animate-spin" />
            </Card>
          ) : grouped.length === 0 ? (
            <Card className="glass-panel p-12 text-center">
              <CalIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground">No attendance records yet.</p>
            </Card>
          ) : grouped.map(([monthKey, recs]) => {
            const [yr, mo] = monthKey.split("-");
            const monthLabel = `${MONTHS[mo] ?? mo} ${yr}`;
            const isCollapsed = collapsedMonths.has(monthKey);
            const lateCount = recs.filter(r => (r as AttendanceWithExtra).isLate).length;
            const totalHrs = recs.reduce((s, r) => s + ((r as AttendanceWithExtra).totalSeconds ?? (r as AttendanceWithExtra).accumulatedSeconds ?? 0), 0);
            return (
              <Card key={monthKey} className="glass-panel overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-6 py-4 border-b border-border hover:bg-muted/50 transition-colors"
                  onClick={() => toggleMonth(monthKey)}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <CalIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-display font-bold text-base">{monthLabel}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                      {recs.length} day{recs.length !== 1 ? "s" : ""} present
                    </span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                      {formatHoursCompact(totalHrs)} total
                    </span>
                    {lateCount > 0 && (
                      <span className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                        {lateCount} late
                      </span>
                    )}
                    {lateCount === 0 && recs.length > 0 && (
                      <span className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> All on time
                      </span>
                    )}
                  </div>
                  {isCollapsed
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    : <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                  }
                </button>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                        <tr>
                          <th className="px-5 py-3 font-medium">Employee</th>
                          <th className="px-5 py-3 font-medium">Date</th>
                          <th className="px-5 py-3 font-medium">Clock In</th>
                          <th className="px-5 py-3 font-medium">Clock Out</th>
                          <th className="px-5 py-3 font-medium">Regular</th>
                          <th className="px-5 py-3 font-medium">Overtime</th>
                          <th className="px-5 py-3 font-medium">Status</th>
                          {isManager && <th className="px-4 py-3 w-10" />}
                        </tr>
                      </thead>
                      <tbody>
                        {recs.map((rec) => {
                          const recEx = rec as AttendanceWithExtra;
                          const totalSecs = recEx.totalSeconds ?? 0;
                          const shiftSecs = (recEx.scheduledShiftHours ?? 8) * 3600;
                          const basicSecs = Math.min(totalSecs, shiftSecs);
                          const overtimeSecs = Math.max(0, totalSecs - shiftSecs);
                          const isOpen = !!rec.clockIn && !rec.clockOut;
                          return (
                            <tr
                              key={rec.id}
                              className="border-b border-border hover:bg-muted/40 transition-colors"
                            >
                              <td className="px-5 py-3 font-medium text-foreground">
                                {rec.user?.firstName} {rec.user?.lastName}
                              </td>
                              <td className="px-5 py-3 text-muted-foreground text-xs">
                                {new Date(rec.date + "T00:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                              </td>
                              <td className="px-5 py-3 font-mono text-sm">
                                <div className="flex items-center gap-1.5">
                                  <span>{new Date(rec.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                  {recEx.isLate && (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-200 dark:border-red-800"
                                      title={`${recEx.lateMinutes} min late`}
                                    >
                                      <AlertTriangle className="w-2.5 h-2.5" />
                                      {recEx.lateMinutes}m late
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-3 font-mono text-sm">
                                {isOpen ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Live
                                  </span>
                                ) : (
                                  new Date(rec.clockOut!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                )}
                              </td>
                              <td className="px-5 py-3 font-mono text-sm text-muted-foreground">
                                {totalSecs > 0 ? formatHoursCompact(basicSecs) : "—"}
                              </td>
                              <td className="px-5 py-3 font-mono text-sm">
                                {overtimeSecs > 0 ? (
                                  <span className="text-amber-600 font-semibold">
                                    +{formatHoursCompact(overtimeSecs)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-5 py-3">
                                <span
                                  className={`px-2 py-1 rounded-md text-xs font-semibold capitalize ${
                                    rec.status === "Present" || rec.status === "present"
                                      ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                                      : "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400"
                                  }`}
                                >
                                  {rec.status}
                                </span>
                              </td>
                              {isManager && (
                                <td className="px-4 py-3">
                                  {confirmDeleteId === rec.id ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleDelete(rec.id)}
                                        disabled={deletingId === rec.id}
                                        className="text-[10px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 px-2 py-1 rounded border border-red-500/20 disabled:opacity-50"
                                      >
                                        {deletingId === rec.id ? "…" : "OK"}
                                      </button>
                                      <button
                                        onClick={() => setConfirmDeleteId(null)}
                                        className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border"
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setConfirmDeleteId(rec.id)}
                                      className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                      title="Delete record"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
