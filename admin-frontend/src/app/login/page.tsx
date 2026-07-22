"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminLogin } from "@/lib/api/admin";
import { ApiError, formatRequestError } from "@/lib/api/client";
import { useAdminAuthStore } from "@/stores/auth-store";

function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/workspaces";
  }
  return next;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAdminAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await adminLogin(email.trim(), password);
      setSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? null,
        user: result.user,
      });
      router.replace(safeNextPath(searchParams.get("next")));
    } catch (err) {
      setError(
        err instanceof ApiError ? formatRequestError(err) : "Login failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-6"
    >
      <div>
        <h1 className="text-lg font-semibold">Admin sign in</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Platform staff only.
        </p>
      </div>
      {error && (
        <p className="rounded border border-[var(--destructive)] bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
          {error}
        </p>
      )}
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Log in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
