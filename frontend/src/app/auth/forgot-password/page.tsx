"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  KeyRoundIcon,
  MailIcon,
  TimerResetIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthFormCard } from "@/components/auth/AuthFormCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigateWithLoading } from "@/hooks/use-navigate-with-loading";
import { forgotPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

export default function ForgotPasswordPage() {
  const navigateWithLoading = useNavigateWithLoading();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const trimmed = email.trim();
      const result = await forgotPassword(trimmed);
      toast.success(result.message);
      if (result.resetToken) {
        navigateWithLoading(
          `/auth/reset-password?token=${encodeURIComponent(result.resetToken)}`,
          "Redirecting…"
        );
      } else {
        setSubmittedEmail(trimmed);
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Could not send reset link.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (submittedEmail) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="Password reset instructions have been sent."
      >
        <AuthFormCard
          title="Reset link sent"
          description={`If an account exists for ${submittedEmail}, we have sent a password reset link to your email address.`}
        >
          <div className="space-y-4 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MailIcon className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              Please check your inbox (and spam folder). The link will expire shortly.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setSubmittedEmail(null)}
            >
              Send link again
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ArrowLeftIcon className="size-3.5" />
                Back to log in
              </Link>
            </p>
          </div>
        </AuthFormCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="Recover account access with a secure reset link."
    >
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <TimerResetIcon className="size-4 text-primary" />
          Reset links expire quickly to keep your account safe.
        </p>
      </div>
      <AuthFormCard
        title="Forgot password"
        description="Enter your account email below."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reset-email">Email</Label>
            <div className="relative">
              <MailIcon className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                id="reset-email"
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
          <Button
            type="submit"
            className="w-full"
            loading={loading}
            loadingText="Sending…"
          >
            <KeyRoundIcon className="size-4" />
            Send reset link
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ArrowLeftIcon className="size-3.5" />
            Back to log in
          </Link>
        </p>
      </AuthFormCard>
    </AuthShell>
  );
}
