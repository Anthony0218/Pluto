import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createGunzip, createGzip } from 'node:zlib';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { LEVELS, LABELS, sum } from './core.mjs';

const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const run = path.resolve(arg('--run', 'artifacts/schafkopf-audit-100000-2026-10-05'));
const partial = args.includes('--partial');
if (!partial && !fs.existsSync(path.join(run, 'report.json'))) throw new Error('Wait for report.json, or use --partial.');
const destination = path.join(run, partial ? 'review-partial' : 'review');
fs.mkdirSync(destination, { recursive: true });
async function writer(name) {
  const output = fs.createWriteStream(path.join(destination, name + '.partial'));
  const gzip = createGzip({ level: 3 }); gzip.pipe(output);
  const done = Promise.all([finished(gzip), finished(output)]); done.catch(() => {});
  return { async write(value) { if (!gzip.write(JSON.stringify(value) + '\n')) await once(gzip, 'drain'); },
    async close() { gzip.end(); await done; fs.renameSync(path.join(destination, name + '.partial'), path.join(destination, name)); } };
}
const singles = await writer('Einzelspiele.jsonl.gz'), spritzes = await writer('Spritzen.jsonl.gz');
const allFindings = await writer('Prueffaelle.jsonl.gz');
const cases = new Map();
const aggregates = { deals: 0, finished: 0, singles: 0, spritzes: 0, simulationFailureReasons: {},
  retrospective: Object.fromEntries(LEVELS.map(level => [level, { assessed: 0, improved: 0, totalGapCent: 0, rulesExcludedBest: 0, tipsInferior: {} }])),
  tips: {}, spritzNames: {}, contracts: {}, severity: {}, reviewProvenance: 'All endgame gaps are full-information hindsight, not probability estimates.' };
