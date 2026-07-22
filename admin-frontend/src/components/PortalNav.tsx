"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminLogout } from "@/lib/api/admin";
import { useAdminAuthStore } from "@/stores/auth-store";

const TABS = [
  { href: "/workspaces", label: "Workspaces" },
  { href: "/users", label: "Users" },
  { href: "/staff", label: "Admins" },
];

export function PortalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearSession } = useAdminAuthStore();

  const handleLogout = async () => {
    try {
      await adminLogout();
    } finally {
      clearSession();
      router.replace("/login");
    }
  };

  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="font-semibold">Kinetix Admin</span>
        <nav className="flex gap-4">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`text-sm ${
                pathname?.startsWith(tab.href)
                  ? "font-medium text-[var(--primary)]"
                  : "text-[var(--muted-foreground)]"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
        {user?.email}
        <button
          onClick={handleLogout}
          className="rounded border border-[var(--border)] px-3 py-1 text-[var(--foreground)] hover:bg-[var(--muted)]"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
