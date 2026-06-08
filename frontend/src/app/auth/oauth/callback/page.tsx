"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthFormCard } from "@/components/auth/AuthFormCard";
import { PageLoader } from "@/components/ui/page-loader";
import { useNavigateWithLoading } from "@/hooks/use-navigate-with-loading";
import { exchangeOAuthCode, getMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

const ERROR_MESSAGES: Record<string, string> = {
  OAUTH_NOT_CONFIGURED:
    "Google sign-in is not configured on the server. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to backend-py/.env.",
  OAUTH_STATE_INVALID: "Sign-in session expired. Please try again.",
  OAUTH_CODE_INVALID: "Sign-in link expired. Please try again.",
  EMAIL_USE_PASSWORD:
    "This email already uses a password. Sign in with email and password instead.",
  OAUTH_EMAIL_REQUIRED: "Google did not provide a verified email.",
  OAUTH_FAILED: "Google sign-in failed. Try again.",
  access_denied: "Google sign-in was cancelled.",
  missing_code: "Google sign-in did not complete. Try again.",
};

function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/home/inbox";
  }
  return next;
}

function OAuthCallbackForm() {
  const searchParams = useSearchParams();
  const navigateWithLoading = useNavigateWithLoading();
  const setSession = useAuthStore((s) => s.setSession);
  const [status, setStatus] = useState<"working" | "error">("working");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const error = searchParams.get("error");
    const message = searchParams.get("message");
    const code = searchParams.get("code");

    if (error) {
      const text =
        message ||
        ERROR_MESSAGES[error] ||
        "Google sign-in could not be completed.";
      setErrorMessage(text);
      setStatus("error");
      toast.error(text);
      return;
    }

    if (!code) {
      const text = "Missing sign-in code. Try again from the login page.";
      setErrorMessage(text);
      setStatus("error");
      toast.error(text);
      return;
    }

    const exchangeKey = `riseup_oauth_exchange_${code}`;
    if (typeof sessionStorage !== "undefined") {
      if (sessionStorage.getItem(exchangeKey) === "done") {
        return;
      }
      if (sessionStorage.getItem(exchangeKey) === "pending") {
        return;
      }
      sessionStorage.setItem(exchangeKey, "pending");
    } else if (started.current) {
      return;
    }
    started.current = true;

    void (async () => {
      try {
        const result = await exchangeOAuthCode(code);
        const me = await getMe(result.accessToken);
        setSession({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken ?? null,
          user: result.user,
          workspaces: me.workspaces,
        });
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(exchangeKey, "done");
        }
        toast.success("Signed in with Google");
        const destination = safeNextPath(searchParams.get("next"));
        const target =
          me.workspaces.length === 0 ? "/onboarding/welcome" : destination;
        navigateWithLoading(target, "Signing you in…");
      } catch (err) {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.removeItem(exchangeKey);
        }
        const text =
          err instanceof ApiError
            ? err.message
            : "Google sign-in failed. Try again.";
        setErrorMessage(text);
        setStatus("error");
        toast.error(text);
      }
    })();
  }, [searchParams, setSession, navigateWithLoading]);

  if (status === "error") {
    return (
      <AuthFormCard
        title="Sign-in failed"
        description={errorMessage ?? "Something went wrong."}
      >
        <p className="text-center text-sm">
          <a href="/auth/login" className="text-primary hover:underline">
            Back to log in
          </a>
        </p>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard title="Signing you in" description="Completing Google sign-in…">
      <PageLoader label="Signing you in…" fullHeight={false} />
    </AuthFormCard>
  );
}

export default function OAuthCallbackPage() {
  return (
    <AuthShell
      title="Google sign-in"
      subtitle="Connecting your Google account to Kinetix."
    >
      <Suspense
        fallback={
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        }
      >
        <OAuthCallbackForm />
      </Suspense>
    </AuthShell>
  );
}
