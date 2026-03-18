import React, { useState } from "react";
import { useListUsers, useGetCurrentUser } from "@workspace/api-client-react";
import {
  Users,
  Trash2,
  Shield,
  UserCheck,
  User,
  Copy,
  Check,
  Loader2,
  ChevronDown,
  Search,
  Mail,
  Link2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

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
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const select = async (role: Role) => {
    setOpen(false);
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
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={disabled || saving}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RoleBadge role={currentRole} />}
        <ChevronDown className="w-3.5 h-3.5 text-zinc-500 ml-1" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-30 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1 min-w-[140px]">
          {(Object.keys(ROLE_CONFIG) as Role[]).map(r => (
            <button key={r} onClick={() => select(r)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors ${r === currentRole ? "text-white font-medium" : "text-zinc-300"}`}>
              <RoleBadge role={r} />
              {r === currentRole && <Check className="w-3 h-3 text-green-400 ml-auto" />}
            </button>
          ))}
        </div>
      )}
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
  const [copied, setCopied] = useState(false);

  const isAdmin = (currentUser as { role?: string } | undefined)?.role === "admin";
  const isManager = isAdmin || (currentUser as { role?: string } | undefined)?.role === "hr";

  // Use server data or local overrides
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

  const copyInviteLink = () => {
    const url = window.location.origin + (import.meta.env.BASE_URL ?? "/");
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
        <Button onClick={copyInviteLink}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold">
          {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy Invite Link"}
        </Button>
      </div>

      {/* Invite banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">How to invite someone</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Click <strong className="text-foreground">Copy Invite Link</strong> and share it with your team member.
            They'll click the link, log in with their Replit account, and automatically join Setspace.
            You can then change their role below.
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
              {isAdmin && <th className="px-4 py-3 w-10" />}
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
                return (
                  <tr key={u.id} className={`border-b border-border/50 hover:bg-white/2 transition-colors ${i === filtered.length - 1 ? "border-0" : ""}`}>
                    {/* Member */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {u.profileImage ? (
                          <img src={u.profileImage} alt="" className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {initial(u)}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-foreground flex items-center gap-2">
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

                    {/* Delete */}
                    {isAdmin && (
                      <td className="px-4 py-3">
                        {!isSelf && (
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            title="Remove member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Delete dialog */}
      {deleteTarget && (
        <DeleteDialog
          user={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
