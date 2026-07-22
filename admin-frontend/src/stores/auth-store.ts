import { create } from "zustand";
import type { AdminUser } from "@/lib/api/admin";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session-cookie";

interface AdminAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AdminUser | null;
  setSession: (input: {
    accessToken: string;
    refreshToken?: string | null;
    user: AdminUser;
  }) => void;
  clearSession: () => void;
}

// Deliberately in-memory only, no persist middleware - the admin portal is
// the most privileged account in the app, so a fresh page load (new tab,
// reload, browser restart) always requires a real login instead of
// silently restoring a session from localStorage.
export const useAdminAuthStore = create<AdminAuthState>()((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
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
}));
