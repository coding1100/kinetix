import { describe, expect, it } from "vitest";
import { looksLikeMarkdown, buildMarkdownHtml } from "./markdown-paste";

describe("looksLikeMarkdown", () => {
  it("detects bold, italic, headings, lists, quotes, code, links", () => {
    expect(looksLikeMarkdown("This is **bold** text")).toBe(true);
    expect(looksLikeMarkdown("This is *italic* text")).toBe(true);
    expect(looksLikeMarkdown("# Heading")).toBe(true);
    expect(looksLikeMarkdown("- item one")).toBe(true);
    expect(looksLikeMarkdown("1. item one")).toBe(true);
    expect(looksLikeMarkdown("> a quote")).toBe(true);
    expect(looksLikeMarkdown("some `code` here")).toBe(true);
    expect(looksLikeMarkdown("[a link](https://example.com)")).toBe(true);
    expect(looksLikeMarkdown("~~strikethrough~~")).toBe(true);
  });

  it("does not flag plain prose containing markdown-ish characters", () => {
    expect(looksLikeMarkdown("5 - 3 = 2")).toBe(false);
    expect(looksLikeMarkdown("Let's meet at 5-6pm")).toBe(false);
    expect(looksLikeMarkdown("just a normal sentence")).toBe(false);
    expect(looksLikeMarkdown("email me at foo_bar@example.com")).toBe(false);
  });
});

describe("buildMarkdownHtml", () => {
  it("converts bold and italic", () => {
    expect(buildMarkdownHtml("**bold** and *italic*")).toBe(
      "<strong>bold</strong> and <em>italic</em>"
    );
  });

  it("converts a heading", () => {
    expect(buildMarkdownHtml("# Title")).toBe("<h1>Title</h1>");
  });

  it("converts an unordered list", () => {
    expect(buildMarkdownHtml("- one\n- two")).toBe(
      "<ul><li>one</li><li>two</li></ul>"
    );
  });

  it("converts an ordered list", () => {
    expect(buildMarkdownHtml("1. one\n2. two")).toBe(
      "<ol><li>one</li><li>two</li></ol>"
    );
  });

  it("converts a blockquote", () => {
    expect(buildMarkdownHtml("> quoted line")).toBe(
      "<blockquote>quoted line</blockquote>"
    );
  });

  it("converts a fenced code block without interpreting inline markdown inside it", () => {
    expect(buildMarkdownHtml("```\nconst x = 1;\n**not bold**\n```")).toBe(
      "<pre>const x = 1;\n**not bold**</pre>"
    );
  });

  it("converts inline code", () => {
    expect(buildMarkdownHtml("run `npm install` first")).toBe(
      "run <code>npm install</code> first"
    );
  });

  it("converts a link", () => {
    expect(buildMarkdownHtml("[docs](https://example.com/docs)")).toBe(
      '<a href="https://example.com/docs" target="_blank" rel="noreferrer noopener">docs</a>'
    );
  });

  it("escapes raw HTML instead of executing it (XSS safety)", () => {
    const out = buildMarkdownHtml("<img src=x onerror=alert(1)>**bold**");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
    expect(out).toContain("<strong>bold</strong>");
  });

  it("does not linkify a javascript: URL", () => {
    const out = buildMarkdownHtml("[click me](javascript:alert(1))");
    expect(out).not.toContain("<a ");
    expect(out).not.toContain('href="javascript:');
  });

  it("does not corrupt numbers when inline code blocks are present", () => {
    const input = "5 - 3 = 2 and `code1` and `code2` with 12 tests and 0 items";
    const out = buildMarkdownHtml(input);
    expect(out).toContain("5 - 3 = 2");
    expect(out).toContain("12 tests");
    expect(out).toContain("0 items");
    expect(out).toContain("<code>code1</code>");
    expect(out).toContain("<code>code2</code>");
  });

  it("does not turn intraword underscores into italics", () => {
    const input = "file_name.test.ts and say_push are identifiers";
    const out = buildMarkdownHtml(input);
    expect(out).not.toContain("<em>");
    expect(out).toContain("file_name.test.ts");
    expect(out).toContain("say_push");
  });

  it("safely escapes raw HTML tag descriptions without creating active DOM tags", () => {
    const input =
      "allow-lists (<strong>, <em>, <del>, <code>, <pre>, <h1-4>, <blockquote>, <ul>/<ol>/<li>, <a>)";
    const out = buildMarkdownHtml(input);
    expect(out).toContain("&lt;strong&gt;");
    expect(out).toContain("&lt;em&gt;");
    expect(out).toContain("&lt;a&gt;");
    expect(out).not.toContain("<strong>");
    expect(out).not.toContain("<em>");
    expect(out).not.toContain("<a>");
  });
});
