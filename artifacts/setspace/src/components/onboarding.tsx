import React, { useRef, useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useUpdateUser, useRequestUploadUrl } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Loader2, CheckCircle2, ArrowRight } from "lucide-react";

function profileImageUrl(p: string | null | undefined): string | null {
  if (!p) return null;
  if (p.startsWith("http")) return p;
  return `/api/storage/objects/${p.replace(/^\/objects\//, "")}`;
}

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user) return <>{children}</>;
  if (user?.profileSetup) return <>{children}</>;

  return (
    <>
      <OnboardingModal />
      {/* Blur the app behind the modal */}
      <div className="fixed inset-0 bg-background/90 backdrop-blur-xl z-40 pointer-events-none" />
    </>
  );
}

function OnboardingModal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(user?.firstName && user.firstName !== "User" ? user.firstName : "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(profileImageUrl(user?.profileImage));
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestUrl = useRequestUploadUrl();
  const updateUser = useUpdateUser({
    mutation: { onSuccess: () => queryClient.invalidateQueries() }
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || !firstName.trim()) return;
    setUploading(true);
    setError(null);
    try {
      let objectPath: string | undefined;
      if (pendingFile) {
        const { uploadURL, objectPath: op } = await requestUrl.mutateAsync({
          data: { name: pendingFile.name, size: pendingFile.size, contentType: pendingFile.type }
        });
        const res = await fetch(uploadURL, { method: "PUT", body: pendingFile, headers: { "Content-Type": pendingFile.type } });
        if (!res.ok) throw new Error("Upload failed");
        objectPath = op;
      }
      await updateUser.mutateAsync({
        userId: user.id,
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          ...(objectPath ? { profileImage: objectPath } : {}),
          profileSetup: true,
        }
      });
    } catch {
      setError("Something went wrong. Please try again.");
      setUploading(false);
    }
  }

  const initials = (firstName[0] ?? user?.username?.[0] ?? "?").toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md rounded-3xl p-8 md:p-10 flex flex-col items-center text-center shadow-2xl border border-white/10">
        {/* Logo */}
        <div className="w-14 h-14 rounded-2xl bg-primary overflow-hidden mb-6 shadow-lg shrink-0">
          <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Setspace" className="w-full h-full object-contain scale-[1.35]" />
        </div>

        <h1 className="text-2xl font-display font-bold text-foreground mb-1">Welcome to Setspace</h1>
        <p className="text-muted-foreground text-sm mb-8">Set up your profile before you get started.</p>

        <form onSubmit={handleSubmit} className="w-full space-y-5">
          {/* Photo picker */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="relative group w-24 h-24 rounded-full focus:outline-none"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Profile" className="w-full h-full rounded-full object-cover border-2 border-white/10" />
              ) : (
                <div className="w-full h-full rounded-full bg-white/10 border-2 border-white/10 flex items-center justify-center text-3xl font-bold text-foreground">
                  {initials}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
            >
              {previewUrl ? "Change photo" : "Upload a photo (optional)"}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileSelect} />
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="text-left">
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">First Name <span className="text-red-400">*</span></label>
              <Input
                required
                placeholder="Jane"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="bg-black/20 border-white/10"
                disabled={uploading}
              />
            </div>
            <div className="text-left">
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Last Name</label>
              <Input
                placeholder="Smith"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="bg-black/20 border-white/10"
                disabled={uploading}
              />
            </div>
          </div>

          {/* Username read-only */}
          <div className="text-left">
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Replit Username</label>
            <Input value={`@${user?.username}`} disabled className="bg-black/10 border-white/5 text-muted-foreground" />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button
            type="submit"
            disabled={uploading || !firstName.trim()}
            className="w-full h-12 bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/20 text-base"
          >
            {uploading ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Setting up…</>
            ) : (
              <>Get Started <ArrowRight className="w-5 h-5 ml-2" /></>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
