import { create } from "zustand";
import type { AdminUser } from "@/lib/api/admin";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session-cookie";

interface AdminAuthState {
  accessToken: string | null;
  user: AdminUser | null;
  setSession: (input: {
    accessToken: string;
    user: AdminUser;
  }) => void;
  clearSession: () => void;
}

// Deliberately in-memory only, no persist middleware - the admin portal is
// the most privileged account in the app, so a fresh page load (new tab,
// reload, browser restart) always requires a real login instead of
// silently restoring a session from localStorage.
export const useAdminAuthStore = create<AdminAuthState>()((set) => ({
  accessToken: null,
  user: null,
  setSession: ({ accessToken, user }) => {
    setSessionCookie();
    set({
      accessToken,
      user,
    });
  },
  clearSession: () => {
    clearSessionCookie();
    set({ accessToken: null, user: null });
  },
}));
