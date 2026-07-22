"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PortalNav } from "@/components/PortalNav";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatRequestError, isAbortError } from "@/lib/api/client";
import {
  type AdminUserRow,
  type PlatformStaffMember,
  grantPlatformStaff,
  listPlatformStaff,
  listUsers,
  revokePlatformStaff,
} from "@/lib/api/admin";
import { useAdminAuthStore } from "@/stores/auth-store";

interface PendingRevoke {
  userId: string;
  name: string;
}

const SEARCH_DEBOUNCE_MS = 300;

export default function StaffPage() {
  const { ready, accessToken } = useAdminSession();
  const currentUser = useAdminAuthStore((s) => s.user);

  const [items, setItems] = useState<PlatformStaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const [results, setResults] = useState<AdminUserRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [granting, setGranting] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);

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

  const staffUserIds = new Set(items.map((s) => s.userId));

  useEffect(() => {
    if (!accessToken || selected || debouncedQuery.trim().length < 2) {
      setResults([]);
      return;
    }
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearching(true);
    listUsers(accessToken, { q: debouncedQuery.trim(), limit: 8, signal: controller.signal })
      .then((result) => {
        setResults(result.items.filter((u) => !staffUserIds.has(u.id)));
      })
      .catch((err) => {
        if (!isAbortError(err)) setError(formatRequestError(err));
      })
      .finally(() => {
        if (searchAbortRef.current === controller) setSearching(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, accessToken, selected]);

  const handleSelect = (u: AdminUserRow) => {
    setSelected(u);
    setQuery(`${u.fullName} (${u.email})`);
    setDropdownOpen(false);
    setResults([]);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelected(null);
    setDropdownOpen(true);
  };

  const handleGrant = async () => {
    if (!accessToken || !selected) return;
    setGranting(true);
    setError(null);
    try {
      await grantPlatformStaff(accessToken, selected.email);
      setQuery("");
      setSelected(null);
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

        <div className="flex flex-wrap items-start gap-2">
          <div className="relative w-full max-w-sm">
            <input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              placeholder="Search by name or email…"
              className="w-full rounded border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            />
            {dropdownOpen && (searching || results.length > 0) && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded border border-[var(--border)] bg-[var(--card)] shadow-lg">
                {searching ? (
                  <p className="px-3 py-2 text-xs text-[var(--muted-foreground)]">Searching…</p>
                ) : (
                  results.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={() => handleSelect(u)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--muted)]"
                    >
                      {u.fullName}{" "}
                      <span className="text-[var(--muted-foreground)]">({u.email})</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={!selected || granting}
            onClick={handleGrant}
            className="rounded bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
          >
            {granting ? "Granting…" : "Grant access"}
          </button>
        </div>

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
              {items.map((s) => {
                const isSelf = s.userId === currentUser?.id;
                return (
                  <tr key={s.id} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2">
                      {s.fullName}
                      {isSelf && (
                        <span className="ml-1.5 text-xs text-[var(--muted-foreground)]">(you)</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{s.email}</td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">
                      {s.grantedBy ? `${s.grantedBy.fullName} (${s.grantedBy.email})` : "—"}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      {!isSelf && (
                        <button
                          onClick={() =>
                            setPendingRevoke({
                              userId: s.userId,
                              name: `${s.fullName} (${s.email})`,
                            })
                          }
                          className="rounded border border-[var(--destructive)] px-2 py-1 text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
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
