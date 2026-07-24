import assert from "node:assert/strict";
import test from "node:test";

import { firstLastIdentityKey, isMiddleNameVariant } from "@/lib/player-name-identity";

test("middle-name additions retain the same player identity boundary", () => {
  assert.equal(isMiddleNameVariant("Xyriel Macahipay", "Xyriel Luis Macahipay"), true);
  assert.equal(isMiddleNameVariant("Josef Calo-Oy", "Josef Conrad Calo-Oy"), true);
});

test("diacritics normalize for review matching", () => {
  assert.equal(firstLastIdentityKey("I\u00f1igo Garcia"), "INIGO|GARCIA");
  assert.equal(firstLastIdentityKey("Inigo Garcia"), "INIGO|GARCIA");
});

test("different first or last names are not middle-name variants", () => {
  assert.equal(isMiddleNameVariant("Xyriel Macahipay", "Xyriel Luis Santos"), false);
  assert.equal(isMiddleNameVariant("Xyriel Macahipay", "Josef Luis Macahipay"), false);
});