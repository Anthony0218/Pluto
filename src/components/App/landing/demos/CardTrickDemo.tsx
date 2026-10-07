import { useEffect, useMemo, useState, type CSSProperties } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { RotateCcw } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useCopy, type CopyKey } from "../copy";
import type { ToneName } from "../tones";
import DemoFrame from "./DemoFrame";
import { cardId, chooseAiCard, legalCards, RANK_NAMES, schafkopfGame, SUIT_NAMES, SUIT_SYMBOLS, trickWinner, wattenGame, type Card, type DemoGame, type Play } from "./cardTrickEngine";

type Place = "bottom" | "left" | "top" | "right";
const seatPlaces: Record<number, Place[]> = { 3: ["bottom", "left", "right"], 4: ["bottom", "left", "top", "right"] };
const games = {
  watten: { game: wattenGame, tone: "watten" as ToneName, title: "Watten", href: "/games/watten", action: "playWatten" as CopyKey, rules: "wattenRules" as CopyKey },
  schafkopf: { game: schafkopfGame, tone: "schafkopf" as ToneName, title: "Schafkopf", href: "/games/schafkopf", action: "playSchafkopf" as CopyKey, rules: "schafkopfRules" as CopyKey },
};
// Each table uses the card faces of the real game: Watten its Bavarian deck, Schafkopf the Bayerisches Blatt.
const cardFaces = { watten: "/images/bavarian", schafkopf: "/images/schafkopf/bayerisches-blatt" };
// The three regulars of the real Schafkopf table. You are the Spieler; the partner sits across.
const stammtisch = [
  null,
  { name: "KI Sepp", portrait: "bavarian", role: "Gegenspieler", said: "Weiter." },
  { name: "KI Resi", portrait: "dirndl", role: "Mitspielerin", said: "Weiter." },
  { name: "KI Franz", portrait: "plaid", role: "Gegenspieler", said: "Weiter." },
] as const;
const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
const cardName = (item: Card) => `${SUIT_NAMES[item.suit]} ${RANK_NAMES[item.rank]}`;

type Round = { hands: Card[][]; plays: Play[]; leader: number; taken: number[]; points: number[]; trick: number };
const fresh = (game: DemoGame): Round => ({ hands: game.hands.map(hand => [...hand]), plays: [], leader: 0, taken: game.hands.map(() => 0), points: game.hands.map(() => 0), trick: 0 });

