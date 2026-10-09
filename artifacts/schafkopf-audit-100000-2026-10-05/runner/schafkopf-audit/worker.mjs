import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { parentPort, workerData } from 'node:worker_threads';
import { createGzip } from 'node:zlib';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { LEVELS, ids, sum, digest, mixSeed, seatLevelsFor, checkFinished, endgameAlternatives, compactView } from './core.mjs';

const { output, games, seed, workers, worker, shardSize, smoke, skipShards = [] } = workerData;
const engine = await import(pathToFileURL(path.join(output, 'runtime/schafkopf.ts')));
const bot = await import(pathToFileURL(path.join(output, 'runtime/bot.ts')));
const { seededRandom, botConfig } = await import(pathToFileURL(path.join(output, 'runtime/botConfig.ts')));
const rules = { ...engine.DEFAULT_GAME_RULES, ...(smoke ? { bot: { legendIterations: 2, legendTimeMs: 1, announcementSamples: 2 } } : {}) };
let currentEvents = [];
let readRngState = () => null;
globalThis.__schafkopfAudit = event => currentEvents.push({ ...event, rngState: readRngState() });

function newStats() {
  return { deals: 0, finished: 0, redeals: 0, errors: 0, moves: 0, simulations: 0, endgameNodes: 0, endgameDecisions: 0, earlyTouts: 0,
    spritzes: 0, singles: 0, checks: 0, searchCalls: 0, searchMs: 0, contractSamples: 0, findings: {}, contracts: {}, tips: {},
    levels: Object.fromEntries(LEVELS.map(level => [level, { games: 0, wins: 0, eyes: 0, delta: 0, declarations: 0, declarerWins: 0, spritzes: 0, spritzWins: 0, seats: [0, 0, 0, 0], dealerSeats: [0, 0, 0, 0] }])) };
}
async function jsonl(file) {
  const destination = fs.createWriteStream(file + '.partial');
  const gzip = createGzip({ level: 3 });
  gzip.pipe(destination);
  const done = Promise.all([finished(gzip), finished(destination)]);
  // Attach error handling immediately; completion is still awaited at close.
  done.catch(() => {});
  return {
    async write(record) { if (!gzip.write(JSON.stringify(record) + '\n')) await once(gzip, 'drain'); },
    async close() { gzip.end(); await done; fs.renameSync(file + '.partial', file); },
  };
}

function declarationAnalysis(view, level) {
  const position = (view.seat - (view.dealer + 1) + 4) % 4 + 1;
  const config = botConfig(view.rules.bot);
  return { position, forced: view.forcedCaller, reason: view.forcedCallerReason, bidLevel: view.bidLevel,
    offered: view.contracts.map(contract => ({ contract, evaluation: bot.evaluateHand(view.hand, contract, position, config, view.rules) })) };
}

