import { describe, expect, it } from "vitest";
import { filterWorkspaceMembersToAdd } from "./channel-access-search";
import type { WorkspaceMemberOption } from "@/lib/types/chat";

const members: WorkspaceMemberOption[] = [
  { id: "u1", fullName: "Alex Rivera", email: "alex@demo.com" },
  { id: "u2", fullName: "Owner Demo", email: "owner@demo.com" },
  { id: "u3", fullName: "Husnain", email: "husnain@demo.com" },
];

describe("filterWorkspaceMembersToAdd", () => {
  it("returns empty when query is blank", () => {
    expect(
      filterWorkspaceMembersToAdd(members, new Set(["u1"]), "")
    ).toEqual([]);
  });

  it("excludes people already in the channel", () => {
    const result = filterWorkspaceMembersToAdd(members, new Set(["u1"]), "owner");
    expect(result.map((m) => m.id)).toEqual(["u2"]);
  });

  it("matches name or email", () => {
    expect(
      filterWorkspaceMembersToAdd(members, new Set(), "husnain@demo").map(
        (m) => m.id
      )
    ).toEqual(["u3"]);
  });
});
