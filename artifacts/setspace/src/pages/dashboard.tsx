import React from "react";
import {
  useListTasks,
  useGetTodayAttendance,
  useListVideoProjects,
  useGetLeaderboard,
  useListQualityChecks,
  useListUsers,
  useListAttendance,
} from "@workspace/api-client-react";
import type { Task, User } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Card } from "@/components/ui/card";
import {
  CheckSquare,
  Clock,
  Trophy,
  PlayCircle,
  Star,
  TimerOff,
  Lock,
  Users,
  CheckCircle2,
  XCircle,
  Minus,
} from "lucide-react";
import { Link } from "wouter";

type TaskWithDerived = Task & { completedOnTime?: boolean | null; assignee?: User | null };

function initials(u: User) {
  return `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase();
}

function StarRating({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3 h-3 ${s <= Math.round(value) ? "text-yellow-400 fill-yellow-400" : "text-white/15"}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{value.toFixed(1)}</span>
    </div>
  );
}

export default function Dashboard() {
  const { user: authUser } = useAuth();
  const isAdminOrHr = authUser?.role === "admin" || authUser?.role === "hr";

  const todayStr = new Date().toISOString().split("T")[0];

  const { data: tasks } = useListTasks();
  const { data: myAttendance } = useGetTodayAttendance();
  const { data: projects } = useListVideoProjects();
  const { data: leaderboard } = useGetLeaderboard({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const { data: qualityChecks } = useListQualityChecks({});
  const { data: users } = useListUsers();
  const { data: todayAttendance } = useListAttendance({ date: todayStr });

  const allTasks = (tasks as TaskWithDerived[] | undefined) ?? [];
  const activeTasks = allTasks.filter((t) => t.status !== "Done");
  const topPerformer = leaderboard?.[0];
  const recentProjects = projects?.slice(0, 3) ?? [];

  // Aggregate KPIs
  const doneTasks = allTasks.filter(
    (t) => t.status === "Done" && t.completedOnTime !== null && t.completedOnTime !== undefined,
  );
  const onTimeCount = doneTasks.filter((t) => t.completedOnTime === true).length;
  const onTimeRate = doneTasks.length > 0 ? Math.round((onTimeCount / doneTasks.length) * 100) : null;

  const avgRating =
    qualityChecks && qualityChecks.length > 0
      ? qualityChecks.reduce((s, q) => s + q.rating, 0) / qualityChecks.length
      : null;

  // Per-employee performance
  const teamStats = (users ?? [])
    .filter((u) => u.role === "employee" || u.role === "admin" || u.role === "hr")
    .map((u) => {
      const userTasks = allTasks.filter((t) => t.assigneeId === u.id);
      const userDone = userTasks.filter((t) => t.status === "Done");
      const userDoneWithDate = userDone.filter(
        (t) => t.completedOnTime !== null && t.completedOnTime !== undefined,
      );
      const userOnTime = userDoneWithDate.filter((t) => t.completedOnTime === true).length;
      const userOnTimeRate =
        userDoneWithDate.length > 0
          ? Math.round((userOnTime / userDoneWithDate.length) * 100)
          : null;

      const userQCs = (qualityChecks ?? []).filter((q) => q.submitterId === u.id);
      const userAvgRating =
        userQCs.length > 0
          ? userQCs.reduce((s, q) => s + q.rating, 0) / userQCs.length
          : null;

      const todayRecord = (todayAttendance ?? []).find((a) => a.userId === u.id);
      const clockedIn = !!todayRecord?.clockIn && !todayRecord?.clockOut;
      const shiftDone = !!todayRecord?.clockIn && !!todayRecord?.clockOut;

      return {
        user: u,
        tasksAssigned: userTasks.length,
        tasksDone: userDone.length,
        onTimeRate: userOnTimeRate,
        avgRating: userAvgRating,
        clockedIn,
        shiftDone,
        todayRecord,
      };
    });

  if (!isAdminOrHr) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center gap-6 py-24">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
          <Lock className="w-9 h-9 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">
            Dashboard Access Restricted
          </h2>
          <p className="text-muted-foreground max-w-sm">
            The overview dashboard is available to management only. Use the navigation to access
            your tasks, attendance, or team chat.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/tasks">
            <span className="px-5 py-2 rounded-xl bg-white/10 text-foreground font-semibold text-sm hover:bg-white/15 transition-colors cursor-pointer border border-white/10">
              My Tasks
            </span>
          </Link>
          <Link href="/attendance">
            <span className="px-5 py-2 rounded-xl bg-white/5 text-foreground font-semibold text-sm hover:bg-white/10 transition-colors cursor-pointer border border-white/10">
              Attendance
            </span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Overview</h1>
        <p className="text-muted-foreground mt-1 text-lg">Agency performance at a glance.</p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-panel p-5 flex flex-col gap-2 relative overflow-hidden group hover:border-white/20 transition-colors">
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
            <CheckSquare className="w-14 h-14" />
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Tasks</p>
          <div className="text-3xl font-display font-bold">{activeTasks.length}</div>
          <p className="text-xs text-muted-foreground">{allTasks.filter(t => t.status === "Done").length} completed</p>
        </Card>

        <Card className="glass-panel p-5 flex flex-col gap-2 relative overflow-hidden group hover:border-white/20 transition-colors">
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
            <TimerOff className="w-14 h-14" />
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">On-Time Rate</p>
          <div className={`text-3xl font-display font-bold ${onTimeRate === null ? "text-muted-foreground" : onTimeRate >= 80 ? "text-green-400" : onTimeRate >= 60 ? "text-yellow-400" : "text-red-400"}`}>
            {onTimeRate !== null ? `${onTimeRate}%` : "—"}
          </div>
          <p className="text-xs text-muted-foreground">{doneTasks.length > 0 ? `${onTimeCount}/${doneTasks.length} tasks` : "No completed tasks yet"}</p>
        </Card>

        <Card className="glass-panel p-5 flex flex-col gap-2 relative overflow-hidden group hover:border-white/20 transition-colors">
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
            <Star className="w-14 h-14" />
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Quality</p>
          <div className="text-3xl font-display font-bold text-yellow-400">
            {avgRating !== null ? (
              <>{avgRating.toFixed(1)}<span className="text-lg text-muted-foreground">/5</span></>
            ) : "—"}
          </div>
          <p className="text-xs text-muted-foreground">{qualityChecks?.length ?? 0} reviews submitted</p>
        </Card>

        <Card className="glass-panel p-5 flex flex-col gap-2 relative overflow-hidden group hover:border-white/20 transition-colors">
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
            <Trophy className="w-14 h-14" />
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Top Performer</p>
          <div className="text-xl font-display font-bold truncate">
            {topPerformer ? `${topPerformer.user?.firstName} ${topPerformer.user?.lastName}` : "TBD"}
          </div>
          <p className="text-xs text-muted-foreground">This month's leaderboard</p>
        </Card>
      </div>

      {/* ── TEAM PERFORMANCE TABLE ── */}
      <Card className="glass-panel overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-xl font-display font-bold">Team Performance</h2>
          </div>
          <span className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase tracking-wider bg-white/3 border-b border-white/5">
                <th className="px-6 py-3 text-left font-medium">Employee</th>
                <th className="px-6 py-3 text-left font-medium">Today</th>
                <th className="px-6 py-3 text-center font-medium">Tasks Done</th>
                <th className="px-6 py-3 text-center font-medium">On-Time Rate</th>
                <th className="px-6 py-3 text-left font-medium">Quality Rating</th>
                <th className="px-6 py-3 text-left font-medium">Clock Status</th>
              </tr>
            </thead>
            <tbody>
              {teamStats.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No team members yet
                  </td>
                </tr>
              )}
              {teamStats.map(({ user: u, tasksAssigned, tasksDone, onTimeRate: uRate, avgRating: uRating, clockedIn, shiftDone, todayRecord }) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  {/* Employee */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                        {initials(u)}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-muted-foreground">{u.title || u.role}</p>
                      </div>
                    </div>
                  </td>

                  {/* Today's date */}
                  <td className="px-6 py-4 text-xs text-muted-foreground">{todayStr}</td>

                  {/* Tasks Done */}
                  <td className="px-6 py-4 text-center">
                    <span className="font-semibold text-foreground">{tasksDone}</span>
                    <span className="text-muted-foreground text-xs">/{tasksAssigned}</span>
                  </td>

                  {/* On-Time Rate */}
                  <td className="px-6 py-4 text-center">
                    {uRate === null ? (
                      <span className="text-muted-foreground text-xs">—</span>
                    ) : (
                      <span className={`font-semibold ${uRate >= 80 ? "text-green-400" : uRate >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                        {uRate}%
                      </span>
                    )}
                  </td>

                  {/* Quality Rating */}
                  <td className="px-6 py-4">
                    <StarRating value={uRating} />
                  </td>

                  {/* Clock Status */}
                  <td className="px-6 py-4">
                    {clockedIn ? (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <div>
                          <p className="text-xs font-medium text-green-400">Clocked In</p>
                          {todayRecord?.clockIn && (
                            <p className="text-[10px] text-muted-foreground">{new Date(todayRecord.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                          )}
                        </div>
                      </div>
                    ) : shiftDone ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                        <div>
                          <p className="text-xs font-medium text-blue-400">Shift Done</p>
                          {todayRecord?.clockIn && todayRecord?.clockOut && (
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(todayRecord.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – {new Date(todayRecord.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Not clocked in</p>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Bottom row: Recent Videos + Active Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-panel p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-display font-bold">Recent Video Reviews</h2>
            <Link href="/videos" className="text-xs text-muted-foreground hover:text-foreground transition-colors">View All</Link>
          </div>
          <div className="space-y-3">
            {recentProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-black/20 rounded-xl border border-white/5 text-sm">
                No active video projects
              </div>
            ) : (
              recentProjects.map((proj) => (
                <Link key={proj.id} href={`/videos/${proj.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <PlayCircle className="w-4 h-4 text-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{proj.title}</p>
                        <p className="text-xs text-muted-foreground">{proj.clientName || "Internal"}</p>
                      </div>
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${proj.status === "Approved" ? "bg-green-500/15 text-green-400" : proj.status === "Needs Revision" ? "bg-red-500/15 text-red-400" : "bg-white/10 text-muted-foreground"}`}>
                      {proj.status}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card className="glass-panel p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-display font-bold">Active Tasks</h2>
            <Link href="/tasks" className="text-xs text-muted-foreground hover:text-foreground transition-colors">View All</Link>
          </div>
          <div className="space-y-3">
            {activeTasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {task.assignee && (
                      <span className="text-xs text-muted-foreground">{task.assignee.firstName} {task.assignee.lastName}</span>
                    )}
                    {task.dueDate && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <span className="ml-2 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/8 text-muted-foreground border border-white/10">
                  {task.status}
                </span>
              </div>
            ))}
            {activeTasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground bg-black/20 rounded-xl border border-white/5 text-sm">
                All caught up!
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
