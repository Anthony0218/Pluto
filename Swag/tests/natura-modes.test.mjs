import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const naturaData = readFileSync(
  new URL("../src/games/natura/naturaData.ts", import.meta.url),
  "utf8",
);
const naturaFacts = readFileSync(
  new URL("../src/games/natura/naturaFacts.ts", import.meta.url),
  "utf8",
);

test("natura includes the three new ocean-and-pond modes", () => {
  assert.match(naturaData, /id:\s*"humpback"/);
  assert.match(naturaData, /id:\s*"dungbeetle"/);
  assert.match(naturaData, /id:\s*"greenheron"/);
  assert.match(naturaFacts, /humpback/);
  assert.match(naturaFacts, /dungbeetle/);
  assert.match(naturaFacts, /greenheron/);
});
