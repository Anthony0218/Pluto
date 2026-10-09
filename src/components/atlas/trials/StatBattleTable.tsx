import { useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDown, ArrowUp, EyeOff, Layers, RotateCcw } from "lucide-react";
import { AtlasResultHero } from "../AtlasResultHero";
import { PLAYER_COLORS } from "../../../games/atlas/soloSettings";
import { STAT_BATTLE } from "../../../games/atlas/trials/config";
import { formatCountryStat, STATS, type TrialCountry } from "../../../games/atlas/trials/countryStats";
import { createBattleTable, nextTableRound, pickTableCard, rerollTableHand, revealTablePicks, tableView, type TableOutcome, type TableView } from "../../../games/atlas/trials/battleTable";
import { battleCategoryById } from "../../../games/atlas/trials/statBattle";
import { HandoffCard } from "./StatBattleDuel";
import { ArenaCard, Pips } from "./StatBattleGame";
import { CountryFlag, TrialShell } from "./TrialsUI";

const playerStyle = (seat: number) => ({ "--player": PLAYER_COLORS[seat] } as CSSProperties);
/** Seats holding the best value of a round: one winner, or everyone who shares a tie. */
function leaders(outcome: TableOutcome) {
  const best = battleCategoryById(outcome.categoryId).direction === "highest" ? Math.max(...outcome.values) : Math.min(...outcome.values);
  return outcome.values.flatMap((value, seat) => value === best ? [seat] : []);
}

export function TableScoreline({ names, scores }: { names: string[]; scores: number[] }) {
  return <div className="duel-scoreline is-table" aria-label="Score">{names.map((name, seat) => <span key={seat} style={playerStyle(seat)}><i />{name} <b>{scores[seat]}</b></span>)}</div>;
}

/**
 * The card table for three or four: the other players on top, one slot per player in the middle and this seat's
 * hand at the bottom. `view.played` is the revealed round; with `spectate` nobody's hand is shown (hotseat reveal).
 */
export function TableBoard({ byId, view, names, canPlay, onPlay, onReroll, hint, spectate = false }: {
  byId: Map<string, TrialCountry>; view: TableView; names: string[]; canPlay: boolean; onPlay: (cardId: string) => void; onReroll?: () => void; hint?: ReactNode; spectate?: boolean;
}) {
  const { played, seat: me } = view;
  const category = battleCategoryById(played?.categoryId ?? view.categoryId);
  const best = played ? leaders(played) : [];
  const pickedCountry = view.picked ? byId.get(view.picked) : null;
  return (
    <div className="battle-table is-table" style={{ "--seats": names.length } as CSSProperties}>
      <div className="battle-rivals">
        {names.map((name, seat) => (spectate || seat !== me) && <div className="battle-player-tag" key={seat} style={playerStyle(seat)} aria-label={`${name} holds ${view.handSizes[seat]} cards`}><span className="battle-seat-name"><i />{name}</span><Pips score={view.scores[seat]} side="opponent" /></div>)}
      </div>
      <div className="battle-category" key={category.id} aria-live="polite">
        <span className="battle-group">{category.group}</span>
        <strong>{category.label}</strong>
        <span className={`trial-direction is-${category.direction}`}>{category.direction === "highest" ? <ArrowUp size={15} aria-hidden /> : <ArrowDown size={15} aria-hidden />}{category.direction === "highest" ? "Higher wins" : "Lower wins"}</span>
        <small>{STATS[category.statId].source}</small>
      </div>
      <div className="battle-arena is-table">
        {names.map((name, seat) => (
          <div className="battle-slot" key={seat} style={playerStyle(seat)}>
            <span className="battle-seat-name"><i />{name}</span>
            {played ? <ArenaCard key={`${seat}-${played.round}`} country={byId.get(played.cards[seat])!} side={seat === me && !spectate ? "player" : "opponent"} statId={category.statId} value={played.values[seat]} showValue result={played.winner === seat ? "winner" : played.winner === null && best.includes(seat) ? "tie" : "loser"} />
              : seat === me && pickedCountry && !spectate ? <div className="battle-arena-card is-player"><CountryFlag country={pickedCountry} /><strong>{pickedCountry.name}</strong><small>Face down</small><span className="battle-value">?</span></div>
                : view.pickedSeats[seat] ? <div className="battle-arena-card is-opponent battle-face-down"><EyeOff aria-hidden /><small>Card played</small></div>
                  : <span className="battle-slot-empty">{seat === me && !spectate ? "Your card" : "Choosing…"}</span>}
          </div>
        ))}
      </div>
      <p className={`battle-verdict ${played ? played.winner === null ? "is-tie" : played.winner === me && !spectate ? "is-player" : "is-opponent" : ""}`} role="status">
        {played ? played.winner === null ? `Tie between ${best.map((seat) => names[seat]).join(" & ")} — nobody scores` : `${byId.get(played.cards[played.winner])!.name} wins — point to ${names[played.winner]}` : hint ?? " "}
      </p>
      {!spectate && <div className="battle-you">
        <div className="battle-player-tag" style={playerStyle(me)}><span className="battle-seat-name"><i />{names[me]}</span><Pips score={view.scores[me]} side="player" /><span className="battle-deck"><Layers size={14} aria-hidden /> {view.deck}</span>
          {onReroll && <button type="button" className="battle-reroll" disabled={!canPlay || Boolean(view.picked) || !view.rerollsLeft} onClick={onReroll} title="Replace every card in your hand"><RotateCcw size={14} aria-hidden /> Reroll all ({view.rerollsLeft} left)</button>}
        </div>
        <div className="battle-hand" role="group" aria-label={`${names[me]}'s hand`}>
          {view.hand.map((id, index) => {
            const country = byId.get(id)!;
            return (
              <button type="button" key={id} className={`battle-hand-card ${view.picked === id ? "is-lifted" : ""}`} style={{ "--fan": index - (view.hand.length - 1) / 2, "--i": index } as CSSProperties}
                disabled={!canPlay || Boolean(view.picked)} onClick={() => onPlay(id)} aria-label={`Play ${country.name}`}>
                <CountryFlag country={country} />
                <strong>{country.name}</strong>
                <small>{country.continent}</small>
              </button>
            );
          })}
        </div>
      </div>}
    </div>
  );
}

