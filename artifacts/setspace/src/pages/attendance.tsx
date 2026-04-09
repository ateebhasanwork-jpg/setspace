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
import { Clock, LogIn, LogOut, Calendar as CalIcon, TimerReset, Trash2, ChevronDown, ChevronUp } from "lucide-react";

type AttendanceWithExtra = AttendanceRecord & {
  accumulatedSeconds?: number;
  lastClockIn?: string | null;
  totalSeconds?: number;
};

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// Standard shift = 4 hours. Anything above is overtime.
const STANDARD_SHIFT_SECONDS = 4 * 3600;

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

export default function Attendance() {
  const queryClient = useQueryClient();
  const { data: records, isLoading } = useListAttendance();
  const { data: today } = useGetTodayAttendance({
    query: { queryKey: getGetTodayAttendanceQueryKey() },
  });
  const { data: currentUser } = useGetCurrentUser();

  const isManager =
    (currentUser as { role?: string } | undefined)?.role === "admin" ||
    (currentUser as { role?: string } | undefined)?.role === "hr";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Attendance</h1>
          <p className="text-muted-foreground mt-1">Time tracking and status.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Sticky Clock Card ── */}
        <Card className="glass-panel p-8 flex flex-col items-center justify-center text-center gap-5 lg:sticky lg:top-4">
          <Clock className="w-12 h-12 text-indigo-400" />
          <h2 className="text-2xl font-display font-bold">Today's Status</h2>

          {!today?.clockIn ? (
            <div className="space-y-4 w-full">
              <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-muted-foreground text-sm">
                Not clocked in yet today.
              </div>
              <Button
                onClick={() => clockInMut.mutate()}
                disabled={clockInMut.isPending}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 h-12 text-base"
              >
                <LogIn className="w-5 h-5 mr-2" /> Clock In
              </Button>
            </div>
          ) : (
            <div className="space-y-4 w-full">
              <div className="px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <p className="text-green-400 font-semibold text-sm mb-0.5">First Clock In</p>
                <p className="text-sm font-mono">{new Date(today.clockIn).toLocaleTimeString()}</p>
              </div>

              <div className="py-4 rounded-2xl bg-black/30 border border-white/5 flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
                  Time Worked
                </span>
                {isActivelyIn ? (
                  <LiveTimer
                    accumulatedSeconds={accumulatedSeconds}
                    lastClockIn={lastClockIn}
                  />
                ) : (
                  <div className="text-4xl font-mono font-bold text-muted-foreground tracking-widest tabular-nums">
                    {formatSeconds(accumulatedSeconds)}
                  </div>
                )}
                <span
                  className={`text-xs mt-1 font-medium ${isActivelyIn ? "text-green-400" : "text-amber-400"}`}
                >
                  {isActivelyIn ? "● Live" : "● Paused"}
                </span>
              </div>

              {isActivelyIn ? (
                <Button
                  onClick={() => clockOutMut.mutate()}
                  disabled={clockOutMut.isPending}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg h-12 text-base"
                >
                  <LogOut className="w-5 h-5 mr-2" /> Clock Out
                </Button>
              ) : (
                <>
                  <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <p className="text-blue-400 font-semibold text-sm mb-0.5">Last Clock Out</p>
                    <p className="text-sm font-mono">
                      {new Date(today.clockOut!).toLocaleTimeString()}
                    </p>
                  </div>
                  <Button
                    onClick={() => clockInMut.mutate()}
                    disabled={clockInMut.isPending}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 h-12 text-base"
                  >
                    <TimerReset className="w-5 h-5 mr-2" /> Clock In Again
                  </Button>
                </>
              )}
            </div>
          )}
        </Card>

        {/* ── Monthly Records ── */}
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <Card className="glass-panel p-8 flex justify-center">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
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
            return (
              <Card key={monthKey} className="glass-panel overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/10 hover:bg-white/3 transition-colors"
                  onClick={() => toggleMonth(monthKey)}
                >
                  <div className="flex items-center gap-3">
                    <CalIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="font-display font-bold text-base">{monthLabel}</span>
                    <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                      {recs.length} record{recs.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {isCollapsed
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    : <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  }
                </button>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-black/20 border-b border-white/5">
                        <tr>
                          <th className="px-5 py-3 font-medium">Employee</th>
                          <th className="px-5 py-3 font-medium">Date</th>
                          <th className="px-5 py-3 font-medium">Clock In</th>
                          <th className="px-5 py-3 font-medium">Clock Out</th>
                          <th className="px-5 py-3 font-medium">Basic</th>
                          <th className="px-5 py-3 font-medium">Overtime</th>
                          <th className="px-5 py-3 font-medium">Status</th>
                          {isManager && <th className="px-4 py-3 w-10" />}
                        </tr>
                      </thead>
                      <tbody>
                        {recs.map((rec) => {
                          const totalSecs = (rec as AttendanceWithExtra).totalSeconds ?? 0;
                          const basicSecs = Math.min(totalSecs, STANDARD_SHIFT_SECONDS);
                          const overtimeSecs = Math.max(0, totalSecs - STANDARD_SHIFT_SECONDS);
                          return (
                            <tr
                              key={rec.id}
                              className="border-b border-white/5 hover:bg-white/5 transition-colors"
                            >
                              <td className="px-5 py-3 font-medium text-foreground">
                                {rec.user?.firstName} {rec.user?.lastName}
                              </td>
                              <td className="px-5 py-3 text-muted-foreground">
                                {new Date(rec.date).toLocaleDateString()}
                              </td>
                              <td className="px-5 py-3 font-mono text-sm">
                                {new Date(rec.clockIn).toLocaleTimeString()}
                              </td>
                              <td className="px-5 py-3 font-mono text-sm">
                                {rec.clockOut ? (
                                  new Date(rec.clockOut).toLocaleTimeString()
                                ) : (
                                  <span className="text-green-400 text-xs font-semibold">Live</span>
                                )}
                              </td>
                              <td className="px-5 py-3 font-mono text-sm text-muted-foreground">
                                {totalSecs > 0 ? formatHoursCompact(basicSecs) : "—"}
                              </td>
                              <td className="px-5 py-3 font-mono text-sm">
                                {overtimeSecs > 0 ? (
                                  <span className="text-amber-400 font-semibold">
                                    +{formatHoursCompact(overtimeSecs)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-5 py-3">
                                <span
                                  className={`px-2 py-1 rounded-sm text-xs font-bold uppercase tracking-wider ${
                                    rec.status === "Present" || rec.status === "present"
                                      ? "bg-green-500/20 text-green-400"
                                      : "bg-yellow-500/20 text-yellow-400"
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
                                        className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-white/10"
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
