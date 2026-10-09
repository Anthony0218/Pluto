import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createGunzip, createGzip } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { endgameAlternatives, ids, sum } from './core.mjs';

const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const run = path.resolve(arg('--run', 'artifacts/schafkopf-audit-100000-2026-10-05'));
const follow = args.includes('--follow');
const e = await import(pathToFileURL(path.join(run, 'source/schafkopf.ts')));
const { gameKnowledge } = await import(pathToFileURL(path.join(run, 'source/knowledge.ts')));
const { seededRandom } = await import(pathToFileURL(path.join(run, 'source/botConfig.ts')));
const manifest = JSON.parse(fs.readFileSync(path.join(run, 'manifest.json')));
const output = path.join(run, 'probability'); fs.mkdirSync(output, { recursive: true });

// Enumerate all remaining allocations, uniformly counting each distinct
// allocation once. Capacities and all observed card plays are hard constraints.
// We do not infer strength from unobserved bot intentions or future cards.
export function compatibleStates(state) {
  const view = e.viewFor(state, state.turn), k = gameKnowledge(view);
  const past = [...state.tricks.flatMap(trick => trick.plays), ...state.trick];
  const seen = new Set([...past.map(play => play.card.id), ...ids(view.hand)]);
  const unseen = e.createDeck().filter(card => !seen.has(card.id));
  if (unseen.length > 6) throw new Error('Only last-two-trick states are supported.');
  const hands = [[], [], [], []]; hands[view.seat] = [...view.hand];
  const seats = [0, 1, 2, 3].filter(seat => seat !== view.seat);
  const allocations = [];
  const validate = () => {
    const initialHands = hands.map((hand, seat) => [...hand, ...past.filter(play => play.seat === seat).map(play => play.card)]);
    const c = state.contract;
    const partner = c.kind === 'rufspiel' ? initialHands.findIndex(hand => hand.some(card => card.id === `${c.suit}-${c.calledRank ?? 'Ass'}`)) : null;
    if (c.kind === 'rufspiel' && (partner < 0 || partner === state.declarer)) return;
    if (view.partner !== null && partner !== view.partner) return;
    if (!e.contractsFor(initialHands[state.declarer], state.rules).some(contract => contract.kind === c.kind && contract.suit === c.suit && Boolean(contract.tout) === Boolean(c.tout))) return;
    const team = seat => seat === state.declarer || seat === partner;
    if (state.spritzEvents.some(event => team(event.seat) !== (event.count % 2 === 0))) return;
    // Replay card legality with guessed initial hands. History winners are
    // public, so no hidden choices or private decisions enter this validation.
    const probe = { ...state, phase: 'play', hands: initialHands.map(hand => [...hand]), initialHands,
      partner, escaped: false, partnerRevealed: false, trick: [], tricks: [] };
    for (const plays of [...state.tricks.map(trick => trick.plays), state.trick]) {
      probe.trick = [];
      for (const play of plays) {
        probe.turn = play.seat;
        if (e.cardLock(probe, play.seat, play.card) !== null) return;
        if (c.kind === 'rufspiel' && play.seat === partner && !probe.trick.length && play.card.suit === c.suit && !e.isTrump(play.card, c) && play.card.rank !== (c.calledRank ?? 'Ass') && probe.hands[partner].some(card => card.id === `${c.suit}-${c.calledRank ?? 'Ass'}`)) probe.escaped = true;
        probe.hands[play.seat] = probe.hands[play.seat].filter(card => card.id !== play.card.id);
        probe.trick.push(play);
      }
      if (plays.length === 4) probe.tricks.push({ plays });
    }
    if (probe.escaped !== state.escaped) return;
    allocations.push({ ...state, hands: hands.map(hand => [...hand]), initialHands, partner });
  };
  const assign = index => {
    if (index === unseen.length) { if (seats.every(seat => hands[seat].length === view.counts[seat])) validate(); return; }
    const card = unseen[index];
    for (const seat of seats) if (hands[seat].length < view.counts[seat] && k.constraints[seat].has(card.id)) {
      hands[seat].push(card); assign(index + 1); hands[seat].pop();
    }
  };
  assign(0);
  return allocations;
}

