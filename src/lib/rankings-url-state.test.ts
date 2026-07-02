import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildRankingsSearchParams, parseRankingsUrlState } from "@/lib/rankings-url-state";

function params(input: Record<string, string>) {
  return {
    get: (key: string) => input[key] ?? null
  };
}

describe("rankings-url-state", () => {
  it("parses defaults for an empty query", () => {
    const parsed = parseRankingsUrlState(params({}));
    assert.equal(parsed.gender, "Boys");
    assert.equal(parsed.ageGroup, "U19");
    assert.equal(parsed.sortKey, "rank");
    assert.equal(parsed.sortDirection, "asc");
    assert.equal(parsed.page, 1);
  });

  it("round-trips gender, age, sort, and page", () => {
    const parsed = parseRankingsUrlState(params({
      age: "U16",
      gender: "Girls",
      minGames: "20",
      sort: "rating",
      dir: "desc",
      page: "2"
    }));

    const built = buildRankingsSearchParams(parsed);
    assert.equal(built.get("age"), "U16");
    assert.equal(built.get("gender"), "Girls");
    assert.equal(built.get("minGames"), "20");
    assert.equal(built.get("sort"), "rating");
    assert.equal(built.get("dir"), "desc");
    assert.equal(built.get("page"), "2");
  });

  it("omits default params from built search params", () => {
    const built = buildRankingsSearchParams({
      gender: "Boys",
      ageGroup: "U19",
      minIndex: 0,
      sortKey: "rank",
      sortDirection: "asc",
      page: 1
    });

    assert.equal(built.get("gender"), null);
    assert.equal(built.get("age"), null);
    assert.equal(built.get("sort"), null);
    assert.equal(built.get("dir"), null);
    assert.equal(built.get("page"), null);
  });
});
