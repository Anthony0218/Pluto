import { useCallback, useState } from "react";
import { Bird, Bug, Fish, Waves } from "lucide-react";
import "./naturaMenu.css";
import NaturaGame from "../../../components/natura/NaturaGame";
import DidYouKnow from "../../../components/natura/DidYouKnow";
import { SCENARIOS } from "../../../games/natura/naturaData";
import type {
  GameResult,
  PlayMode,
  Player,
  Scenario,
  ScenarioId,
  Stage,
} from "../../../games/natura/naturaData";
import {
  awardPoints,
  getAnswerPoints,
} from "../../../games/natura/naturafunctions";

const menuScenarios = [
  SCENARIOS.find(scenario => scenario.id === "meadow")!,
  ...SCENARIOS.filter(scenario => scenario.id !== "meadow"),
];

function HabitatIcon({ id }: { id: ScenarioId }) {
  if (id === "meadow") return <Bird aria-hidden="true" />;
  if (["archerfish", "flyingfish"].includes(id)) return <Fish aria-hidden="true" />;
  if (["cuttlefish", "coconut"].includes(id)) return <Waves aria-hidden="true" />;
  return <Bug aria-hidden="true" />;
}

type Match = {
  stage: Stage;
  mode: PlayMode;
  selected: ScenarioId;
  round: number;
  scores: [number, number];
  result: GameResult | null;
  question: number;
  turn: Player;
  answer: number | null;
  history: string[];
  aiQuiz: string[];
};
const freshMatch = (): Match => ({
  stage: "menu",
  mode: "hotseat",
  selected: "meadow",
  round: 1,
  scores: [0, 0],
  result: null,
  question: 0,
  turn: 0,
  answer: null,
  history: [],
  aiQuiz: [],
});
const label = (player: Player, mode: PlayMode) =>
  mode === "ai" ? (player === 0 ? "You" : "AI") : `Player ${player + 1}`;

