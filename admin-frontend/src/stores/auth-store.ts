import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AdminUser } from "@/lib/api/admin";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session-cookie";

interface AdminAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AdminUser | null;
  hydrated: boolean;
  setHydrated: () => void;
  setSession: (input: {
    accessToken: string;
    refreshToken?: string | null;
    user: AdminUser;
  }) => void;
  clearSession: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      setSession: ({ accessToken, refreshToken, user }) => {
        setSessionCookie();
        set({
          accessToken,
          refreshToken: refreshToken ?? get().refreshToken,
          user,
        });
      },
      clearSession: () => {
        clearSessionCookie();
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    {
      // Distinct storage key from the main app's "riseup-auth" — both apps
      // are same-origin under nginx path routing, and localStorage is
      // origin-scoped (not path-scoped), so a shared key would collide.
      name: "riseup-admin-auth",
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) setSessionCookie();
        state?.setHydrated();
      },
    }
  )
);
