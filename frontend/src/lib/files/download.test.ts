// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { downloadFileWithFeedback } from "./download";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("downloadFileWithFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks programmatic download anchor with data-native-download", async () => {
    let clickedAnchor: HTMLAnchorElement | null = null;
    const originalClick = HTMLAnchorElement.prototype.click;

    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clickedAnchor = this;
    };

    // Mock fetch to simulate CORS/network fallback
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network Error"));

    try {
      await downloadFileWithFeedback("https://example.com/file.md", "file.md");

      expect(clickedAnchor).not.toBeNull();
      expect((clickedAnchor as HTMLAnchorElement | null)?.getAttribute("data-native-download")).toBe("true");
      expect((clickedAnchor as HTMLAnchorElement | null)?.getAttribute("download")).toBe("file.md");
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("Download started for file.md"),
        expect.any(Object)
      );
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });

  it("deduplicates rapid simultaneous download calls for the same file", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network Error"));

    const p1 = downloadFileWithFeedback("https://example.com/test.png", "test.png");
    const p2 = downloadFileWithFeedback("https://example.com/test.png", "test.png");

    await Promise.all([p1, p2]);

    expect(toast.loading).toHaveBeenCalledTimes(1);
  });
});
