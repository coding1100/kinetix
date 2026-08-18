import { describe, expect, it } from "vitest";
import { isOpenableExternalUrl } from "./open-external-url";

describe("isOpenableExternalUrl", () => {
  it("accepts browser-safe external links", () => {
    expect(isOpenableExternalUrl("https://kinetix.mindrind.com")).toBe(true);
    expect(isOpenableExternalUrl("http://example.com")).toBe(true);
    expect(isOpenableExternalUrl("mailto:team@kinetix.com")).toBe(true);
  });

  it("rejects internal and unsafe schemes", () => {
    expect(isOpenableExternalUrl("/chat/c/general")).toBe(false);
    expect(isOpenableExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isOpenableExternalUrl("")).toBe(false);
  });
});