function sample(type, record, finding) {
  const existing = cases.get(type);
  if (!existing || (finding.gapCent ?? 0) > (existing.finding.gapCent ?? 0)) cases.set(type, { record, finding });
}
const files = fs.readdirSync(path.join(run, 'shards')).filter(name => name.endsWith('.json')).sort();
for (const file of files) {
  const shard = JSON.parse(fs.readFileSync(path.join(run, 'shards', file)));
  const input = fs.createReadStream(path.join(run, 'games', file.replace('.json', '.jsonl.gz')));
  const gzip = createGunzip(); input.pipe(gzip);
  const lines = readline.createInterface({ input: gzip, crlfDelay: Infinity });
  for await (const line of lines) {
    const record = JSON.parse(line); aggregates.deals++;
    if (record.phase !== 'finished') continue;
    aggregates.finished++;
    const result = record.final.result;
    const declaration = record.trace.find(entry => entry.action.type === 'declare');
    const contract = record.final.contract;
    const contractName = `${contract.kind}${contract.suit ? ':' + contract.suit : ''}${contract.tout ? ':tout' : ''}`;
    const contractStats = aggregates.contracts[contractName] ??= { games: 0, wins: 0, spritzes: 0 };
    contractStats.games++; contractStats.wins += Number(result.declarerWon); contractStats.spritzes += record.final.spritzEvents.length;
    if (contract.kind !== 'rufspiel') {
      aggregates.singles++;
      await singles.write({ id: record.id, dealer: record.dealer, seatLevels: record.seatLevels, initialHands: record.initialHands,
        declaration, auction: record.trace.filter(entry => ['intent', 'bid'].includes(entry.action.type)), contract, result,
        points: record.final.points, spritzEvents: record.final.spritzEvents, tricks: record.final.tricks, findings: record.findings });
    }
    for (const event of record.final.spritzEvents) {
      aggregates.spritzes++;
      const trigger = record.trace.find(entry => entry.action.spritz && entry.view.spritzCount + 1 === event.count);
      const name = ['Kontra', 'Re', 'Sub', 'Hirsch'][event.count - 1];
      const stat = aggregates.spritzNames[name] ??= { count: 0, partyWins: 0, byLevel: {} };
      const partyWon = result.team.includes(event.seat) === result.declarerWon;
      stat.count++; stat.partyWins += Number(partyWon);
      const level = record.seatLevels[event.seat]; stat.byLevel[level] = (stat.byLevel[level] ?? 0) + 1;
      await spritzes.write({ id: record.id, ...event, name, level, initialHands: record.initialHands, contract, trigger,
        partyWon, points: record.final.points, result, tricks: record.final.tricks });
    }
    for (const entry of record.trace) {
      const exact = entry.endgame;
      if (exact) {
        const stat = aggregates.retrospective[entry.level]; stat.assessed++;
        const best = Math.max(...exact.alternatives.map(item => item.delta));
        const selected = exact.alternatives.find(item => item.card === entry.action.cardId).delta;
        const bestAllowed = Math.max(...exact.alternatives.filter(item => entry.action.debugInfo.candidates.includes(item.card)).map(item => item.delta));
        if (best > selected) { stat.improved++; stat.totalGapCent += best - selected; }
        stat.rulesExcludedBest += Number(best > bestAllowed);
      }
      // Each match is a separate contextual recommendation; multiple variants
      // of T2/T6 etc. can be present on the same decision.
      for (const match of entry.tipStatus ?? []) {
        const key = `${entry.level}:${match.code}`;
        const stat = aggregates.tips[key] ??= { matches: 0, selected: 0, exactAssessed: 0, exactInferior: 0, exactSuperior: 0, exactEqual: 0 };
        stat.matches++; stat.selected += Number(match.selectedRecommendedCard);
        if (!exact) continue;
        const recommended = exact.alternatives.filter(item => match.cards.includes(item.card));
        const other = exact.alternatives.filter(item => entry.action.debugInfo.candidates.includes(item.card) && !match.cards.includes(item.card));
        if (!recommended.length || !other.length) continue;
        stat.exactAssessed++;
        const gap = Math.max(...recommended.map(item => item.delta)) - Math.max(...other.map(item => item.delta));
        if (gap < 0) { stat.exactInferior++; const s = aggregates.retrospective[entry.level]; s.tipsInferior[match.code] = (s.tipsInferior[match.code] ?? 0) + 1; }
        else if (gap > 0) stat.exactSuperior++;
        else stat.exactEqual++;
      }
    }
    for (const raw of record.findings) {
      // Older archived runners kept the telemetry event type in this field;
      // preserve it as eventType and normalize the human-facing classification.
      const finding = raw.type === 'searchFailure' ? { ...raw, eventType: raw.type, type: 'simulation-failure' }
        : raw.type === 'contractEstimate' ? { ...raw, eventType: raw.type, type: 'announcement-or-spritz-small-sample' } : raw;
      aggregates.severity[finding.severity] = (aggregates.severity[finding.severity] ?? 0) + 1;
      if (finding.type === 'simulation-failure') {
        const key = `${finding.stage}:${finding.reason}:${finding.error ?? ''}`;
        aggregates.simulationFailureReasons[key] = (aggregates.simulationFailureReasons[key] ?? 0) + 1;
        sample(key, record, finding);
      }
      if (['hindsight-better-card', 'hindsight-rule-excludes-best', 'hindsight-tip-inferior'].includes(finding.type)) {
        sample(`${finding.type}:${record.trace[finding.step].level}:${finding.tip ?? finding.rules?.join('+') ?? ''}`, record, finding);
      }
      if (!['expected', 'index'].includes(finding.severity)) {
        const entry = record.trace.find(entry => entry.step === finding.step);
        await allFindings.write({ ...finding, contract, level: entry?.level, actual: entry?.action.cardId,
          hand: entry?.view.hand, result, fullGameShard: shard.shard });
      }
    }
  }
}
await singles.close(); await spritzes.close(); await allFindings.close();
fs.writeFileSync(path.join(destination, 'Auswertung.json'), JSON.stringify(aggregates, null, 2) + '\n');
const fmt = n => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(n);
const sections = [];
for (const [type, { record, finding }] of cases) {
  const entry = record.trace.find(entry => entry.step === finding.step);
  if (!entry) continue;
  const stem = `${record.id}-${finding.step}-${sections.length}`;
  fs.writeFileSync(path.join(destination, `Fall-${stem}.json`), JSON.stringify({ gameId: record.id, finding, decision: entry,
    initialHands: record.initialHands, seatLevels: record.seatLevels, final: record.final }, null, 2) + '\n');
  sections.push(`### Spiel ${record.id}, Zugindex ${finding.step}: ${type}\n\n- Stufe: ${LABELS[LEVELS.indexOf(entry.level)]}; Sitz ${entry.view.seat}; ${JSON.stringify(record.final.contract)}.\n- Hand damals: ${entry.view.hand.join(', ')}.\n- Gespielt: ${entry.action.cardId ?? JSON.stringify(entry.action)}; Begründung: ${entry.action.reasonCode}.\n- R-Kandidaten: ${(entry.action.debugInfo?.candidates ?? []).join(', ')}.\n- Befund: ${JSON.stringify(Object.fromEntries(Object.entries(finding).filter(([key]) => !['view','rolloutStart','sampledHands','stack'].includes(key))))}.\n- Vollständiger Fall: [Fall-${stem}.json](Fall-${stem}.json).\n\n`);
}
const table = LEVELS.map((level, i) => { const s = aggregates.retrospective[level]; return `| ${LABELS[i]} | ${fmt(s.assessed)} | ${fmt(s.improved)} | ${fmt(s.rulesExcludedBest)} |`; }).join('\n');
fs.writeFileSync(path.join(destination, 'FEEDBACK.md'), `# Konkrete Prüffälle${partial ? ' – Zwischenstand' : ''}\n\nAusgewertet: ${fmt(aggregates.deals)} Verteilungen, ${fmt(aggregates.finished)} abgeschlossene Spiele. **${fmt(aggregates.singles)} Einzelspiele** stehen vollständig in Einzelspiele.jsonl.gz, **${fmt(aggregates.spritzes)} Spritzen** in Spritzen.jsonl.gz. Alle Entscheidungen einschließlich abgelehnter Spritzgelegenheiten stehen in games/.\n\n| Stufe | exakt geprüfte Endspielentscheidungen | im Rückblick bessere Karte | R-Regel schließt beste Karte aus |\n|---|---:|---:|---:|\n${table}\n\nDiese Befunde nutzen vollständiges Kartenwissen. Sie beweisen keine damals erkennbare Fehlentscheidung. Die Summe der Cent-Abstände ist kein erwartbarer Gewinn eines neuen Bots; mehrere Befunde können dieselbe Partie betreffen. Die Tabelle beschränkt sich auf Entscheidungssituationen mit mehreren legalen Karten in den letzten zwei Stichen.\n\nTipp-Auswertung in Auswertung.json zählt einzelne Tippvarianten; derselbe Tippcode kann in einem Zug mehrfach mit verschiedenen empfohlenen Karten vorkommen. „exactInferior“ vergleicht jeweils die beste Tippkarte mit der besten übrigen R-Karte für die tatsächliche Verteilung.\n\nSimulationen, die abbrechen, stehen mit Ursache in Auswertung.json. Prueffaelle.jsonl.gz enthält sämtliche Prüfanlässe außer absichtlich erwarteten Anfänger-Abweichungen und reinen Indexeinträgen. Die ungekürzten Originalfunde bleiben in findings/.\n\nFeedback bitte als **Spiel-ID, nullbasierter Zugindex, gewünschte Karte/Ansage/Spritze und Begründung**.\n\n## Beispiele\n\n${sections.join('\n')}`);
console.log(JSON.stringify({ destination, ...Object.fromEntries(['deals', 'finished', 'singles', 'spritzes'].map(key => [key, aggregates[key]])), simulationFailureReasons: aggregates.simulationFailureReasons, retrospective: aggregates.retrospective, samples: cases.size }, null, 2));
