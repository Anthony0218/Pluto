import { useEffect, useMemo, useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { RotateCcw } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useCopy, type CopyKey } from "../copy";
import type { ToneName } from "../tones";
import DemoFrame from "./DemoFrame";
import { cardId, cardImage, chooseAiCard, legalCards, schafkopfGame, trickWinner, wattenGame, type Card, type DemoGame, type Play } from "./cardTrickEngine";

type Seat = { name: CopyKey; place: "bottom" | "left" | "top" | "right" };
const seatLayouts: Record<number, Seat[]> = {
  3: [{ name: "seatYou", place: "bottom" }, { name: "seatLeft", place: "left" }, { name: "seatRight", place: "right" }],
  4: [{ name: "seatYou", place: "bottom" }, { name: "seatLeft", place: "left" }, { name: "seatAcross", place: "top" }, { name: "seatRight", place: "right" }],
};
const games = {
  watten: { game: wattenGame, tone: "watten" as ToneName, table: "/images/tables/bavarian.webp", title: "Watten", href: "/games/watten", action: "playWatten" as CopyKey, rules: "wattenRules" as CopyKey },
  schafkopf: { game: schafkopfGame, tone: "schafkopf" as ToneName, table: "/images/tables/alpine.webp", title: "Schafkopf", href: "/games/schafkopf", action: "playSchafkopf" as CopyKey, rules: "schafkopfRules" as CopyKey },
};
const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));

type Round = { hands: Card[][]; plays: Play[]; leader: number; taken: number[]; points: number[]; trick: number };
const fresh = (game: DemoGame): Round => ({ hands: game.hands.map(hand => [...hand]), plays: [], leader: 0, taken: game.hands.map(() => 0), points: game.hands.map(() => 0), trick: 0 });

/** A playable trick-taking round on a card table: you are at the bottom, the others answer by the rules. */
export default function CardTrickDemo({ id }: { id: keyof typeof games }) {
  useUiLanguage();
  const text = useCopy();
  const { game, tone, table, title, href, action, rules } = games[id];
  const [round, setRound] = useState(() => fresh(game));
  const seats = seatLayouts[game.seats];
  const toPlay = round.plays.length < game.seats ? (round.leader + round.plays.length) % game.seats : null;
  const finished = round.trick >= game.hands[0].length;
  const myTurn = toPlay === 0 && !finished;
  const mine = useMemo(() => legalCards(round.hands[0], round.plays, game.rules), [round.hands, round.plays, game.rules]);

  const play = (seat: number, chosen: Card) => setRound(current => {
    if (current.plays.length >= game.seats || (current.leader + current.plays.length) % game.seats !== seat) return current;
    const hands = current.hands.map((hand, index) => index === seat ? hand.filter(item => cardId(item) !== cardId(chosen)) : hand);
    return { ...current, hands, plays: [...current.plays, { seat, card: chosen }] };
  });

  // Computer seats answer after a short think; a finished trick is shown for a moment, then swept away.
  useEffect(() => {
    if (finished) return;
    if (toPlay !== null && toPlay !== 0) {
      const timer = window.setTimeout(() => play(toPlay, chooseAiCard(round.hands[toPlay], round.plays, game.rules)), 750);
      return () => window.clearTimeout(timer);
    }
    if (toPlay === null) {
      const winner = trickWinner(round.plays, game.rules);
      const timer = window.setTimeout(() => setRound(current => ({
        ...current, plays: [], leader: winner, trick: current.trick + 1,
        taken: current.taken.map((count, seat) => count + (seat === winner ? 1 : 0)),
        points: current.points.map((sum, seat) => sum + (seat === winner ? current.plays.reduce((total, item) => total + game.rules.points(item.card), 0) : 0)),
      })), 1500);
      return () => window.clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `play` only uses state setters and constants
  }, [toPlay, round.plays.length, finished, round.trick]);

  const sideOf = (seat: number) => seats[seat].place;
  const resolved = toPlay === null && !finished ? trickWinner(round.plays, game.rules) : null;
  const teamPoints = id === "schafkopf" ? round.points[0] + round.points[2] : null;
  const message = finished
    ? id === "schafkopf" ? fill(text("cardDonePoints"), { points: teamPoints ?? 0 }) : fill(text("cardDoneTricks"), { tricks: round.taken[0] })
    : resolved !== null ? fill(text(resolved === 0 ? "cardTrickYou" : "cardTrickOther"), { name: text(seats[resolved].name) })
    : myTurn ? text("cardYourTurn") : text("cardWaiting");

  return <DemoFrame tone={tone} title={ui(title)} href={href} action={text(action)}>
    <div className="card-table" style={{ backgroundImage: `linear-gradient(#050a14b8, #050a14d9), url(${table})` }}>
      {seats.slice(1).map((seat, offset) => {
        const index = offset + 1;
        return <div key={seat.place} className={`card-seat card-seat--${seat.place}`} aria-label={`${text(seat.name)}: ${round.hands[index].length}`}>
          <span className="card-seat-name">{text(seat.name)}{id === "watten" ? ` · ${round.taken[index]}` : ""}</span>
          <span className="card-fan" aria-hidden="true">{round.hands[index].map((_, position) => <i key={position} className="card-back" />)}</span>
        </div>;
      })}
      <div className="card-center" aria-live="polite">
        <AnimatePresence>
          {round.plays.map(item => <m.img key={cardId(item.card)} src={cardImage(item.card)} alt={ui(`${item.card.suit} ${item.card.rank}`)}
            className={`card-played card-played--${sideOf(item.seat)}${resolved === item.seat ? " card-played--winner" : ""}`}
            initial={{ opacity: 0, scale: 0.8, y: sideOf(item.seat) === "bottom" ? 60 : -30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} />)}
        </AnimatePresence>
      </div>
      <div className="card-hand" role="group" aria-label={text(seats[0].name)}>
        {round.hands[0].map(item => {
          const allowed = myTurn && mine.some(option => cardId(option) === cardId(item));
          return <button key={cardId(item)} type="button" className="card-hand-card" disabled={!allowed} onClick={() => play(0, item)} aria-label={ui(`${item.suit} ${item.rank}`)}>
            <img src={cardImage(item)} alt="" loading="lazy" draggable={false} />
          </button>;
        })}
      </div>
    </div>
    <div className="card-status">
      <p aria-live="polite">{message}</p>
      <span className="card-score">{id === "schafkopf" ? fill(text("pointsLabel"), { points: round.points[0] + round.points[2] }) : fill(text("tricksLabel"), { tricks: round.taken[0], total: game.hands[0].length })}</span>
      {finished ? <button type="button" className="demo-link" onClick={() => setRound(fresh(game))}><RotateCcw size={14} aria-hidden="true" />{text("cardAgain")}</button> : <small>{text(rules)}</small>}
    </div>
  </DemoFrame>;
}
