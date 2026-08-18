"use client";

import { isTauri } from "@/lib/tauri";

const OPENABLE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const EXPLICIT_EXTERNAL_SCHEME_RE = /^(?:https?:\/\/|mailto:)/i;

export function isOpenableExternalUrl(rawUrl: string): boolean {
  const value = rawUrl.trim();
  if (!value || !EXPLICIT_EXTERNAL_SCHEME_RE.test(value)) return false;

  try {
    const parsed = new URL(value);
    return OPENABLE_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export async function openExternalUrl(rawUrl: string): Promise<void> {
  const value = rawUrl.trim();
  if (
    !value ||
    typeof window === "undefined" ||
    !isOpenableExternalUrl(value)
  ) {
    return;
  }

  if (isTauri()) {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(value);
      return;
    } catch (err) {
      console.warn("[links] failed to open via tauri shell", err);
    }
  }

  const tab = window.open(value, "_blank", "noopener,noreferrer");
  if (tab) tab.opener = null;
}
