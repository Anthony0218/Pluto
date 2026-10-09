import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { execFileSync } from 'node:child_process';
import { instrumentBot, digest, LEVELS, LABELS, sum } from './schafkopf-audit/core.mjs';

const args = process.argv.slice(2);
const argument = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const games = Number(argument('--games', '100000'));
const seed = Number(argument('--seed', '20261005'));
const workers = Number(argument('--workers', String(Math.min(8, os.availableParallelism() - 1 || 1))));
const shardSize = Number(argument('--shard-size', '250'));
const output = path.resolve(argument('--output', path.join(root, 'artifacts/schafkopf-audit-100000-2026-10-05')));
const smoke = args.includes('--smoke');
const resume = args.includes('--resume');
assert.ok(Number.isInteger(games) && games > 0 && games <= 100000);
assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff);
assert.ok(Number.isInteger(workers) && workers > 0 && workers <= 32);
assert.ok(Number.isInteger(shardSize) && shardSize > 0);
if (!resume) {
  assert.ok(!fs.existsSync(path.join(output, 'manifest.json')), 'Choose a new output directory or use --resume.');
  for (const dir of ['source', 'runtime', 'docs', 'runner/schafkopf-audit', 'games', 'findings', 'shards']) fs.mkdirSync(path.join(output, dir), { recursive: true });
  const hashes = {};
  for (const name of ['schafkopf.ts', 'bot.ts', 'botConfig.ts', 'knowledge.ts', 'coach.ts', 'lessons.ts', 'announcements.ts']) {
    const source = fs.readFileSync(path.join(root, 'src/games/schafkopf', name), 'utf8');
    fs.writeFileSync(path.join(output, 'source', name), source);
    fs.writeFileSync(path.join(output, 'runtime', name), name === 'bot.ts' ? instrumentBot(source) : source);
    hashes[name] = { original: digest(source), runtime: digest(fs.readFileSync(path.join(output, 'runtime', name))) };
  }
  for (const name of fs.readdirSync(path.join(root, 'src/games/schafkopf/docs'))) {
    if (name.endsWith('.md')) fs.copyFileSync(path.join(root, 'src/games/schafkopf/docs', name), path.join(output, 'docs', name));
  }
  for (const name of ['core.mjs', 'worker.mjs']) fs.copyFileSync(path.join(root, 'scripts/schafkopf-audit', name), path.join(output, 'runner/schafkopf-audit', name));
  fs.copyFileSync(fileURLToPath(import.meta.url), path.join(output, 'runner/audit-schafkopf.mjs'));
  const engine = await import(pathToFileURL(path.join(output, 'runtime/schafkopf.ts')));
  const { DEFAULT_BOT_CONFIG } = await import(pathToFileURL(path.join(output, 'runtime/botConfig.ts')));
  const manifest = { schema: 1, startedAt: new Date().toISOString(), requestedDeals: games, seed, workers, shardSize,
    levels: LEVELS, labels: LABELS, profile: smoke ? 'smoke-reduced-search-NOT-standard' : 'standard',
    rules: engine.DEFAULT_GAME_RULES, botConfig: smoke ? { ...DEFAULT_BOT_CONFIG, legendIterations: 2, legendTimeMs: 1, announcementSamples: 2 } : DEFAULT_BOT_CONFIG,
    node: process.version, cpu: os.cpus()[0]?.model, parallelism: os.availableParallelism(), hashes,
    gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    workingTreeStatus: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }),
    dealMeaning: 'Exactly requestedDeals distinct four-seat allocations, including all-pass redeals. Redeals have zero score and are not silently replaced.',
    seatSchedule: 'All 24 tier permutations; dealer changes after each 24 allocations; 96-deal balanced blocks.',
    timing: 'Original wall-clock search budgets preserved. Scheduling/load affects iteration counts, so action traces, rather than seeds alone, reproduce exact games.',
    audit: 'Read-only runtime telemetry; no live source changes. Separate PRNG for reviews. Exact full-information endgame assessment is retrospective and does not reach bots.',
    coverage: 'Default rules only: no Legen/Ramsch/Geier/Farbgeier/Bettel/Hochzeit. Logs include every spritz opportunity and executed Kontra/Re/Sub/Hirsch.',
  };
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
for (const [key, value] of Object.entries({ requestedDeals: games, seed, shardSize, profile: smoke ? 'smoke-reduced-search-NOT-standard' : 'standard' })) assert.equal(manifest[key], value, `resume configuration ${key}`);
for (const [name, hash] of Object.entries(manifest.hashes)) {
  assert.equal(digest(fs.readFileSync(path.join(output, 'source', name))), hash.original);
  assert.equal(digest(fs.readFileSync(path.join(output, 'runtime', name))), hash.runtime);
}
const committed = new Map();
for (const name of fs.readdirSync(path.join(output, 'shards')).filter(name => name.endsWith('.json'))) {
  const shard = JSON.parse(fs.readFileSync(path.join(output, 'shards', name), 'utf8'));
  committed.set(shard.shard, shard);
}
const live = new Map();
function merge(a, b) {
  for (const [key, value] of Object.entries(b)) {
    if (typeof value === 'number') a[key] = (a[key] ?? 0) + value;
    else if (Array.isArray(value)) { a[key] ??= value.map(() => 0); value.forEach((n, i) => { a[key][i] += n; }); }
    else if (value && typeof value === 'object') { a[key] ??= {}; merge(a[key], value); }
  }
  return a;
}
function totals(includeLive = false) {
  const result = {};
  for (const shard of committed.values()) merge(result, shard.stats);
  if (includeLive) for (const entry of live.values()) if (!committed.has(entry.shard)) merge(result, entry.stats);
  return result;
}
const started = Date.now();
let lastPrint = 0;
function progress(status = 'running', error = null) {
  const stats = totals(true);
  const elapsedSeconds = (Date.now() - started) / 1000;
  const rate = (stats.deals ?? 0) / elapsedSeconds;
  const report = { status, pid: process.pid, output, requestedDeals: games, committedDeals: totals().deals ?? 0,
    observedDeals: stats.deals ?? 0, sessionElapsedSeconds: elapsedSeconds, estimatedRemainingSeconds: rate > 0 ? (games - (stats.deals ?? 0)) / rate : null,
    stats, error, updatedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(output, 'progress.json.partial'), JSON.stringify(report, null, 2) + '\n');
  fs.renameSync(path.join(output, 'progress.json.partial'), path.join(output, 'progress.json'));
  if (Date.now() - lastPrint > 30000 || status !== 'running') {
    console.log(`${status}: ${report.observedDeals}/${games} Verteilungen; ${stats.finished ?? 0} beendet; ${stats.redeals ?? 0} alle weiter; ${stats.errors ?? 0} Fehler; ${Math.round(elapsedSeconds)} s; Rest ca. ${Math.round((report.estimatedRemainingSeconds ?? 0) / 60)} min`);
    lastPrint = Date.now();
  }
  return report;
}
progress();
const pool = [];
const tick = setInterval(() => progress(), 15000);
let failed = null;
try {
  await Promise.all(Array.from({ length: workers }, (_, worker) => new Promise((resolve, reject) => {
    const thread = new Worker(pathToFileURL(path.join(output, 'runner/schafkopf-audit/worker.mjs')), {
      workerData: { output, games, seed, workers, worker, shardSize, smoke, skipShards: [...committed.keys()] },
    });
    pool.push(thread);
    thread.on('message', message => {
      if (message.type === 'progress') live.set(worker, message);
      if (message.type === 'shard') { committed.set(message.shard, message); live.delete(worker); progress(); }
    });
    thread.on('error', reject);
    thread.on('exit', code => code === 0 ? resolve() : reject(new Error(`Worker ${worker} exited ${code}`)));
  })));
} catch (error) {
  failed = error;
  await Promise.allSettled(pool.map(worker => worker.terminate()));
} finally { clearInterval(tick); }
if (failed) { progress('failed', String(failed)); process.exitCode = 1; }
else {
  const stats = totals();
  const summaries = [...committed.values()].flatMap(shard => shard.summaries).sort((a, b) => a.id - b.id);
  assert.equal(summaries.length, games, 'every allocation recorded');
  assert.equal(new Set(summaries.map(game => game.id)).size, games, 'unique game IDs');
  assert.equal(new Set(summaries.map(game => game.dealHash)).size, games, '100% distinct per-seat allocations');
  assert.equal(sum(Object.values(stats.levels).map(level => level.delta)), 0, 'aggregate zero-sum');
  for (const level of Object.values(stats.levels)) {
    level.winRate = level.games ? level.wins / level.games : null;
    level.averageEyes = level.games ? level.eyes / level.games : null;
    level.averageDelta = level.games ? level.delta / level.games : null;
    level.declarerWinRate = level.declarations ? level.declarerWins / level.declarations : null;
    level.spritzWinRate = level.spritzes ? level.spritzWins / level.spritzes : null;
  }
  const report = { ...manifest, status: stats.errors ? 'complete-with-errors' : 'complete', completedAt: new Date().toISOString(),
    elapsedSeconds: (Date.now() - new Date(manifest.startedAt).getTime()) / 1000, uniqueAllocations: summaries.length, ...stats };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'index.jsonl'), summaries.map(game => JSON.stringify(game)).join('\n') + '\n');
  const score = Object.fromEntries(LEVELS.map(level => [level, 0]));
  const rows = ['id,phase,contract,declarer,beginner_eyes,amateur_eyes,pro_eyes,legend_eyes,beginner_delta,amateur_delta,pro_delta,legend_delta,beginner_total,amateur_total,pro_total,legend_total,spritzes,findings'];
  for (const game of summaries) {
    const eyes = {}, delta = {};
    game.seatLevels.forEach((level, seat) => { eyes[level] = game.points?.[seat] ?? 0; delta[level] = game.deltas[seat]; score[level] += delta[level]; });
    rows.push([game.id, game.phase, JSON.stringify(game.contract ?? {}), game.declarer ?? '', ...LEVELS.map(l => eyes[l]), ...LEVELS.map(l => delta[l]), ...LEVELS.map(l => score[l]), game.spritzes, game.findings].map(v => `"${String(v).replaceAll('"', '""')}"`).join(','));
  }
  fs.writeFileSync(path.join(output, 'scores.csv'), rows.join('\n') + '\n');
  const fmt = n => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(n);
  const table = LEVELS.map((level, i) => { const s = stats.levels[level]; return `| ${LABELS[i]} | ${fmt(s.games)} | ${fmt(s.wins)} | ${fmt(100 * s.winRate)} % | ${fmt(s.eyes)} | ${fmt(s.delta)} | ${fmt(s.declarations)} | ${fmt(s.declarerWins)} | ${fmt(s.spritzes)} |`; }).join('\n');
  const findings = Object.entries(stats.findings).sort((a, b) => b[1] - a[1]).map(([type, count]) => `- ${type}: ${fmt(count)}`).join('\n');
  fs.writeFileSync(path.join(output, 'BERICHT.md'), `# Schafkopf-Prüflauf\n\n${fmt(games)} verschiedene Verteilungen; ${fmt(stats.finished)} abgeschlossene Spiele; ${fmt(stats.redeals)} Neugeben nach viermal Weiter; ${fmt(stats.errors)} Fehler. Profil: **${manifest.profile}**. Quelle und Regelstand sind eingefroren und SHA-256-geprüft.\n\n| Bot | Spiele | Siege | Siegquote | Augen gesamt | Saldo (¢) | Ansagen | Ansagen gewonnen | Spritzen |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n${table}\n\nSalden sind virtuelle Cent, Augen die persönlich gewonnenen Stichpunkte. Alle Salden ergeben zusammen null. Neugeben erzeugt keinen Spielgewinn und keinen Punkteumsatz.\n\n${fmt(stats.moves)} echte Kartenzüge, ${fmt(stats.simulations)} Legende-Suchiterationen, ${fmt(stats.contractSamples)} Ansage-/Spritz-Rollouts. ${fmt(stats.endgameDecisions)} Entscheidungen mit exakter Rückblickprüfung. Legende: im Mittel ${fmt(stats.simulations / (stats.searchCalls || 1))} Iterationen je Suche; ${fmt(stats.searchMs / (stats.searchCalls || 1))} ms Suchzeit. Budget unverändert: 200 Iterationen/180 ms, höchstens 64 Ansage-Verteilungen. Parallelität und Systemlast beeinflussen die tatsächlich erreichte Tiefe.\n\n## Prüffunde\n\n${findings}\n\n## Interpretation\n\n- Ein Tipp kann absichtlich nicht gewählt werden: Anfänger verwendet keine Tipps; Amateur eingeschränkte Trefferquoten; Profi Fehlerrate; Legende Suchbewertung. Tipp-Abweichungen sind Prüfanlässe, keine automatisch feststehenden Fehler.\n- Ein verlorener Stich nach einem Tipp belegt keine schlechtere Karte. Abwurf, Trumpfreserve oder Schmierverteilung können spätere Stiche verbessern.\n- Die exakte Prüfung der letzten zwei Stiche nutzt alle tatsächlichen Hände und optimale gemeinsame Parteientscheidungen. Sie kann eine schlechtere Karte für diese konkrete Verteilung beweisen, jedoch keine damals erkennbare Fehlentscheidung und keine bessere Strategie über unbekannte Verteilungen. Harte R-Ausschlüsse werden gesondert markiert. Die Zukunft enthält keine weitere Spritzmöglichkeit.\n- Pro-Review-Empfehlungen verwenden eine getrennte Zufallsfolge und sind Heuristiken. Die echten R-Kandidaten und tatsächlichen Tipps stehen unabhängig davon im Zugprotokoll.\n- Tipp-Siegquoten und Endgame-Befunde sind situationsabhängig, miteinander korreliert und kein kausaler A/B-Test. Unveränderte Regeln und Bot-Stufen bleiben während des ganzen Laufs fest.\n- Seltene Tout-/Sie-/Sub-/Hirsch-Ereignisse werden nicht künstlich erzeugt. Fehlende Ereignisse sind ausdrücklich keine Bestätigung ihrer Korrektheit. Optionale Hausregeln sind außerhalb dieses Standardlaufs.\n\n## Verbesserungsansätze aus dem Quellcode\n\n1. Ansage-Auswahl nach Nettogewinn prüfen: Die aktuelle Simulation mittelt nur Gewinne, Verluste gehen als null ein. Das kann teure riskante Spiele bevorzugen. Ein Folgetest sollte signed deltas einschließlich dreifacher Einzelspielerzahlung, Zuschlägen und Spritzen vergleichen.\n2. Unsicherheit sichtbar machen: Bei wenigen Suchbesuchen oder Ansage-Rollouts ist die beobachtete Quote grob. Mindestbesuche und Konfidenzintervalle vor einer riskanten Spritze wären prüfenswert.\n3. Harte Regeln anhand der markierten Endspiele überprüfen. Erst anhand konkreter Spiele entscheiden, ob eine Ausnahme ohne verborgenes Wissen formulierbar ist.\n4. Neue Tipps zunächst an separaten Verteilungen mit unveränderten Gegnern prüfen. Die hier untersuchten Spiele dienen der Fehlersuche und dürfen nicht zugleich als unabhängiger Erfolgsnachweis dienen.\n\n## Dateien und Feedback\n\n- games/*.jsonl.gz: **jede** Verteilung, Anfangshände, komplette Aktionen, damalige eigene Sicht, echte R-Kandidaten, Tippkarten, Suchwerte, alle Stiche, Ansagen, Spritzen und Ergebnis.\n- findings/*.jsonl.gz: alle Funde mit Spiel-ID, nullbasiertem Zugindex, Typ und Beleg.\n- index.jsonl: alle Spielausgänge und Verteilungshashes; scores.csv: Augen, Rundenbuchung und fortlaufender Saldo je Stufe in Spiel-ID-Reihenfolge.\n- source/, runtime/, docs/, runner/: eingefrorene Originale, ausschließlich beobachtend instrumentierter Bot, Regeltexte und ausführbarer Prüflauf. manifest.json nennt Budgets und Dateihashes.\n\nEin Spiel extrahieren: \`node scripts/read-schafkopf-audit.mjs --run ${output} --game 123 --output /tmp/schafkopf-123.json\`. Feedback am besten mit **Spiel-ID + Zugindex + Karte/Tipp + Begründung**.\n`);
  progress(report.status);
  console.log(JSON.stringify({ output, status: report.status, deals: stats.deals, finished: stats.finished, redeals: stats.redeals, errors: stats.errors, levels: stats.levels }, null, 2));
  if (stats.errors) process.exitCode = 2;
}
