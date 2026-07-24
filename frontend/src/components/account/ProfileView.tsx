"use client";

import { useEffect, useRef, useState } from "react";
import { UploadIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { AvatarCropDialog } from "@/components/account/AvatarCropDialog";
import { getMe, updateProfile, uploadAvatar } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
import { ROLE_LABELS } from "@/components/workspace/WorkspaceInviteForm";
import { toast } from "sonner";
import { avatarColorClassForKey, avatarInitial } from "@/lib/user-display";
import { cn, PKT_TIME_ZONE } from "@/lib/utils";

export function ProfileView() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const updateSession = useAuthStore((s) => s.updateSession);

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<
    { id: string; name: string; role: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    getMe(accessToken)
      .then((me) => {
        setFullName(me.fullName);
        setAvatarUrl(me.avatarUrl ?? "");
        setEmail(me.email);
        setCreatedAt(me.createdAt);
        setWorkspaces(me.workspaces);
      })
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Failed to load profile");
      })
      .finally(() => setLoading(false));
  }, [accessToken]);

  const handleSave = async () => {
    if (!accessToken) return;
    const trimmed = fullName.trim();
    if (!trimmed) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const me = await updateProfile(accessToken, {
        fullName: trimmed,
      });
      updateUser({
        id: me.id,
        email: me.email,
        fullName: me.fullName,
        avatarUrl: me.avatarUrl,
      });
      updateSession({
        accessToken,
        user: {
          id: me.id,
          email: me.email,
          fullName: me.fullName,
          avatarUrl: me.avatarUrl,
        },
        workspaces: me.workspaces,
      });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setPendingFile(file);
  };

  const handleCropConfirm = async (blob: Blob) => {
    if (!accessToken) return;
    setUploadingAvatar(true);
    try {
      const me = await uploadAvatar(accessToken, blob);
      setAvatarUrl(me.avatarUrl ?? "");
      updateUser({
        id: me.id,
        email: me.email,
        fullName: me.fullName,
        avatarUrl: me.avatarUrl,
      });
      updateSession({
        accessToken,
        user: {
          id: me.id,
          email: me.email,
          fullName: me.fullName,
          avatarUrl: me.avatarUrl,
        },
        workspaces: me.workspaces,
      });
      toast.success("Photo updated");
      setPendingFile(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to upload photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const joinedLabel = createdAt
    ? new Date(createdAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: PKT_TIME_ZONE,
      })
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <PageHeader title="Profile" />
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-lg space-y-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading profile…</p>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={fullName} />
                  ) : null}
                  <AvatarFallback
                    className={cn(
                      "text-lg font-semibold",
                      avatarColorClassForKey(user?.id, fullName || email)
                    )}
                  >
                    {avatarInitial(fullName, email)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-semibold">{fullName}</p>
                  <p className="text-sm text-muted-foreground">{email}</p>
                  {joinedLabel ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Member since {joinedLabel}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadIcon className="size-3.5" />
                    Upload photo
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarSelected}
                />
              </div>

              <div className="space-y-4 rounded-xl border border-border bg-card p-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-email">Email</Label>
                  <Input id="profile-email" value={email} readOnly disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-name">Full name</Label>
                  <Input
                    id="profile-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleSave}
                  loading={saving}
                  loadingText="Saving…"
                >
                  Save changes
                </Button>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-semibold">Workspaces</p>
                <ul className="mt-3 space-y-2">
                  {workspaces.map((ws) => (
                    <li
                      key={ws.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <span className="text-sm font-medium">{ws.name}</span>
                      <Badge variant="outline" className="capitalize">
                        {ROLE_LABELS[ws.role] ?? ws.role}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
      <AvatarCropDialog
        file={pendingFile}
        open={pendingFile !== null}
        saving={uploadingAvatar}
        onCancel={() => (uploadingAvatar ? undefined : setPendingFile(null))}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}
