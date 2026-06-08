"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  LockIcon,
  MailIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthFormCard } from "@/components/auth/AuthFormCard";
import { AuthSocialButtons } from "@/components/auth/AuthSocialButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigateWithLoading } from "@/hooks/use-navigate-with-loading";
import { login, getMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/home/inbox";
  }
  return next;
}

function LoginForm() {
  const navigateWithLoading = useNavigateWithLoading();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      const me = await getMe(result.accessToken);
      setSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? null,
        user: result.user,
        workspaces: me.workspaces,
      });
      toast.success("Welcome back!");
      const destination = safeNextPath(searchParams.get("next"));
      navigateWithLoading(destination, "Signing you in…");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Login failed. Try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFormCard title="Log in" description="Use Google or your work email and password.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthSocialButtons />
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Email</Label>
          <div className="relative">
            <MailIcon className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              id="login-email"
              type="email"
              placeholder="owner@demo.com"
              className="pl-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Password</Label>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <LockIcon className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              id="login-password"
              type="password"
              placeholder="Enter password"
              className="pl-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
        </div>
        <Button
          type="submit"
          className="w-full"
          loading={loading}
          loadingText="Signing in…"
        >
          Log in
          <ArrowRightIcon className="size-4" />
        </Button>
      </form>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheckIcon className="size-4 text-primary" />
          Demo: owner@demo.com / password123
        </p>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2Icon className="size-4 text-emerald-600" />
          Quick access to Inbox, Home, and Chat after sign in.
        </p>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/auth/signup" className="text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthFormCard>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Securely access your workspace, tasks, and chat."
    >
      <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
