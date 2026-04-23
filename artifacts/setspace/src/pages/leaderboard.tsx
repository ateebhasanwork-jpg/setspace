import React, { useState } from "react";
import { useGetLeaderboard, getGetLeaderboardQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Trophy, RefreshCw, Star, CalendarCheck, Clock, LayoutList } from "lucide-react";
import { getUserTextColor } from "@/lib/user-colors";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

type LeaderEntry = {
  userId: string;
  user?: { firstName?: string | null; lastName?: string | null; profileImage?: string | null } | null;
  score: number;
  onTimeScore: number;
  qualityScore: number;
  attendanceScore: number;
  punctualityScore?: number;
  onTimeLogins?: number;
  scheduledLoginDays?: number;
  avgRevisions?: number;
  completedTasks?: number;
  onTimeTasks?: number;
  presentDays?: number;
  workingDays?: number;
  workedHours?: number;
  expectedHours?: number;
  rank: number;
};

function Avatar({ entry, size = "md" }: { entry: LeaderEntry; size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? "w-24 h-24 text-3xl" : size === "md" ? "w-14 h-14 text-xl" : "w-8 h-8 text-xs";
  const initials = `${entry.user?.firstName?.[0] ?? ""}${entry.user?.lastName?.[0] ?? ""}`.toUpperCase();
  if (entry.user?.profileImage) {
    return <img src={entry.user.profileImage} alt={initials} className={`${sz} rounded-full object-cover`} />;
  }
  return (
    <div className={`${sz} rounded-full bg-indigo-600/30 border border-indigo-500/20 flex items-center justify-center font-display font-bold text-indigo-200 shrink-0`}>
      {initials || "?"}
    </div>
  );
}

function ScorePill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-xs font-bold ${color}`}>{value.toFixed(0)}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

export default function Leaderboard() {
  const date = new Date();
  const [month, setMonth] = useState(date.getMonth() + 1);
  const [year, setYear] = useState(date.getFullYear());
  const queryClient = useQueryClient();

  const { data: leaderboard, isLoading, isFetching } = useGetLeaderboard({ month, year });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey({ month, year }) });
  };

  const hasData = leaderboard && leaderboard.length > 0 && leaderboard.some(e => e.score > 0);

  const chartData = leaderboard?.map((entry) => ({
    name: entry.user?.firstName || "Unknown",
    "On-Time": (entry as LeaderEntry).onTimeScore,
    Quality: (entry as LeaderEntry).qualityScore,
    Attendance: (entry as LeaderEntry).attendanceScore,
    Punctuality: (entry as LeaderEntry).punctualityScore ?? 0,
  })) || [];

  const fullName = (entry: LeaderEntry) =>
    [entry.user?.firstName, entry.user?.lastName].filter(Boolean).join(" ") || "—";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-400" /> Employee of the Month
          </h1>
          <p className="text-muted-foreground mt-1">Monthly rankings — on-time delivery, quality &amp; attendance.</p>
        </div>
        <div className="flex gap-2 shrink-0 items-center">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-indigo-500"
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1} className="bg-card">{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-indigo-500"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y} className="bg-card">{y}</option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="p-2 rounded-lg border border-white/10 bg-black/20 hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Refresh leaderboard"
          >
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Score formula legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-400" /> On-Time Tasks 40%</span>
        <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-violet-300" /> Quality Score 25%</span>
        <span className="flex items-center gap-1.5"><CalendarCheck className="w-3.5 h-3.5 text-emerald-400" /> Attendance 20%</span>
        <span className="flex items-center gap-1.5"><LayoutList className="w-3.5 h-3.5 text-sky-400" /> Punctuality 15%</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : !hasData ? (
        <div className="py-24 text-center border-2 border-dashed border-white/10 rounded-2xl">
          <Trophy className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-20" />
          <p className="text-foreground font-semibold">No performance data for {MONTHS[month - 1]} {year}</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            Rankings appear once attendance, tasks, and quality checks are recorded for this month.
          </p>
        </div>
      ) : (
        <>
          {/* ── Podium ── */}
          <div className="flex flex-col md:flex-row justify-center items-end gap-4 md:gap-6 pt-10 pb-2">
            {/* 2nd Place */}
            {leaderboard[1] && (
              <Card className="glass-panel w-full md:w-60 p-6 flex flex-col items-center relative border-t-4 border-t-slate-400 order-2 md:order-1">
                <div className="absolute -top-6 w-12 h-12 bg-slate-300 rounded-full flex items-center justify-center text-slate-800 font-bold text-xl shadow-lg border-4 border-background z-10">2</div>
                <div className="mt-3 mb-3">
                  <Avatar entry={leaderboard[1] as LeaderEntry} size="md" />
                </div>
                <h3 className={`font-bold text-base text-center ${getUserTextColor(leaderboard[1].userId)}`}>{fullName(leaderboard[1] as LeaderEntry)}</h3>
                <p className="text-muted-foreground text-sm font-mono mt-0.5">{leaderboard[1].score.toFixed(0)} pts</p>
                <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-white/10 w-full justify-center">
                  <ScorePill label="On-Time" value={(leaderboard[1] as LeaderEntry).onTimeScore} color="text-amber-400" />
                  <ScorePill label="Quality" value={(leaderboard[1] as LeaderEntry).qualityScore} color="text-violet-300" />
                  <ScorePill label="Attend." value={(leaderboard[1] as LeaderEntry).attendanceScore} color="text-emerald-400" />
                  <ScorePill label="Punctual." value={(leaderboard[1] as LeaderEntry).punctualityScore ?? 0} color="text-sky-400" />
                </div>
              </Card>
            )}

            {/* 1st Place — prominent winner */}
            {leaderboard[0] && (
              <Card className="glass-panel w-full md:w-80 p-8 flex flex-col items-center relative border-t-4 border-t-yellow-400 order-1 md:order-2 transform md:-translate-y-6 shadow-2xl shadow-yellow-500/15">
                <div className="absolute -top-10 w-20 h-20 bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-full flex items-center justify-center text-yellow-900 font-bold text-4xl shadow-xl border-4 border-background z-10">
                  🏆
                </div>
                <div className="absolute inset-0 rounded-xl bg-yellow-400/3 pointer-events-none" />
                <div className="mt-8 mb-4">
                  <Avatar entry={leaderboard[0] as LeaderEntry} size="lg" />
                </div>
                <h3 className="font-display font-bold text-2xl text-yellow-400 text-center">{fullName(leaderboard[0] as LeaderEntry)}</h3>
                <p className="text-white font-mono text-xl mt-1">{leaderboard[0].score.toFixed(0)} pts</p>
                <p className="text-xs text-yellow-400/70 mt-1 font-semibold tracking-wider uppercase">Employee of the Month</p>
                <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-white/10 w-full justify-center">
                  <ScorePill label="On-Time" value={(leaderboard[0] as LeaderEntry).onTimeScore} color="text-amber-400" />
                  <ScorePill label="Quality" value={(leaderboard[0] as LeaderEntry).qualityScore} color="text-violet-300" />
                  <ScorePill label="Attend." value={(leaderboard[0] as LeaderEntry).attendanceScore} color="text-emerald-400" />
                  <ScorePill label="Punctual." value={(leaderboard[0] as LeaderEntry).punctualityScore ?? 0} color="text-sky-400" />
                </div>
                {(leaderboard[0] as LeaderEntry).completedTasks !== undefined && (
                  <p className="text-xs text-muted-foreground mt-3">
                    {(leaderboard[0] as LeaderEntry).onTimeTasks}/{(leaderboard[0] as LeaderEntry).completedTasks} tasks on time
                    · {(leaderboard[0] as LeaderEntry).workedHours ?? (leaderboard[0] as LeaderEntry).presentDays}h worked
                  </p>
                )}
              </Card>
            )}

            {/* 3rd Place */}
            {leaderboard[2] && (
              <Card className="glass-panel w-full md:w-60 p-6 flex flex-col items-center relative border-t-4 border-t-orange-400 order-3">
                <div className="absolute -top-6 w-12 h-12 bg-orange-400 rounded-full flex items-center justify-center text-orange-950 font-bold text-xl shadow-lg border-4 border-background z-10">3</div>
                <div className="mt-3 mb-3">
                  <Avatar entry={leaderboard[2] as LeaderEntry} size="md" />
                </div>
                <h3 className={`font-bold text-base text-center ${getUserTextColor(leaderboard[2].userId)}`}>{fullName(leaderboard[2] as LeaderEntry)}</h3>
                <p className="text-muted-foreground text-sm font-mono mt-0.5">{leaderboard[2].score.toFixed(0)} pts</p>
                <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-white/10 w-full justify-center">
                  <ScorePill label="On-Time" value={(leaderboard[2] as LeaderEntry).onTimeScore} color="text-amber-400" />
                  <ScorePill label="Quality" value={(leaderboard[2] as LeaderEntry).qualityScore} color="text-violet-300" />
                  <ScorePill label="Attend." value={(leaderboard[2] as LeaderEntry).attendanceScore} color="text-emerald-400" />
                  <ScorePill label="Punctual." value={(leaderboard[2] as LeaderEntry).punctualityScore ?? 0} color="text-sky-400" />
                </div>
              </Card>
            )}
          </div>

          {/* ── Chart + Rankings ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
            {/* Score breakdown chart */}
            <Card className="glass-panel lg:col-span-2 p-6">
              <h3 className="font-display font-bold mb-6 text-lg">Score Breakdown</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      contentStyle={{ backgroundColor: "#111", borderColor: "#333", borderRadius: "10px", fontSize: "12px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "16px" }} />
                    <Bar dataKey="On-Time" stackId="a" fill="#f59e0b" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="Quality" stackId="a" fill="#a78bfa" />
                    <Bar dataKey="Attendance" stackId="a" fill="#10b981" />
                    <Bar dataKey="Punctuality" stackId="a" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Full rankings */}
            <Card className="glass-panel p-6 flex flex-col overflow-hidden">
              <h3 className="font-display font-bold mb-4 text-lg flex items-center gap-2">
                <LayoutList className="w-4 h-4 text-muted-foreground" /> Full Rankings
              </h3>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {leaderboard?.map((entry, idx) => (
                  <div key={entry.userId} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                    idx === 0 ? "bg-yellow-500/5 border-yellow-500/20" :
                    idx === 1 ? "bg-slate-500/5 border-slate-400/20" :
                    idx === 2 ? "bg-orange-500/5 border-orange-400/20" :
                    "bg-white/3 border-white/5"
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-5 text-center font-mono font-bold text-sm ${
                        idx === 0 ? "text-yellow-400" : idx === 1 ? "text-slate-300" : idx === 2 ? "text-orange-400" : "text-muted-foreground"
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-300">
                        {(entry.user?.firstName?.[0] ?? "") + (entry.user?.lastName?.[0] ?? "")}
                      </div>
                      <div>
                        <span className={`font-medium text-sm ${getUserTextColor(entry.userId)}`}>{fullName(entry as LeaderEntry)}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-amber-400">{(entry as LeaderEntry).onTimeScore.toFixed(0)} OT</span>
                          <span className="text-[10px] text-violet-300">{(entry as LeaderEntry).qualityScore.toFixed(0)} Q</span>
                          <span className="text-[10px] text-emerald-400">{(entry as LeaderEntry).attendanceScore.toFixed(0)} A</span>
                          <span className="text-[10px] text-sky-400">{((entry as LeaderEntry).punctualityScore ?? 0).toFixed(0)} P</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold text-foreground">{entry.score.toFixed(0)}</div>
                      <div className="text-[10px] text-muted-foreground">pts</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
