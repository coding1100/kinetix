"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRightIcon, LockIcon, MailIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthFormCard } from "@/components/auth/AuthFormCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/page-loader";
import { useNavigateWithLoading } from "@/hooks/use-navigate-with-loading";
import { getMe } from "@/lib/api/auth";
import {
  acceptInvite,
  acceptInviteSignup,
  getInvitePreview,
} from "@/lib/api/invites";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

function inviteLoginHref(token: string) {
  const next = `/invite/accept?token=${encodeURIComponent(token)}`;
  return `/auth/login?next=${encodeURIComponent(next)}`;
}

function InviteAcceptForm() {
  const navigateWithLoading = useNavigateWithLoading();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const updateSession = useAuthStore((s) => s.updateSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  const [preview, setPreview] = useState<{
    email: string;
    workspace: { name: string; id: string };
  } | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isLoggedIn = Boolean(accessToken && user);
  const emailMatches =
    isLoggedIn &&
    preview &&
    user!.email.toLowerCase() === preview.email.toLowerCase();

  useEffect(() => {
    if (!token) return;
    getInvitePreview(token)
      .then((data) =>
        setPreview({ email: data.email, workspace: data.workspace })
      )
      .catch((err) =>
        setLoadError(
          err instanceof ApiError ? err.message : "Invite not found or expired"
        )
      );
  }, [token]);

  const handleAcceptExisting = async () => {
    if (!accessToken || !token) return;
    setLoading(true);
    try {
      const result = await acceptInvite(accessToken, token);
      const me = await getMe(accessToken);
      updateSession({
        accessToken,
        user: {
          id: me.id,
          email: me.email,
          fullName: me.fullName,
          avatarUrl: me.avatarUrl,
        },
        workspaces: me.workspaces,
        activeWorkspaceId: result.workspace.id,
      });
      toast.success(`Joined ${result.workspace.name}!`);
      navigateWithLoading("/home/inbox", "Joining workspace…");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not accept invite"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    try {
      const result = await acceptInviteSignup(token, fullName.trim(), password);
      setSession({
        accessToken: result.accessToken,
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          avatarUrl: null,
        },
        workspaces: [
          {
            id: result.workspace.id,
            name: result.workspace.name,
            slug: result.workspace.slug,
            role: result.role,
          },
        ],
        activeWorkspaceId: result.workspace.id,
      });
      toast.success(`Joined ${result.workspace.name}!`);
      navigateWithLoading("/home/inbox", "Joining workspace…");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not accept invite"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthFormCard title="Invalid invite" description="This invite link is missing a token.">
        <Button nativeButton={false} render={<Link href="/auth/login" />} className="w-full">
          Go to log in
        </Button>
      </AuthFormCard>
    );
  }

  if (loadError) {
    return (
      <AuthFormCard title="Invite unavailable" description={loadError}>
        <Button nativeButton={false} render={<Link href="/auth/login" />} className="w-full">
          Go to log in
        </Button>
      </AuthFormCard>
    );
  }

  if (!preview) {
    return (
      <AuthFormCard title="Loading invite…" description="Please wait.">
        <PageLoader label="Verifying your invitation…" fullHeight={false} />
      </AuthFormCard>
    );
  }

  if (isLoggedIn && !emailMatches) {
    return (
      <AuthFormCard
        title={`Join ${preview.workspace.name}`}
        description={`This invite is for ${preview.email}, but you're signed in as ${user!.email}.`}
      >
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            clearSession();
            toast.message("Signed out — log in with the invited email");
          }}
        >
          Sign out and switch account
        </Button>
        <Button
          nativeButton={false}
          render={<Link href={inviteLoginHref(token)} />}
          className="w-full"
        >
          Log in as {preview.email}
        </Button>
      </AuthFormCard>
    );
  }

  if (isLoggedIn && emailMatches) {
    return (
      <AuthFormCard
        title={`Join ${preview.workspace.name}`}
        description={`Accept the invitation sent to ${preview.email}.`}
      >
        <Button
          type="button"
          className="w-full"
          loading={loading}
          loadingText="Joining…"
          onClick={handleAcceptExisting}
        >
          Accept invite
          <ArrowRightIcon className="size-4" />
        </Button>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard
      title={`Join ${preview.workspace.name}`}
      description={`You've been invited as ${preview.email}`}
    >
      <form onSubmit={handleSignupSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <div className="relative">
            <MailIcon className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              id="invite-email"
              type="email"
              className="pl-9"
              value={preview.email}
              readOnly
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-name">Full name</Label>
          <div className="relative">
            <UserIcon className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              id="invite-name"
              className="pl-9"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-password">Password</Label>
          <div className="relative">
            <LockIcon className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              id="invite-password"
              type="password"
              className="pl-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
        </div>
        <Button
          type="submit"
          className="w-full"
          loading={loading}
          loadingText="Joining…"
        >
          Accept invite
          <ArrowRightIcon className="size-4" />
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={inviteLoginHref(token)} className="text-primary hover:underline">
          Log in
        </Link>
      </p>
    </AuthFormCard>
  );
}

export default function InviteAcceptPage() {
  return (
    <AuthShell title="Workspace invite" subtitle="Create your account to join the team.">
      <Suspense fallback={<PageLoader label="Loading…" fullHeight={false} />}>
        <InviteAcceptForm />
      </Suspense>
    </AuthShell>
  );
}
