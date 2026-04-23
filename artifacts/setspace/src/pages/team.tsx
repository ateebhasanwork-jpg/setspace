import React, { useState } from "react";
import { useListUsers, useGetCurrentUser } from "@workspace/api-client-react";
import {
  Users,
  Trash2,
  Shield,
  UserCheck,
  User,
  Check,
  Loader2,
  Search,
  Info,
  AlertTriangle,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUserTextColor } from "@/lib/user-colors";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function resolveProfileImage(profileImage: string | null | undefined): string | null {
  if (!profileImage) return null;
  if (profileImage.startsWith("http")) return profileImage;
  const subPath = profileImage.replace(/^\/objects\//, "");
  return `/api/storage/objects/${subPath}`;
}

type Role = "admin" | "hr" | "employee";

const ROLE_CONFIG: Record<Role, { label: string; icon: React.ElementType; cls: string }> = {
  admin:    { label: "Admin",    icon: Shield,    cls: "bg-purple-900/50 text-purple-300 border-purple-700/50" },
  hr:       { label: "HR",       icon: UserCheck, cls: "bg-blue-900/50 text-blue-300 border-blue-700/50" },
  employee: { label: "Employee", icon: User,      cls: "bg-zinc-800 text-zinc-300 border-zinc-700" },
};

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CONFIG[role as Role] ?? ROLE_CONFIG.employee;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.cls}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

function RoleDropdown({
  userId, currentRole, onChanged, disabled,
}: { userId: string; currentRole: string; onChanged: (r: Role) => void; disabled: boolean }) {
  const [saving, setSaving] = useState(false);

  const handleChange = async (role: Role) => {
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
        credentials: "include",
      });
      if (res.ok) onChanged(role);
    } finally { setSaving(false); }
  };

  return (
    <div className="flex items-center gap-2">
      {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />}
      <select
        value={currentRole}
        disabled={disabled || saving}
        onChange={e => handleChange(e.target.value as Role)}
        className="bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white py-1.5 px-2.5 cursor-pointer focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {(Object.keys(ROLE_CONFIG) as Role[]).map(r => (
          <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
        ))}
      </select>
    </div>
  );
}

function DeleteDialog({ user, onConfirm, onClose }: {
  user: { id: string; firstName: string; lastName: string };
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const confirm = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Remove team member</h3>
            <p className="text-zinc-400 text-sm">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-zinc-300 text-sm mb-6">
          Are you sure you want to remove <strong className="text-white">{user.firstName} {user.lastName}</strong> from the team?
          All their data (tasks, attendance, messages) will remain but their access will be revoked.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1 border border-zinc-600 text-zinc-300 hover:text-white">Cancel</Button>
          <Button onClick={confirm} disabled={deleting} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreateUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", username: "", password: "", role: "employee" as Role, department: "", title: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create user."); return; }
      onCreated();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-indigo-900/40 flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Add Team Member</h3>
            <p className="text-zinc-400 text-sm">Create a new account and set their password.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="First name" value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" required />
            <Input placeholder="Last name" value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" required />
          </div>
          <Input placeholder="Username (login)" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" required autoCapitalize="none" />
          <Input type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" required />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Department (optional)" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
            <Input placeholder="Title (optional)" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
          </div>
          <select
            value={form.role}
            onChange={e => setForm(p => ({ ...p, role: e.target.value as Role }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white py-2 px-3 focus:outline-none focus:border-indigo-500"
          >
            {(Object.keys(ROLE_CONFIG) as Role[]).map(r => (
              <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
            ))}
          </select>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 border border-zinc-600 text-zinc-300 hover:text-white">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating…</> : "Create Account"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: { id: string; firstName: string; lastName: string }; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/users/${user.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to reset password."); return; }
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-white font-semibold mb-1">Reset Password</h3>
        <p className="text-zinc-400 text-sm mb-4">Set a new password for <strong className="text-white">{user.firstName} {user.lastName}</strong>.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input type="password" placeholder="New password (min 6 chars)" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" required />
          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-green-400 flex items-center gap-1"><Check className="w-4 h-4" /> Password reset!</p>}
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 border border-zinc-600 text-zinc-300">Cancel</Button>
            <Button type="submit" disabled={loading || success} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string | null;
  role: string;
  department: string | null;
  title: string | null;
  profileImage: string | null;
  createdAt: string;
}

