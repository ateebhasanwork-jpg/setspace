import React from "react";
import { 
  useListTasks, 
  useGetTodayAttendance,
  useListVideoProjects,
  useGetLeaderboard
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { CheckSquare, Clock, Trophy, Video, PlayCircle } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: tasks } = useListTasks();
  const { data: attendance } = useGetTodayAttendance();
  const { data: projects } = useListVideoProjects();
  const { data: leaderboard } = useGetLeaderboard({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });

  const activeTasks = tasks?.filter(t => t.status !== "Done") || [];
  const topPerformer = leaderboard?.[0];
  const recentProjects = projects?.slice(0, 4) || [];

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
            <Clock className="w-16 h-16 text-primary" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Today's Status</p>
          <div className="text-2xl font-display font-bold text-foreground">
            {attendance?.clockIn && !attendance?.clockOut ? "Clocked In" : "Not Clocked In"}
          </div>
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

        <Card className="glass-panel p-6 flex flex-col justify-between relative overflow-hidden group hover:border-primary/50 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Video className="w-16 h-16 text-primary" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Video Projects</p>
          <div className="text-4xl font-display font-bold text-foreground">{projects?.length || 0}</div>
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
              recentProjects.map(proj => (
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
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      proj.status === 'Approved' ? 'bg-green-500/20 text-green-400' :
                      proj.status === 'Needs Revision' ? 'bg-red-500/20 text-red-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {proj.status}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Active Tasks Widget */}
        <Card className="glass-panel p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-display font-bold">Your Tasks</h2>
            <Link href="/tasks" className="text-sm text-primary hover:underline">View All</Link>
          </div>
          <div className="space-y-4">
            {activeTasks.slice(0, 4).map(task => (
              <div key={task.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                <div>
                  <h3 className="font-medium text-foreground">{task.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}</p>
                </div>
                <div className="px-3 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                  {task.status}
                </div>
              </div>
            ))}
            {activeTasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground bg-black/20 rounded-xl border border-white/5">
                You're all caught up!
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