export function TableHistory({ history, byId, names }: { history: TableOutcome[]; byId: Map<string, TrialCountry>; names: string[] }) {
  return (
    <ol className="battle-history is-table">
      {history.map((item) => {
        const category = battleCategoryById(item.categoryId);
        return (
          <li key={item.round} className={item.winner === null ? "is-tie" : "is-player"}>
            <span className="battle-history-category">{category.label} {category.direction === "highest" ? "↑" : "↓"}</span>
            <span className="battle-history-cards">{item.cards.map((card, seat) => { const country = byId.get(card)!; return <span key={seat} className={item.winner === seat ? "is-best" : ""} title={names[seat]}><CountryFlag country={country} />{country.name} <b>{formatCountryStat(category.statId, item.values[seat])}</b></span>; })}</span>
            <em>{item.winner === null ? "Tie" : names[item.winner]}</em>
          </li>
        );
      })}
    </ol>
  );
}

type Stage = { kind: "handoff"; seat: number } | { kind: "pick"; seat: number } | { kind: "reveal" };

/**
 * Stat Battle for three or four people on one device. Before each pick the device is handed over behind a cover
 * screen, so each hand is only ever shown to its owner; all cards are then revealed together.
 */
export function StatBattleTableHotseat({ pool, byId, seed, names, onExit, onRestart, onComplete }: {
  pool: TrialCountry[]; byId: Map<string, TrialCountry>; seed: string; names: string[]; onExit: () => void; onRestart: () => void; onComplete?: (scores: number[]) => void;
}) {
  const seats = names.length;
  const [table, setTable] = useState(() => createBattleTable(pool, seed, seats));
  const [stage, setStage] = useState<Stage>({ kind: "handoff", seat: 0 });
  const finished = table.phase === "finished";
  // The seat that starts each round rotates, so nobody always picks first.
  const opener = (round: number) => (round - 1) % seats;
  const category = battleCategoryById(table.categoryId);

  const play = (seat: number, cardId: string) => {
    const revealed = revealTablePicks(pickTableCard(table, seat, cardId), byId);
    setTable(revealed);
    setStage(revealed.phase === "reveal" ? { kind: "reveal" } : { kind: "handoff", seat: (seat + 1) % seats });
  };
  const nextRound = () => {
    const next = nextTableRound(table);
    setTable(next);
    if (next.phase === "finished") onComplete?.(next.scores);
    setStage({ kind: "handoff", seat: opener(next.round) });
  };
  const top = Math.max(...table.scores), winners = table.scores.flatMap((score, seat) => score === top ? [seat] : []);
  return (
    <TrialShell title="Stat Battle · Hotseat" accent="amber" roundLabel={finished ? "Final" : `Round ${table.round} · first to ${STAT_BATTLE.winTarget}`} progress={top / STAT_BATTLE.winTarget * 100} onExit={onExit} wide>
      <TableScoreline names={names} scores={table.scores} />
      {finished ? (
        <section className="trial-game-over">
          <AtlasResultHero heading="h2" eyebrow="Battle complete" title={winners.length > 1 ? "Draw" : `${names[winners[0]]} wins`} />
          <p className="trial-final-score">{table.scores.join(" – ")}</p>
          <TableHistory history={table.history} byId={byId} names={names} />
          <div className="trial-final-actions">
            {onComplete ? <button type="button" className="atlas-start" onClick={() => onComplete(table.scores)}>See series score</button> : <button type="button" className="atlas-start" onClick={onRestart}><RotateCcw size={18} /> Replay</button>}
            <button type="button" className="atlas-start atlas-secondary" onClick={onExit}>Back to menu</button>
          </div>
        </section>
      ) : stage.kind === "handoff" ? (() => {
        const waiting = table.picks.filter(Boolean).length;
        return <HandoffCard name={names[stage.seat]} color={PLAYER_COLORS[stage.seat]} action={`Show ${names[stage.seat]}'s hand`} onReady={() => setStage({ kind: "pick", seat: stage.seat })}
          detail={`Round ${table.round}: ${category.label}, ${category.direction === "highest" ? "higher" : "lower"} wins. ${waiting ? `${waiting} card${waiting === 1 ? " is" : "s are"} already face down.` : "You pick first."}`} />;
      })() : stage.kind === "pick" ? (
        <TableBoard byId={byId} view={tableView(table, stage.seat)} names={names} canPlay onPlay={(id) => play(stage.seat, id)}
          onReroll={() => setTable((current) => rerollTableHand(current, stage.seat))} hint={`${names[stage.seat]}, choose a card. Everyone else must not look!`} />
      ) : <>
        <TableBoard byId={byId} view={tableView(table, 0)} names={names} canPlay={false} onPlay={() => undefined} spectate />
        <div className="duel-next"><button type="button" className="atlas-start" onClick={nextRound}>{table.scores.some((score) => score >= STAT_BATTLE.winTarget) ? "See the result" : "Next round"}</button></div>
      </>}
    </TrialShell>
  );
}
