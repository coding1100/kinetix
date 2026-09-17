// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as downloadModule from "@/lib/files/download";

vi.mock("@/lib/files/download", () => ({
  downloadFileWithFeedback: vi.fn(),
}));

describe("ExternalLinkProvider link click handler logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles user clicks on download anchors and calls downloadFileWithFeedback", () => {
    const handleGlobalLinkClick = (e: MouseEvent) => {
      if (!e.isTrusted && (e as any).synthetic) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (
        anchor.dataset.nativeDownload === "true" ||
        anchor.hasAttribute("data-native-download")
      ) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href) return;
      if (anchor.hasAttribute("download")) {
        e.preventDefault();
        e.stopPropagation();
        const fileName = anchor.getAttribute("download") || href.split("/").pop() || "download";
        void downloadModule.downloadFileWithFeedback(href, fileName);
      }
    };

    document.addEventListener("click", handleGlobalLinkClick, true);

    const anchor = document.createElement("a");
    anchor.href = "https://example.com/plan.md";
    anchor.setAttribute("download", "plan.md");
    document.body.appendChild(anchor);

    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);

    expect(downloadModule.downloadFileWithFeedback).toHaveBeenCalledTimes(1);
    expect(downloadModule.downloadFileWithFeedback).toHaveBeenCalledWith(
      "https://example.com/plan.md",
      "plan.md"
    );

    document.removeEventListener("click", handleGlobalLinkClick, true);
    document.body.removeChild(anchor);
  });

  it("ignores anchors with data-native-download to prevent loops", () => {
    const handleGlobalLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (
        anchor.dataset.nativeDownload === "true" ||
        anchor.hasAttribute("data-native-download")
      ) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href) return;
      if (anchor.hasAttribute("download")) {
        const fileName = anchor.getAttribute("download") || href.split("/").pop() || "download";
        void downloadModule.downloadFileWithFeedback(href, fileName);
      }
    };

    document.addEventListener("click", handleGlobalLinkClick, true);

    const anchor = document.createElement("a");
    anchor.href = "https://example.com/plan.md";
    anchor.setAttribute("download", "plan.md");
    anchor.setAttribute("data-native-download", "true");
    document.body.appendChild(anchor);

    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);

    expect(downloadModule.downloadFileWithFeedback).not.toHaveBeenCalled();

    document.removeEventListener("click", handleGlobalLinkClick, true);
    document.body.removeChild(anchor);
  });
});
