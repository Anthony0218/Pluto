import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, Compass, Globe, Leaf, Play, Repeat2, Users } from 'lucide-react';
import { SCENARIOS, type ScenarioId, type GameResult, type PlayMode, type BotDifficulty } from '../../../games/natura/naturaData';
import { STUDIES, difficultyLabel } from '../../../games/natura/studies';
import DidYouKnow from '../../../components/natura/DidYouKnow';
import FieldQuiz from '../../../components/natura/FieldQuiz';
import type { RunOptions } from '../../../games/natura/world';
import { loadJournal, habitatRecord, awardMedal, recordKey } from '../../../games/natura/journal';
import NaturaJournal from '../../../components/natura/NaturaJournal';
import HabitatIcon from '../../../components/natura/HabitatIcon';
import '../../../components/natura/natura3d.css';
import '../../../components/natura/fieldStation.css';
import '../../../components/natura/fieldJourney.css';
const NaturaExpedition = lazy(() => import('../../../components/natura/NaturaExpedition'));
const NaturaGame = lazy(() => import('../../../components/natura/NaturaGame'));
const NaturaOnline = lazy(() => import('../../../components/natura/NaturaOnline'));
const NaturaHotseat = lazy(() => import('../../../components/natura/NaturaHotseat'));
const order: ScenarioId[] = ['meadow', 'bolas', 'coconut', 'trapjaw', 'cuttlefish', 'jumpingspider', 'spermwhale', 'archerfish', 'flyingfish'];
const scenarios = order.map(id => SCENARIOS.find(s => s.id === id)!);
export default function NaturaMenu() {
  const [format,setFormat]=useState<'solo'|'local'|'online'|'alternating'>(()=>new URLSearchParams(location.search).has('naturaRoom')?'online':'solo');
  const mode:PlayMode=format==='local'?'hotseat':'ai';
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('normal');
  const [selected, setSelected] = useState<ScenarioId>('meadow');
  const [stage, setStage] = useState<'menu' | 'game' | 'results' | 'expedition'>(()=>new URLSearchParams(location.search).has('naturaRoom')?'game':'menu');
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [result, setResult] = useState<GameResult | null>(null);
  const [journal,setJournal]=useState(loadJournal),[journalOpen,setJournalOpen]=useState(false);
  useEffect(()=>{const refresh=()=>setJournal(loadJournal());window.addEventListener('natura-journal',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('natura-journal',refresh);window.removeEventListener('storage',refresh);};},[]);
  const [quiz, setQuiz] = useState<ScenarioId | null>(null);
  const scenario = SCENARIOS.find(s => s.id === selected)!;
  const study = STUDIES[selected];
  const finish = (r: GameResult) => {
    setResult(r);
    if (r.winner !== null) setScores(previous => { const next: [number, number] = [...previous]; next[r.winner!] += 3; return next; });
    setStage('results');
  };
  if(stage==='expedition')return <Suspense fallback={<div className="n3-loading">Preparing your trail…</div>}><NaturaExpedition onExit={()=>setStage('menu')}/></Suspense>;
  if (stage === 'game') return <Suspense fallback={<div className="n3-loading"><div><Compass size={36}/><p className="nm-eyebrow">NATURA / PREPARING YOUR STUDY</p><h2>{scenario.title}</h2><p>Opening the {study.habitat.toLowerCase()} habitat…</p></div></div>}>{format==='online'?<NaturaOnline scenario={selected} onExit={()=>setStage('menu')}/>:format==='alternating'?<NaturaHotseat scenario={selected} difficulty={botDifficulty} onExit={()=>setStage('menu')} onComplete={finish}/>:<NaturaGame key={`${selected}-${round}`} scenario={selected} mode={mode} botDifficulty={botDifficulty} round={round} initialLevel={result?.context?.level??0} options={result?.context?{challenge:result.context.challenge as RunOptions['challenge'],variant:result.context.variant as RunOptions['variant'],role:result.context.role as RunOptions['role']}:undefined} onComplete={finish} onExit={() => setStage('menu')}/>}</Suspense>;
  return <main className="nm-page">
    <div className="nm-shell">
      <header className="nm-masthead"><div className="nm-wordmark"><Leaf aria-hidden="true"/><span>Natura</span><small>FIELD STATION</small></div><span className="nm-collection-label">PLAY · OBSERVE · DISCOVER</span></header>
      {stage === 'results' ? <section className="nm-results" style={{ '--habitat-accent': study.accent } as CSSProperties}>
        <p className="nm-eyebrow">STUDY COMPLETE / ROUND {round}</p><HabitatIcon id={selected}/><h1>{result?.winner === null ? 'An even match.' : format === 'solo' ? result?.winner === 0 ? 'You win.' : result?.opponent==='ocean' ? 'The ocean wins.' : 'Your rival wins.' : `Player ${(result?.winner ?? 0) + 1} wins.`}</h1><h2>{scenario.title}</h2><p>{result?.detail}</p>
        <div className="nm-assessment"><b>{scores[0]} : {scores[1]}</b><span>Match record<br/>{result?.winner === null ? 'A draw adds no points.' : 'Three match points awarded to the winner.'}</span></div>
        {result?.review&&<div className="nj-run-review"><h3>Your field observations</h3><div>{result.review.facts.map(f=><span key={f}>{f}</span>)}</div><p>{result.review.tip}</p>{format==='solo'&&awardMedal(result)&&<strong className={`nj-medal nj-${awardMedal(result)}`}>{awardMedal(result)} medal earned</strong>}{format==='solo'&&result.context&&<p>Best progress for this course and difficulty: {journal.runs[recordKey({scenario:selected,...result.context})]?.bestProgress.toFixed(1)??'0'} · Best win: {journal.runs[recordKey({scenario:selected,...result.context})]?.bestTime?.toFixed(1)??'—'}s</p>}</div>}<DidYouKnow scenario={selected}/><div className="nm-result-actions"><button className="nf-primary" onClick={() => { setRound(r => r + 1); setStage('game'); }}><Play size={17}/> Play again</button><button className="nf-button" onClick={() => { setRound(r => r + 1); setStage('menu'); }}><ArrowLeft size={17}/> Choose habitat</button><button className="nf-button" onClick={() => setQuiz(selected)}><BookOpen size={17}/> Field quiz</button></div>
      </section> : <>
        <section className="nm-heading"><div className="nm-hero-copy"><p className="nm-eyebrow">THE NATURAL WORLD, IN PLAY</p><h1>Follow your<br/><em>curiosity.</em></h1><p>Think like a hunter. Move like a spider.<br/>Explore nine living worlds, one discovery at a time.</p><a className="nm-collection-link" href="#natura-collection">Explore the collection <ArrowUpRight size={18}/></a></div><div className="nm-hero-art" aria-hidden="true"><div className="nm-orbit nm-orbit-one"/><div className="nm-orbit nm-orbit-two"/><Leaf className="nm-hero-leaf" strokeWidth={1}/><span className="nm-art-label">01 / THE ART OF ADAPTATION</span><span className="nm-art-cross">+</span><span className="nm-art-note">A world worth<br/>looking closer at.</span></div></section>
        <section className="nj-entrance"><div><p className="nm-eyebrow">A TRAIL OF DISCOVERIES</p><h2>Make each visit count.</h2><p>Learn a field skill, collect specimen illustrations, and follow a three-habitat expedition.</p></div><div><button className="nf-primary" onClick={()=>setStage('expedition')}><Compass size={17}/> Start an expedition</button><button className="nf-button" onClick={()=>setJournalOpen(true)}><BookOpen size={17}/> Field journal · {scenarios.filter(s=>habitatRecord(journal,s.id).wins>0).length}/9</button></div></section><section id="natura-collection" aria-labelledby="collection-title">
          <div className="nm-menu-tools"><div><p className="nm-eyebrow">INTERACTIVE COLLECTION / 09 STUDIES</p><h2 id="collection-title">Choose a habitat.</h2></div><div className="nm-mode" role="group" aria-label="Play format"><button aria-pressed={format === 'solo'} onClick={() => setFormat('solo')}><Compass size={17}/> Single-player</button><button aria-pressed={format==='online'} onClick={()=>setFormat('online')}><Globe size={17}/> Online</button><button aria-pressed={format==='alternating'} onClick={()=>setFormat('alternating')}><Repeat2 size={17}/> Hotseat</button><button aria-pressed={format === 'local'} onClick={() => setFormat('local')}><Users size={17}/> Local two players</button></div></div>
          <div className="nm-settings"><p>{format==='online'?'Play on separate devices. Create an invite-code room or join a friend.':format==='alternating'?'Take turns on one device, with matching seeds, courses and animal roles.':format === 'solo' ? 'Play against an animal rival, or the ocean in survival studies.' : 'Simultaneous shared-screen play. Player 1 uses WASD; Player 2 uses arrows. Touch controls included.'}</p>{format!=='online'&&format!=='local' && <div className="nm-bot-level" role="group" aria-label="Bot difficulty"><span>AI RIVAL</span>{(['easy', 'normal', 'hard'] as const).map(level => <button key={level} aria-pressed={botDifficulty === level} onClick={() => setBotDifficulty(level)}>{difficultyLabel(level)}</button>)}</div>}</div>
          <div className="nm-cards">{scenarios.map((s, index) => { const metadata = STUDIES[s.id]; return <article className="nm-card" key={s.id} style={{ '--habitat-accent': metadata.accent } as CSSProperties}>
            <div className="nm-card-art" aria-hidden="true"><span className="nm-record">FIELD STUDY / {String(index + 1).padStart(2, '0')}</span><HabitatIcon id={s.id}/><span className="nm-art-scale">┃ ┃ ┃ ┃ ┃ ┃</span></div>
            <div className="nm-card-copy"><small className="nm-eyebrow">{metadata.category}</small><h3>{s.title}</h3><p className="nm-habitat">{metadata.habitat} · {metadata.subjects}</p><p>{metadata.summary}</p><div className="nm-card-meta"><span>{metadata.difficulty}</span><span>1–2 players</span></div><p className="nj-card-progress">{habitatRecord(journal,s.id).wins>0?'✓ Specimen collected':'Specimen awaits'} · Quiz {journal.quizzes[s.id]??0}/6{journal.practice[s.id]?' · Skill practised':''}</p><div className="nm-card-actions"><button className="nf-primary" onClick={() => { setSelected(s.id);setResult(null);setStage('game'); }} aria-label={`Play ${s.title}`}><Play size={15}/> Play</button><button className="nf-button" onClick={() => setQuiz(s.id)} aria-label={`Quiz: ${s.title}`}><BookOpen size={16}/> Quiz</button></div></div>
          </article>; })}</div>
        </section>
        <footer className="nm-footer"><div><Leaf size={20}/><p>Inspired by biology. Made for play.<br/><span>Game rules are simplified or fictional. Explore source-linked field notes in every habitat.</span></p></div><div className="nm-score"><small>MATCH RECORD</small><b>{scores[0]} <span>:</span> {scores[1]}</b><button onClick={() => { setScores([0, 0]); setRound(1); }}>Reset match</button></div></footer>
      </>}
    </div>{journalOpen&&<NaturaJournal journal={journal} close={()=>setJournalOpen(false)}/>} {quiz && <FieldQuiz key={quiz} id={quiz} close={() => setQuiz(null)}/>}
  </main>;
}
