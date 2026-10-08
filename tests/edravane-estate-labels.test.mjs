import test from "node:test";
import assert from "node:assert/strict";
import { createCampaign } from "../src/games/MedievalKingdoms/edravane/simulation.ts";
import { createEstateLabelPainter, estateLabelPlacements, splitEstateLabel } from "../src/pages/games/MedievalKingdoms/estateLabelPainter.ts";

function fakeCanvas(stats) {
  const canvas = { width: 0, height: 0 };
  canvas.getContext = () => ({ canvas, scale() {}, save() {}, restore() {}, clearRect() {},
    fillText(text, x, y, width) { stats.glyphs.push({ text, x, y, width }); },
    drawImage(...args) { stats.images.push(args); },
  });
  return canvas;
}

test("close-up names reuse rasterized glyphs across repeated fields and camera movement", () => {
  const stats = { glyphs: [], images: [] }, paint = createEstateLabelPainter(() => fakeCanvas(stats));
  const context = fakeCanvas(stats).getContext("2d"), box = { minX: 0, minY: 0, width: 1000, height: 1000 };
  const names = Array.from({ length: 200 }, (_, i) => ({ label: "Market town", x: 50 + i, y: 50 }));
  assert.equal(paint(context, names, box, 2), 200);
  assert.equal(stats.glyphs.length, 1, "Repeated names must not run 200 text layouts");
  assert.equal(paint(context, names, { ...box, minX: 10 }, 2), 200);
  assert.equal(stats.glyphs.length, 1, "Camera movement must reuse the prepared name");
  paint(context, names, box, 3);
  assert.equal(stats.glyphs.length, 2, "A sharper resolution requires exactly one new stamp");
});

test("label clipping excludes off-screen fields, includes entering names, and keeps long names in two bounded lines", () => {
  const stats = { glyphs: [], images: [] }, paint = createEstateLabelPainter(() => fakeCanvas(stats));
  const box = { minX: 0, minY: 0, width: 100, height: 100 };
  assert.equal(paint(fakeCanvas(stats).getContext("2d"), [
    { label: "Hidden", x: -100, y: 50 }, { label: "Entering", x: -10, y: 50 },
    { label: "Drazhkul March Keep", x: 50, y: 50 },
  ], box, 2), 2);
  assert.deepEqual(splitEstateLabel("Drazhkul March Keep"), ["Drazhkul", "March Keep"]);
  const long = splitEstateLabel("Astonishinglylongname March Keep of the Northern Coast");
  assert.equal(long.length, 2); assert.ok(long.every((line) => line.length <= 12));
  assert.ok(stats.glyphs.every((glyph) => glyph.width === 34 && glyph.y <= 13));
});

test("new label placements preserve estate names and house identity while omitting sea and locked legacy fields", () => {
  const s = createCampaign(), labels = estateLabelPlacements(s);
  assert.equal(labels.length, s.districts.filter((d) => d.nation).length);
  assert.ok(labels.some((label) => label.label === "Valcrest Seat"));
  assert.ok(labels.some((label) => label.label === "Valcrest"));
  assert.ok(!labels.some((label) => ["The Azure Sea", "Legacy Region"].includes(label.label)));
});