export default function TeamManagement() {
  const { data: currentUser } = useGetCurrentUser();
  const { data: rawUsers, refetch } = useListUsers();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);

  const isAdmin = (currentUser as { role?: string } | undefined)?.role === "admin";
  const isManager = isAdmin || (currentUser as { role?: string } | undefined)?.role === "hr";

  const displayUsers: UserRow[] = (users ?? (rawUsers as UserRow[] | undefined) ?? []);

  const filtered = displayUsers.filter(u =>
    `${u.firstName} ${u.lastName} ${u.username} ${u.email ?? ""} ${u.role} ${u.department ?? ""}`
      .toLowerCase().includes(search.toLowerCase())
  );

  const handleRoleChanged = (userId: string, role: Role) => {
    setUsers(prev => (prev ?? (rawUsers as UserRow[]) ?? []).map(u => u.id === userId ? { ...u, role } : u));
  };

  const handleDelete = async (user: UserRow) => {
    const res = await fetch(`${BASE}/api/users/${user.id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      setUsers(prev => (prev ?? (rawUsers as UserRow[]) ?? []).filter(u => u.id !== user.id));
      setDeleteTarget(null);
    }
  };

  const handleCreated = () => {
    setShowCreate(false);
    setUsers(null);
    refetch();
  };

  const initial = (u: UserRow) => `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() || "?";

  if (!isManager) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Admin or HR access required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-3">
            <Users className="w-7 h-7 text-primary" /> Team Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage roles, access, and team members.</p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
          >
            <UserPlus className="w-4 h-4" /> Add Member
          </Button>
        )}
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Managing team access</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Admins can create accounts and set passwords for new team members. Members can change their own password from their profile page.
          </p>
        </div>
      </div>

      {/* Search + stats */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, role, department…"
            className="pl-9 bg-background border-border"
          />
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{displayUsers.length} total</span>
          <span>{displayUsers.filter(u => u.role === "admin").length} admins</span>
          <span>{displayUsers.filter(u => u.role === "hr").length} HR</span>
          <span>{displayUsers.filter(u => u.role === "employee").length} employees</span>
        </div>
      </div>

      {/* User table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Member</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Department / Title</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Joined</th>
              {isAdmin && <th className="px-4 py-3 w-24 text-muted-foreground font-medium text-left">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted-foreground">
                  {search ? "No members match your search." : "No team members yet."}
                </td>
              </tr>
            ) : (
              filtered.map((u, i) => {
                const isSelf = u.id === (currentUser as { id?: string } | undefined)?.id;
                const nameColor = getUserTextColor(u.id);
                return (
                  <tr key={u.id} className={`border-b border-border/50 hover:bg-white/2 transition-colors ${i === filtered.length - 1 ? "border-0" : ""}`}>
                    {/* Member */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {resolveProfileImage(u.profileImage) ? (
                          <img src={resolveProfileImage(u.profileImage)!} alt="" className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                            {initial(u)}
                          </div>
                        )}
                        <div>
                          <div className={`font-medium flex items-center gap-2 ${nameColor}`}>
                            {u.firstName} {u.lastName}
                            {isSelf && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">you</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">@{u.username}</div>
                        </div>
                      </div>
                    </td>

                    {/* Dept / Title */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-foreground">{u.department || <span className="text-muted-foreground/50">—</span>}</div>
                      {u.title && <div className="text-xs text-muted-foreground">{u.title}</div>}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      {isAdmin && !isSelf ? (
                        <RoleDropdown
                          userId={u.id}
                          currentRole={u.role}
                          onChanged={role => handleRoleChanged(u.id, role)}
                          disabled={false}
                        />
                      ) : (
                        <RoleBadge role={u.role} />
                      )}
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">
                      {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>

                    {/* Actions */}
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {!isSelf && (
                            <>
                              <button
                                onClick={() => setResetTarget(u)}
                                className="p-1.5 text-muted-foreground hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors"
                                title="Reset password"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setDeleteTarget(u)}
                                className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                title="Remove member"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Dialogs */}
      {showCreate && <CreateUserDialog onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {deleteTarget && (
        <DeleteDialog
          user={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
      {resetTarget && <ResetPasswordDialog user={resetTarget} onClose={() => setResetTarget(null)} />}
    </div>
  );
}
