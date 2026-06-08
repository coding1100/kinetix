"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme";
import { useSettingsStore } from "@/stores/settings-store";

/** Applies persisted theme preference from settings store after mount (avoids hydration flash). */
export function ThemeSync() {
  const theme = useSettingsStore((s) => s.theme);
  const { setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) setTheme(theme);
  }, [theme, setTheme, mounted]);

  return null;
}
