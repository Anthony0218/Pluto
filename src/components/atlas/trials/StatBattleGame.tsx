import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowUp, Crown, Layers, RotateCcw, Swords } from "lucide-react";
import { STAT_BATTLE } from "../../../games/atlas/trials/config";
import { formatCountryStat, STATS, type TrialCountry, type TrialStatId } from "../../../games/atlas/trials/countryStats";
import { advanceBattle, battleCategoryById, battlePoints, battleWinner, createBattle, MAX_BATTLE_REROLLS, playBattleCard, rerollBattleHand, type BattleLevel } from "../../../games/atlas/trials/statBattle";
import { CountryFlag, GameOverPanel, TrialShell, type TrialModeProps } from "./TrialsUI";
import { motionDelay, useRecordWhenOver, useTrialTimers } from "./useTrialTimers";

/** idle → lift (card rises) → travel (flies to the arena) → opponent (answers) → reveal (values count in) → result → idle. */
type Stage = "idle" | "lift" | "travel" | "opponent" | "reveal" | "result";
const LEVELS: Record<TrialModeProps["difficulty"], BattleLevel> = { beginner: "easy", intermediate: "normal", expert: "hard" };
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Counts a revealed stat up from zero; reduced-motion players see the final value at once. */
function CountUp({ value, statId }: { value: number; statId: TrialStatId }) {
  const [shown, setShown] = useState(() => reducedMotion() ? value : 0);
  useEffect(() => {
    if (reducedMotion()) return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 650);
      setShown(value * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{formatCountryStat(statId, statId === "neighborCount" ? Math.round(shown) : shown)}</>;
}

export function ArenaCard({ country, side, statId, value, showValue, result }: { country: TrialCountry; side: "player" | "opponent"; statId: TrialStatId; value: number; showValue: boolean; result: "winner" | "loser" | "tie" | null }) {
  return (
    <div className={`battle-arena-card is-${side} ${result ? `is-${result}` : ""}`}>
      {result === "winner" && <Crown className="battle-crown" aria-hidden />}
      <CountryFlag country={country} />
      <strong>{country.name}</strong>
      <small>{country.continent}</small>
      <span className={`battle-value ${showValue ? "is-shown" : ""}`} aria-live="polite">{showValue ? <CountUp value={value} statId={statId} /> : "?"}</span>
    </div>
  );
}

export function StatBattleGame({ pool, byId, seed, difficulty, best, onRecord, onRestart, onExit }: TrialModeProps) {
  const level = LEVELS[difficulty];
  const [battle, setBattle] = useState(() => createBattle(pool, seed, level));
  const [stage, setStage] = useState<Stage>("idle");
  const [lifted, setLifted] = useState<string | null>(null);
  const flyFrom = useRef<DOMRect | null>(null);
  const playerSlot = useRef<HTMLDivElement>(null);
  const { schedule } = useTrialTimers();
  const category = battleCategoryById(battle.categoryId);
  const outcome = battle.played, finished = battle.phase === "finished";
  const points = battlePoints(battle);
  useRecordWhenOver(finished, points, onRecord);

  // FLIP: the card appears in the arena, then animates from where it sat in the hand.
  useLayoutEffect(() => {
    const from = flyFrom.current, slot = playerSlot.current?.firstElementChild as HTMLElement | null;
    if (stage !== "travel" || !from || !slot) return;
    flyFrom.current = null;
    if (reducedMotion()) return;
    const to = slot.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
    slot.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width}) rotate(-4deg)` }, { transform: "none" }], { duration: 460, easing: "cubic-bezier(.22,.9,.24,1)" });
  }, [stage]);

  const play = (id: string, element: HTMLElement) => {
    if (stage !== "idle" || battle.phase !== "choose" || !battle.player.includes(id)) return;
    flyFrom.current = element.getBoundingClientRect();
    setLifted(id); setStage("lift");
    const lift = motionDelay(150), travel = lift + motionDelay(480), opponent = travel + motionDelay(650), reveal = opponent + 800, result = reveal + 1500;
    schedule(() => { setBattle((current) => playBattleCard(current, id, byId)); setLifted(null); setStage("travel"); }, lift);
    schedule(() => setStage("opponent"), travel);
    schedule(() => setStage("reveal"), opponent);
    schedule(() => setStage("result"), reveal);
    schedule(() => { setBattle((current) => advanceBattle(current)); setStage("idle"); }, result);
  };

  const showOpponent = outcome && ["opponent", "reveal", "result"].includes(stage);
  const showValues = stage === "reveal" || stage === "result";
  const settled = stage === "result";
  // Scores tick over only when the result is shown, not the instant the card is played.
  const pending = outcome && !settled && stage !== "idle" ? outcome.winner : null;
  const playerScore = battle.playerScore - Number(pending === "player"), opponentScore = battle.opponentScore - Number(pending === "opponent");
  const opponentCards = battle.opponent.length + Number(Boolean(outcome) && stage === "travel");
  const resultFor = (side: "player" | "opponent") => !settled || !outcome ? null : outcome.winner === "tie" ? "tie" : outcome.winner === side ? "winner" : "loser";
  const winner = battleWinner(battle);

  return (
    <TrialShell title="Stat Battle" accent="amber" roundLabel={`Round ${battle.round} · first to ${STAT_BATTLE.winTarget}`} score={points} progress={Math.max(playerScore, opponentScore) / STAT_BATTLE.winTarget * 100} onExit={onExit} wide>
      {!finished && (
        <div className="battle-table">
          <div className="battle-opponent" aria-label={`Opponent holds ${opponentCards} cards`}>
            <div className="battle-player-tag"><span>Opponent · {level}</span><Pips score={opponentScore} side="opponent" /></div>
            <div className="battle-card-backs">{Array.from({ length: opponentCards }, (_, index) => <i key={index} style={{ "--fan": index - (opponentCards - 1) / 2 } as CSSProperties} />)}</div>
          </div>

          <div className="battle-category" key={battle.round} aria-live="polite">
            <span className="battle-group">{category.group}</span>
            <strong>{category.label}</strong>
            <span className={`trial-direction is-${category.direction}`}>{category.direction === "highest" ? <ArrowUp size={15} aria-hidden /> : <ArrowDown size={15} aria-hidden />}{category.direction === "highest" ? "Higher wins" : "Lower wins"}</span>
            <small>{STATS[category.statId].source}</small>
          </div>

          <div className="battle-arena">
            <div className="battle-slot is-player" ref={playerSlot}>
              {outcome && stage !== "lift" ? <ArenaCard country={byId.get(outcome.player)!} side="player" statId={category.statId} value={outcome.playerValue} showValue={showValues} result={resultFor("player")} /> : <span className="battle-slot-empty">Your card</span>}
            </div>
            <span className="battle-vs" aria-hidden><Swords size={18} />VS</span>
            <div className="battle-slot is-opponent">
              {showOpponent ? <ArenaCard country={byId.get(outcome.opponent)!} side="opponent" statId={category.statId} value={outcome.opponentValue} showValue={showValues} result={resultFor("opponent")} /> : <span className="battle-slot-empty">{outcome ? "Opponent is choosing…" : "Opponent"}</span>}
            </div>
          </div>
          <p className={`battle-verdict ${settled && outcome ? `is-${outcome.winner}` : ""}`} role="status">
            {settled && outcome ? outcome.winner === "tie" ? "Tie — nobody scores" : `${byId.get(outcome.winner === "player" ? outcome.player : outcome.opponent)!.name} wins${outcome.winner === "player" ? " — point to you" : ""}` : stage === "idle" ? "Choose a card. Its stats stay hidden until both cards are down." : " "}
          </p>

          <div className="battle-you">
            <div className="battle-player-tag"><span>You</span><Pips score={playerScore} side="player" /><span className="battle-deck"><Layers size={14} aria-hidden /> {battle.deck.length}</span>
              <button type="button" className="battle-reroll" disabled={stage !== "idle" || battle.rerolls[0] >= MAX_BATTLE_REROLLS} onClick={() => setBattle((current) => rerollBattleHand(current, 0))} title="Replace every card in your hand"><RotateCcw size={14} aria-hidden /> Reroll all ({MAX_BATTLE_REROLLS - battle.rerolls[0]} left)</button>
            </div>
            <div className="battle-hand" role="group" aria-label="Your hand">
              {battle.player.map((id, index) => {
                const country = byId.get(id)!;
                return (
                  <button type="button" key={id} className={`battle-hand-card ${lifted === id ? "is-lifted" : ""}`} style={{ "--fan": index - (battle.player.length - 1) / 2, "--i": index } as CSSProperties}
                    disabled={stage !== "idle"} onClick={(event) => play(id, event.currentTarget)} aria-label={`Play ${country.name}`}>
                    <CountryFlag country={country} />
                    <strong>{country.name}</strong>
                    <small>{country.continent}</small>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {finished && (
        <GameOverPanel title={winner === "player" ? "Victory" : winner === "opponent" ? "Defeat" : "Draw"} subtitle={`${battle.playerScore} – ${battle.opponentScore} against the ${level} opponent`} score={points} best={best}
          stats={[{ label: "Rounds won", value: battle.playerScore }, { label: "Rounds lost", value: battle.opponentScore }, { label: "Ties", value: battle.history.filter((item) => item.winner === "tie").length }]} onRestart={onRestart} onExit={onExit}>
          <ol className="battle-history">
            {battle.history.map((item) => {
              const mine = byId.get(item.player)!, theirs = byId.get(item.opponent)!, itemCategory = battleCategoryById(item.categoryId);
              return (
                <li key={item.round} className={`is-${item.winner}`}>
                  <span className="battle-history-category">{itemCategory.label} {itemCategory.direction === "highest" ? "↑" : "↓"}</span>
                  <span><CountryFlag country={mine} />{mine.name} <b>{formatCountryStat(itemCategory.statId, item.playerValue)}</b></span>
                  <span className="battle-history-vs">vs</span>
                  <span><CountryFlag country={theirs} />{theirs.name} <b>{formatCountryStat(itemCategory.statId, item.opponentValue)}</b></span>
                  <em>{item.winner === "tie" ? "Tie" : item.winner === "player" ? "Won" : "Lost"}</em>
                </li>
              );
            })}
          </ol>
        </GameOverPanel>
      )}
    </TrialShell>
  );
}

export function Pips({ score, side }: { score: number; side: "player" | "opponent" }) {
  return <span className={`battle-pips is-${side}`} aria-label={`${score} of ${STAT_BATTLE.winTarget}`}>{Array.from({ length: STAT_BATTLE.winTarget }, (_, index) => <i key={index} className={index < score ? "is-won" : ""} />)}<b>{score}</b></span>;
}
