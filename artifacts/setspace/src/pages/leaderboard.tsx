import React, { useState } from "react";
import { useGetLeaderboard } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Trophy, Medal, Star, Target, Clock, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function Leaderboard() {
  const date = new Date();
  const [month, setMonth] = useState(date.getMonth() + 1);
  const [year, setYear] = useState(date.getFullYear());
  
  const { data: leaderboard, isLoading } = useGetLeaderboard({ month, year });

  const chartData = leaderboard?.map(entry => ({
    name: entry.user?.firstName || 'Unknown',
    KPI: entry.kpiScore,
    Quality: entry.qualityScore,
    Attendance: entry.attendanceScore,
    OnTime: entry.onTimeScore,
    Total: entry.score
  })) || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-400" /> Employee of the Month
          </h1>
          <p className="text-muted-foreground mt-1">Monthly performance rankings based on core metrics.</p>
        </div>
        <div className="flex gap-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary">
            {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1} className="bg-card">{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary">
            {[2024, 2025, 2026].map(y => <option key={y} value={y} className="bg-card">{y}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <>
          {/* Top 3 Podium */}
          <div className="flex flex-col md:flex-row justify-center items-end gap-4 md:gap-8 pt-8 pb-4">
            {/* 2nd Place */}
            {leaderboard?.[1] && (
              <Card className="glass-panel w-full md:w-64 p-6 flex flex-col items-center relative order-2 md:order-1 border-t-4 border-t-gray-300">
                <div className="absolute -top-6 w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center text-gray-800 font-bold text-xl shadow-lg border-4 border-background z-10">2</div>
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-200 to-gray-400 mb-4 mt-2 flex items-center justify-center text-gray-800 font-display font-bold text-2xl">
                  {leaderboard[1].user?.firstName?.[0]}
                </div>
                <h3 className="font-bold text-lg">{leaderboard[1].user?.firstName}</h3>
                <p className="text-muted-foreground text-sm font-mono">{leaderboard[1].score.toFixed(0)} pts</p>
              </Card>
            )}
            
            {/* 1st Place */}
            {leaderboard?.[0] && (
              <Card className="glass-panel w-full md:w-72 p-8 flex flex-col items-center relative order-1 md:order-2 border-t-4 border-t-yellow-400 transform md:-translate-y-4 shadow-xl shadow-yellow-500/20 bg-primary/5">
                <div className="absolute -top-8 w-16 h-16 bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-full flex items-center justify-center text-yellow-900 font-bold text-3xl shadow-xl border-4 border-background z-10 shadow-yellow-500/50">1</div>
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent mb-4 mt-4 flex items-center justify-center text-white font-display font-bold text-4xl shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                  {leaderboard[0].user?.firstName?.[0]}
                </div>
                <h3 className="font-display font-bold text-2xl text-yellow-400">{leaderboard[0].user?.firstName} {leaderboard[0].user?.lastName}</h3>
                <p className="text-white font-mono text-xl mt-1">{leaderboard[0].score.toFixed(0)} pts</p>
              </Card>
            )}

            {/* 3rd Place */}
            {leaderboard?.[2] && (
              <Card className="glass-panel w-full md:w-64 p-6 flex flex-col items-center relative order-3 border-t-4 border-t-orange-400">
                <div className="absolute -top-6 w-12 h-12 bg-orange-400 rounded-full flex items-center justify-center text-orange-950 font-bold text-xl shadow-lg border-4 border-background z-10">3</div>
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-300 to-orange-600 mb-4 mt-2 flex items-center justify-center text-orange-950 font-display font-bold text-2xl">
                  {leaderboard[2].user?.firstName?.[0]}
                </div>
                <h3 className="font-bold text-lg">{leaderboard[2].user?.firstName}</h3>
                <p className="text-muted-foreground text-sm font-mono">{leaderboard[2].score.toFixed(0)} pts</p>
              </Card>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8">
            <Card className="glass-panel lg:col-span-2 p-6 h-[400px]">
              <h3 className="font-display font-bold mb-6 text-lg">Score Breakdown</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '8px' }} />
                  <Bar dataKey="KPI" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="Quality" stackId="a" fill="hsl(var(--accent))" />
                  <Bar dataKey="Attendance" stackId="a" fill="#10b981" />
                  <Bar dataKey="OnTime" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="glass-panel p-6 overflow-hidden flex flex-col">
              <h3 className="font-display font-bold mb-4 text-lg">Full Rankings</h3>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {leaderboard?.map((entry, idx) => (
                  <div key={entry.userId} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-center font-mono text-muted-foreground font-bold">{idx + 1}</span>
                      <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-xs font-bold text-white border border-white/10">
                        {entry.user?.firstName?.[0]}
                      </div>
                      <span className="font-medium text-sm">{entry.user?.firstName}</span>
                    </div>
                    <span className="font-mono text-sm font-semibold">{entry.score.toFixed(0)}</span>
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
