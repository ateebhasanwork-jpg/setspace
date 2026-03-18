import React from "react";
import {
  useListTasks,
  useGetTodayAttendance,
  useListVideoProjects,
  useGetLeaderboard,
  useListQualityChecks,
} from "@workspace/api-client-react";
import type { Task } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Card } from "@/components/ui/card";
import { CheckSquare, Clock, Trophy, Video, PlayCircle, Star, TimerOff, Lock } from "lucide-react";
import { Link } from "wouter";

type TaskWithDerived = Task & { completedOnTime?: boolean | null };

export default function Dashboard() {
  const { user } = useAuth();
  const isAdminOrHr = user?.role === "admin" || user?.role === "hr";

  const { data: tasks } = useListTasks();
  const { data: attendance } = useGetTodayAttendance();
  const { data: projects } = useListVideoProjects();
  const { data: leaderboard } = useGetLeaderboard({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const { data: qualityChecks } = useListQualityChecks({});

  const activeTasks = tasks?.filter((t) => t.status !== "Done") || [];
  const topPerformer = leaderboard?.[0];
  const recentProjects = projects?.slice(0, 4) || [];

  // On-time rate (admin/hr only metric)
  const doneTasks = (tasks as TaskWithDerived[] | undefined)?.filter((t) => t.status === "Done" && t.completedOnTime !== null && t.completedOnTime !== undefined) || [];
  const onTimeCount = doneTasks.filter((t) => t.completedOnTime === true).length;
  const onTimeRate = doneTasks.length > 0 ? Math.round((onTimeCount / doneTasks.length) * 100) : null;

  // Average quality rating (admin/hr only metric)
  const avgRating = qualityChecks && qualityChecks.length > 0
    ? (qualityChecks.reduce((sum, q) => sum + q.rating, 0) / qualityChecks.length).toFixed(1)
    : null;

  if (!isAdminOrHr) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center gap-6 py-24">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
          <Lock className="w-9 h-9 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">Dashboard Access Restricted</h2>
          <p className="text-muted-foreground max-w-sm">
            The overview dashboard is available to management only. Use the navigation to access your tasks, attendance, or team chat.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/tasks">
            <span className="px-5 py-2 rounded-xl bg-primary/20 text-primary font-semibold text-sm hover:bg-primary/30 transition-colors cursor-pointer">My Tasks</span>
          </Link>
          <Link href="/attendance">
            <span className="px-5 py-2 rounded-xl bg-white/5 text-foreground font-semibold text-sm hover:bg-white/10 transition-colors cursor-pointer border border-white/10 cursor-pointer">Attendance</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Overview</h1>
        <p className="text-muted-foreground mt-1 text-lg">Welcome back to Setspace HQ.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="glass-panel p-6 flex flex-col justify-between relative overflow-hidden group hover:border-primary/50 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <CheckSquare className="w-16 h-16 text-primary" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Active Tasks</p>
          <div className="text-4xl font-display font-bold text-foreground">{activeTasks.length}</div>
        </Card>

        <Card className="glass-panel p-6 flex flex-col justify-between relative overflow-hidden group hover:border-primary/50 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TimerOff className="w-16 h-16 text-green-400" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-2">On-Time Delivery</p>
          <div className="text-4xl font-display font-bold text-foreground">
            {onTimeRate !== null ? (
              <span className={onTimeRate >= 80 ? "text-green-400" : onTimeRate >= 60 ? "text-yellow-400" : "text-red-400"}>
                {onTimeRate}%
              </span>
            ) : (
              <span className="text-muted-foreground text-2xl">No data</span>
            )}
          </div>
          {doneTasks.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">{onTimeCount}/{doneTasks.length} tasks on time</p>
          )}
        </Card>

        <Card className="glass-panel p-6 flex flex-col justify-between relative overflow-hidden group hover:border-primary/50 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Star className="w-16 h-16 text-yellow-400" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Avg Quality Rating</p>
          <div className="text-4xl font-display font-bold text-foreground">
            {avgRating !== null ? (
              <span className="text-yellow-400">{avgRating}<span className="text-xl text-muted-foreground">/5</span></span>
            ) : (
              <span className="text-muted-foreground text-2xl">No data</span>
            )}
          </div>
          {qualityChecks && qualityChecks.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">Based on {qualityChecks.length} review{qualityChecks.length !== 1 ? "s" : ""}</p>
          )}
        </Card>

        <Card className="glass-panel p-6 flex flex-col justify-between relative overflow-hidden group hover:border-primary/50 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Trophy className="w-16 h-16 text-accent" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Top Performer</p>
          <div className="text-2xl font-display font-bold text-foreground truncate">
            {topPerformer ? `${topPerformer.user?.firstName} ${topPerformer.user?.lastName}` : "TBD"}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Video Projects */}
        <Card className="glass-panel p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-display font-bold">Recent Video Reviews</h2>
            <Link href="/videos" className="text-sm text-primary hover:underline">View All</Link>
          </div>
          <div className="space-y-4">
            {recentProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-black/20 rounded-xl border border-white/5">
                No active video projects
              </div>
            ) : (
              recentProjects.map((proj) => (
                <Link key={proj.id} href={`/videos/${proj.id}`}>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <PlayCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{proj.title}</h3>
                        <p className="text-sm text-muted-foreground">{proj.clientName || "Internal"}</p>
                      </div>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        proj.status === "Approved"
                          ? "bg-green-500/20 text-green-400"
                          : proj.status === "Needs Revision"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {proj.status}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* All Tasks Widget */}
        <Card className="glass-panel p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-display font-bold">Active Tasks</h2>
            <Link href="/tasks" className="text-sm text-primary hover:underline">View All</Link>
          </div>
          <div className="space-y-3">
            {activeTasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
              >
                <div className="min-w-0">
                  <h3 className="font-medium text-foreground text-sm truncate">{task.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {(task as TaskWithDerived).assignee && (
                      <span className="text-xs text-muted-foreground">
                        {(task as TaskWithDerived).assignee?.firstName} {(task as TaskWithDerived).assignee?.lastName}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border ml-2 shrink-0">
                  {task.status}
                </div>
              </div>
            ))}
            {activeTasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground bg-black/20 rounded-xl border border-white/5">
                All caught up!
              </div>
            )}
          </div>
        </Card>

        {/* Today's Attendance Summary */}
        <Card className="glass-panel p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-display font-bold">Your Attendance Today</h2>
            <Link href="/attendance" className="text-sm text-primary hover:underline">Full Log</Link>
          </div>
          <div className="flex items-center gap-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 ${attendance?.clockIn ? "border-green-500 bg-green-500/10" : "border-white/10 bg-white/5"}`}>
              <Clock className={`w-7 h-7 ${attendance?.clockIn ? "text-green-400" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="font-semibold text-foreground text-lg">
                {attendance?.clockIn && !attendance?.clockOut
                  ? "Clocked In"
                  : attendance?.clockIn && attendance?.clockOut
                  ? "Shift Complete"
                  : "Not Clocked In"}
              </p>
              {attendance?.clockIn && (
                <p className="text-sm text-muted-foreground">
                  In: {new Date(attendance.clockIn).toLocaleTimeString()}
                  {attendance.clockOut && ` · Out: ${new Date(attendance.clockOut).toLocaleTimeString()}`}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Quality Rating Summary */}
        <Card className="glass-panel p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-display font-bold">Recent Quality Checks</h2>
            <Link href="/quality" className="text-sm text-primary hover:underline">View All</Link>
          </div>
          <div className="space-y-3">
            {qualityChecks?.slice(0, 4).map((qc) => (
              <div key={qc.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {qc.submitter?.firstName} {qc.submitter?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[160px]">{qc.feedback || "No feedback"}</p>
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${s <= qc.rating ? "text-yellow-400 fill-yellow-400" : "text-white/20"}`}
                    />
                  ))}
                </div>
              </div>
            ))}
            {(!qualityChecks || qualityChecks.length === 0) && (
              <div className="text-center py-8 text-muted-foreground bg-black/20 rounded-xl border border-white/5">
                No quality checks yet
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
