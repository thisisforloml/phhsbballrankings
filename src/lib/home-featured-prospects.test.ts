import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { prioritizeHomepageLeader } from "@/lib/home-featured-prospects";
import type { HomeLeaderboardRow } from "@/lib/public-site-data";

function row(playerId: string, displayName: string, rating: number): HomeLeaderboardRow {
  return { playerId, displayName, rating } as HomeLeaderboardRow;
}

describe("prioritizeHomepageLeader", () => {
  it("keeps the canonical U19 Boys leader in the homepage hero position", () => {
    const xyriel = row("xyriel", "Xyriel Macahipay", 99);
    const jude = row("jude", "Jude Eriobu", 98);
    const result = prioritizeHomepageLeader([xyriel, jude], jude, 5);

    assert.equal(result[0].playerId, "jude");
    assert.deepEqual(result.map((player) => player.playerId), ["jude", "xyriel"]);
  });

  it("does not duplicate a leader already in the cross-board pool", () => {
    const jude = row("jude", "Jude Eriobu", 98);
    const result = prioritizeHomepageLeader([jude, row("other", "Other Player", 90)], jude, 5);

    assert.equal(result.filter((player) => player.playerId === "jude").length, 1);
  });

  it("preserves the existing order when no public leader is available", () => {
    const prospects = [row("a", "Player A", 90), row("b", "Player B", 89)];
    assert.deepEqual(prioritizeHomepageLeader(prospects, null, 1), [prospects[0]]);
  });
});
