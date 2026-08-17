import { describe, expect, it } from "vitest";
import {
  filterSpecialMentions,
  isSpecialMention,
  SPECIAL_MENTIONS,
} from "./mention-utils";

describe("special channel mentions (@everyone, @channel, @here, @all)", () => {
  it("correctly identifies special mentions regardless of case or leading @", () => {
    expect(isSpecialMention("@everyone")).toBe(true);
    expect(isSpecialMention("@EVERYONE")).toBe(true);
    expect(isSpecialMention("@channel")).toBe(true);
    expect(isSpecialMention("here")).toBe(true);
    expect(isSpecialMention("@all")).toBe(true);

    expect(isSpecialMention("@Husnain")).toBe(false);
    expect(isSpecialMention("random_word")).toBe(false);
  });

  it("filters special mentions based on user draft query", () => {
    expect(filterSpecialMentions("")).toEqual(SPECIAL_MENTIONS);
    expect(filterSpecialMentions("ev")).toEqual([
      {
        id: "special:everyone",
        label: "everyone",
        description: "Notify everyone in this channel",
      },
    ]);
    expect(filterSpecialMentions("ch")).toEqual([
      {
        id: "special:channel",
        label: "channel",
        description: "Notify everyone in this channel",
      },
    ]);
    expect(filterSpecialMentions("all")).toEqual([
      {
        id: "special:everyone",
        label: "everyone",
        description: "Notify everyone in this channel",
      },
    ]);
  });
});
