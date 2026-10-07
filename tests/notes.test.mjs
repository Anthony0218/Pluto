import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanNote, createNote, createNotesStore, createTableBlock, createTextBlock, effectiveStyle, limits, matchesQuery, moveBlock, noteSnippet, noteTitle, parseNotes, readableOn,
  resultBlock, tableAddColumn, tableAddRow, tableRemoveColumn, tableRemoveRow, tableSetCell,
} from "../src/data/notes.ts";

const memory = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), map }; };

test("notes round-trip through storage per account", () => {
  const storage = memory(), store = createNotesStore(storage);
  const note = createNote([createTextBlock("Milk")], "Shopping", 100);
  assert.ok(store.save("a", note));
  assert.equal(store.read("a").length, 1);
  assert.equal(store.read("b").length, 0);
  // A second store over the same storage sees the saved note.
  assert.equal(createNotesStore(storage).read("a")[0].title, "Shopping");
  assert.ok(store.remove("a", note.id));
  assert.equal(store.read("a").length, 0);
});

test("save replaces a note with the same id and new notes go first", () => {
  const store = createNotesStore(memory());
  const first = createNote([], "One", 1), second = createNote([], "Two", 2);
  store.save("a", first); store.save("a", second);
  assert.deepEqual(store.read("a").map(note => note.title), ["Two", "One"]);
  store.save("a", { ...first, title: "One edited" });
  assert.deepEqual(store.read("a").map(note => note.title), ["Two", "One edited"]);
});

test("append adds to an existing note, or starts a new one", () => {
  const store = createNotesStore(memory());
  const note = createNote([createTextBlock("a")], "Maths", 1);
  store.save("a", note);
  assert.equal(store.append("a", note.id, [resultBlock("Calculator", ["2 + 2 = 4"])], "x", 5), note.id);
  assert.equal(store.read("a")[0].blocks.length, 2);
  assert.equal(store.read("a")[0].blocks[1].text, "Calculator\n2 + 2 = 4");
  const created = store.append("a", null, [createTextBlock("b")], "Fresh", 6);
  assert.notEqual(created, note.id);
  assert.equal(store.read("a").find(item => item.id === created).title, "Fresh");
  // A note that is gone starts a new one rather than losing the result.
  assert.ok(store.append("a", "missing-id", [createTextBlock("c")], "Again", 7));
  assert.equal(store.read("a").length, 3);
});

test("damaged data keeps what is usable", () => {
  assert.deepEqual(parseNotes("not json"), []);
  assert.deepEqual(parseNotes(JSON.stringify({ version: 2, notes: [] })), []);
  const good = createNote([createTextBlock("ok")], "Good", 1);
  const parsed = parseNotes(JSON.stringify({ version: 1, notes: [good, { id: "bad id!", blocks: [] }, 5, { ...good, id: "second", blocks: [{ id: "x", type: "unknown" }, { id: "y", type: "text", text: "kept" }], style: { font: "comic", color: "red" } }] }));
  assert.deepEqual(parsed.map(note => note.id), [good.id, "second"]);
  assert.equal(parsed[1].blocks.length, 1);
  // Unknown fonts and colours fall back to the defaults.
  assert.equal(parsed[1].style.font, "sans");
  assert.match(parsed[1].style.color, /^#[0-9a-f]{6}$/i);
});

test("styles are validated and blocks follow the note unless they choose their own", () => {
  const note = cleanNote({ id: "n", blocks: [{ id: "t", type: "text", text: "hi", style: { font: "serif", color: "#ff0000", bold: true, size: "gigantic", junk: 1 } }] });
  assert.deepEqual(note.blocks[0].style, { font: "serif", color: "#ff0000", bold: true });
  assert.deepEqual(effectiveStyle(note.style, note.blocks[0].style), { font: "serif", size: "medium", color: "#ff0000", bold: true, italic: false });
  assert.equal(effectiveStyle(note.style).font, "sans");
  assert.equal(cleanNote({ id: "n", blocks: [{ id: "t", type: "text", text: "hi", style: { color: "javascript:alert(1)" } }] }).blocks[0].style, undefined);
});

test("tables stay rectangular and within limits", () => {
  const table = createTableBlock(2, 2);
  assert.equal(table.rows.length, 2);
  let rows = tableSetCell(table.rows, 1, 0, "x");
  assert.equal(rows[1][0], "x");
  rows = tableAddRow(rows); rows = tableAddColumn(rows);
  assert.deepEqual(rows.map(row => row.length), [3, 3, 3]);
  rows = tableRemoveColumn(rows, 0);
  assert.deepEqual(rows.map(row => row.length), [2, 2, 2]);
  assert.equal(rows[1][0], "");
  rows = tableRemoveRow(rows, 1);
  assert.equal(rows.length, 2);
  assert.equal(tableRemoveRow([["a"]], 0).length, 1, "the last row stays");
  assert.equal(tableRemoveColumn([["a"], ["b"]], 0)[0].length, 1, "the last column stays");
  let wide = [[""]];
  for (let i = 0; i < 20; i++) wide = tableAddColumn(wide);
  assert.equal(wide[0].length, limits.columns);
  const ragged = cleanNote({ id: "r", blocks: [{ id: "t", type: "table", rows: [["a", "b", "c"], ["d"]] }] });
  assert.deepEqual(ragged.blocks[0].rows, [["a", "b", "c"], ["d", "", ""]]);
  assert.equal(ragged.blocks[0].header, true);
});

test("blocks move within the note, and notes can be found", () => {
  const blocks = [createTextBlock("a"), createTextBlock("b"), createTextBlock("c")];
  assert.deepEqual(moveBlock(blocks, blocks[2].id, -1).map(block => block.text), ["a", "c", "b"]);
  assert.equal(moveBlock(blocks, blocks[0].id, -1), blocks);
  const note = createNote([createTextBlock("Remember the milk"), { ...createTableBlock(1, 2), rows: [["Oats", "Rice"]] }], "", 1);
  assert.equal(noteTitle(note), "Remember the milk");
  assert.match(noteSnippet(note), /Oats · Rice/);
  assert.ok(matchesQuery(note, "RICE"));
  assert.ok(!matchesQuery(note, "tomato"));
});

test("table header text stays readable on any accent colour", () => {
  assert.equal(readableOn("#ffffff"), "#0b1020");
  assert.equal(readableOn("#000000"), "#ffffff");
  assert.equal(readableOn("#6366f1"), "#ffffff");
  assert.equal(readableOn("#fde68a"), "#0b1020");
});

test("storage failures keep notes for the session", () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const store = createNotesStore(broken);
  assert.ok(store.save("a", createNote([], "Kept", 1)));
  assert.equal(store.read("a")[0].title, "Kept");
  assert.ok(store.isVolatile("a"));
});
