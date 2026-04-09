import React from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";

import { AppLayout } from "./components/layout";
import { OnboardingGate } from "./components/onboarding";
import Dashboard from "./pages/dashboard";
import Tasks from "./pages/tasks";
import PublicReview from "./pages/public-review";
import KPIs from "./pages/kpis";
import Attendance from "./pages/attendance";
import QualityChecks from "./pages/quality-checks";
import Leaderboard from "./pages/leaderboard";
import TeamChat from "./pages/chat";
import Meetings from "./pages/meetings";
import Notifications from "./pages/notifications";
import Profile from "./pages/profile";
import TeamManagement from "./pages/team";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,       // Use cached data when navigating between pages
      refetchOnReconnect: false,   // Don't batch-refetch everything on network reconnect
      retry: false,
      // Data never becomes stale automatically — SSE events handle all invalidation.
      // Pages only fetch on first load (empty cache) or after explicit mutation/invalidation.
      staleTime: Infinity,
      gcTime: 10 * 60_000,        // Keep unused cache in memory for 10 minutes
    }
  }
});

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, login } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground font-display tracking-widest uppercase text-xs">Authenticating</p>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background artwork */}
        <div className="absolute inset-0 z-0">
          <img src={`${import.meta.env.BASE_URL}images/hero-bg.png`} alt="Background" className="w-full h-full object-cover opacity-50" />
          <div className="absolute inset-0 bg-background/80 backdrop-blur-3xl" />
        </div>
        
        <div className="glass-panel max-w-md w-full p-8 md:p-12 rounded-3xl relative z-10 flex flex-col items-center text-center">
          <div className="w-52 h-52 bg-primary rounded-3xl mb-8 shadow-2xl shadow-primary/20 overflow-hidden">
            <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Setspace Logo" className="w-full h-full object-contain scale-[1.35]" />
          </div>
          <h1 className="text-4xl font-display font-bold text-white mb-2">Setspace</h1>
          <p className="text-muted-foreground mb-10">Agency Management Platform</p>
          <Button 
            onClick={() => login()} 
            className="w-full h-14 text-lg font-semibold bg-white text-black hover:bg-white/90 rounded-xl shadow-xl shadow-white/10"
          >
            Log in with Replit
          </Button>
        </div>
      </div>
    );
  }
  
  return <OnboardingGate>{children}</OnboardingGate>;
}

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/review/:token" component={PublicReview} />
      
      {/* Protected Routes */}
      <Route path="*">
        <AuthWrapper>
          <AppLayout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/tasks" component={Tasks} />
              <Route path="/kpis" component={KPIs} />
              <Route path="/attendance" component={Attendance} />
              <Route path="/quality" component={QualityChecks} />
              <Route path="/leaderboard" component={Leaderboard} />
              <Route path="/chat" component={TeamChat} />
              <Route path="/meetings" component={Meetings} />
              <Route path="/notifications" component={Notifications} />
              <Route path="/team" component={TeamManagement} />
              <Route path="/profile" component={Profile} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        </AuthWrapper>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
