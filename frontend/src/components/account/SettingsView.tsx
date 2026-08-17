"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { Switch } from "@/components/ui/switch";
import { changePassword, getMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { isPasswordValid } from "@/lib/password";
import { useAuthStore, selectActiveWorkspace } from "@/stores/auth-store";
import { BellIcon, Volume2Icon } from "lucide-react";
import {
  useSettingsStore,
  type SoundPreset,
  type ThemePreference,
} from "@/stores/settings-store";
import {
  getDesktopPermission,
  requestDesktopPermission,
  sendTestDesktopNotification,
} from "@/lib/notifications/desktop";
import { playNotificationSound, SOUND_PRESETS } from "@/lib/notifications/sound";
import { toast } from "sonner";

export function SettingsView() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const workspace = useAuthStore(selectActiveWorkspace);
  const {
    theme,
    setTheme,
    soundEnabled,
    setSoundEnabled,
    soundPreset,
    setSoundPreset,
    desktopNotifications,
    setDesktopNotifications,
  } = useSettingsStore();
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

  const handleSoundPresetChange = (preset: SoundPreset) => {
    setSoundPreset(preset);
    playNotificationSound(preset, true);
    toast.success("Notification sound updated");
  };

  const handleDesktopNotificationsChange = async (enabled: boolean) => {
    if (!enabled) {
      setDesktopNotifications(false);
      return;
    }
    const permission = await requestDesktopPermission();
    if (permission === "granted") {
      setDesktopNotifications(true);
      sendTestDesktopNotification();
      toast.success("Desktop notifications enabled!");
    } else if (permission === "denied") {
      toast.error("Desktop notifications are blocked in your browser settings");
    } else if (permission === "unsupported") {
      toast.error("Desktop notifications aren't supported in this browser");
    }
  };

  const handlePasswordChange = async () => {
    if (!accessToken) return;
    if (!currentPassword) {
      toast.error("Enter your current password");
      return;
    }
    if (!isPasswordValid(newPassword)) {
      toast.error("New password doesn't meet the requirements below");
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
          </section>

          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Notifications & Sound</h2>

            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="notification-sound" className="text-sm font-normal">
                Play sound on new messages
              </Label>
              <Switch
                id="notification-sound"
                checked={soundEnabled}
                onCheckedChange={(v) => setSoundEnabled(Boolean(v))}
              />
            </div>

            {soundEnabled ? (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sound-preset" className="text-xs text-muted-foreground">
                    Notification Sound
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => playNotificationSound(soundPreset, true)}
                  >
                    <Volume2Icon className="size-3.5" />
                    Test Sound
                  </Button>
                </div>
                <Select
                  value={soundPreset}
                  onValueChange={(v) => v && handleSoundPresetChange(v as SoundPreset)}
                >
                  <SelectTrigger id="sound-preset" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOUND_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        <div className="flex flex-col text-left">
                          <span className="font-medium">{preset.label}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {preset.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="notification-desktop" className="text-sm font-normal">
                    Desktop notifications
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Get notified about new messages and mentions when this app or tab isn&apos;t in focus.
                  </p>
                </div>
                <Switch
                  id="notification-desktop"
                  checked={desktopNotifications && mounted && getDesktopPermission() === "granted"}
                  onCheckedChange={(v) => void handleDesktopNotificationsChange(Boolean(v))}
                />
              </div>

              {desktopNotifications && mounted && getDesktopPermission() === "granted" ? (
                <div className="mt-2.5 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => {
                      sendTestDesktopNotification();
                      toast.info("Sent test desktop notification");
                    }}
                  >
                    <BellIcon className="size-3.5" />
                    Send Test Notification
                  </Button>
                </div>
              ) : null}
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
                  <PasswordStrengthMeter password={newPassword} />
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
