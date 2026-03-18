import React, { useEffect, useRef, useState, useContext, createContext, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useListNotifications, getListNotificationsQueryKey, type Notification } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { playNotificationSound, initAudio } from "@/lib/sounds";
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
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
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
  LogOut,
  UserCircle,
} from "lucide-react";

/* ── Unread Counts Context ────────────────────────────────────── */
interface UnreadCounts {
  notifCount: number;
  dmCount: number;
  taskNotifCount: number;
}
const UnreadCountsCtx = createContext<UnreadCounts>({ notifCount: 0, dmCount: 0, taskNotifCount: 0 });

/* ── Nav config ───────────────────────────────────────────────── */
const NAV_ITEMS = [
  { title: "Dashboard",    href: "/",             icon: LayoutDashboard, badge: null as null | "notif" | "dm" | "task" },
  { title: "Tasks",        href: "/tasks",         icon: CheckSquare,     badge: "task"  as const },
  { title: "Video Studio", href: "/videos",        icon: Video,           badge: null },
  { title: "KPIs",         href: "/kpis",          icon: TrendingUp,      badge: null },
  { title: "Attendance",   href: "/attendance",    icon: Clock,           badge: null },
  { title: "Quality Check",href: "/quality",       icon: Star,            badge: null },
  { title: "Leaderboard",  href: "/leaderboard",   icon: Trophy,          badge: null },
  { title: "Team Chat",    href: "/chat",          icon: MessageSquare,   badge: "dm"    as const },
  { title: "Meetings",     href: "/meetings",      icon: Calendar,        badge: null },
  { title: "Notifications",href: "/notifications", icon: Bell,            badge: "notif" as const },
];

/* ── Profile image helper ─────────────────────────────────────── */
function profileImageUrl(profileImage: string | null | undefined): string | null {
  if (!profileImage) return null;
  if (profileImage.startsWith("http")) return profileImage;
  const subPath = profileImage.replace(/^\/objects\//, "");
  return `/api/storage/objects/${subPath}`;
}

/* ── Badge dot component ──────────────────────────────────────── */
function BadgeDot({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none shadow-sm shadow-red-900/40 animate-pulse">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/* ── NavItem ──────────────────────────────────────────────────── */
function NavItem({ item, isActive }: { item: typeof NAV_ITEMS[0]; isActive: boolean }) {
  const { setOpenMobile } = useSidebar();
  const counts = useContext(UnreadCountsCtx);

  const badgeCount =
    item.badge === "notif" ? counts.notifCount :
    item.badge === "dm"    ? counts.dmCount :
    item.badge === "task"  ? counts.taskNotifCount : 0;

  return (
    <SidebarMenuItem className="mb-1">
      <SidebarMenuButton asChild>
        <Link
          href={item.href}
          onClick={() => setOpenMobile(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
            isActive
              ? "bg-white/10 text-foreground font-medium shadow-inner border border-white/10"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
          }`}
        >
          <div className="relative shrink-0">
            <item.icon className={`w-5 h-5 ${isActive ? "text-foreground" : "opacity-70"}`} />
            {badgeCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-sidebar" />
            )}
          </div>
          <span className="flex-1">{item.title}</span>
          <BadgeDot count={badgeCount} />
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/* ── SidebarInner ─────────────────────────────────────────────── */
function SidebarInner() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { setOpenMobile } = useSidebar();
  const imgUrl = profileImageUrl(user?.profileImage);
  const initial = user?.firstName?.[0] ?? user?.username?.[0] ?? "U";

  return (
    <Sidebar className="border-r border-border/50 bg-sidebar/95 backdrop-blur-md">
      <SidebarHeader className="p-6 border-b border-border/50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary overflow-hidden shadow-lg shrink-0">
            <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Setspace" className="w-full h-full object-contain scale-[1.35]" />
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
                return <NavItem key={item.title} item={item} isActive={isActive} />;
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-border/50">
        <Link href="/profile" onClick={() => setOpenMobile(false)}>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/5 mb-3 hover:bg-white/5 transition-colors cursor-pointer group">
            {imgUrl ? (
              <img src={imgUrl} alt={user?.firstName ?? ""} className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-sm font-bold text-foreground shrink-0">
                {initial}
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-medium text-foreground truncate">{user?.firstName} {user?.lastName}</div>
              <div className="text-xs text-muted-foreground truncate capitalize flex items-center gap-1">
                {user?.role || "Employee"}
                <span className="text-[10px] text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">· Edit profile</span>
              </div>
            </div>
            <UserCircle className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
          </div>
        </Link>
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => logout()}>
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

/* ── Global hooks ─────────────────────────────────────────────── */
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const TASK_NOTIF_TYPES = new Set(["task_assigned", "task_status", "task_completed"]);

function useUnreadCounts(): UnreadCounts {
  const { data: notifications } = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey(), refetchInterval: 5000 }
  });
  const [dmCount, setDmCount] = useState(0);
  const [location] = useLocation();

  // Poll DM unread count
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${BASE}/api/dm-unread`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json() as { total: number };
        setDmCount(data.total ?? 0);
      } catch {}
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [location]);

  const notifs = (notifications as Notification[] | undefined) ?? [];
  const unread = notifs.filter(n => !n.isRead);
  const notifCount = unread.length;
  const taskNotifCount = unread.filter(n => TASK_NOTIF_TYPES.has(n.type)).length;

  return { notifCount, dmCount, taskNotifCount };
}

function useNotificationSoundEffect(counts: UnreadCounts) {
  const lastNotifRef = useRef<number | null>(null);
  const lastDmRef = useRef<number | null>(null);
  const isInitialRef = useRef(true);

  useEffect(() => {
    const total = counts.notifCount + counts.dmCount;
    const prevTotal = (lastNotifRef.current ?? 0) + (lastDmRef.current ?? 0);

    if (isInitialRef.current) {
      lastNotifRef.current = counts.notifCount;
      lastDmRef.current = counts.dmCount;
      isInitialRef.current = false;
      return;
    }

    if (total > prevTotal) {
      playNotificationSound();
    }

    lastNotifRef.current = counts.notifCount;
    lastDmRef.current = counts.dmCount;
  }, [counts.notifCount, counts.dmCount]);
}

/* ── AppLayout ────────────────────────────────────────────────── */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const counts = useUnreadCounts();
  useNotificationSoundEffect(counts);

  useEffect(() => { initAudio(); }, []);

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <UnreadCountsCtx.Provider value={counts}>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
          <SidebarInner />
          <main className="flex-1 flex flex-col h-screen overflow-y-auto relative min-w-0">
            <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-white/3 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[40%] rounded-full bg-white/2 blur-[100px] pointer-events-none" />

            {/* Mobile top bar */}
            <header className="md:hidden sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-background/80 backdrop-blur-md border-b border-white/5 shrink-0">
              <SidebarTrigger className="text-foreground" />
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary overflow-hidden shrink-0">
                  <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Setspace" className="w-full h-full object-contain scale-[1.35]" />
                </div>
                <span className="font-display font-bold text-base text-foreground">Setspace</span>
              </div>
            </header>

            {location.startsWith("/videos") ? (
              <div className="absolute inset-0 z-10 flex flex-col overflow-hidden">
                {children}
              </div>
            ) : (
              <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full relative z-10 flex-1">
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
            )}
          </main>
        </div>
      </SidebarProvider>
    </UnreadCountsCtx.Provider>
  );
}