function analyze(state, entry) {
  const states = compatibleStates(state);
  if (!states.length) return { error: 'no-compatible-allocation-after-history-validation' };
  const chosen = entry.action.cardId;
  const sums = new Map(e.legalCards(state).map(card => [card.id, { card: card.id, meanMinimaxDeltaCent: 0, fullInformationWins: 0, betterThanChosen: 0, worseThanChosen: 0, tiesWithChosen: 0, minDelta: Infinity, maxDelta: -Infinity, rAllowed: entry.action.debugInfo.candidates.includes(card.id) }]));
  let nodes = 0;
  for (const candidate of states) {
    const result = endgameAlternatives(candidate, entry.view.seat, e); nodes += result.nodes;
    const actual = result.alternatives.find(item => item.card === chosen).delta;
    for (const alternative of result.alternatives) {
      const stat = sums.get(alternative.card); stat.meanMinimaxDeltaCent += alternative.delta;
      stat.fullInformationWins += Number(alternative.delta > 0);
      stat.betterThanChosen += Number(alternative.delta > actual);
      stat.worseThanChosen += Number(alternative.delta < actual);
      stat.tiesWithChosen += Number(alternative.delta === actual);
      stat.minDelta = Math.min(stat.minDelta, alternative.delta); stat.maxDelta = Math.max(stat.maxDelta, alternative.delta);
    }
  }
  const alternatives = [...sums.values()].map(stat => ({ ...stat, meanMinimaxDeltaCent: stat.meanMinimaxDeltaCent / states.length,
    fullInformationWinFraction: stat.fullInformationWins / states.length, strictlyBetterFraction: stat.betterThanChosen / states.length,
    strictlyWorseFraction: stat.worseThanChosen / states.length }));
  const actual = alternatives.find(item => item.card === chosen);
  alternatives.forEach(item => { item.meanPairedGainCent = item.meanMinimaxDeltaCent - actual.meanMinimaxDeltaCent; });
  alternatives.sort((a, b) => b.meanMinimaxDeltaCent - a.meanMinimaxDeltaCent);
  return { compatibleAllocations: states.length, nodes, alternatives,
    model: 'uniform-all-allocations-consistent-with-own-hand-public-plays-card-legality-capacities-public-spritz-parties-and-called-card',
    objective: 'tariff-delta-with-full-information-optimal-team-continuations',
    caveat: 'Full-information continuations overestimate implementable hidden-information play. This is a screening estimate, not a measured real-bot win probability.' };
}

