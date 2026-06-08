"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRightIcon, LockIcon } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthFormCard } from "@/components/auth/AuthFormCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/page-loader";
import { useNavigateWithLoading } from "@/hooks/use-navigate-with-loading";
import { resetPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

function ResetPasswordForm() {
  const navigateWithLoading = useNavigateWithLoading();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (!token) {
      toast.error("Invalid reset link");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      toast.success("Password updated. You can log in now.");
      navigateWithLoading("/auth/login", "Redirecting to log in…");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Reset failed. Try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthFormCard title="Invalid link" description="This reset link is missing or expired.">
        <Button nativeButton={false} render={<Link href="/auth/forgot-password" />} className="w-full">
          Request a new link
        </Button>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard title="Set new password" description="Choose a strong password.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <div className="relative">
            <LockIcon className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              id="new-password"
              type="password"
              className="pl-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <div className="relative">
            <LockIcon className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              id="confirm-password"
              type="password"
              className="pl-9"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
        </div>
        <Button
          type="submit"
          className="w-full"
          loading={loading}
          loadingText="Updating…"
        >
          Update password
          <ArrowRightIcon className="size-4" />
        </Button>
      </form>
    </AuthFormCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Reset password" subtitle="Enter your new password below.">
      <Suspense fallback={<PageLoader label="Loading…" fullHeight={false} />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
