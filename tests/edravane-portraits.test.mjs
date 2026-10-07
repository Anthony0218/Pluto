import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createCampaign } from "../src/games/MedievalKingdoms/edravane/simulation.ts";
import { portraitFor } from "../src/games/MedievalKingdoms/edravane/portraits.ts";

test("all 120 starting characters have separate, valid local portrait cells", () => {
  const state = createCampaign();
  const identities = new Set();
  for (const house of state.houses) {
    for (const person of house.family) {
      const portrait = portraitFor(person, house);
      assert.ok(
        existsSync(new URL(`../public${portrait.src}`, import.meta.url)),
      );
      assert.ok(portrait.row >= 0 && portrait.row < 5);
      assert.ok(portrait.column >= 0 && portrait.column < 3);
      assert.ok(portrait.src.endsWith(`/${house.nation}.jpg`));
      identities.add(`${portrait.src}:${portrait.row}:${portrait.column}`);
    }
  }
  assert.equal(identities.size, 120);
});

test("a person's face stays the same through promotion, marriage, aging and captivity", () => {
  const state = createCampaign();
  const house = state.houses[0];
  const person = house.family[1];
  const original = portraitFor(person, house);
  house.ruler = person.id;
  person.age += 20;
  person.spouse = state.houses[6].family[0].id;
  person.imprisonedBy = state.houses[6].id;
  assert.deepEqual(portraitFor(person, house), original);
  assert.deepEqual(portraitFor(person, state.houses[6]), original);
});

test("unknown identities get a stable portrait matching their recorded culture and gender", () => {
  const house = createCampaign().houses.find((h) => h.nation === "graskor");
  const person = { ...house.family[1], id: "custom-heir" };
  const portrait = portraitFor(person, house);
  assert.equal(
    portrait.src,
    "/MedievalKingdoms/edravane/portraits/graskor.jpg",
  );
  assert.equal(portrait.column, 1);
  assert.deepEqual(
    portraitFor({ ...person, name: "New name", age: 32 }, house),
    portrait,
  );
});
