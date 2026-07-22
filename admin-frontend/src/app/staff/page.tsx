"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PortalNav } from "@/components/PortalNav";
import { useAdminSession } from "@/hooks/use-admin-session";
import { formatRequestError } from "@/lib/api/client";
import {
  type PlatformStaffMember,
  grantPlatformStaff,
  listPlatformStaff,
  revokePlatformStaff,
} from "@/lib/api/admin";

interface PendingRevoke {
  userId: string;
  name: string;
}

export default function StaffPage() {
  const { ready, accessToken } = useAdminSession();
  const [items, setItems] = useState<PlatformStaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [granting, setGranting] = useState(false);

  const [pendingRevoke, setPendingRevoke] = useState<PendingRevoke | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listPlatformStaff(accessToken);
      setItems(result.items);
    } catch (err) {
      setError(formatRequestError(err));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (ready && accessToken) void load();
  }, [ready, accessToken, load]);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !email.trim()) return;
    setGranting(true);
    setError(null);
    try {
      await grantPlatformStaff(accessToken, email.trim());
      setEmail("");
      await load();
    } catch (err) {
      setError(formatRequestError(err));
    } finally {
      setGranting(false);
    }
  };

  const confirmRevoke = async () => {
    if (!pendingRevoke || !accessToken) return;
    setConfirmBusy(true);
    try {
      await revokePlatformStaff(accessToken, pendingRevoke.userId);
      await load();
      setPendingRevoke(null);
    } catch (err) {
      setError(formatRequestError(err));
    } finally {
      setConfirmBusy(false);
    }
  };

  if (!ready) return null;

  return (
    <div>
      <PortalNav />
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <div>
          <h1 className="text-lg font-semibold">Platform admins</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            People who can sign in to this admin portal. Granting access requires an existing
            account — it doesn't create one.
          </p>
        </div>

        <form onSubmit={handleGrant} className="flex flex-wrap gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
            className="w-full max-w-sm rounded border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={granting}
            className="rounded bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
          >
            {granting ? "Granting…" : "Grant access"}
          </button>
        </form>

        {error && (
          <p className="rounded border border-[var(--destructive)] bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--muted)] text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Granted by</th>
                <th className="px-3 py-2">Since</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-b border-[var(--border)]">
                  <td className="px-3 py-2">{s.fullName}</td>
                  <td className="px-3 py-2">{s.email}</td>
                  <td className="px-3 py-2 text-[var(--muted-foreground)]">
                    {s.grantedBy ? `${s.grantedBy.fullName} (${s.grantedBy.email})` : "—"}
                  </td>
                  <td className="px-3 py-2 text-[var(--muted-foreground)]">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() =>
                        setPendingRevoke({ userId: s.userId, name: `${s.fullName} (${s.email})` })
                      }
                      className="rounded border border-[var(--destructive)] px-2 py-1 text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--muted-foreground)]">
                    No platform admins yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      <ConfirmDialog
        open={pendingRevoke !== null}
        title="Revoke admin-portal access?"
        description={
          pendingRevoke
            ? `${pendingRevoke.name} will no longer be able to sign in to the admin portal.`
            : undefined
        }
        confirmLabel="Revoke"
        danger
        busy={confirmBusy}
        onConfirm={confirmRevoke}
        onCancel={() => setPendingRevoke(null)}
      />
    </div>
  );
}