const completed = new Set(fs.readdirSync(output).filter(name => /^\d{4}\.json$/.test(name)).map(name => Number(name.slice(0, 4))));
const totals = { analyzed: 0, allocationHypotheses: 0, modelErrors: 0, positiveMeanAlternative: 0, nonWorseningAlternative: 0, samples: [] };
const mergeTotals = report => { for (const key of ['analyzed', 'allocationHypotheses', 'modelErrors', 'positiveMeanAlternative', 'nonWorseningAlternative']) totals[key] += report[key]; totals.samples.push(...report.samples); totals.samples.sort((a, b) => b.gain - a.gain); totals.samples = totals.samples.slice(0, 30); };
for (const shard of completed) mergeTotals(JSON.parse(fs.readFileSync(path.join(output, String(shard).padStart(4, '0') + '.json'))));
while (true) {
  const shards = fs.readdirSync(path.join(run, 'shards')).filter(name => name.endsWith('.json')).sort();
  for (const name of shards) {
    const shard = Number(name.slice(0, -5)); if (completed.has(shard)) continue;
    const report = { analyzed: 0, allocationHypotheses: 0, modelErrors: 0, positiveMeanAlternative: 0, nonWorseningAlternative: 0, samples: [] };
    const file = path.join(output, name.replace('.json', '.jsonl.gz'));
    const destination = fs.createWriteStream(file + '.partial'), gzip = createGzip({ level: 3 }); gzip.pipe(destination);
    const done = Promise.all([finished(gzip), finished(destination)]); done.catch(() => {});
    const input = fs.createReadStream(path.join(run, 'games', name.replace('.json', '.jsonl.gz'))), unzip = createGunzip(); input.pipe(unzip);
    const lines = readline.createInterface({ input: unzip, crlfDelay: Infinity });
    for await (const line of lines) {
      const record = JSON.parse(line);
      const steps = new Set(record.findings.filter(finding => ['hindsight-better-card', 'hindsight-rule-excludes-best', 'hindsight-tip-inferior'].includes(finding.type)).map(finding => finding.step));
      if (!steps.size) continue;
      const cards = new Map(e.createDeck().map(card => [card.id, card]));
      let state = e.createGame(record.seatLevels, record.dealer, record.deck.map(id => cards.get(id)), undefined, record.id, manifest.rules);
      for (const entry of record.trace) {
        if (steps.has(entry.step)) {
          const result = analyze(state, entry);
          const analysis = { id: record.id, step: entry.step, level: entry.level, chosen: entry.action.cardId, rules: entry.action.debugInfo.rules, tips: entry.tipStatus, view: entry.view, ...result };
          report.analyzed++; report.allocationHypotheses += result.compatibleAllocations ?? 0;
          if (result.error) report.modelErrors++;
          else {
            const best = result.alternatives[0];
            report.positiveMeanAlternative += Number(best.meanPairedGainCent > 0);
            const robust = result.alternatives.find(item => item.meanPairedGainCent > 0 && item.strictlyWorseFraction === 0);
            report.nonWorseningAlternative += Number(!!robust);
            if (best.meanPairedGainCent > 0) report.samples.push({ id: record.id, step: entry.step, gain: best.meanPairedGainCent, allocations: result.compatibleAllocations, chosen: entry.action.cardId, recommendation: best, level: entry.level, rules: entry.action.debugInfo.rules, tips: entry.tipStatus });
          }
          if (!gzip.write(JSON.stringify(analysis) + '\n')) await once(gzip, 'drain');
        }
        state = e.applyAction(state, state.turn, entry.action, seededRandom(1));
      }
    }
    gzip.end(); await done; fs.renameSync(file + '.partial', file);
    report.samples.sort((a, b) => b.gain - a.gain); report.samples = report.samples.slice(0, 30);
    fs.writeFileSync(path.join(output, name + '.partial'), JSON.stringify(report)); fs.renameSync(path.join(output, name + '.partial'), path.join(output, name));
    completed.add(shard); mergeTotals(report);
    const progress = { status: 'running', analyzedShards: completed.size, ...totals, updatedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(output, 'progress.json.partial'), JSON.stringify(progress, null, 2)); fs.renameSync(path.join(output, 'progress.json.partial'), path.join(output, 'progress.json'));
    console.log(`Wahrscheinlichkeitsprüfung: ${completed.size} Blöcke; ${totals.analyzed} auffällige Endspielentscheidungen; ${totals.modelErrors} Modellfehler.`);
  }
  if (!follow || fs.existsSync(path.join(run, 'report.json')) && completed.size === Math.ceil(manifest.requestedDeals / manifest.shardSize)) break;
  const main = JSON.parse(fs.readFileSync(path.join(run, 'progress.json')));
  if (main.status === 'failed') throw new Error('Main simulation failed; analysis preserved.');
  await delay(15000);
}
fs.writeFileSync(path.join(output, 'Auswertung.json'), JSON.stringify({ status: 'complete', analyzedShards: completed.size, ...totals }, null, 2) + '\n');
fs.writeFileSync(path.join(output, 'HINWEISE.md'), `# Wahrscheinlichkeitsprüfung auffälliger Endspiele\n\n${totals.analyzed} auffällige Entscheidungen wurden über ${totals.allocationHypotheses} vollständig aufgezählte, mit der damaligen Sicht vereinbare Kartenverteilungen geprüft. ${totals.modelErrors} Fälle ohne gültige Modellverteilung. Bei ${totals.positiveMeanAlternative} Entscheidungen hat eine andere Karte einen höheren mittleren Abrechnungssaldo im Modell; bei ${totals.nonWorseningAlternative} gibt es eine Alternative, die in keiner Modellverteilung schlechter und in mindestens einer besser abschneidet.\n\nAlle Verteilungen werden gleich gewichtet. Die Aufzählung prüft eigene Hand, Handgrößen, sämtliche bisherigen Karten samt damaliger Bedienpflicht/Ruf-Sau/Davonlaufen, legale Spielansage und öffentlich bekannte Spritzparteien. Die eigene Karte wird für jede Alternative identisch gehalten; die tatsächlichen fremden Hände und spätere Karten entscheiden nicht über die Aufzählung.\n\n**Grenze:** Die Fortsetzungen verwenden optimale Parteientscheidungen mit vollständigem Kartenwissen. Damit entstehen keine empirisch gemessenen Siegchancen realer Bots. Unterschiedliche vollständige Verteilungen können unterschiedliche Zukunftsstrategien verlangen, obwohl ein echter Bot sie noch nicht unterscheiden kann. Die Zahlen eignen sich zur Vorauswahl neuer Tipps und Regel-Ausnahmen, die anschließend unabhängig mit echten Bots geprüft werden müssen.\n\nDie jsonl.gz-Dateien enthalten jeden geprüften Fall samt allen Alternativen, Vergleich zur gespielten Karte und Anteil besserer/schlechterer/gleicher Verteilungen. Auswertung.json nennt die größten mittleren Abstände.\n`);
console.log(JSON.stringify({ analyzedShards: completed.size, ...Object.fromEntries(Object.entries(totals).filter(([key]) => key !== 'samples')) }, null, 2));
