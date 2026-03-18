import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { motion } from "framer-motion";
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  CheckSquare, 
  Video, 
  TrendingUp, 
  Clock, 
  Star, 
  Trophy, 
  MessageSquare, 
  Calendar, 
  Bell, 
  LogOut 
} from "lucide-react";

const NAV_ITEMS = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Tasks", href: "/tasks", icon: CheckSquare },
  { title: "Video Studio", href: "/videos", icon: Video },
  { title: "KPIs", href: "/kpis", icon: TrendingUp },
  { title: "Attendance", href: "/attendance", icon: Clock },
  { title: "Quality Check", href: "/quality", icon: Star },
  { title: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { title: "Team Chat", href: "/chat", icon: MessageSquare },
  { title: "Meetings", href: "/meetings", icon: Calendar },
  { title: "Notifications", href: "/notifications", icon: Bell },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
        <Sidebar className="border-r border-border/50 bg-sidebar/95 backdrop-blur-md">
          <SidebarHeader className="p-6 border-b border-border/50 flex items-center justify-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
                <Video className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-xl tracking-wide text-foreground">Setspace</span>
            </div>
          </SidebarHeader>
          <SidebarContent className="px-3 py-4">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => {
                    const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                    return (
                      <SidebarMenuItem key={item.title} className="mb-1">
                        <SidebarMenuButton asChild>
                          <Link 
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                              isActive 
                                ? "bg-primary/10 text-primary font-medium shadow-inner border border-primary/10" 
                                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                            }`}
                          >
                            <item.icon className={`w-5 h-5 ${isActive ? "text-primary" : "opacity-70"}`} />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-border/50">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/5 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold shrink-0">
                {user?.firstName?.[0] || user?.username?.[0] || "U"}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-sm font-medium text-foreground truncate">{user?.firstName} {user?.lastName}</div>
                <div className="text-xs text-muted-foreground truncate capitalize">{user?.role || "Employee"}</div>
              </div>
            </div>
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => logout()}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 flex flex-col h-screen overflow-y-auto relative">
          {/* Subtle background decoration */}
          <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[40%] rounded-full bg-accent/5 blur-[100px] pointer-events-none" />
          
          <div className="p-8 max-w-7xl mx-auto w-full relative z-10 flex-1">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="h-full flex flex-col"
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
