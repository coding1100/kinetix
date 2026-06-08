"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import { THEME_STORAGE_KEY } from "@/lib/theme-constants";

export type ThemePreference = "light" | "dark" | "system";

export { THEME_STORAGE_KEY };

interface ThemeContextValue {
  theme?: ThemePreference;
  setTheme: Dispatch<SetStateAction<ThemePreference>>;
  resolvedTheme?: "light" | "dark";
  themes: string[];
  systemTheme?: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue>({
  setTheme: () => undefined,
  themes: ["light", "dark", "system"],
});

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: ThemePreference): "light" | "dark" {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
  return resolved;
}

function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // ignore
  }
  return "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    setResolvedTheme(applyTheme(stored));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      setThemeState((current) => {
        if (current === "system") {
          setResolvedTheme(applyTheme("system"));
        }
        return current;
      });
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mounted]);

  const setTheme = useCallback<Dispatch<SetStateAction<ThemePreference>>>(
    (value) => {
      setThemeState((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        try {
          localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // ignore
        }
        setResolvedTheme(applyTheme(next));
        return next;
      });
    },
    []
  );

  const systemTheme = mounted ? getSystemTheme() : undefined;

  const value = useMemo(
    () => ({
      theme: mounted ? theme : undefined,
      setTheme,
      resolvedTheme: mounted ? resolvedTheme : undefined,
      themes: ["light", "dark", "system"],
      systemTheme,
    }),
    [theme, setTheme, resolvedTheme, mounted, systemTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