async function runGame(index, stats, gameWriter, findingWriter) {
  const id = index + 1;
  const seatLevels = seatLevelsFor(index);
  const dealSeed = mixSeed(seed, index, 0), decisionSeed = mixSeed(seed, index, 1);
  const deck = engine.shuffledDeck(seededRandom(dealSeed));
  let rngState = decisionSeed;
  const random = () => { rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0; return rngState / 4294967296; };
  readRngState = () => rngState;
  const dealer = Math.floor(index / 24) % 4;
  let state = engine.createGame(seatLevels, dealer, deck, undefined, id, rules);
  const record = { schema: 1, id, dealSeed, decisionSeed, dealer, seatLevels, initialHands: state.initialHands.map(ids), deck: ids(deck),
    // Sorted per-seat hands detect duplicate allocations even if hand order differs.
    dealHash: digest(JSON.stringify(state.initialHands.map(hand => ids(hand).sort()))), trace: [], findings: [] };
  const flag = (type, step, detail = {}, severity = 'review') => {
    const finding = { id, step, type, severity, ...detail };
    record.findings.push(finding);
    stats.findings[type] = (stats.findings[type] ?? 0) + 1;
    return finding;
  };
  let before = null, action = null;
  try {
    for (let step = 0; !['finished', 'redeal'].includes(state.phase); step++) {
      assert.ok(step < 160, 'auction/play termination');
      before = state;
      const seat = state.turn, level = seatLevels[seat], view = engine.viewFor(state, seat);
      assert.ok(!['hands', 'initialHands', 'pendingHands'].some(key => Object.hasOwn(view, key)), 'hidden hands must not reach bots');
      assert.ok(view.partner === null || view.partnerRevealed || view.partner === seat, 'hidden partner must not reach bots');
      currentEvents = [];
      const rngStateBefore = rngState;
      action = engine.chooseAiAction(view, level, random);
      const events = currentEvents;
      const entry = { step, level, rngStateBefore, rngStateAfterDecision: rngState, view: compactView(view), action, events };
      record.trace.push(entry);
      if (['intent', 'declare'].includes(view.phase)) entry.announcementAnalysis = declarationAnalysis(view, level);
      if (view.phase === 'declare') {
        assert.ok(view.contracts.some(contract => JSON.stringify(contract) === JSON.stringify(action.contract)), 'offered legal declaration');
        const evaluation = entry.announcementAnalysis.offered.find(item => JSON.stringify(item.contract) === JSON.stringify(action.contract))?.evaluation;
        if (evaluation && !evaluation.eligible) flag('declaration-below-hand-threshold', step, { forced: view.forcedCaller, contract: action.contract, evaluation }, view.forcedCaller ? 'expected' : 'review');
        if (action.contract.kind !== 'rufspiel') { stats.singles++; flag('single-game', step, { contract: action.contract }, 'index'); }
        if (action.contract.tout) flag('tout-announcement', step, { contract: action.contract }, 'index');
      }
      for (const event of events) {
        if (event.type === 'searchFailure') flag('simulation-failure', step, event, 'unexpected');
        if (event.type === 'cardSearch') {
          stats.searchCalls++; stats.searchMs += event.elapsedMs;
          if (event.fallback) flag('simulation-incomplete-candidates', step, { search: event }, 'unexpected');
          if (event.alternatives.some(item => item.visits < 5)) flag('simulation-small-sample', step, { search: event }, 'uncertain');
        }
        if (event.type === 'contractEstimate') {
          stats.contractSamples += event.samples;
          if (event.samples < 16) flag('announcement-or-spritz-small-sample', step, event, 'uncertain');
        }
      }
      if (action.type === 'play') {
        stats.moves++; stats.simulations += action.debugInfo?.simulations ?? 0;
        assert.ok(view.legalCards.includes(action.cardId), 'legal engine move');
        assert.ok(action.debugInfo?.candidates.includes(action.cardId), 'R candidate move');
        assert.ok(action.debugInfo.candidates.every(card => view.legalCards.includes(card)), 'all R candidates are legal');
        const matched = events.find(event => event.type === 'cardDecision')?.matches ?? [];
        entry.tipStatus = matched.map(match => ({ ...match, selectedRecommendedCard: match.cards.includes(action.cardId),
          expectedReliability: botConfig(view.rules.bot).reliability[level][match.code] }));
        for (const match of entry.tipStatus) {
          const key = `${level}:${match.code}`;
          const tip = stats.tips[key] ??= { opportunities: 0, followed: 0, usedAsReason: 0, trickWins: 0, gameWins: 0 };
          tip.opportunities++; tip.followed += Number(match.selectedRecommendedCard); tip.usedAsReason += Number(action.reasonCode === match.code);
          if (!match.selectedRecommendedCard) flag('tip-recommended-other-card', step, { tip: match.code, cards: match.cards, expectedReliability: match.expectedReliability }, level === 'beginner' || match.expectedReliability === 0 ? 'expected' : 'review');
        }
        currentEvents = [];
        const recommendation = bot.chooseCard(view, 'pro', seededRandom(mixSeed(seed, index, step + 10)), { ...view.rules.bot, proError: 0 });
        // This independent review has its own PRNG and cannot perturb real play.
        currentEvents = [];
        entry.proReview = { card: recommendation.card.id, reason: recommendation.reasonCode, ...recommendation.debugInfo };
        if (recommendation.card.id !== action.cardId) flag('pro-review-alternative', step, entry.proReview);
        if (view.legalCards.length > 1) {
          const exact = endgameAlternatives(state, seat, engine);
          if (exact) {
            entry.endgame = exact; stats.endgameNodes += exact.nodes; stats.endgameDecisions++;
            const chosen = exact.alternatives.find(item => item.card === action.cardId).delta;
            const best = Math.max(...exact.alternatives.map(item => item.delta));
            const allowed = exact.alternatives.filter(item => action.debugInfo.candidates.includes(item.card));
            const bestAllowed = Math.max(...allowed.map(item => item.delta));
            if (chosen < best) flag('hindsight-better-card', step, { chosenDelta: chosen, bestDelta: best, bestCards: exact.alternatives.filter(item => item.delta === best).map(item => item.card), gapCent: best - chosen, withinRCandidates: chosen < bestAllowed }, 'hindsight');
            if (bestAllowed < best) flag('hindsight-rule-excludes-best', step, { rules: action.debugInfo.rules, candidates: action.debugInfo.candidates, alternatives: exact.alternatives, gapCent: best - bestAllowed }, 'hindsight');
            for (const match of matched) {
              const recommended = exact.alternatives.filter(item => match.cards.includes(item.card));
              if (recommended.length && Math.max(...recommended.map(item => item.delta)) < bestAllowed) flag('hindsight-tip-inferior', step, { tip: match.code, recommended: match.cards, alternatives: exact.alternatives }, 'hindsight');
            }
          }
        }
      }
      if (action.spritz || action.type === 'double' && action.accept) {
        assert.ok(view.canDouble, 'legal spritz window');
        const count = state.spritzCount + 1;
        flag('spritz', step, { name: ['Kontra', 'Re', 'Sub', 'Hirsch'][count - 1], count, seat, contract: state.contract }, 'index');
        stats.spritzes++;
      }
      state = engine.applyAction(state, seat, action, random);
      entry.rngStateAfterTransition = rngState;
      stats.checks++;
    }
    stats.deals++;
    record.phase = state.phase;
    record.final = { contract: state.contract, declarer: state.declarer, partner: state.partner, points: state.points,
      result: state.result, totals: state.totals, tricks: state.tricks, remainingHands: state.hands.map(ids),
      spritzEvents: state.spritzEvents, announcements: state.announcements, multiplier: state.multiplier };
    if (state.phase === 'redeal') stats.redeals++;
    else {
      checkFinished(state, engine);
      stats.finished++;
      const key = engine.contractName(state.contract);
      stats.contracts[key] = (stats.contracts[key] ?? 0) + 1;
      if (state.contract.tout && state.tricks.length < 8) { stats.earlyTouts++; flag('early-lost-tout', record.trace.length - 1, {}, 'index'); }
      const won = seat => state.result.team.includes(seat) === state.result.declarerWon;
      for (let seat = 0; seat < 4; seat++) {
        const stat = stats.levels[seatLevels[seat]];
        stat.games++; stat.wins += Number(won(seat)); stat.eyes += state.points[seat]; stat.delta += state.result.deltas[seat];
        stat.seats[seat]++; stat.dealerSeats[dealer]++;
        if (seat === state.declarer) { stat.declarations++; stat.declarerWins += Number(state.result.declarerWon); }
      }
      for (const event of state.spritzEvents ?? []) {
        const stat = stats.levels[seatLevels[event.seat]]; stat.spritzes++; stat.spritzWins += Number(won(event.seat));
        if (!won(event.seat)) flag('spritz-party-lost', record.trace.find(entry => entry.action.spritz && entry.view.spritzCount + 1 === event.count)?.step ?? null, { ...event, level: seatLevels[event.seat], points: state.points, result: state.result });
      }
      if (!state.result.declarerWon) flag('declaration-lost', record.trace.find(entry => entry.action.type === 'declare')?.step ?? null, { contract: state.contract, declarer: state.declarer, eyes: state.result.declarerPoints });
      for (const entry of record.trace.filter(entry => entry.action.type === 'play')) {
        const trick = state.tricks[entry.view.trickIndex];
        const trickWon = trick && state.result.team.includes(trick.winner) === state.result.team.includes(entry.view.seat);
        for (const match of entry.tipStatus ?? []) {
          const tip = stats.tips[`${entry.level}:${match.code}`];
          if (match.selectedRecommendedCard) { tip.trickWins += Number(trickWon); tip.gameWins += Number(won(entry.view.seat)); }
        }
        if (entry.action.reasonCode?.startsWith('T') && !trickWon) flag('tip-applied-trick-lost', entry.step, { tip: entry.action.reasonCode, winner: trick?.winner, trickPoints: trick?.points }, 'outcome-only');
      }
    }
  } catch (error) {
    stats.errors++;
    if (!record.phase) stats.deals++;
    record.phase = 'error'; record.error = { message: String(error), stack: error.stack, before, action };
    flag('invariant-or-engine-error', record.trace.length - 1, { message: String(error) }, 'unexpected');
  }
  record.summary = { id, phase: record.phase, dealer, seatLevels, dealHash: record.dealHash,
    contract: record.final?.contract, declarer: record.final?.declarer, points: record.final?.points,
    deltas: record.final?.result?.deltas ?? [0, 0, 0, 0], declarerWon: record.final?.result?.declarerWon,
    spritzes: record.final?.spritzEvents?.length ?? 0, findings: record.findings.length };
  await gameWriter.write(record);
  for (const finding of record.findings) await findingWriter.write(finding);
  return record.summary;
}

for (let shard = worker; shard * shardSize < games; shard += workers) {
  if (skipShards.includes(shard)) continue;
  const name = String(shard).padStart(4, '0');
  const start = Date.now(), stats = newStats(), summaries = [];
  const gameWriter = await jsonl(path.join(output, `games/${name}.jsonl.gz`));
  const findingWriter = await jsonl(path.join(output, `findings/${name}.jsonl.gz`));
  for (let index = shard * shardSize; index < Math.min(games, (shard + 1) * shardSize); index++) {
    summaries.push(await runGame(index, stats, gameWriter, findingWriter));
    if (summaries.length % 10 === 0) parentPort.postMessage({ type: 'progress', worker, shard, doneInShard: summaries.length, stats });
  }
  await gameWriter.close(); await findingWriter.close();
  const result = { shard, stats, summaries, elapsedSeconds: (Date.now() - start) / 1000 };
  fs.writeFileSync(path.join(output, `shards/${name}.json.partial`), JSON.stringify(result));
  fs.renameSync(path.join(output, `shards/${name}.json.partial`), path.join(output, `shards/${name}.json`));
  parentPort.postMessage({ type: 'shard', ...result });
}
parentPort.postMessage({ type: 'done', worker });