function AnimalBox({ scenario }: { scenario: Scenario }) {
  return (
    <aside className="natura-info">
      <strong>🌿 What these animals really do</strong>
      <p>{scenario.behaviour}</p>
      <a href={scenario.source.url} target="_blank" rel="noreferrer">
        Learn more: {scenario.source.label} ↗
      </a>
    </aside>
  );
}
function RulesBox({ scenario, mode }: { scenario: Scenario; mode: PlayMode }) {
  return (
    <aside className="natura-info natura-rules">
      <strong>
        How to play · {mode === "ai" ? "Vs AI" : "Local two players"}
      </strong>
      <ol>
        {scenario.rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ol>
      <p>
        <b>Natura score:</b> Win +3; draw +0. Then three questions per player:
        correct +1, wrong −1. Scores can go below zero.
      </p>
      {mode === "ai" && (
        <p>
          The AI plays the second side and takes a simulated quiz with a 70%
          chance of a correct answer per question.
        </p>
      )}
      <small>{scenario.abstraction}</small>
    </aside>
  );
}

/** Import this page in Pluto's existing router. No new dependencies are required. */
export default function NaturaMenu() {
  const [match, setMatch] = useState<Match>(freshMatch);
  const [gameRulesOpen, setGameRulesOpen] = useState(false);
  const scenario = SCENARIOS.find((s) => s.id === match.selected)!;
  const q = scenario.questions[match.question + (match.turn === 1 ? 3 : 0)];
  const finishGame = useCallback((result: GameResult) => {
    // Generate outside the React state updater so StrictMode cannot reroll it.
    const aiAnswers = Array.from({ length: 3 }, () => Math.random() < 0.7);
    setMatch((prev) => {
      if (prev.stage !== "game") return prev; // Accept only one result per round.
      const gameScores =
        result.winner === null
          ? prev.scores
          : awardPoints(prev.scores, result.winner, 3);
      const aiPoints =
        prev.mode === "ai"
          ? aiAnswers.reduce((sum, right) => sum + (right ? 1 : -1), 0)
          : 0;
      return {
        ...prev,
        stage: "quiz",
        result,
        scores: awardPoints(gameScores, 1, aiPoints),
        question: 0,
        turn: 0,
        answer: null,
        history: [
          ...prev.history,
          `Round ${prev.round}: ${result.winner === null ? "Draw (+0)" : `${label(result.winner, prev.mode)} wins (+3)`}. ${result.detail}`,
        ],
        aiQuiz:
          prev.mode === "ai"
            ? aiAnswers.map(
                (right, i) =>
                  `AI question ${i + 1}: ${right ? "correct (+1)" : "wrong (−1)"}`,
              )
            : [],
      };
    });
  }, []);
  const answer = (index: number) =>
    setMatch((prev) => {
      if (prev.stage !== "quiz" || prev.answer !== null) return prev;
      const current = SCENARIOS.find((s) => s.id === prev.selected)!.questions[
        prev.question + (prev.turn === 1 ? 3 : 0)
      ];
      const points = getAnswerPoints(index, current.correct);
      return {
        ...prev,
        answer: index,
        scores: awardPoints(prev.scores, prev.turn, points),
        history: [
          ...prev.history,
          `${label(prev.turn, prev.mode)} · question ${prev.question + 1}: ${points > 0 ? "correct (+1)" : "wrong (−1)"}`,
        ],
      };
    });
  const nextQuestion = () =>
    setMatch((prev) => {
      if (prev.stage !== "quiz" || prev.answer === null) return prev;
      if (prev.mode === "hotseat" && prev.turn === 0)
        return { ...prev, turn: 1, answer: null };
      if (prev.question < 2)
        return { ...prev, question: prev.question + 1, turn: 0, answer: null };
      return {
        ...prev,
        stage: "results",
        answer: null,
        history: [...prev.history, ...prev.aiQuiz],
      };
    });
  const select = (id: ScenarioId) =>
    setMatch((prev) => ({ ...prev, selected: id }));
  const begin = () => setMatch((prev) => ({ ...prev, stage: "briefing" }));
  const nextRound = (repeat: boolean) =>
    setMatch((prev) => ({
      ...prev,
      stage: repeat ? "briefing" : "menu",
      round: prev.round + 1,
      result: null,
      question: 0,
      turn: 0,
      answer: null,
      aiQuiz: [],
    }));
  const meadowRole =
    match.round % 2 === 1 ? "kestrel (WASD + Space)" : "vole (arrows + Enter)";
  return (
    <div className="natura natura-experience">
      <style>{NATURA_CSS}</style>
      <div className="natura-shell">
        <header className="natura-header">
          <div>
            <span className="natura-mark">✺</span> NATURA{" "}
            <small>PLUTO · PLAY & DISCOVER</small>
          </div>
          <button onClick={() => setMatch(freshMatch())}>New match</button>
        </header>
        <div className="natura-score" aria-label="Natura match scores">
          <span>
            {label(0, match.mode)} <b>{match.scores[0]}</b>
          </span>
          <span>ROUND {match.round}</span>
          <span>
            {label(1, match.mode)} <b>{match.scores[1]}</b>
          </span>
        </div>
        {match.stage === "menu" && (
          <main className="natura-panel natura-menu-panel">
            <section className="natura-menu-hero" aria-labelledby="natura-menu-title">
              <div className="natura-menu-hero__copy">
                <p className="natura-eyebrow">FIELD NOTES / VOL. 01</p>
                <h1 id="natura-menu-title">The wild is full of tactics.</h1>
                <p>Observe real animal behaviour. Choose a habitat. Then play the experiment.</p>
                <div className="natura-menu-hero__meta"><span>{SCENARIOS.length} living worlds</span><span>Play · Learn · Discover</span></div>
              </div>
            </section>
            <div className="natura-menu-content">
              <div className="natura-menu-heading"><div><p className="natura-eyebrow">01 / CHOOSE A HABITAT</p><h2>Explore the field guide</h2></div><span>SELECT A SPECIMEN TO PREVIEW</span></div>
              <div className="natura-menu-grid">
                <div className="natura-cards" aria-label="Habitats">
                  {menuScenarios.map((s, index) => (
                    <button key={s.id} type="button" aria-pressed={match.selected === s.id} className={match.selected === s.id ? "selected" : ""} onClick={() => select(s.id)}>
                      <span className="natura-card-number">{String(index + 1).padStart(2, "0")}</span>
                      <span className="natura-card-icon"><HabitatIcon id={s.id} /></span>
                      <span className="natura-card-copy"><strong>{s.title}</strong><span>{s.setting}</span></span>
                      <span className="natura-card-arrow" aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
                <aside className="natura-spotlight" aria-label={`${scenario.title} field notes`}>
                  <div className="natura-spotlight-top"><span>SPECIMEN / {String(menuScenarios.findIndex(s => s.id === scenario.id) + 1).padStart(2, "0")}</span><span>● LIVE STUDY</span></div>
                  <div className="natura-spotlight-icon"><HabitatIcon id={scenario.id} /></div>
                  <p className="natura-eyebrow">{scenario.setting}</p>
                  <h2>{scenario.title}</h2>
                  <p className="natura-spotlight-behaviour">{scenario.behaviour}</p>
                  <a href={scenario.source.url} target="_blank" rel="noreferrer">Field source: {scenario.source.label} ↗</a>
                  <DidYouKnow key={scenario.id} scenario={scenario.id} />
                  <div className="natura-spotlight-opponents"><p className="natura-eyebrow">02 / CHOOSE YOUR OPPONENT</p><div className="natura-options">
                    <button type="button" disabled={match.round > 1} aria-pressed={match.mode === "hotseat"} className={match.mode === "hotseat" ? "active" : ""} onClick={() => setMatch(prev => ({ ...prev, mode: "hotseat" }))}>Local two players<small>One device · shared adventure</small></button>
                    <button type="button" disabled={match.round > 1} aria-pressed={match.mode === "ai"} className={match.mode === "ai" ? "active" : ""} onClick={() => setMatch(prev => ({ ...prev, mode: "ai" }))}>Vs AI<small>Play against the computer</small></button>
                  </div>{match.round > 1 && <p className="natura-note">Start a new match to change opponents.</p>}</div>
                  <button type="button" className="natura-primary" onClick={begin}>Read rules & play {scenario.title} <span aria-hidden="true">→</span></button>
                </aside>
              </div>
            </div>
          </main>
        )}
        {match.stage === "briefing" && (
          <main className="natura-panel">
            <p className="natura-eyebrow">
              BEFORE YOU PLAY · ROUND {match.round}
            </p>
            <h1>
              {scenario.icon} {scenario.title}
            </h1>
            <AnimalBox scenario={scenario} />
            <RulesBox scenario={scenario} mode={match.mode} />
            <DidYouKnow key={scenario.id} scenario={scenario.id} />
            {scenario.id === "meadow" && (
              <p>
                <b>{label(0, match.mode)}:</b>{" "}
                {match.mode === "ai"
                  ? `${match.round % 2 === 1 ? "kestrel" : "vole"} (WASD + Space)`
                  : meadowRole}
                .{" "}
                {match.mode === "hotseat" &&
                  `Player 2: ${match.round % 2 === 1 ? "vole (arrows + Enter)" : "kestrel (WASD + Space)"}.`}
              </p>
            )}
            <button
              className="natura-primary"
              onClick={() => {
                setGameRulesOpen(false);
                setMatch((prev) => ({ ...prev, stage: "game" }));
              }}
            >
              Ready — start game →
            </button>
            <button
              className="natura-secondary"
              onClick={() => setMatch((prev) => ({ ...prev, stage: "menu" }))}
            >
              ← Change scenario
            </button>
          </main>
        )}
        {match.stage === "game" && (
          <main>
            <details
              className="natura-game-help"
              onToggle={(event) => setGameRulesOpen(event.currentTarget.open)}
            >
              <summary>Animal behaviour & rules</summary>
              <AnimalBox scenario={scenario} />
              <RulesBox scenario={scenario} mode={match.mode} />
            </details>
            <NaturaGame
              key={`${match.selected}-${match.round}`}
              scenario={match.selected}
              mode={match.mode}
              round={match.round}
              rulesOpen={gameRulesOpen}
              onComplete={finishGame}
            />
            {![
              "trapjaw",
              "cuttlefish",
              "flyingfish",
              "bolas",
              "coconut",
            ].includes(scenario.id) && (
              <DidYouKnow key={scenario.id} scenario={scenario.id} />
            )}
          </main>
        )}
        {match.stage === "quiz" && (
          <main className="natura-panel natura-quiz">
            <p className="natura-eyebrow">{scenario.title} · FIELD QUIZ</p>
            <h1>
              {match.result?.winner === null
                ? "A draw in the wild."
                : `${label(match.result!.winner!, match.mode)} won!`}
            </h1>
            <p>
              {match.result?.winner === null
                ? "No win bonus this round."
                : "The winner earned 3 Natura points."}{" "}
              Now discover why these animals behave this way.
            </p>
            <p>
              <b>{label(match.turn, match.mode)}</b> · Question{" "}
              {match.question + 1} of 3
            </p>
            <h2>{q.text}</h2>
            <div className="natura-answers">
              {q.answers.map((option, i) => (
                <button
                  key={option}
                  disabled={match.answer !== null}
                  className={
                    match.answer !== null && i === q.correct
                      ? "correct"
                      : match.answer === i
                        ? "incorrect"
                        : ""
                  }
                  onClick={() => answer(i)}
                >
                  {option}
                </button>
              ))}
            </div>
            {match.answer !== null && (
              <div className="natura-feedback" role="status">
                <p>
                  <b>
                    {match.answer === q.correct
                      ? "+1 point. Correct!"
                      : "−1 point. Not quite."}
                  </b>{" "}
                  {q.explanation}
                </p>
                <button className="natura-primary" onClick={nextQuestion}>
                  {match.mode === "hotseat" && match.turn === 0
                    ? "Player 2's question"
                    : match.question < 2
                      ? "Next question"
                      : "View round results"}{" "}
                  →
                </button>
              </div>
            )}
          </main>
        )}
        {match.stage === "results" && (
          <main className="natura-panel">
            <p className="natura-eyebrow">ROUND {match.round} COMPLETE</p>
            <h1>
              {match.scores[0] === match.scores[1]
                ? "All square."
                : `${label(match.scores[0] > match.scores[1] ? 0 : 1, match.mode)} leads.`}
            </h1>
            <p>
              Natura score:{" "}
              <b>
                {match.scores[0]} – {match.scores[1]}
              </b>
            </p>
            {match.aiQuiz.length > 0 && (
              <aside className="natura-info">
                <strong>AI quiz results</strong>
                {match.aiQuiz.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </aside>
            )}
            <AnimalBox scenario={scenario} />
            <DidYouKnow key={scenario.id} scenario={scenario.id} />
            <details>
              <summary>Match scoring history</summary>
              <ul>
                {match.history.map((entry, i) => (
                  <li key={i}>{entry}</li>
                ))}
              </ul>
            </details>
            <div className="natura-options">
              <button
                className="natura-primary"
                onClick={() => nextRound(false)}
              >
                Choose next scenario →
              </button>
              <button onClick={() => nextRound(true)}>
                Replay this scenario
              </button>
            </div>
            <button
              className="natura-secondary"
              onClick={() => setMatch(freshMatch())}
            >
              Finish match & reset scores
            </button>
          </main>
        )}
        <footer className="natura-footer">
          Real behaviours. Playful models. Stay curious.
        </footer>
      </div>
    </div>
  );
}

const NATURA_CSS = `
.natura{min-height:100vh;background:#e8e5da;color:#193b3b;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.natura *{box-sizing:border-box}.natura button{font:inherit;cursor:pointer}.natura-shell{max-width:1200px;margin:auto;padding:0 24px 48px}.natura-header{display:flex;align-items:center;justify-content:space-between;padding:22px 0;border-bottom:1px solid #b7c7bb;font-weight:800;letter-spacing:.12em}.natura-mark{font-size:25px;color:#c56a42}.natura-header small{font-size:10px;color:#69837a;margin-left:12px}.natura-header button,.natura-back{background:none;border:0;text-decoration:underline;color:#365d56}.natura-score{display:flex;justify-content:center;gap:22px;align-items:center;padding:18px 0;font-size:13px;font-weight:700}.natura-score b{font-size:24px;margin-left:8px;color:#bd653d}.natura-panel{max-width:850px;margin:35px auto;background:#f5f0e4;padding:clamp(22px,5vw,55px);box-shadow:0 15px 50px #2f51421a}.natura-eyebrow{letter-spacing:.17em;color:#be6840;font-weight:800;font-size:11px}.natura h1{font:normal clamp(38px,6vw,65px) Georgia,serif;letter-spacing:-.05em;margin:12px 0}.natura-panel>p:not(.natura-eyebrow){line-height:1.6;color:#60736b}.natura h2{font:normal 29px Georgia,serif;margin:30px 0 16px}.natura-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:30px 0}.natura-cards button,.natura-options button,.natura-answers button{border:1px solid #becdc0;background:#fffaf0;text-align:left;padding:17px;color:#234944}.natura-cards button{min-height:150px;display:flex;flex-direction:column;gap:12px}.natura-cards strong{font-size:18px}.natura-cards span,.natura-options small{font-size:12px;color:#73877d}.natura-cards small{margin-top:auto;color:#b3633e;font-size:10px;font-weight:800;letter-spacing:.12em}.natura button:disabled{opacity:.5;cursor:not-allowed}.natura-cards .selected,.natura-options .active{border:2px solid #c26c46;background:#fffbf1}.natura-options{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.natura-options button{flex:1;min-width:160px;font-weight:700}.natura-options small{display:block;margin-top:8px;font-weight:400}.natura-primary{display:block;background:#c66b42;color:#fff;border:0;padding:15px 20px;margin-top:25px;font-weight:800;letter-spacing:.05em}.natura-secondary{background:none;border:0;text-decoration:underline;color:#315f55;margin-top:15px}.natura-game .nd-page{min-height:0}.natura-game .nd-top{display:none}.natura-game .nd-shell{padding-bottom:20px}.natura-back{padding:12px 0}.natura-quiz{max-width:680px}.natura-answers{display:grid;gap:10px}.natura-answers button{width:100%;font-weight:700}.natura-answers .correct{border-color:#308164;background:#e3f3e6}.natura-answers .incorrect{border-color:#b74d4d;background:#f7e3dd}.natura-feedback{margin-top:20px;line-height:1.5}.natura details{margin-top:25px}.natura li{margin:8px 0}@media(max-width:640px){.natura-shell{padding:0 12px 30px}.natura-cards{grid-template-columns:1fr}.natura-cards button{min-height:90px}.natura-header small{display:none}.natura-score{gap:10px;font-size:11px}.natura-score b{font-size:19px}.natura-game .nd-shell{padding:0 8px}}

.natura-info{margin:18px 0;padding:18px 20px;background:#e5ecdf;border:1px solid #becbb8;border-radius:10px;font-size:14px;line-height:1.6}.natura-info>strong{color:#315c42}.natura-info p{margin:8px 0}.natura-info a{font-size:12px;color:#315e52}.natura-rules{background:#f4e9d3;border-color:#ddc9a9}.natura-rules ol{padding-left:20px;margin:10px 0}.natura-rules li{margin:8px 0}.natura-rules small{display:block;color:#715f49;border-top:1px solid #ddc9a9;padding-top:10px}.natura-game-help{max-width:850px;margin:10px auto;padding:12px 20px;background:#f4f0e3;border-radius:8px}.natura summary{cursor:pointer;font-weight:700}.natura-footer{padding:25px;text-align:center;color:#61796b;font-size:12px}.natura-note{font-size:12px}.natura-panel{border-radius:16px}.natura-cards button{border-radius:10px}.natura-options button,.natura-primary,.natura-answers button{border-radius:7px}.natura .natura-options .natura-primary{background:#c66b42;color:white;margin-top:0}.natura-feedback{padding:4px 16px 16px;border-left:3px solid #b86b41;background:#eee9db}
`;
