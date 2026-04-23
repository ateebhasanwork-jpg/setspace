import React, { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@workspace/replit-auth-web";
import { Input } from "@/components/ui/input";
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
import Notifications from "./pages/notifications";
import Profile from "./pages/profile";
import TeamManagement from "./pages/team";
import NotFound from "./pages/not-found";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: false,
      staleTime: Infinity,
      gcTime: 10 * 60_000,
    }
  }
});

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null);
  const [setupData, setSetupData] = useState({ firstName: "", lastName: "", username: "", password: "" });
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // For users migrated from Replit OIDC who have no password yet
  const [initPassword, setInitPassword] = useState<{ username: string; password: string; confirm: string } | null>(null);
  const [initLoading, setInitLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/setup/needed`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setSetupNeeded(!!d.needed))
      .catch(() => setSetupNeeded(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "NO_PASSWORD") {
          // Existing account with no password (migrated from Replit OIDC)
          setInitPassword({ username, password: "", confirm: "" });
        } else {
          setError(data.error ?? "Login failed.");
        }
        return;
      }
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleInitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!initPassword) return;
    setInitError(null);
    if (initPassword.password !== initPassword.confirm) {
      setInitError("Passwords do not match.");
      return;
    }
    setInitLoading(true);
    try {
      const res = await fetch(`${BASE}/api/setup/init-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: initPassword.username, password: initPassword.password }),
      });
      const data = await res.json();
      if (!res.ok) { setInitError(data.error ?? "Failed to set password."); return; }
      window.location.reload();
    } catch {
      setInitError("Network error. Please try again.");
    } finally {
      setInitLoading(false);
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setSetupError(null);
    setSetupLoading(true);
    try {
      const res = await fetch(`${BASE}/api/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(setupData),
      });
      const data = await res.json();
      if (!res.ok) { setSetupError(data.error ?? "Setup failed."); return; }
      window.location.reload();
    } catch {
      setSetupError("Network error. Please try again.");
    } finally {
      setSetupLoading(false);
    }
  }

  const card = (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={`${import.meta.env.BASE_URL}images/hero-bg.png`} alt="Background" className="w-full h-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-3xl" />
      </div>
      <div className="glass-panel max-w-md w-full p-8 md:p-12 rounded-3xl relative z-10 flex flex-col items-center text-center">
        <div className="w-52 h-52 bg-primary rounded-3xl mb-8 shadow-2xl shadow-primary/20 overflow-hidden">
          <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Setspace Logo" className="w-full h-full object-contain scale-[1.35]" />
        </div>
        <h1 className="text-4xl font-display font-bold text-white mb-2">Setspace</h1>
        <p className="text-muted-foreground mb-8">Agency Management Platform</p>
        {setupNeeded === null ? (
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        ) : setupNeeded ? (
          <form onSubmit={handleSetup} className="w-full space-y-3 text-left">
            <p className="text-center text-sm text-amber-400 font-medium mb-4">First-time setup — create your admin account</p>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="First name" value={setupData.firstName} onChange={e => setSetupData(p => ({ ...p, firstName: e.target.value }))} className="bg-white/5 border-white/10 text-white placeholder:text-white/40" required />
              <Input placeholder="Last name" value={setupData.lastName} onChange={e => setSetupData(p => ({ ...p, lastName: e.target.value }))} className="bg-white/5 border-white/10 text-white placeholder:text-white/40" required />
            </div>
            <Input placeholder="Username" value={setupData.username} onChange={e => setSetupData(p => ({ ...p, username: e.target.value }))} className="bg-white/5 border-white/10 text-white placeholder:text-white/40" required autoCapitalize="none" />
            <Input type="password" placeholder="Password (min 6 chars)" value={setupData.password} onChange={e => setSetupData(p => ({ ...p, password: e.target.value }))} className="bg-white/5 border-white/10 text-white placeholder:text-white/40" required />
            {setupError && <p className="text-sm text-red-400 text-center">{setupError}</p>}
            <Button type="submit" disabled={setupLoading} className="w-full h-12 text-base font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">
              {setupLoading ? "Creating account…" : "Create Admin Account"}
            </Button>
          </form>
        ) : initPassword ? (
          <form onSubmit={handleInitPassword} className="w-full space-y-3 text-left">
            <p className="text-center text-sm text-amber-400 font-medium mb-4">
              Set your password for <strong className="text-white">@{initPassword.username}</strong>
            </p>
            <p className="text-center text-xs text-muted-foreground mb-2">Your account was migrated — please choose a password to continue.</p>
            <Input type="password" placeholder="New password (min 6 chars)" value={initPassword.password} onChange={e => setInitPassword(p => p ? { ...p, password: e.target.value } : p)} className="bg-white/5 border-white/10 text-white placeholder:text-white/40" required autoComplete="new-password" />
            <Input type="password" placeholder="Confirm password" value={initPassword.confirm} onChange={e => setInitPassword(p => p ? { ...p, confirm: e.target.value } : p)} className="bg-white/5 border-white/10 text-white placeholder:text-white/40" required autoComplete="new-password" />
            {initError && <p className="text-sm text-red-400 text-center">{initError}</p>}
            <Button type="submit" disabled={initLoading} className="w-full h-12 text-base font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">
              {initLoading ? "Setting password…" : "Set Password & Sign In"}
            </Button>
            <button type="button" onClick={() => setInitPassword(null)} className="w-full text-xs text-muted-foreground hover:text-white text-center mt-1 transition-colors">← Back to login</button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="w-full space-y-3 text-left">
            <Input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="bg-white/5 border-white/10 text-white placeholder:text-white/40" required autoCapitalize="none" autoComplete="username" />
            <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="bg-white/5 border-white/10 text-white placeholder:text-white/40" required autoComplete="current-password" />
            {error && <p className="text-sm text-red-400 text-center">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );

  return card;
}

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground font-display tracking-widest uppercase text-xs">Authenticating</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
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
