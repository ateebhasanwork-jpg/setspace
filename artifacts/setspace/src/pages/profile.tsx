import React, { useRef, useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useUpdateUser, useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, User, CheckCircle2, Loader2, KeyRound } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function profileImageUrl(profileImage: string | null | undefined): string | null {
  if (!profileImage) return null;
  if (profileImage.startsWith("http")) return profileImage;
  const subPath = profileImage.replace(/^\/objects\//, "");
  return `${BASE}/api/storage/objects/${subPath}`;
}

export default function Profile() {
  const { user } = useAuth();
  const { data: dbUser } = useGetCurrentUser();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password change state
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const updateUser = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      },
    },
  });

  if (!user) return null;

  const resolvedProfileImage = (dbUser as { profileImage?: string | null } | undefined)?.profileImage ?? user.profileImage;
  const imgUrl = profileImageUrl(resolvedProfileImage);
  const displayName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || (user as { username?: string }).username || "";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setUploading(true);
    setError(null);
    try {
      const uploadRes = await fetch(`${BASE}/api/storage/upload`, {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "X-File-Name": encodeURIComponent(file.name),
          "Content-Length": String(file.size),
        },
        credentials: "include",
        body: file,
      });
      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.error ?? "Upload failed");
      }
      const { objectPath } = await uploadRes.json();
      await updateUser.mutateAsync({ userId: user.id, data: { profileImage: objectPath } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg.includes("not configured") ? "File storage is not available on this server." : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (pwNew !== pwConfirm) { setPwError("New passwords don't match."); return; }
    if (pwNew.length < 6) { setPwError("Password must be at least 6 characters."); return; }
    setPwLoading(true);
    try {
      const res = await fetch(`${BASE}/api/users/me/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await res.json();
      if (!res.ok) { setPwError(data.error ?? "Failed to change password."); return; }
      setPwSuccess(true);
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
      setTimeout(() => setPwSuccess(false), 3000);
    } catch {
      setPwError("Network error. Please try again.");
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-display font-bold">My Profile</h1>
        <p className="text-muted-foreground mt-1">Update your photo and personal details.</p>
      </div>

      {/* Profile Photo */}
      <Card className="glass-panel p-8 flex flex-col items-center text-center gap-5">
        <div className="relative group">
          {imgUrl ? (
            <img src={imgUrl} alt={displayName} className="w-28 h-28 rounded-full object-cover border-2 border-white/10" />
          ) : (
            <div className="w-28 h-28 rounded-full bg-white/10 border-2 border-white/10 flex items-center justify-center text-3xl font-bold text-foreground">
              {user.firstName?.[0] ?? (user as { username?: string }).username?.[0] ?? "?"}
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          >
            {uploading ? <Loader2 className="w-7 h-7 text-white animate-spin" /> : <Camera className="w-7 h-7 text-white" />}
          </button>
        </div>

        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileChange} />

        <div>
          <p className="text-xl font-display font-bold">{displayName}</p>
          <p className="text-sm text-muted-foreground capitalize mt-0.5">{(user as { role?: string }).role}</p>
        </div>

        <Button onClick={() => fileRef.current?.click()} disabled={uploading} variant="outline" className="gap-2 border-white/10 hover:bg-white/5">
          {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> :
           saved    ? <><CheckCircle2 className="w-4 h-4 text-green-400" /> Photo updated!</> :
                      <><Camera className="w-4 h-4" /> Upload Photo</>}
        </Button>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <p className="text-xs text-muted-foreground">JPG, PNG or WebP · Max 10 MB</p>
      </Card>

      {/* User Details */}
      <Card className="glass-panel p-6 space-y-4">
        <h2 className="text-lg font-display font-bold flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" /> Account Info
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">First Name</p>
            <p className="font-medium">{user.firstName || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Last Name</p>
            <p className="font-medium">{user.lastName || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Username</p>
            <p className="font-medium text-muted-foreground">@{(user as { username?: string }).username}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Role</p>
            <p className="font-medium capitalize">{(user as { role?: string }).role || "Employee"}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground pt-2 border-t border-white/5">
          Name and role changes must be requested from your manager.
        </p>
      </Card>

      {/* Change Password */}
      <Card className="glass-panel p-6 space-y-4">
        <h2 className="text-lg font-display font-bold flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-muted-foreground" /> Change Password
        </h2>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <Input
            type="password"
            placeholder="Current password"
            value={pwCurrent}
            onChange={e => setPwCurrent(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
            required
            autoComplete="current-password"
          />
          <Input
            type="password"
            placeholder="New password (min 6 chars)"
            value={pwNew}
            onChange={e => setPwNew(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
            required
            autoComplete="new-password"
          />
          <Input
            type="password"
            placeholder="Confirm new password"
            value={pwConfirm}
            onChange={e => setPwConfirm(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
            required
            autoComplete="new-password"
          />
          {pwError && <p className="text-sm text-red-400">{pwError}</p>}
          {pwSuccess && <p className="text-sm text-green-400 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Password updated successfully!</p>}
          <Button type="submit" disabled={pwLoading} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
            {pwLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating…</> : "Update Password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
