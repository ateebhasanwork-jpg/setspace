import React, { useRef, useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useUpdateUser, useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, User, CheckCircle2, Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function profileImageUrl(profileImage: string | null | undefined): string | null {
  if (!profileImage) return null;
  if (profileImage.startsWith("http")) return profileImage;
  const subPath = profileImage.replace(/^\/objects\//, "");
  return `${BASE}/api/storage/objects/${subPath}`;
}

export default function Profile() {
  const { user: authUser } = useAuth();
  // Read profile data from our DB — not from the Replit session which always
  // contains the original Replit avatar regardless of what the user has set.
  const { data: dbUser } = useGetCurrentUser();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateUser = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      },
    },
  });

  if (!authUser) return null;

  // Use the DB-stored profileImage (may be a custom upload) for display;
  // fall back to the Replit session image only if the DB has nothing yet.
  const resolvedProfileImage = (dbUser as { profileImage?: string | null } | undefined)?.profileImage ?? authUser.profileImage;
  const imgUrl = profileImageUrl(resolvedProfileImage);
  const displayName = `${authUser.firstName ?? ""} ${authUser.lastName ?? ""}`.trim() || authUser.username;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !authUser?.id) return;
    setUploading(true);
    setError(null);
    try {
      const uploadRes = await fetch(`${BASE}/api/storage/upload`, {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "X-File-Name": file.name,
          "Content-Length": String(file.size),
        },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { objectPath } = await uploadRes.json();

      await updateUser.mutateAsync({
        userId: authUser.id,
        data: { profileImage: objectPath },
      });
    } catch (err) {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
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
            <img
              src={imgUrl}
              alt={displayName}
              className="w-28 h-28 rounded-full object-cover border-2 border-white/10"
            />
          ) : (
            <div className="w-28 h-28 rounded-full bg-white/10 border-2 border-white/10 flex items-center justify-center text-3xl font-bold text-foreground">
              {authUser.firstName?.[0] ?? authUser.username?.[0] ?? "?"}
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          >
            {uploading ? (
              <Loader2 className="w-7 h-7 text-white animate-spin" />
            ) : (
              <Camera className="w-7 h-7 text-white" />
            )}
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />

        <div>
          <p className="text-xl font-display font-bold">{displayName}</p>
          <p className="text-sm text-muted-foreground capitalize mt-0.5">{authUser.role}</p>
        </div>

        <Button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          variant="outline"
          className="gap-2 border-white/10 hover:bg-white/5"
        >
          {uploading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
          ) : saved ? (
            <><CheckCircle2 className="w-4 h-4 text-green-400" /> Photo updated!</>
          ) : (
            <><Camera className="w-4 h-4" /> Upload Photo</>
          )}
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
            <p className="font-medium">{authUser.firstName || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Last Name</p>
            <p className="font-medium">{authUser.lastName || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Username</p>
            <p className="font-medium text-muted-foreground">@{authUser.username}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Role</p>
            <p className="font-medium capitalize">{authUser.role || "Employee"}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground pt-2 border-t border-white/5">
          Name and role changes must be requested from your manager.
        </p>
      </Card>
    </div>
  );
}
