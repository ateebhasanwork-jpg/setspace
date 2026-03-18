import React, { useEffect, useState } from "react";
import { useListAttendance, useGetTodayAttendance, useClockIn, useClockOut, getListAttendanceQueryKey, getGetTodayAttendanceQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogIn, LogOut, Calendar as CalIcon, TimerReset } from "lucide-react";

function formatSeconds(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
}

function LiveTimer({ accumulatedSeconds, lastClockIn }: { accumulatedSeconds: number; lastClockIn: string | null }) {
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

export default function Attendance() {
  const queryClient = useQueryClient();
  const { data: records, isLoading } = useListAttendance();
  const { data: today } = useGetTodayAttendance({ query: { refetchInterval: 30000 } });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
  };

  const clockInMut = useClockIn({ mutation: { onSuccess: invalidate } });
  const clockOutMut = useClockOut({ mutation: { onSuccess: invalidate } });

  const isActivelyIn = !!today?.clockIn && !today?.clockOut;
  const hasClockedOutToday = !!today?.clockIn && !!today?.clockOut;
  const accumulatedSeconds: number = (today as any)?.accumulatedSeconds ?? 0;
  const lastClockIn: string | null = (today as any)?.lastClockIn ?? today?.clockIn ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Attendance</h1>
          <p className="text-muted-foreground mt-1">Time tracking and status.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass-panel p-8 flex flex-col items-center justify-center text-center gap-5">
          <Clock className="w-12 h-12 text-primary" />
          <h2 className="text-2xl font-display font-bold">Today's Status</h2>

          {!today?.clockIn ? (
            /* Never clocked in */
            <div className="space-y-4 w-full">
              <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-muted-foreground text-sm">
                Not clocked in yet today.
              </div>
              <Button
                onClick={() => clockInMut.mutate()}
                disabled={clockInMut.isPending}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg shadow-primary/20 h-12 text-base"
              >
                <LogIn className="w-5 h-5 mr-2" /> Clock In
              </Button>
            </div>
          ) : (
            <div className="space-y-4 w-full">
              {/* First clock-in badge */}
              <div className="px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <p className="text-green-400 font-semibold text-sm mb-0.5">First Clock In</p>
                <p className="text-sm font-mono">{new Date(today.clockIn).toLocaleTimeString()}</p>
              </div>

              {/* Live timer */}
              <div className="py-4 rounded-2xl bg-black/30 border border-white/5 flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Time Worked</span>
                {isActivelyIn ? (
                  <LiveTimer accumulatedSeconds={accumulatedSeconds} lastClockIn={lastClockIn} />
                ) : (
                  <div className="text-4xl font-mono font-bold text-muted-foreground tracking-widest tabular-nums">
                    {formatSeconds(accumulatedSeconds)}
                  </div>
                )}
                <span className={`text-xs mt-1 font-medium ${isActivelyIn ? "text-green-400" : "text-amber-400"}`}>
                  {isActivelyIn ? "● Live" : "● Paused"}
                </span>
              </div>

              {isActivelyIn ? (
                /* Currently clocked in — show Clock Out */
                <Button
                  onClick={() => clockOutMut.mutate()}
                  disabled={clockOutMut.isPending}
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl shadow-lg shadow-accent/20 h-12 text-base"
                >
                  <LogOut className="w-5 h-5 mr-2" /> Clock Out
                </Button>
              ) : (
                /* Clocked out — show Clock Out time + Clock In Again */
                <>
                  <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <p className="text-blue-400 font-semibold text-sm mb-0.5">Last Clock Out</p>
                    <p className="text-sm font-mono">{new Date(today.clockOut!).toLocaleTimeString()}</p>
                  </div>
                  <Button
                    onClick={() => clockInMut.mutate()}
                    disabled={clockInMut.isPending}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg shadow-primary/20 h-12 text-base"
                  >
                    <TimerReset className="w-5 h-5 mr-2" /> Clock In Again
                  </Button>
                </>
              )}
            </div>
          )}
        </Card>

        <Card className="glass-panel lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-white/5 bg-black/10 flex items-center">
            <CalIcon className="w-5 h-5 mr-3 text-muted-foreground" />
            <h3 className="font-display font-bold text-lg">Recent Team Records</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-black/20 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Clock In</th>
                  <th className="px-6 py-4 font-medium">Clock Out</th>
                  <th className="px-6 py-4 font-medium">Time Worked</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {records?.slice().reverse().map(rec => {
                  const totalSecs = (rec as any).totalSeconds ?? 0;
                  return (
                    <tr key={rec.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">
                        {rec.user?.firstName} {rec.user?.lastName}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{new Date(rec.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-mono">{new Date(rec.clockIn).toLocaleTimeString()}</td>
                      <td className="px-6 py-4 font-mono">{rec.clockOut ? new Date(rec.clockOut).toLocaleTimeString() : <span className="text-green-400 text-xs font-semibold">Live</span>}</td>
                      <td className="px-6 py-4 font-mono text-muted-foreground">{totalSecs > 0 ? formatSeconds(totalSecs) : "—"}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-sm text-xs font-bold uppercase tracking-wider ${
                          rec.status === 'Present' || rec.status === 'present' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
