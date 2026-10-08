import test from "node:test";
import assert from "node:assert/strict";
import { createCampaign } from "../src/games/MedievalKingdoms/edravane/simulation.ts";
import { center } from "../src/games/MedievalKingdoms/edravane/world.ts";
import { clampMapZoom, MIN_MAP_ZOOM, MAX_MAP_ZOOM, mapViewport, visibleMapDistricts } from "../src/pages/games/MedievalKingdoms/mapViewport.ts";
import { mapBounds } from "../src/pages/games/MedievalKingdoms/territoryLayout.ts";

test("wheel and button zoom stop at the playable-world fit without overshooting either limit", () => {
  for (const decrease of [(z) => z * 0.88, (z) => z - 0.25]) {
    let zoom = 1.8;
    for (let i = 0; i < 100; i++) zoom = clampMapZoom(decrease(zoom));
    assert.equal(zoom, MIN_MAP_ZOOM);
    assert.equal(clampMapZoom(decrease(zoom)), zoom);
  }
  assert.equal(clampMapZoom(1.8), 1.8);
  assert.equal(clampMapZoom(100), MAX_MAP_ZOOM);
});

test("world fit contains every playable land hex and island without reserving space for the locked legacy field", () => {
  const { districts } = createCampaign();
  const bounds = mapBounds(districts, { includeLegacy: false });
  const legacy = districts.find((d) => d.biome === "legacy");
  assert.deepEqual(mapBounds(districts.filter((d) => d !== legacy)), bounds);
  assert.ok(bounds.width < mapBounds(districts).width);
  for (const frame of [{ width: 836, height: 645 }, { width: 490, height: 100 }]) {
    const scale = Math.min(frame.width / bounds.width, frame.height / bounds.height) * MIN_MAP_ZOOM;
    for (const d of districts.filter((d) => d.nation && d.biome !== "legacy")) {
      const [x, y] = center(d);
      const sx = frame.width / 2 + (x - bounds.center[0]) * scale;
      const sy = frame.height / 2 + (y - bounds.center[1]) * scale;
      assert.ok(sx - 25 * scale >= 0 && sx + 25 * scale <= frame.width, `Clipped horizontal hex ${d.id}`);
      assert.ok(sy - 25 * scale >= 0 && sy + 25 * scale <= frame.height, `Clipped vertical hex ${d.id}`);
    }
  }
});

test("viewport culling retains every visible field, overscans hex edges, and follows the camera across both continents", () => {
  const { districts } = createCampaign(), frame = { width: 900, height: 650 }, origin = [450, 325], scale = 2;
  for (const seat of ["8:6", "14:6", "16:10"]) {
    const camera = center(districts.find((d) => d.id === seat));
    const viewport = mapViewport(camera, origin, scale, frame), visible = visibleMapDistricts(districts, viewport);
    assert.ok(visible.length < districts.length / 2);
    assert.ok(visible.some((d) => d.id === seat));
    for (const d of districts) {
      const [x, y] = center(d), sx = origin[0] + (x - camera[0]) * scale, sy = origin[1] + (y - camera[1]) * scale;
      if (sx >= -50 && sx <= frame.width + 50 && sy >= -50 && sy <= frame.height + 50) assert.ok(visible.includes(d), `Missing visible hex ${d.id}`);
    }
  }
  assert.equal(visibleMapDistricts(districts, ""), districts);
});

test("nearby camera positions share a drawing window instead of rebuilding the scene for every pointer event", () => {
  const frame = { width: 900, height: 650 }, origin = [450, 325];
  assert.equal(mapViewport([500, 300], origin, 2, frame), mapViewport([510, 310], origin, 2, frame));
  assert.notEqual(mapViewport([500, 300], origin, 2, frame), mapViewport([750, 300], origin, 2, frame));
});
