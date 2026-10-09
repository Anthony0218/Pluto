import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDown, ArrowUp, EyeOff, Layers, RotateCcw, Swords } from "lucide-react";
import { AtlasResultHero } from "../AtlasResultHero";
import { STAT_BATTLE } from "../../../games/atlas/trials/config";
import { formatCountryStat, STATS, type TrialCountry } from "../../../games/atlas/trials/countryStats";
import { battleView, createBattleMatch, nextBattleRound, pickBattleCard, rerollBattleMatchHand, revealBattlePicks, type BattleSeat, type SeatOutcome } from "../../../games/atlas/trials/battleMatch";
import { battleCategoryById } from "../../../games/atlas/trials/statBattle";
import { ArenaCard, Pips } from "./StatBattleGame";
import { CountryFlag, TrialShell } from "./TrialsUI";

/**
 * The card table for two people: your hand at the bottom, the other side's face-down hand on top. Used by the
 * hotseat duel and the online duel; `played` is the revealed round, from this seat's point of view.
 */
export function DuelBoard({ byId, categoryId, me, them, hand, opponentCards, deck, picked, opponentPicked, played, canPlay, onPlay, rerollsLeft, onReroll, hint }: {
  byId: Map<string, TrialCountry>; categoryId: string; me: { name: string; score: number }; them: { name: string; score: number };
  hand: string[]; opponentCards: number; deck: number; picked: string | null; opponentPicked: boolean; played: SeatOutcome | null;
  canPlay: boolean; onPlay: (cardId: string) => void; rerollsLeft?: number; onReroll?: () => void; hint?: ReactNode;
}) {
  useGameLanguage();
  const category = battleCategoryById(played?.categoryId ?? categoryId);
  const result = (side: "me" | "them") => !played ? null : played.winner === "tie" ? "tie" : played.winner === side ? "winner" : "loser";
  const pickedCountry = picked ? byId.get(picked) : null;
  return (
    <div className="battle-table">
      <div className="battle-opponent" aria-label={gameUi(`${them.name} holds ${opponentCards} cards`)}>
        <div className="battle-player-tag"><span>{them.name}</span><Pips score={them.score} side="opponent" /></div>
        <div className="battle-card-backs">{Array.from({ length: opponentCards }, (_, index) => <i key={index} style={{ "--fan": index - (opponentCards - 1) / 2 } as CSSProperties} />)}</div>
      </div>
      <div className="battle-category" key={category.id} aria-live="polite">
        <span className="battle-group">{gameUi(category.group)}</span>
        <strong>{gameUi(category.label)}</strong>
        <span className={`trial-direction is-${category.direction}`}>{category.direction === "highest" ? <ArrowUp size={15} aria-hidden /> : <ArrowDown size={15} aria-hidden />}{gameUi(category.direction === "highest" ? "Higher wins" : "Lower wins")}</span>
        <small>{gameUi(STATS[category.statId].source)}</small>
      </div>
      <div className="battle-arena">
        <div className="battle-slot is-player">
          {played ? <ArenaCard key={`me-${played.round}`} country={byId.get(played.mine)!} side="player" statId={category.statId} value={played.myValue} showValue result={result("me")} />
            : pickedCountry ? <div className="battle-arena-card is-player"><CountryFlag country={pickedCountry} /><strong>{pickedCountry.name}</strong><small>{gameUi("Face down")}</small><span className="battle-value">?</span></div>
              : <span className="battle-slot-empty">{gameUi("Your card")}</span>}
        </div>
        <span className="battle-vs" aria-hidden><Swords size={18} />{gameUi("VS")}</span>
        <div className="battle-slot is-opponent">
          {gameUi(played ? <ArenaCard key={`them-${played.round}`} country={byId.get(played.theirs)!} side="opponent" statId={category.statId} value={played.theirValue} showValue result={result("them")} />
            : opponentPicked ? <div className="battle-arena-card is-opponent battle-face-down"><EyeOff aria-hidden /><small>{gameUi("Card played")}</small></div>
              : <span className="battle-slot-empty">{them.name}{gameUi(" is choosing…")}</span>)}
        </div>
      </div>
      <p className={`battle-verdict ${played ? played.winner === "me" ? "is-player" : played.winner === "them" ? "is-opponent" : "is-tie" : ""}`} role="status">
        {gameUi(played ? played.winner === "tie" ? "Tie — nobody scores" : `${byId.get(played.winner === "me" ? played.mine : played.theirs)!.name} wins — point to ${played.winner === "me" ? me.name : them.name}` : hint ?? " ")}
      </p>
      <div className="battle-you">
        <div className="battle-player-tag"><span>{me.name}</span><Pips score={me.score} side="player" /><span className="battle-deck"><Layers size={14} aria-hidden /> {gameUi(deck)}</span>
          {onReroll && <button type="button" className="battle-reroll" disabled={!canPlay || Boolean(picked) || !rerollsLeft} onClick={onReroll} title={gameUi("Replace every card in your hand")}><RotateCcw size={14} aria-hidden />{gameUi(" Reroll all (")}{gameUi(rerollsLeft ?? 0)}{gameUi(" left)")}</button>}
        </div>
        <div className="battle-hand" role="group" aria-label={gameUi(`${me.name}'s hand`)}>
          {hand.map((id, index) => {
            const country = byId.get(id)!;
            return (
              <button type="button" key={id} className={`battle-hand-card ${picked === id ? "is-lifted" : ""}`} style={{ "--fan": index - (hand.length - 1) / 2, "--i": index } as CSSProperties}
                disabled={!canPlay || Boolean(picked)} onClick={() => onPlay(id)} aria-label={gameUi(`Play ${country.name}`)}>
                <CountryFlag country={country} />
                <strong>{gameUi(country.name)}</strong>
                <small>{gameUi(country.continent)}</small>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DuelHistory({ history, byId, names }: { history: SeatOutcome[]; byId: Map<string, TrialCountry>; names: [string, string] }) {
  useGameLanguage();
  return (
    <ol className="battle-history">
      {history.map((item) => {
        const mine = byId.get(item.mine)!, theirs = byId.get(item.theirs)!, category = battleCategoryById(item.categoryId);
        return (
          <li key={item.round} className={`is-${item.winner === "me" ? "player" : item.winner === "them" ? "opponent" : "tie"}`}>
            <span className="battle-history-category">{gameUi(category.label)} {gameUi(category.direction === "highest" ? "↑" : "↓")}</span>
            <span><CountryFlag country={mine} />{gameUi(mine.name)} <b>{gameUi(formatCountryStat(category.statId, item.myValue))}</b></span>
            <span className="battle-history-vs">{gameUi("vs")}</span>
            <span><CountryFlag country={theirs} />{gameUi(theirs.name)} <b>{gameUi(formatCountryStat(category.statId, item.theirValue))}</b></span>
            <em>{gameUi(item.winner === "tie" ? "Tie" : item.winner === "me" ? names[0] : names[1])}</em>
          </li>
        );
      })}
    </ol>
  );
}

type Stage = { kind: "handoff"; seat: BattleSeat } | { kind: "pick"; seat: BattleSeat } | { kind: "reveal" };

/**
 * Stat Battle for two people on one device. Before each pick the device is handed over behind a cover screen, so
 * each hand is only ever shown to its owner; both cards are then revealed together.
 */
export function StatBattleHotseat({ pool, byId, seed, names, onExit, onRestart, onComplete }: {
  pool: TrialCountry[]; byId: Map<string, TrialCountry>; seed: string; names: [string, string]; onExit: () => void; onRestart: () => void; onComplete?: (scores: number[]) => void;
}) {
  useGameLanguage();
  const [match, setMatch] = useState(() => createBattleMatch(pool, seed));
  const [stage, setStage] = useState<Stage>({ kind: "handoff", seat: 0 });
  const { battle } = match;
  const finished = battle.phase === "finished";
  // The seat that starts each round alternates, so neither player always picks first.
  const opener = ((battle.round - 1) % 2) as BattleSeat;
  const other = (seat: BattleSeat): BattleSeat => seat === 0 ? 1 : 0;

  const play = (seat: BattleSeat, cardId: string) => {
    const next = pickBattleCard(match, seat, cardId);
    const revealed = revealBattlePicks(next, byId);
    setMatch(revealed);
    setStage(revealed.battle.phase === "reveal" ? { kind: "reveal" } : { kind: "handoff", seat: other(seat) });
  };
  const nextRound = () => {
    const next = nextBattleRound(match);
    setMatch(next);
    if (next.battle.phase === "finished") onComplete?.([next.battle.playerScore, next.battle.opponentScore]);
    setStage({ kind: "handoff", seat: ((next.battle.round - 1) % 2) as BattleSeat });
  };

  const title = finished ? "Final" : `Round ${battle.round} · first to ${STAT_BATTLE.winTarget}`;
  const score = Math.max(battle.playerScore, battle.opponentScore);
  return (
    <TrialShell title={gameUi("Stat Battle · Hotseat")} accent="amber" roundLabel={title} progress={score / STAT_BATTLE.winTarget * 100} onExit={onExit} wide>
      <div className="duel-scoreline" aria-label={gameUi("Score")}><span className="is-player">{gameUi(names[0])} <b>{gameUi(battle.playerScore)}</b></span><span>–</span><span className="is-opponent"><b>{gameUi(battle.opponentScore)}</b> {gameUi(names[1])}</span></div>
      {gameUi(finished ? (
        <section className="trial-game-over">
          <AtlasResultHero heading="h2" eyebrow="Duel complete" title={gameUi(battle.playerScore === battle.opponentScore ? "Draw" : `${battle.playerScore > battle.opponentScore ? names[0] : names[1]} wins`)} />
          <p className="trial-final-score">{gameUi(battle.playerScore)} – {gameUi(battle.opponentScore)}</p>
          <DuelHistory history={battleView(match, 0).history} byId={byId} names={names} />
          <div className="trial-final-actions">
            {onComplete ? <button type="button" className="atlas-start" onClick={() => onComplete([battle.playerScore, battle.opponentScore])}>{gameUi("See series score")}</button> : <button type="button" className="atlas-start" onClick={onRestart}><RotateCcw size={18} />{gameUi(" Replay")}</button>}
            <button type="button" className="atlas-start atlas-secondary" onClick={onExit}>{gameUi("Back to menu")}</button>
          </div>
        </section>
      ) : stage.kind === "handoff" ? (
        <HandoffCard name={names[stage.seat]} detail={stage.seat === opener ? `Round ${battle.round}: ${battleCategoryById(battle.categoryId).label}, ${battleCategoryById(battle.categoryId).direction === "highest" ? "higher" : "lower"} wins. You pick first.` : `${names[other(stage.seat)]} has played a card face down. Your turn.`}
          action={`Show ${names[stage.seat]}'s hand`} onReady={() => setStage({ kind: "pick", seat: stage.seat })} />
      ) : stage.kind === "pick" ? (() => {
        const view = battleView(match, stage.seat);
        return <DuelBoard byId={byId} categoryId={view.categoryId} me={{ name: names[stage.seat], score: view.myScore }} them={{ name: names[other(stage.seat)], score: view.theirScore }}
          hand={view.hand} opponentCards={view.opponentCards} deck={view.deck} picked={view.picked} opponentPicked={view.opponentPicked} played={null}
          canPlay onPlay={(id) => play(stage.seat, id)} rerollsLeft={view.rerollsLeft} onReroll={() => setMatch((current) => rerollBattleMatchHand(current, stage.seat))} hint={`${names[stage.seat]}, choose a card. ${names[other(stage.seat)]} must not look!`} />;
      })() : (() => {
        const view = battleView(match, 0);
        return <>
          <DuelBoard byId={byId} categoryId={view.categoryId} me={{ name: names[0], score: view.myScore }} them={{ name: names[1], score: view.theirScore }}
            hand={[]} opponentCards={view.opponentCards} deck={view.deck} picked={null} opponentPicked={false} played={view.played} canPlay={false} onPlay={() => undefined} />
          <div className="duel-next"><button type="button" className="atlas-start" onClick={nextRound}>{gameUi(view.myScore >= STAT_BATTLE.winTarget || view.theirScore >= STAT_BATTLE.winTarget ? "See the result" : "Next round")}</button></div>
        </>;
      })())}
    </TrialShell>
  );
}

/** Full-cover "pass the device" card between hotseat turns, so nobody sees what the previous player did. */
export function HandoffCard({ name, detail, action, onReady, color }: { name: string; detail?: ReactNode; action: string; onReady: () => void; color?: string }) {
  useGameLanguage();
  return (
    <section className="atlas-handoff" style={color ? { "--player": color } as CSSProperties : undefined}>
      <span className="atlas-eyebrow">{gameUi("Pass the device")}</span>
      <h2><i />{gameUi(name)}</h2>
      {detail && <p>{gameUi(detail)}</p>}
      <button type="button" className="atlas-start" onClick={onReady} autoFocus>{gameUi(action)}</button>
    </section>
  );
}
