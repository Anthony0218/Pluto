import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCampaign, loadSave } from "../src/games/MedievalKingdoms/edravane/simulation.ts";
import { center, findPath, hexDistance, neighbors, NATIONS, WORLD_HEX_COUNT } from "../src/games/MedievalKingdoms/edravane/world.ts";
import { mapBounds, territoryLayouts } from "../src/pages/games/MedievalKingdoms/territoryLayout.ts";

test("two separate continents, isolated Saltmere islands, valid capitals and navigable intercontinental ports", () => {
  const s = createCampaign(), mainland = s.districts.filter((d) => d.nation && d.biome !== "island");
  assert.equal(s.districts.length, WORLD_HEX_COUNT);
  assert.equal(new Set(s.districts.map((d) => d.id)).size, WORLD_HEX_COUNT);
  const unseen = new Set(mainland.map((d) => d.id)), components = [];
  for (const first of mainland) {
    if (!unseen.delete(first.id)) continue;
    const component = [first];
    for (let i = 0; i < component.length; i++) for (const next of neighbors(s.districts, component[i].id)) if (unseen.delete(next.id)) component.push(next);
    components.push(component);
  }
  assert.deepEqual(components.map((c) => c.length).sort((a, b) => b - a), [224, 103]);
  for (const n of NATIONS) assert.equal(s.districts.find((d) => d.id === n.capital).nation, n.id);
  assert.deepEqual(findPath(s.districts, "8:6", "14:6"), []);
  const westPort = components[0].find((d) => d.port), eastPort = components[1].find((d) => d.port);
  const crossing = findPath(s.districts, westPort.id, eastPort.id, true);
  assert.ok(crossing.length && crossing.some((id) => s.districts.find((d) => d.id === id).biome === "sea"));
  const islands = s.districts.filter((d) => d.biome === "island");
  assert.equal(islands.length, 6);
  for (const d of islands) {
    assert.equal(d.nation, "saltmere"); assert.ok(d.port && d.shipyard);
    assert.deepEqual(findPath(s.districts, "14:6", d.id), []);
  }
  assert.ok(s.districts.filter((d) => d.nation === "saltmere").every((d) => d.port));
});

test("territory names grow with conquered control, and sigil anchors remain on their own fields", () => {
  const s = createCampaign();
  const before = territoryLayouts(s, "realm").find((t) => t.id === "auremarch");
  for (const d of s.districts.filter((d) => d.nation === "high-cairn")) d.occupation = "auremarch-0";
  const after = territoryLayouts(s, "realm").find((t) => t.id === "auremarch");
  assert.ok(after.districts.length > before.districts.length);
  assert.ok(after.fontSize > before.fontSize && after.width > before.width);
  assert.ok(!territoryLayouts(s, "realm").some((t) => t.id === "high-cairn"));
  for (const territory of territoryLayouts(s, "house")) {
    assert.equal(territory.anchor.occupation ?? territory.anchor.owner, territory.house.id);
    assert.ok(Number.isFinite(territory.angle) && Number.isFinite(territory.fontSize));
  }
  const salt = territoryLayouts(s, "realm").find((t) => t.id === "saltmere");
  assert.equal(salt.anchor.biome, "island");
});

test("indexed adjacency preserves offset-hex geometry, including negative rows and legacy duplicate positions", () => {
  const s = createCampaign();
  for (const d of s.districts) assert.deepEqual(neighbors(s.districts, d.id).map((n) => n.id), s.districts.filter((n) => hexDistance(d, n) === 1).map((n) => n.id));
  const bounds = mapBounds(s.districts);
  for (const d of s.districts.filter((d) => d.nation || d.biome === "legacy")) {
    const [x, y] = center(d); assert.ok(x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY);
  }
  const old = JSON.parse(readFileSync(new URL("./fixtures/edravane-original-geography-save.json", import.meta.url), "utf8"));
  for (const d of old.districts) assert.deepEqual(neighbors(old.districts, d.id).map((n) => n.id), old.districts.filter((n) => hexDistance(d, n) === 1).map((n) => n.id));
});

test("existing 301-hex campaign saves retain their geography, armies, money and progress", () => {
  const raw = readFileSync(new URL("./fixtures/edravane-original-geography-save.json", import.meta.url), "utf8"), original = JSON.parse(raw);
  const loaded = loadSave(raw);
  assert.equal(loaded.districts.length, 301);
  assert.deepEqual(loaded.districts, original.districts);
  assert.deepEqual(loaded.armies, original.armies);
  assert.equal(loaded.tick, 12); assert.equal(loaded.houses[0].treasury, 331); assert.equal(loaded.houses[0].stock.grain, 207);
  assert.deepEqual(loadSave(JSON.stringify(loaded)).districts, original.districts);
  const fresh = createCampaign();
  assert.deepEqual(loadSave(JSON.stringify(fresh)).districts, JSON.parse(JSON.stringify(fresh.districts)));
});
