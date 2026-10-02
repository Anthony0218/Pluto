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

test("retired natura modes are gone from scenarios and facts", () => {
  for (const id of ["humpback", "dungbeetle", "greenheron", "alarm", "bridges", "echo"]) {
    assert.doesNotMatch(naturaData, new RegExp(`id:\\s*"${id}"`));
    assert.doesNotMatch(naturaFacts, new RegExp(`^  ${id}: \\[`, "m"));
  }
  for (const title of ["Bubble Corral", "Milky Way Express", "Bait & Wait", "False Alarm", "Living Bridges", "Echo Chase"])
    assert.ok(!naturaData.includes(`title: "${title}"`), title);
});
