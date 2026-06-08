"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  LockIcon,
  MailIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthFormCard } from "@/components/auth/AuthFormCard";
import { AuthSocialButtons } from "@/components/auth/AuthSocialButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigateWithLoading } from "@/hooks/use-navigate-with-loading";
import { signup, getMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

export default function SignupPage() {
  const navigateWithLoading = useNavigateWithLoading();
  const setSession = useAuthStore((s) => s.setSession);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signup({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
      });
      const me = await getMe(result.accessToken);
      setSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? null,
        user: result.user,
        workspaces: me.workspaces,
      });
      toast.success("Account created!");
      navigateWithLoading("/onboarding/welcome", "Setting up your account…");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Sign up failed. Try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up your profile and start collaborating with your team."
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <UsersIcon className="size-3.5 text-primary" />
            Invite teammates
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <BadgeCheckIcon className="size-3.5 text-primary" />
            Production-ready workspace
          </p>
        </div>
      </div>
      <AuthFormCard title="Sign up" description="Create your profile in seconds.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Suspense fallback={null}>
            <AuthSocialButtons />
          </Suspense>
          <div className="space-y-1.5">
            <Label htmlFor="signup-name">Full name</Label>
            <div className="relative">
              <UserIcon className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                id="signup-name"
                placeholder="Alex Rivera"
                className="pl-9"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signup-email">Work email</Label>
            <div className="relative">
              <MailIcon className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                id="signup-email"
                type="email"
                placeholder="you@company.com"
                className="pl-9"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signup-password">Password</Label>
            <div className="relative">
              <LockIcon className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                id="signup-password"
                type="password"
                placeholder="Min. 8 characters"
                className="pl-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            loadingText="Creating account…"
          >
            Continue
            <ArrowRightIcon className="size-4" />
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-primary hover:underline">
            Log in
          </Link>
        </p>
      </AuthFormCard>
    </AuthShell>
  );
}
