import { footballFlags } from '@/data/footballTournaments';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { boundaryRestart, footballEdition, footballLawsUrl, formationPlayers, roleResponsibilities, judgeOffside, offsidePresets, type Formation, type OffsideOrigin, type OpponentContact } from '@/data/footballLearning';
import { clubHonours, clubHonoursCutoff, domesticLeagues, mensWorldCups, womensWorldCups, worldCupSources } from '@/data/footballHonours';
import { subjectActivities } from '@/data/musicFootball';
import { ui } from '@/i18n/ui';

function Pitch({ children, label }: { children?: ReactNode; label: string }) {
  return <svg className="sl-pitch" viewBox="0 0 700 400" role="img" aria-label={label}>
    <rect width="700" height="400" rx="12" fill="#0d4539" />{[0, 1, 2, 3, 4, 5].map(i => <rect key={i} x={20 + i * 110} y="20" width="55" height="360" fill="#ffffff04" />)}
    <g stroke="#bae6cf" strokeWidth="2" fill="none"><rect x="20" y="20" width="660" height="360" /><path d="M350 20V380" /><circle cx="350" cy="200" r="50" /><rect x="20" y="92" width="105" height="216" /><rect x="575" y="92" width="105" height="216" /><rect x="20" y="150" width="38" height="100" /><rect x="642" y="150" width="38" height="100" /><path d="M20 174H8V226H20 M680 174H692V226H680" /><circle cx="92" cy="200" r="2" fill="#bae6cf" /><circle cx="608" cy="200" r="2" fill="#bae6cf" /></g>{children}
  </svg>;
}
const px = (x: number) => 20 + x * 6.6;
function Dot({ x, y, label, opponent = false, ghost = false }: { x: number; y: number; label: string; opponent?: boolean; ghost?: boolean }) {
  return <g opacity={ghost ? 0.35 : 1}><circle cx={px(x)} cy={y} r="17" fill={opponent ? '#fda4af' : '#fde68a'} stroke="#092b24" strokeWidth="2" /><text x={px(x)} y={y + 5} textAnchor="middle" fontWeight="700" fontSize="13" fill="#142b28">{label}</text></g>;
}
function OffsideLab() {
  const [situation, setSituation] = useState(offsidePresets[0].situation);
  const [preset, setPreset] = useState(0);
  const [frame, setFrame] = useState(0);
  const [running, setRunning] = useState(false);
  const verdict = judgeOffside(situation);
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (!running || frame >= 100) return;
    const timer = window.setInterval(() => setFrame(value => Math.min(100, value + 2)), 60);
    return () => window.clearInterval(timer);
  }, [running, frame]);
  // A completed run can be replayed without starting an automatic loop.
  const update = (change: Partial<typeof situation>) => { setRunning(false); setFrame(0); setSituation({ ...situation, ...change }); };
  const recipientX = situation.involved ? Math.min(96, situation.attacker + 12) : 87;
  const recipientY = situation.involved ? 225 : 65;
  const hasContact = situation.contact !== 'none';
  const segment = hasContact && frame > 50 ? (frame - 50) / 50 : hasContact ? frame / 50 : frame / 100;
  const fromX = hasContact && frame > 50 ? situation.opponents[1] : situation.ball;
  const fromY = hasContact && frame > 50 ? 120 : 330;
  const toX = hasContact && frame <= 50 ? situation.opponents[1] : recipientX;
  const toY = hasContact && frame <= 50 ? 120 : recipientY;
  const ballX = fromX + (toX - fromX) * segment;
  const ballY = fromY + (toY - fromY) * segment;
  const attackerX = situation.attacker + (Math.min(96, situation.attacker + 12) - situation.attacker) * frame / 100;
  return <section className="sl-lab"><p className="lt-eyebrow">{ui('Offside replay')}</p><h3>{ui('Freeze the pass. Then follow the play.')}</h3><div className="sl-controls">
    <label>{ui('Situation')}<select value={preset} onChange={e => { const index = Number(e.target.value); setPreset(index); setSituation({ ...offsidePresets[index].situation }); setFrame(0); setRunning(false); }}>{offsidePresets.map((p, index) => <option key={p.name} value={index}>{ui(p.name)}</option>)}</select></label>
    <label>{ui('Attacker at the pass')} · {situation.attacker}<input type="range" min="20" max="96" value={situation.attacker} onChange={e => update({ attacker: Number(e.target.value) })} /></label>
    <label>{ui('Ball at the pass')} · {situation.ball}<input type="range" min="20" max="96" value={situation.ball} onChange={e => update({ ball: Number(e.target.value) })} /></label>
    <label>{ui('Second-last opponent')} · {verdict.secondLast}<input type="range" min="30" max="88" value={verdict.secondLast} onChange={e => update({ opponents: preset === 3 ? [92, 25, Number(e.target.value)] : [92, Number(e.target.value), 25] })} /></label>
    <label>{ui('Origin')}<select value={situation.origin} onChange={e => update({ origin: e.target.value as OffsideOrigin })}>{([['pass', 'Normal team-mate pass'], ['throw-in', 'Throw-in'], ['goal-kick', 'Goal kick'], ['corner', 'Corner kick'], ['free-kick', 'Free kick']] as const).map(([value, name]) => <option key={value} value={value}>{ui(name)}</option>)}</select></label>
    <label>{ui('Opponent contact after the pass')}<select value={situation.contact} onChange={e => update({ contact: e.target.value as OpponentContact })}>{([['none', 'No opponent touch'], ['deflection', 'Deflection'], ['save', 'Deliberate save'], ['deliberate-play', 'Controlled deliberate play']] as const).map(([value, name]) => <option key={value} value={value}>{ui(name)}</option>)}</select></label>
    <label className="sl-checkbox"><input type="checkbox" checked={situation.involved} onChange={e => update({ involved: e.target.checked })} />{ui('Attacker becomes involved')}</label>
  </div><Pitch label={ui('Offside situation, attacking to the right')}>
    <rect x={px(verdict.line)} y="20" width={680 - px(verdict.line)} height="360" fill="#fda4af12" /><line x1={px(verdict.line)} x2={px(verdict.line)} y1="20" y2="380" stroke="#fda4af" strokeWidth="3" strokeDasharray="8 6" />
    <text x="42" y="48" fill="#e1f5eb" fontSize="14">{ui('Attack direction')} →</text>
    {situation.opponents.map((x, index) => <Dot key={index} x={x} y={index === 0 ? 180 : index === 1 ? 120 : 282} label={preset === 3 ? index === 1 ? 'GK' : `D${index}` : index === 0 ? 'GK' : `D${index}`} opponent />)}
    {frame > 0 && <Dot x={situation.attacker} y={225} label="A" ghost />}<Dot x={situation.involved ? attackerX : situation.attacker} y={225} label="A" /><Dot x={situation.ball} y={330} label="P" />
    <line x1={px(situation.ball)} y1="330" x2={px(recipientX)} y2={recipientY} stroke="#fff" strokeDasharray="4 6" opacity=".5" />
    {!situation.involved && <Dot x={87} y={65} label="R" />}
    <circle cx={px(ballX)} cy={ballY} r="7" fill="#fff" stroke="#172033" />
  </Pitch><p>{ui('A = attacker · P = passer · D = opponent · GK = goalkeeper. R = receiving team-mate. Faded A marks the position at the pass; the dashed line is frozen at that moment.')}</p>
    <div className="sl-actions"><button type="button" className="lt-button primary" disabled={reduced} onClick={() => { if (frame >= 100) setFrame(0); setRunning(frame >= 100 ? true : !running); }}>{running && frame < 100 ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}{ui(running && frame < 100 ? 'Pause' : 'Play situation')}</button><button type="button" className="lt-button" onClick={() => { setRunning(false); setFrame(0); }}><RotateCcw size={16} aria-hidden />{ui('Freeze at pass')}</button></div>
    <label className="sl-slider">{ui('Replay position')} · {frame}%<input type="range" min="0" max="100" value={frame} onChange={e => { setRunning(false); setFrame(Number(e.target.value)); }} /></label>
    {reduced && <p>{ui('Reduced motion is enabled. Use the replay slider to move through the situation.')}</p>}
    <div className="sl-verdict" aria-live="polite"><strong>{ui(verdict.offence ? 'Offside offence on involvement' : 'No offside offence in this situation')}</strong><p>{ui(verdict.reason)}</p></div>
    <p className="sl-source">{ui('The dots represent eligible body points. This is a simplified teaching model; contact and interference still need referee judgement.')} · <a href="https://www.theifab.com/laws/latest/offside/" target="_blank" rel="noreferrer">IFAB · Law 11</a></p>
  </section>;
}
function RestartLab({ topic }: { topic: string }) {
  const [boundary, setBoundary] = useState<'touchline' | 'goal-line'>('goal-line');
  const [lastTouch, setLastTouch] = useState<'attacker' | 'defender'>('defender');
  const [distance, setDistance] = useState(0);
  const restart = boundaryRestart(boundary, lastTouch, distance > 8);
  return <section className="sl-lab"><p className="lt-eyebrow">{ui('Boundary replay')}</p><h3>{ui('The whole ball must cross the line')}</h3><div className="sl-controls"><label>{ui('Boundary')}<select value={boundary} onChange={e => setBoundary(e.target.value as typeof boundary)}><option value="touchline">{ui('Touchline')}</option><option value="goal-line">{ui('Goal line outside the goal')}</option></select></label><label>{ui('Last touch')}<select value={lastTouch} onChange={e => setLastTouch(e.target.value as typeof lastTouch)}><option value="attacker">{ui('Attacker')}</option><option value="defender">{ui('Defender')}</option></select></label></div>
    <svg className="sl-boundary" viewBox="0 0 660 160" role="img" aria-label={ui('Ball crossing a boundary')}><rect width="330" height="160" fill="#0d4539" /><rect x="330" width="330" height="160" fill="#101b2e" /><rect x="324" width="12" height="160" fill="#fff" /><circle cx={336 + distance * 3} cy="80" r="24" fill="#fef3c7" stroke="#172033" strokeWidth="2" /><text x="70" y="140" fill="#fff" fontSize="18">{ui('Field')}</text><text x="470" y="140" fill="#fff" fontSize="18">{ui('Out of play')}</text></svg>
    <label className="sl-slider">{ui('Move the ball')}<input type="range" min="-25" max="35" value={distance} onChange={e => setDistance(Number(e.target.value))} /></label><div className="sl-verdict" role="status"><strong>{ui(restart)}</strong></div><p>{ui('A ball overlapping the line is still in play. This diagram shows a goal-line crossing outside the goal mouth, so it cannot be a goal.')}</p>
    {topic === 'time-score' && <p>{ui('A valid goal requires the whole ball between the posts and below the bar. Added time is a minimum; competition rules decide extra time and shoot-outs.')}</p>}
  </section>;
}
function TacticsLab({ topic }: { topic: string }) {
  const [formation, setFormation] = useState<Formation>('4-3-3');
  const [possession, setPossession] = useState(false);
  const [phase, setPhase] = useState(0);
  const [selected, setSelected] = useState(8);
  const arrowId = `sl-arrow-${useId().replace(/:/g, '')}`;
  const players = formationPlayers(formation, possession);
  const explanation = subjectActivities.find(item => item.pathId === 'positions-tactics' && item.topic === topic)!.example;
  const centralForward = players.find(p => p.role === 'Forward' && p.y >= 49)?.number ?? 10;
  const supportForward = players.find(p => p.role === 'Forward' && p.number !== centralForward)!.number;
  const modified = players.map(p => {
    if (topic === 'overlap' && p.number === 2) return { ...p, x: Math.min(96, p.x + phase * 0.58), y: 9 };
    if (topic === 'false-nine' && p.number === centralForward) return { ...p, x: p.x - phase * 0.27, y: 50 };
    if (topic === 'false-nine' && p.number === supportForward) return { ...p, x: p.x + phase * 0.14, y: 28 };
    if (topic === 'pressing' && [6, 7, 8].includes(p.number)) return { ...p, x: p.x + phase * 0.2, y: p.y + (50 - p.y) * phase / 300 };
    return p;
  });
  const chosen = players.find(p => p.number === selected)!;
  const responsibility = roleResponsibilities[chosen.role][possession ? 'with' : 'without'];
  return <section className="sl-lab"><p className="lt-eyebrow">{ui('Tactics board')}</p><h3>{ui('Shape, movement, and responsibilities')}</h3><div className="sl-controls"><label>{ui('Formation')}<select value={formation} onChange={e => { setFormation(e.target.value as Formation); setPhase(0); }}>{(['4-3-3', '4-4-2', '3-5-2'] as const).map(f => <option key={f}>{f}</option>)}</select></label><label>{ui('Team phase')}<select value={possession ? 'with' : 'without'} onChange={e => { setPossession(e.target.value === 'with'); setPhase(0); }}><option value="without">{ui('Without possession')}</option><option value="with">{ui('With possession')}</option></select></label><label>{ui('Player to inspect')}<select value={selected} onChange={e => setSelected(Number(e.target.value))}>{players.map(p => <option key={p.number} value={p.number}>{p.number} · {ui(p.role)}</option>)}</select></label></div>
    <Pitch label={ui('Formation and player movements')}><defs><marker id={arrowId} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="#fff" /></marker></defs><text x="42" y="48" fontSize="14" fill="#fff">{formation} · {ui('Attack direction')} →</text>
      {modified.map((p, i) => <g key={p.number}>{(p.x !== players[i].x || p.y !== players[i].y) && <line x1={px(players[i].x)} y1={20 + players[i].y * 3.6} x2={px(p.x)} y2={20 + p.y * 3.6} stroke="#fff" strokeDasharray="5 5" markerEnd={`url(#${arrowId})`} />}{p.number === selected && <circle cx={px(p.x)} cy={20 + p.y * 3.6} r="24" stroke="#fff" strokeWidth="2" fill="none" />}<Dot x={p.x} y={20 + p.y * 3.6} label={String(p.number)} /></g>)}
      {topic === 'pressing' && <><Dot x={73} y={200} label="D" opponent /><circle cx={px(70)} cy="214" r="7" fill="#fff" /></>}
    </Pitch>{['overlap', 'false-nine', 'pressing'].includes(topic) && <label className="sl-slider">{ui('Movement phase')} · {phase}%<input type="range" min="0" max="100" value={phase} onChange={e => setPhase(Number(e.target.value))} /></label>}
    <div className="sl-readout"><strong>{chosen.number} · {ui(chosen.role)}</strong><span>{ui(responsibility)}</span></div><p>{ui(explanation)}</p><p>{ui('Eleven generic players including the goalkeeper. Shapes and runs are teaching examples; they change with the opponent and the match.')}</p>
  </section>;
}
export function HonoursExplorer() {
  const [view, setView] = useState('clubs');
  const [league, setLeague] = useState('all');
  const [query, setQuery] = useState('');
  const [clubId, setClubId] = useState('bayern');
  const clubs = clubHonours.filter(club => (league === 'all' || club.league === league) && club.name.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()));
  const club = clubs.find(c => c.id === clubId) ?? clubs[0];
  const worldCups = view === 'men' ? mensWorldCups : womensWorldCups;
  return <section className="sl-lab"><p className="lt-eyebrow">{ui('Trophy explorer')}</p><h3>{ui('Clubs, domestic competitions, and World Cups')}</h3><div className="sl-controls"><label>{ui('Records')}<select value={view} onChange={e => setView(e.target.value)}><option value="clubs">{ui('Men’s club honours through 2024/25')}</option><option value="men">{ui('Men’s World Cups through 2026')}</option><option value="women">{ui('Women’s World Cups through 2023')}</option></select></label>{view === 'clubs' && <><label>{ui('Domestic league')}<select value={league} onChange={e => setLeague(e.target.value)}><option value="all">{ui('All leagues')}</option>{domesticLeagues.map(l => <option key={l}>{l}</option>)}</select></label><label>{ui('Find a club')}<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label><label>{ui('Club')}<select value={club?.id ?? ''} disabled={!club} onChange={e => setClubId(e.target.value)}>{clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></>}</div>
    {view === 'clubs' ? club ? <><p><strong>{club.name}</strong> · {club.league} · {clubHonoursCutoff}</p><div className="sl-honours-grid">{[[club.domesticLabel, club.leagueTitles], [club.cup, club.cupTitles], ['European Cup / Champions League', club.ucl], ['UEFA Cup / Europa League', club.europa], ['Conference League', club.conference]].map(([label, count]) => <div key={label}><span>{ui(String(label))}</span><strong>{count}</strong></div>)}</div>{club.note && <p>{ui(club.note)}</p>}<p>{ui('Selected clubs and categories only. No overall trophy total: super cups, league cups, former Cup Winners’ Cup, and club world titles are not included.')}</p><div className="sl-source">{club.sources.map((source, i) => <a key={source} href={source} target="_blank" rel="noreferrer">{ui('Source')} {i + 1}</a>)}</div></> : <p role="status">{ui('No matching clubs. Try another league or search.')}</p> : <><div className="sl-table-wrap"><table className="sl-table"><caption>{ui(view === 'men' ? 'Men’s World Cups through 2026' : 'Women’s World Cups through 2023')}</caption><thead><tr><th>{ui('National team')}</th><th>{ui('Titles')}</th><th>{ui('Winning years')}</th></tr></thead><tbody>{worldCups.map(team => <tr key={team.team}><th scope="row"><span className="fr-team">{footballFlags[team.team] && <img width="24" height="18" src={`/flags/4x3/${footballFlags[team.team]}.svg`} alt="" />}{ui(team.team)}</span></th><td>{team.years.length}</td><td>{team.years.join(', ')}</td></tr>)}</tbody></table></div><p>{ui('Germany includes West Germany. National-team World Cups are separate from club competitions.')}</p><a className="sl-source" href={view === 'men' ? worldCupSources.men : worldCupSources.women} target="_blank" rel="noreferrer">{view === 'men' ? 'FIFA' : 'UEFA'} · {ui('Source')}</a></>}
    <p className="sl-source">{ui('Historical snapshots with explicit cutoffs. Source pages may now show newer seasons; this explorer does not update automatically.')}</p><p className="sl-source">{ui('Independent educational reference. Names identify teams and competitions; no official logos, trophy images, or affiliation are used.')}</p>
  </section>;
}
function RuleSituationLab({ topic }: { topic: string }) {
  const [selection, setSelection] = useState(0);
  const [frame, setFrame] = useState(0);
  const situations = topic === 'fouls-cards' ? [
    ['Careless challenge', 'Direct free kick; no card solely for a careless challenge.'], ['Reckless challenge', 'Direct free kick and yellow card.'], ['Excessive force', 'Direct free kick and red card.'],
  ] : [['Direct free kick', 'A goal can be scored directly against the opponents.'], ['Indirect free kick', 'Another player must touch the ball before a goal can be scored.'], ['Penalty kick', 'A defender committed a direct-free-kick offence inside their own penalty area.']];
  return <section className="sl-lab"><p className="lt-eyebrow">{ui('Compare situations')}</p><div className="sl-controls"><label>{ui('Situation')}<select value={selection} onChange={e => { setSelection(Number(e.target.value)); setFrame(0); }}>{situations.map(([label], i) => <option key={label} value={i}>{ui(label)}</option>)}</select></label></div><Pitch label={ui('Free kick and challenge situation')}><Dot x={topic === 'fouls-cards' ? 58 - frame * .05 : selection === 2 ? 89 : 60} y={200} label="A" /><Dot x={topic === 'fouls-cards' ? 64 - frame * .05 : 92} y={topic === 'fouls-cards' ? 235 - frame * .25 : 200} label="D" opponent /><circle cx={px(topic === 'fouls-cards' ? 59 : selection === 2 ? 89 + frame * .1 : 63 + frame * .28)} cy="200" r="7" fill="#fff" />{topic === 'fouls-cards' && frame > 70 && selection > 0 && <rect x="385" y="80" width="20" height="30" fill={selection === 1 ? '#fde047' : '#f87171'} />}</Pitch><label className="sl-slider">{ui('Movement phase')}<input type="range" min="0" max="100" value={frame} onChange={e => setFrame(Number(e.target.value))} /></label><div className="sl-verdict" role="status"><strong>{ui(situations[selection][0])}</strong><p>{ui(situations[selection][1])}</p></div><p>{ui('The diagram illustrates the stated scenario; it cannot infer foul severity from movement alone.')}</p></section>;
}
function PitchAreasLab() {
  const [area, setArea] = useState('penalty');
  return <section className="sl-lab"><p className="lt-eyebrow">{ui('Pitch guide')}</p><label>{ui('Area')}<select value={area} onChange={e => setArea(e.target.value)}><option value="penalty">{ui('Penalty area')}</option><option value="goal">{ui('Goal area')}</option><option value="half">{ui('Halfway line')}</option></select></label><Pitch label={ui('Football pitch markings')}>{area === 'half' ? <line x1="350" x2="350" y1="20" y2="380" stroke="#fde68a" strokeWidth="5" /> : <rect x={area === 'penalty' ? 575 : 642} y={area === 'penalty' ? 92 : 150} width={area === 'penalty' ? 105 : 38} height={area === 'penalty' ? 216 : 100} fill="#fde68a40" />}</Pitch><p>{ui(area === 'penalty' ? 'The larger box is the penalty area. Its boundary lines are part of the area.' : area === 'goal' ? 'The smaller box is the goal area. It is not the limit of goalkeeper handling.' : 'The halfway line is excluded from the opponents’ half for offside position.')}</p></section>;
}
export default function FootballLab({ topic, tactics }: { topic: string; tactics: boolean }) {
  return <>{tactics ? <TacticsLab topic={topic} /> : topic === 'offside' ? <OffsideLab /> : topic === 'competitions' ? <HonoursExplorer /> : topic === 'pitch-players' ? <PitchAreasLab /> : topic === 'fouls-cards' || topic === 'free-kicks' ? <RuleSituationLab topic={topic} /> : <RestartLab topic={topic} />} {!tactics && <p className="sl-source">{footballEdition} · <a href={footballLawsUrl} target="_blank" rel="noreferrer">{ui('Official laws and editions')}</a></p>}</>;
}
