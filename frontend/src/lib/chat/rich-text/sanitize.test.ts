import { describe, expect, it } from "vitest";
import { normalizeComposerHtml, bodyToComposerHtml, decodeMessageEntities } from "./sanitize";

describe("normalizeComposerHtml", () => {
  it("preserves HTML entity escaping &lt; and &gt; in composer HTML", () => {
    const input = "allow-lists (&lt;strong&gt;, &lt;em&gt;, &lt;a&gt;)";
    const normalized = normalizeComposerHtml(input);
    expect(normalized).toContain("&lt;strong&gt;");
    expect(normalized).toContain("&lt;em&gt;");
    expect(normalized).toContain("&lt;a&gt;");
  });

  it("extracts plain text cleanly when formatting tags are present", () => {
    const input = "Hello <b>world</b>";
    const normalized = normalizeComposerHtml(input);
    expect(normalized).toContain("<b>world</b>");
  });
});

describe("bodyToComposerHtml", () => {
  it("leaves HTML formatted bodies sanitized without double entity unescaping", () => {
    const input = "<p>Hello &lt;strong&gt;</p>";
    const result = bodyToComposerHtml(input);
    expect(result).toContain("&lt;strong&gt;");
  });
});

describe("decodeMessageEntities", () => {
  it("decodes nbsp and amp for plain text output", () => {
    expect(decodeMessageEntities("Hello&nbsp;world &amp; all")).toBe("Hello world & all");
  });
});
