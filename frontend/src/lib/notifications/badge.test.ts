import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { updateAppUnreadBadge } from "./badge";

describe("updateAppUnreadBadge", () => {
  const originalTitle = globalThis.document?.title;

  beforeEach(() => {
    if (typeof globalThis.document === "undefined") {
      (globalThis as any).document = { title: "Kinetix" };
    } else {
      globalThis.document.title = "Kinetix";
    }

    if (typeof globalThis.navigator === "undefined") {
      (globalThis as any).navigator = {};
    }
  });

  afterEach(() => {
    if (globalThis.document && originalTitle !== undefined) {
      globalThis.document.title = originalTitle;
    }
  });

  it("updates document title with unread count when > 0", () => {
    updateAppUnreadBadge(5);
    expect(globalThis.document.title).toBe("(5) Kinetix");
  });

  it("clears unread count from document title when 0", () => {
    globalThis.document.title = "(3) Kinetix";
    updateAppUnreadBadge(0);
    expect(globalThis.document.title).toBe("Kinetix");
  });

  it("invokes setAppBadge when count > 0", () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    (globalThis.navigator as any).setAppBadge = setAppBadge;

    updateAppUnreadBadge(2);
    expect(setAppBadge).toHaveBeenCalledWith(2);
  });

  it("invokes clearAppBadge when count is 0", () => {
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    (globalThis.navigator as any).clearAppBadge = clearAppBadge;

    updateAppUnreadBadge(0);
    expect(clearAppBadge).toHaveBeenCalled();
  });
});
