import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import readline from 'node:readline';
import { createGunzip } from 'node:zlib';
import { pathToFileURL } from 'node:url';
const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const run = path.resolve(arg('--run', 'artifacts/schafkopf-audit-100000-2026-10-05'));
const manifest = JSON.parse(fs.readFileSync(path.join(run, 'manifest.json')));
const game = Number(arg('--game', '1'));
assert.ok(Number.isInteger(game) && game >= 1 && game <= manifest.requestedDeals);
const shard = String(Math.floor((game - 1) / manifest.shardSize)).padStart(4, '0');
const input = fs.createReadStream(path.join(run, `games/${shard}.jsonl.gz`));
const unzip = createGunzip(); input.pipe(unzip);
const lines = readline.createInterface({ input: unzip, crlfDelay: Infinity });
let record;
try {
  for await (const line of lines) {
    const candidate = JSON.parse(line);
    if (candidate.id === game) { record = candidate; break; }
  }
} finally { lines.close(); input.destroy(); unzip.destroy(); }
assert.ok(record, `Game ${game} not found.`);
if (args.includes('--replay')) {
  const engine = await import(pathToFileURL(path.join(run, 'source/schafkopf.ts')));
  const { seededRandom } = await import(pathToFileURL(path.join(run, 'source/botConfig.ts')));
  const cards = new Map(engine.createDeck().map(card => [card.id, card]));
  let state = engine.createGame(record.seatLevels, record.dealer, record.deck.map(id => cards.get(id)), undefined, game, manifest.rules);
  for (const entry of record.trace) {
    const view = engine.viewFor(state, state.turn);
    assert.deepEqual(view.hand.map(card => card.id), entry.view.hand);
    assert.deepEqual(view.legalCards, entry.view.legalCards);
    assert.deepEqual(view.points, entry.view.points);
    assert.equal(state.turn, entry.view.seat);
    // Natural-language random phrases don't affect cards, points or legality.
    state = engine.applyAction(state, state.turn, entry.action, seededRandom(1));
  }
  assert.equal(state.phase, record.phase);
  assert.deepEqual(state.result, record.final.result);
  assert.deepEqual(state.tricks, record.final.tricks);
  assert.deepEqual(state.spritzEvents, record.final.spritzEvents);
  console.error(`Replay OK: Spiel ${game}, ${record.trace.length} Aktionen.`);
}
const output = arg('--output', null);
if (output) { fs.writeFileSync(output, JSON.stringify(record, null, 2) + '\n'); console.log(output); }
else console.log(JSON.stringify(record, null, 2));
