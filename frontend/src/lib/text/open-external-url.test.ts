import { describe, expect, it } from "vitest";
import {
  isExternalHref,
  isOpenableExternalUrl,
  normalizeExternalUrl,
} from "./open-external-url";

describe("openExternalUrl utilities", () => {
  it("normalizes URLs missing protocol", () => {
    expect(normalizeExternalUrl("www.google.com")).toBe("https://www.google.com");
    expect(normalizeExternalUrl("github.com/org/repo")).toBe("https://github.com/org/repo");
    expect(normalizeExternalUrl("https://kinetix.com")).toBe("https://kinetix.com");
  });

  it("accepts browser-safe external links", () => {
    expect(isOpenableExternalUrl("https://kinetix.mindrind.com")).toBe(true);
    expect(isOpenableExternalUrl("http://example.com")).toBe(true);
    expect(isOpenableExternalUrl("mailto:team@kinetix.com")).toBe(true);
    expect(isOpenableExternalUrl("www.google.com")).toBe(true);
  });

  it("rejects internal and unsafe schemes", () => {
    expect(isOpenableExternalUrl("/chat/c/general")).toBe(false);
    expect(isOpenableExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isOpenableExternalUrl("")).toBe(false);
  });

  it("identifies external vs internal hrefs", () => {
    expect(isExternalHref("https://google.com")).toBe(true);
    expect(isExternalHref("www.github.com")).toBe(true);
    expect(isExternalHref("/spaces/list-123")).toBe(false);
    expect(isExternalHref("#heading")).toBe(false);
  });
});

