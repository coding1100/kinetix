"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { changePassword, getMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore, selectActiveWorkspace } from "@/stores/auth-store";
import { useSettingsStore, type ThemePreference } from "@/stores/settings-store";
import { useShellStore } from "@/stores/shell-store";
import { toast } from "sonner";

export function SettingsView() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const workspace = useAuthStore(selectActiveWorkspace);
  const { theme, setTheme, emailNotifications, setEmailNotifications, desktopNotifications, setDesktopNotifications } =
    useSettingsStore();
  const { secondaryPanelOpen, setSecondaryPanelOpen } = useShellStore();
  const { setTheme: applyTheme, resolvedTheme } = useTheme();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasPassword, setHasPassword] = useState(true);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!accessToken) return;
    getMe(accessToken)
      .then((me) => setHasPassword(me.hasPassword))
      .catch(() => setHasPassword(true));
  }, [accessToken]);

  useEffect(() => {
    if (mounted) applyTheme(theme);
  }, [theme, applyTheme, mounted]);

  const handleThemeChange = (value: ThemePreference) => {
    setTheme(value);
    applyTheme(value);
    toast.success("Theme updated");
  };

  const handlePasswordChange = async () => {
    if (!accessToken) return;
    if (!currentPassword || newPassword.length < 8) {
      toast.error("Enter current password and a new password (8+ characters)");
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(accessToken, {
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Password updated");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to change password"
      );
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <PageHeader title="Settings" />
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-lg space-y-6">
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Appearance</h2>
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select
                value={mounted ? theme : "system"}
                onValueChange={(v) =>
                  v && handleThemeChange(v as ThemePreference)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
              {mounted ? (
                <p className="text-xs text-muted-foreground">
                  Active: {resolvedTheme ?? theme}
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Show Home sidebar</p>
                <p className="text-xs text-muted-foreground">
                  Inbox / Replies panel beside navigation
                </p>
              </div>
              <Switch
                checked={secondaryPanelOpen}
                onCheckedChange={setSecondaryPanelOpen}
              />
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Email notifications</p>
                <p className="text-xs text-muted-foreground">
                  Workspace invites and digests (when enabled on server)
                </p>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Desktop notifications</p>
                <p className="text-xs text-muted-foreground">
                  Browser alerts for mentions and DMs
                </p>
              </div>
              <Switch
                checked={desktopNotifications}
                onCheckedChange={(v) => {
                  setDesktopNotifications(v);
                  if (v && typeof Notification !== "undefined") {
                    void Notification.requestPermission();
                  }
                }}
              />
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Workspace</h2>
            <p className="text-sm text-muted-foreground">
              Active: <strong>{workspace?.name ?? "None"}</strong>
              {workspace?.role ? ` · ${workspace.role}` : ""}
            </p>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/people" />}>
              Manage people
            </Button>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Password</h2>
            {!hasPassword ? (
              <p className="text-sm text-muted-foreground">
                You signed in with Google. Use{" "}
                <Link href="/auth/forgot-password" className="text-primary underline">
                  forgot password
                </Link>{" "}
                to set a password for email login.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handlePasswordChange}
                  loading={changingPassword}
                  loadingText="Updating…"
                >
                  Update password
                </Button>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Account</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Edit your name and avatar on your profile page.
            </p>
            <Button
              variant="link"
              className="mt-2 h-auto px-0"
              nativeButton={false}
              render={<Link href="/profile" />}
            >
              Open profile
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
