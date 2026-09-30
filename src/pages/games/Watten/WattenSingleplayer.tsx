import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCardTheme } from "@/context/CardThemeContext";
import { getWattenCardImage } from "@/utils/WattenCardImages";
import { RANKS, SUITS, SUIT_SYMBOLS, WATTEN_CARD_CLIP, canPlayWattenCard, type Rank, type Suit, type WattenCard } from "@/utils/watten";
import { botShouldHold, botShouldRaise, chooseBotCard } from "@/games/watten/bot";
import { advanceSingleWatten, canRaiseSingleWatten, createSingleWattenRound, cutSingleWatten, declareSingleWatten, playSingleWattenCard, raiseSingleWatten, respondSingleWattenBid, teamOf, type SingleWattenState } from "@/games/watten/singleplayer";
import { ui, useUiLanguage } from "@/i18n/ui";

function CardImage({ card, className = "" }: { card: WattenCard; className?: string }) {
  const { cardTheme } = useCardTheme();
  return <img src={getWattenCardImage(card, cardTheme)} alt={`${card.suit} ${card.rank}`} draggable={false} style={{ clipPath: WATTEN_CARD_CLIP }} className={`h-28 w-[74px] rounded-md object-fill shadow-xl sm:h-36 sm:w-24 ${className}`} />;
}
export default function WattenSingleplayer() {
  useUiLanguage();
  const [count, setCount] = useState<3 | 4>(3);
  const [game, setGame] = useState<SingleWattenState | null>(null);
  const [trump, setTrump] = useState<Suit>("Herz");
  const [schlag, setSchlag] = useState<Rank>("Ober");
  const [cutIndex, setCutIndex] = useState(16);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!game || game.phase !== "playing" || !game.trump || !game.schlag) return;
    const humanSide = teamOf("0", game.count, game.caller);
    if (game.pendingBid?.side !== humanSide && (game.pendingBid || game.turn === 0)) return;
    const timer = window.setTimeout(() => {
      setGame(current => {
        if (!current || current.phase !== "playing" || !current.trump || !current.schlag) return current;
        const playerSide = (seat: number) => teamOf(String(seat), current.count, current.caller);
        const teamTricks = (side: string) => Object.entries(current.tricksWon).reduce((sum, [id, won]) => sum + (playerSide(Number(id)) === side ? won : 0), 0);
        if (current.pendingBid) {
          const responder = Array.from({ length: current.count }, (_, seat) => seat).find(seat => seat !== 0 && playerSide(seat) !== current.pendingBid?.side);
          if (responder === undefined) return current;
          const side = playerSide(responder);
          const hold = botShouldHold(current.hands[responder], current.trump, current.schlag, teamTricks(side), teamTricks(current.pendingBid.side));
          return respondSingleWattenBid(current, responder, hold);
        }
        if (current.turn === 0) return current;
        const seat = current.turn;
        const side = playerSide(seat);
        const otherSide = Array.from({ length: current.count }, (_, index) => playerSide(index)).find(value => value !== side)!;
        if (canRaiseSingleWatten(current, seat) && botShouldRaise(current.hands[seat], current.trump, current.schlag, current.roundValue, teamTricks(side), teamTricks(otherSide))) {
          return raiseSingleWatten(current, seat);
        }
        const choice = chooseBotCard(current.hands[seat], { seat, playerCount: current.count, trick: current.trick,
          playedCardIds: new Set(current.playedCardIds), tricksWon: current.tricksWon, trump: current.trump, schlag: current.schlag,
          teamOf: id => teamOf(id, current.count, current.caller) });
        return playSingleWattenCard(current, choice.id);
      });
    }, 620);
    return () => window.clearTimeout(timer);
  }, [game]);
  function play(card: WattenCard) {
    if (!game || game.turn !== 0) return;
    try { setGame(playSingleWattenCard(game, card.id)); setNotice(null); }
    catch (error) { setNotice(error instanceof Error ? error.message : ui("Illegal card.")); }
  }
  if (!game) return <main className="mx-auto min-h-[var(--app-height)] max-w-5xl px-4 py-12 text-white"><Link to="/games/watten" className="text-amber-200 hover:underline">← {ui("Watten")}</Link><section className="mt-8 rounded-3xl border border-amber-300/20 bg-[#14251d] p-7 shadow-2xl sm:p-10"><p className="text-xs font-black uppercase tracking-[.24em] text-amber-200">{ui("Watten")}</p><h1 className="mt-3 font-serif text-4xl">{ui("Singleplayer")}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-zinc-300">{ui("Play against rule-aware bots. Choose three players for solo against two, or four players for teams.")}</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{([3, 4] as const).map(value => <button key={value} type="button" aria-pressed={count === value} onClick={() => setCount(value)} className={`rounded-xl border p-5 text-left text-lg font-bold transition ${count === value ? "border-amber-300 bg-amber-300/15" : "border-white/10 bg-white/5 hover:border-amber-300/30"}`}>{value} {ui("Players")}<span className="mt-1 block text-sm font-normal text-zinc-400">{ui(value === 3 ? "One solo player against a team of two." : "Two fixed teams with partners sitting opposite each other.")}</span></button>)}</div><button type="button" onClick={() => setGame(createSingleWattenRound(count))} className="mt-7 rounded-xl bg-amber-300 px-6 py-3 font-black text-[#172015] hover:bg-amber-200">{ui("Start Game")}</button></section></main>;
  const team = teamOf("0", game.count, game.caller);
  const roundWinner = game.winnerSide;
  const legal = game.phase === "playing" && !game.pendingBid && game.turn === 0 && game.trump && game.schlag ? new Set(game.hands[0].filter(card => canPlayWattenCard(card, game.hands[0], game.trick, game.tricksWon, game.trump, game.schlag)).map(card => card.id)) : new Set<string>();
  return <main className="min-h-[var(--app-height)] bg-[radial-gradient(circle_at_top,#254d36,#10251b_55%,#08140e)] px-3 py-4 text-white sm:px-6">
    <div className="mx-auto max-w-7xl"><header className="flex flex-wrap items-center justify-between gap-3"><Link to="/games/watten" className="text-sm text-amber-200 hover:underline">← {ui("Watten")}</Link><h1 className="font-serif text-2xl">{ui("Singleplayer")} · {game.count} {ui("Players")}</h1><button type="button" onClick={() => setGame(null)} className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10">{ui("New Game")}</button></header>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"><section className="min-w-0 rounded-3xl border border-amber-200/20 bg-[#16412e]/65 p-4 shadow-2xl sm:p-6">
        <div className="grid gap-2 sm:grid-cols-3">{game.hands.slice(1).map((hand, index) => <div key={index} className="rounded-xl border border-white/15 bg-black/15 p-3 text-center"><p className="font-bold">{ui("Bot")} {index + 1} <span className="text-xs text-amber-200">{teamOf(String(index + 1), game.count, game.caller) === team ? ui("Teammate") : ui("Opponent")}</span></p><p className="mt-1 text-xs text-zinc-300">{hand.length} {ui("Cards")} · {game.scores[index + 1]} {ui("Points")} · {game.tricksWon[String(index + 1)]} {ui("Tricks")}</p></div>)}</div>
        <div className="mt-4 flex min-h-40 flex-wrap items-center justify-center gap-2 rounded-2xl border border-amber-200/15 bg-[#0b2319]/65 p-4">{game.trick.length ? game.trick.map(entry => <div key={entry.playerId} className="text-center"><p className="mb-1 text-xs">{entry.playerId === "0" ? ui("You") : `${ui("Bot")} ${entry.playerId}`}</p><CardImage card={entry.card} /></div>) : game.lastTrick.length ? <div className="text-center"><p className="mb-2 text-sm text-amber-200">{ui("Last trick")} · {game.lastTrickWinner === 0 ? ui("You") : `${ui("Bot")} ${game.lastTrickWinner}`}</p><div className="flex flex-wrap justify-center gap-2">{game.lastTrick.map(entry => <CardImage key={entry.playerId} card={entry.card} className="h-20 w-14 sm:h-24 sm:w-16" />)}</div></div> : <p className="text-zinc-400">{ui("Waiting for the first card")}</p>}</div>
        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3"><p className="font-bold">{ui("You")} · {game.scores[0]} {ui("Points")} · {game.tricksWon["0"]} {ui("Tricks")}</p><p className="mt-1 text-xs text-zinc-300">{game.phase === "playing" ? game.pendingBid ? ui("A raise is awaiting an answer") : game.turn === 0 ? ui("Your turn") : `${ui("Bot")} ${game.turn} ${ui("is thinking…")}` : game.phase === "cut" ? ui("Cut the deck") : game.phase === "declare" ? ui("Choose trump and Schlag") : game.phase === "trickPause" ? ui("Trick complete") : game.phase === "matchOver" ? ui("Match finished") : ui("Round finished")}</p></div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">{game.hands[0].map(card => <button type="button" key={card.id} disabled={!legal.has(card.id)} onClick={() => play(card)} className="rounded-md transition hover:-translate-y-2 focus-visible:outline-2 focus-visible:outline-amber-200 disabled:cursor-default disabled:opacity-45 motion-reduce:transform-none"><CardImage card={card} /></button>)}</div>
        {notice && <p role="alert" className="mt-3 text-center text-red-200">{notice}</p>}
      </section><aside className="space-y-4"><section className="rounded-2xl border border-amber-200/20 bg-black/25 p-5"><h2 className="font-serif text-xl">{ui("Round")} {game.round}</h2><p className="mt-3 text-sm">{ui("Trumpf")}: <strong>{game.trump ? `${SUIT_SYMBOLS[game.trump]} ${game.trump}` : "—"}</strong></p><p className="mt-1 text-sm">{ui("Schlag")}: <strong>{game.schlag ?? "—"}</strong></p><p className="mt-3 text-xs text-zinc-400">{ui("First to 15 points wins. Three tricks win a round.")}</p></section>
        {game.phase === "cut" && <section className="rounded-2xl border border-amber-200/30 bg-black/25 p-5"><h2 className="font-bold">{ui("Cut the deck")}</h2><p className="mt-2 text-sm text-zinc-300">{ui("Choose where to cut. Revealed critical cards go alternately to the cutter and dealer.")}</p><input aria-label={ui("Cut position")} type="range" min="1" max={game.deck.length - 1} value={cutIndex} onChange={event => setCutIndex(Number(event.target.value))} className="mt-4 w-full accent-amber-300" /><p className="mt-1 text-sm">{ui("Cut position")}: {cutIndex}</p><button type="button" onClick={() => setGame(cutSingleWatten(game, cutIndex))} className="mt-4 w-full rounded-lg bg-amber-300 p-2 font-bold text-black">{ui("Cut the deck")}</button></section>}
        {game.cutCards.length > 0 && game.phase !== "cut" && <p className="rounded-xl border border-amber-200/20 bg-black/25 p-3 text-xs text-amber-100">{ui("Critical cards from the cut")}: {game.cutCards.map(card => `${SUIT_SYMBOLS[card.suit]} ${card.rank}`).join(" · ")}</p>}
        {game.phase === "declare" && <section className="rounded-2xl border border-amber-200/30 bg-black/25 p-5"><h2 className="font-bold">{ui("Choose trump and Schlag")}</h2><label className="mt-3 block text-sm">{ui("Trumpf")}<select value={trump} onChange={event => setTrump(event.target.value as Suit)} className="mt-1 block w-full rounded-lg border border-white/20 bg-[#173b2a] p-2">{SUITS.map(suit => <option key={suit}>{suit}</option>)}</select></label><label className="mt-3 block text-sm">{ui("Schlag")}<select value={schlag} onChange={event => setSchlag(event.target.value as Rank)} className="mt-1 block w-full rounded-lg border border-white/20 bg-[#173b2a] p-2">{RANKS.map(rank => <option key={rank}>{rank}</option>)}</select></label><button type="button" onClick={() => setGame(declareSingleWatten(game, trump, schlag))} className="mt-4 w-full rounded-lg bg-amber-300 p-2 font-bold text-black">{ui("Continue")}</button></section>}
        {game.phase === "playing" && <section className="rounded-2xl border border-amber-200/20 bg-black/25 p-5"><h2 className="font-bold">{ui("Round value")}: {game.roundValue}</h2>{game.pendingBid ? <><p className="mt-2 text-sm text-zinc-300">{game.pendingBid.side === team ? ui("Your side raised the round.") : ui("Opponents raised the round.")}</p>{game.pendingBid.side !== team && <div className="mt-3 flex gap-2"><button type="button" onClick={() => setGame(respondSingleWattenBid(game, 0, true))} className="flex-1 rounded-lg bg-amber-300 p-2 font-bold text-black">{ui("Hold")}</button><button type="button" onClick={() => setGame(respondSingleWattenBid(game, 0, false))} className="flex-1 rounded-lg border border-white/20 p-2">{ui("Decline")}</button></div>}</> : canRaiseSingleWatten(game, 0) && <button type="button" onClick={() => setGame(raiseSingleWatten(game, 0))} className="mt-3 w-full rounded-lg border border-amber-300/50 p-2 font-bold text-amber-100 hover:bg-amber-300/10">{ui("Raise")}</button>}</section>}
        {game.phase === "trickPause" && <button type="button" onClick={() => setGame(advanceSingleWatten(game))} className="w-full rounded-xl bg-amber-300 p-3 font-bold text-black">{ui("Next trick")}</button>}
        {(game.phase === "roundOver" || game.phase === "matchOver") && <section className="rounded-2xl border border-amber-200/30 bg-black/25 p-5"><h2 className="font-serif text-xl">{roundWinner === team ? ui("Your side won the round") : ui("Opponents won the round")}</h2><p className="mt-2 text-sm text-zinc-300">{game.scores.map((score, index) => `${index === 0 ? ui("You") : `${ui("Bot")} ${index}`}: ${score}`).join(" · ")}</p>{game.phase === "roundOver" && <button type="button" onClick={() => setGame(advanceSingleWatten(game))} className="mt-4 rounded-lg bg-amber-300 px-4 py-2 font-bold text-black">{ui("Next round")}</button>}</section>}
      </aside></div></div>
  </main>;
}