/** A playable trick-taking round, laid out like the real table of each game: you are at the bottom, the others answer by the rules. */
export default function CardTrickDemo({ id }: { id: keyof typeof games }) {
  useUiLanguage();
  const text = useCopy();
  const { game, tone, title, href, action, rules } = games[id];
  const [round, setRound] = useState(() => fresh(game));
  const places = seatPlaces[game.seats];
  const total = game.hands[0].length;
  const toPlay = round.plays.length < game.seats ? (round.leader + round.plays.length) % game.seats : null;
  // Watten is you against the other two: three tricks on either side end the round.
  const theirTricks = round.taken.slice(1).reduce((sum, count) => sum + count, 0);
  const decided = game.tricksToWin !== undefined && (round.taken[0] >= game.tricksToWin || theirTricks >= game.tricksToWin);
  const finished = round.trick >= total || decided;
  const myTurn = toPlay === 0 && !finished;
  const mine = useMemo(() => legalCards(round.hands[0], round.plays, game.rules, round.trick), [round.hands, round.plays, round.trick, game.rules]);

  const play = (seat: number, chosen: Card) => setRound(current => {
    if (current.plays.length >= game.seats || (current.leader + current.plays.length) % game.seats !== seat) return current;
    const hands = current.hands.map((hand, index) => index === seat ? hand.filter(item => cardId(item) !== cardId(chosen)) : hand);
    return { ...current, hands, plays: [...current.plays, { seat, card: chosen }] };
  });

  // Computer seats answer after a short think; a finished trick is shown for a moment, then swept away.
  useEffect(() => {
    if (finished) return;
    if (toPlay !== null && toPlay !== 0) {
      const timer = window.setTimeout(() => play(toPlay, chooseAiCard(round.hands[toPlay], round.plays, game.rules, round.trick)), 750);
      return () => window.clearTimeout(timer);
    }
    if (toPlay === null) {
      const winner = trickWinner(round.plays, game.rules);
      const timer = window.setTimeout(() => setRound(current => ({
        ...current, plays: [], leader: winner, trick: current.trick + 1,
        taken: current.taken.map((count, seat) => count + (seat === winner ? 1 : 0)),
        points: current.points.map((sum, seat) => sum + (seat === winner ? current.plays.reduce((sumOfTrick, item) => sumOfTrick + game.rules.points(item.card), 0) : 0)),
      })), 1500);
      return () => window.clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `play` only uses state setters and constants
  }, [toPlay, round.plays.length, finished, round.trick]);

  const seatName = (seat: number) => seat === 0 ? ui("You") : id === "watten" ? `${ui("Bot")} ${seat}` : stammtisch[seat]!.name;
  const resolved = toPlay === null && !finished ? trickWinner(round.plays, game.rules) : null;
  const teamPoints = round.points[0] + round.points[2];
  const message = finished
    ? id === "schafkopf" ? fill(text("cardDonePoints"), { points: teamPoints })
      : decided ? text(round.taken[0] >= game.tricksToWin! ? "cardRoundWon" : "cardRoundLost") : fill(text("cardDoneTricks"), { tricks: round.taken[0] })
    : resolved !== null ? fill(text(resolved === 0 ? "cardTrickYou" : "cardTrickOther"), { name: seatName(resolved) })
    : myTurn ? text("cardYourTurn") : text("cardWaiting");
  const face = (item: Card) => `${cardFaces[id]}/${cardId(item)}.png`;

  const trick = <AnimatePresence>
    {round.plays.map(item => <m.figure key={cardId(item.card)} className={`card-played card-played--${places[item.seat]}${resolved === item.seat ? " card-played--winner" : ""}`}
      initial={{ opacity: 0, scale: 0.8, y: places[item.seat] === "bottom" ? 40 : -24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
      <img src={face(item.card)} alt={cardName(item.card)} draggable={false} />
      {id === "watten" && <figcaption>{seatName(item.seat)}</figcaption>}
    </m.figure>)}
  </AnimatePresence>;
  const hand = round.hands[0].map((item, position) => {
    const allowed = myTurn && mine.some(option => cardId(option) === cardId(item));
    const spread = position - (round.hands[0].length - 1) / 2;
    return <button key={cardId(item)} type="button" className="card-hand-card" style={{ "--fan": spread } as CSSProperties} disabled={!allowed} onClick={() => play(0, item)} aria-label={cardName(item)}>
      <img src={face(item)} alt="" loading="lazy" draggable={false} />
    </button>;
  });

  return <DemoFrame tone={tone} title={ui(title)} href={href} action={text(action)}>
    {id === "watten" ? <div className="wt-table">
      <div className="wt-status">
        <span>{ui("Round")} 1</span>
        <strong><small>{ui("Trumpf")}</small>{SUIT_SYMBOLS[game.trump]} {SUIT_NAMES[game.trump]}</strong>
        <strong><small>Schlag</small>{RANK_NAMES[game.schlag!]}</strong>
        <span>{ui("Round value")}: 2</span>
      </div>
      {places.slice(1).map((place, offset) => {
        const seat = offset + 1;
        return <div key={place} className={`wt-seat wt-seat--${place}${toPlay === seat && !finished ? " is-active" : ""}`}>
          <strong>{seatName(seat)}</strong>
          <span>{ui("Opponent")} · {round.taken[seat]} {ui("Tricks")}</span>
          <div className="wt-backs" role="img" aria-label={`${round.hands[seat].length} ${ui("Cards")}`}>{round.hands[seat].map((_, position) => <i key={position} />)}</div>
        </div>;
      })}
      <div className="wt-trick" aria-live="polite">
        {round.plays.length ? trick : <p>{finished ? message : ui("Waiting for the first card")}</p>}
      </div>
      <div className="wt-hand">
        <p className={myTurn ? "is-active" : ""}><strong>{ui("You")}</strong><span>{myTurn ? ui("Your turn") : `${ui("Your side")} · ${round.taken[0]} ${ui("Tricks")}`}</span></p>
        <div className="card-hand" role="group" aria-label={ui("You")}>{hand}</div>
      </div>
    </div> : <div className="skd-table">
      <div className="skd-bar">
        <strong>Schafkopf</strong>
        <span>Runde 1 · Sauspiel auf die {SUIT_NAMES[game.called!]}-Sau</span>
        <span className="skd-trump"><small>Trumpf</small>Ober · Unter · <b>{SUIT_SYMBOLS[game.trump]}</b> {SUIT_NAMES[game.trump]}</span>
      </div>
      {!finished && <span className="skd-stich">Stich {Math.min(total, round.trick + 1)}/{total}</span>}
      {places.slice(1).map((place, offset) => {
        const seat = offset + 1, player = stammtisch[seat]!, count = round.hands[seat].length;
        return <div key={place} className={`skd-seat skd-seat--${place}${toPlay === seat && !finished ? " is-active" : ""}`}>
          {round.trick === 0 && !round.plays.some(item => item.seat === seat) && <span className="skd-speech"><b>{player.name}:</b> {player.said}</span>}
          <span className="skd-portrait">
            <img src={`/images/landing/schafkopf-${player.portrait}.png`} alt="" loading="lazy" draggable={false} />
            <span className="skd-held" role="img" aria-label={`${player.name}: ${count} ${ui("Cards")}`}>{round.hands[seat].map((_, position) => <i key={position} style={{ "--fan": position - (count - 1) / 2 } as CSSProperties} />)}</span>
          </span>
          <span className={`skd-plate skd-plate--${player.role === "Gegenspieler" ? "opposing" : "playing"}`}><b>{player.name}</b><small>{player.role}</small></span>
        </div>;
      })}
      <div className="skd-trick" aria-live="polite">{trick}</div>
      <div className="skd-hand">
        <div className="card-hand" role="group" aria-label={ui("You")}>{hand}</div>
        <p className={`skd-turn${myTurn ? " is-active" : ""}`} role="status">{myTurn ? "Du bist am Zug" : finished ? `${teamPoints} Augen` : `Spieler · ${teamPoints} Augen`}</p>
      </div>
    </div>}
    <div className="card-status">
      <p aria-live="polite">{message}</p>
      <span className="card-score">{id === "schafkopf" ? fill(text("pointsLabel"), { points: teamPoints }) : fill(text("tricksLabel"), { tricks: round.taken[0], total: game.tricksToWin ?? total })}</span>
      {finished ? <button type="button" className="demo-link" onClick={() => setRound(fresh(game))}><RotateCcw size={14} aria-hidden="true" />{text("cardAgain")}</button> : <small>{text(rules)}</small>}
    </div>
  </DemoFrame>;
}
