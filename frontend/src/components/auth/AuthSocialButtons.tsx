"use client";

import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { googleOAuthStartUrl } from "@/lib/auth/google-oauth";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9a6 6 0 1 1 0-12c2.2 0 3.6.9 4.5 1.7l3.1-3A11 11 0 1 0 23 12c0-.7-.1-1.3-.2-1.8H12Z"
      />
      <path
        fill="#34A853"
        d="M6.7 14.3 5.9 17l-2.7.1A11 11 0 0 1 1 12c0-1.8.4-3.5 1.2-5l2.4.4 1 2.3A6 6 0 0 0 6 12c0 .8.2 1.6.6 2.3Z"
      />
      <path
        fill="#4A90E2"
        d="M22.8 10.2H12v3.9h5.4c-.3 1.6-1.3 2.7-2.6 3.4l3.1 2.4c2-1.8 3.1-4.5 3.1-7.9 0-.6 0-1.2-.2-1.8Z"
      />
      <path
        fill="#FBBC05"
        d="M6 9.7 2.6 7A11 11 0 0 1 12 1a10.6 10.6 0 0 1 7.3 2.8l-3.1 3A6 6 0 0 0 12 5.9 6 6 0 0 0 6 9.7Z"
      />
    </svg>
  );
}

function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/home/inbox";
  }
  return next;
}

export function AuthSocialButtons() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  function startGoogle() {
    window.location.href = googleOAuthStartUrl(next);
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-center gap-2"
        onClick={startGoogle}
      >
        <GoogleIcon />
        Continue with Google
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Or continue with email below
      </p>
    </div>
  );
}
