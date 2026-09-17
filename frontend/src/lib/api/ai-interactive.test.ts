import { describe, expect, it } from "vitest";
import type { CatchUpItem, ActionChip } from "@/lib/api/ai";

function getItemDetails(item: string | CatchUpItem): { text: string; messageId?: string | null } {
  if (typeof item === "string") {
    return { text: item, messageId: null };
  }
  return { text: item.text, messageId: item.messageId ?? null };
}

function resolveActionDestination(chip: ActionChip, channels: { id: string; name: string }[]): string {
  if (chip.action === "open_channel") {
    const targetLower = (chip.target ?? "").toLowerCase();
    const matched = channels.find(
      (c) =>
        c.name.toLowerCase() === targetLower ||
        c.name.toLowerCase().includes(targetLower) ||
        targetLower.includes(c.name.toLowerCase())
    );
    return matched ? `/chat/c/${matched.id}` : "/chat";
  }
  if (chip.action === "open_link" && chip.target) {
    return chip.target;
  }
  if (chip.action === "open_doc") {
    return "/settings";
  }
  return "/";
}

function parseSseBuffer(buffer: string): { meta?: any; tokens: string[]; done: boolean } {
  const lines = buffer.split("\n\n");
  let meta: any = undefined;
  const tokens: string[] = [];
  let done = false;

  for (const block of lines) {
    const trimmed = block.trim();
    if (!trimmed.startsWith("data:")) continue;
    try {
      const payload = JSON.parse(trimmed.replace(/^data:\s*/, ""));
      if (payload.type === "meta") {
        meta = payload;
      } else if (payload.type === "token") {
        tokens.push(payload.token);
      } else if (payload.type === "done") {
        done = true;
      }
    } catch {
      // ignore
    }
  }

  return { meta, tokens, done };
}

describe("AI Interactive Features & Parsing", () => {
  it("resolves both legacy string items and rich CatchUpItem objects", () => {
    const legacy = "Faraz flagged a decision: deploy Friday";
    const rich: CatchUpItem = {
      text: "Umair decided to freeze features",
      messageId: "msg-12345",
    };

    expect(getItemDetails(legacy)).toEqual({
      text: "Faraz flagged a decision: deploy Friday",
      messageId: null,
    });

    expect(getItemDetails(rich)).toEqual({
      text: "Umair decided to freeze features",
      messageId: "msg-12345",
    });
  });

  it("resolves action chip targets accurately", () => {
    const channels = [
      { id: "c-general", name: "general" },
      { id: "c-it", name: "it-support" },
      { id: "c-hr", name: "hr-inquiries" },
    ];

    expect(resolveActionDestination({ label: "IT", action: "open_channel", target: "it-support" }, channels))
      .toBe("/chat/c/c-it");

    expect(resolveActionDestination({ label: "HR", action: "open_channel", target: "hr" }, channels))
      .toBe("/chat/c/c-hr");

    expect(resolveActionDestination({ label: "Missing", action: "open_channel", target: "unknown" }, channels))
      .toBe("/chat");

    expect(resolveActionDestination({ label: "Expenses", action: "open_link", target: "/settings" }, channels))
      .toBe("/settings");

    expect(resolveActionDestination({ label: "Docs", action: "open_doc", target: "leave" }, channels))
      .toBe("/settings");
  });

  it("parses multi-event SSE streams smoothly", () => {
    const rawSse = [
      'data: {"type": "meta", "query": "leave policy", "citations": [{"id": "1", "title": "Leave Policy"}]}',
      'data: {"type": "token", "token": "Employees "}',
      'data: {"type": "token", "token": "get 20 days "}',
      'data: {"type": "token", "token": "of PTO."}',
      'data: {"type": "done"}',
    ].join("\n\n");

    const parsed = parseSseBuffer(rawSse);
    expect(parsed.meta.query).toBe("leave policy");
    expect(parsed.meta.citations).toHaveLength(1);
    expect(parsed.tokens.join("")).toBe("Employees get 20 days of PTO.");
    expect(parsed.done).toBe(true);
  });
});
