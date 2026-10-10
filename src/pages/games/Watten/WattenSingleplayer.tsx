import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useCardTheme } from "@/context/CardThemeContext";
import { getWattenCardImage } from "@/utils/WattenCardImages";
import { RANKS, SUITS, SUIT_SYMBOLS, WATTEN_CARD_CLIP, canPlayWattenCard, getPreviousPlayer, getWattenCardRole, isHauptschlag, isFirstTrick, type Rank, type Suit, type WattenCard } from "@/utils/watten";
import { botShouldHold, botShouldRaise, chooseBotCard } from "@/games/watten/bot";
import { getWattenHelpComparison } from "@/games/watten/help";
import { advanceSingleWatten, canRaiseSingleWatten, createSingleWattenRound, cutSingleWatten, declareSingleWatten, playSingleWattenCard, raiseSingleWatten, respondSingleWattenBid, teamOf, type SingleWattenState } from "@/games/watten/singleplayer";
import { useTableTheme } from "@/context/TableThemeContext";
import { useAuth } from "@/context/AuthContext";
import { ProfileAvatar } from "@/components/social/ProfileAvatarPicker";
import { HeaderTools } from "@/components/App/PublicHeader";
import CardThemeSelector from "@/components/Watten/WattenCardGameSelector";
import TableThemeSelector from "@/components/App/TableThemeSelector";
import WattenTurnNotice from "@/components/Watten/WattenTurnNotice";
import WattenScreen from "@/components/Watten/WattenScreen";
import WattenFullscreenButton from "@/components/Watten/WattenFullscreenButton";
import { WattenLastTrickViewer, WattenTrickPile, type WattenTrickRecord } from "@/components/Watten/WattenTricks";
import { useFitWattenScreen } from "@/games/watten/useFitWattenScreen";
import { wattenPlayAnimation, wattenSeatPosition, wattenTableStyle } from "@/games/watten/presentation";
import { isTrumpfOderKritischActive, mustFollowTrumpfOderKritisch } from "@/utils/watten";
import "@/components/Watten/wattenGameScreen.css";
import "./wattenMenus.css";
import { ui, useUiLanguage } from "@/i18n/ui";

function CardImage({ card, className = "" }: { card: WattenCard; className?: string }) {
  useGameLanguage();
  const { cardTheme } = useCardTheme();
  return <img src={getWattenCardImage(card, cardTheme)} alt={gameUi(`${card.suit} ${card.rank}`)} draggable={false} style={{ clipPath: WATTEN_CARD_CLIP }} className={`h-28 w-[74px] rounded-md object-fill shadow-xl sm:h-36 sm:w-24 ${className}`} />;
}
export default function WattenSingleplayer() {
  useUiLanguage();
  const { tableTheme } = useTableTheme();
  const { profile } = useAuth();
  const avatarId = profile?.avatar_id ?? "m1";
  const [count, setCount] = useState<3 | 4>(3);
  const [game, setGame] = useState<SingleWattenState | null>(null);
  const [trump, setTrump] = useState<Suit>("Herz");
  const [schlag, setSchlag] = useState<Rank>("Ober");
  const [targetScore, setTargetScore] = useState(15);
  const [cutIndex, setCutIndex] = useState(16);
  const [notice, setNotice] = useState<string | null>(null);
  const [helpMode, setHelpMode] = useState(false);
  // The trick the viewer was opened for; a newer trick closes it by no longer matching.
  const [viewedTrick, setViewedTrick] = useState<unknown>(null);
  useFitWattenScreen(!game);
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
  useEffect(() => {
    if (!game || game.phase !== "cut") return;
    const cutter = getPreviousPlayer(game.dealer, game.count);
    if (cutter === 0) return;
    const timer = window.setTimeout(() => setGame(current => current?.phase === "cut"
      ? cutSingleWatten(current, 10 + Math.floor(Math.random() * 12), cutter) : current), 1400);
    return () => window.clearTimeout(timer);
  }, [game]);
  function play(card: WattenCard) {
    if (!game || game.turn !== 0) return;
    try { setGame(playSingleWattenCard(game, card.id)); setNotice(null); }
    catch (error) { setNotice(error instanceof Error ? error.message : ui("Illegal card.")); }
  }
  function confirmLeaveGame() {
    return !game || game.phase === "matchOver" || window.confirm(ui("Leave this game? Current progress will be lost."));
  }
  if (!game) return (
    <main className="watten-menu watten-menu--screen px-4 py-8 text-white sm:py-12">
      <div className="mx-auto max-w-2xl">
        <section className="watten-menu__panel rounded-3xl border p-5 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">{ui("Bavarian Watten")}</p>
          <h1 className="mt-2 text-3xl font-black">{ui("Singleplayer")}</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{ui("Play against rule-aware bots. Choose three players for solo against two, or four players for teams.")}</p>
          <p className="mb-3 mt-6 text-sm font-bold text-zinc-300">{ui("Number of players")}</p>
          <div className="grid grid-cols-2 gap-3">
            {([3, 4] as const).map(value => (
              <button key={gameUi(value)} type="button" aria-pressed={count === value} onClick={() => setCount(value)} className={`rounded-2xl border p-4 text-left transition sm:p-5 ${count === value ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                <span className="text-xl font-black">{gameUi(value)} {ui("Players")}</span>
                <span className="mt-2 block text-xs leading-5 text-zinc-400">{ui(value === 3 ? "One solo player against a team of two." : "Two fixed teams with partners sitting opposite each other.")}</span>
              </button>
            ))}
          </div>
          <section className="mt-5 rounded-2xl border border-white/10 bg-zinc-950/95 p-5 text-center">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{ui("Points to win")}</h2>
            <p className="mt-2 text-sm text-zinc-400">{ui("First choose how many points are needed to win the match.")}</p>
            <div className="mt-3 flex justify-center gap-2">{[11, 15, 18].map(score => <button key={gameUi(score)} type="button" aria-pressed={targetScore === score} onClick={() => setTargetScore(score)} className={`h-10 w-14 rounded-lg text-sm font-black transition ${targetScore === score ? "bg-amber-400 text-amber-950 ring-2 ring-amber-200" : "bg-white/10 text-white hover:bg-white/20"}`}>{gameUi(score)}</button>)}</div>
            <label className="mt-3 block text-xs text-zinc-500">{ui("Or custom value:")}<input type="number" min={4} max={50} value={targetScore} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value)) setTargetScore(Math.max(4, Math.min(50, Math.trunc(value)))); }} className="mx-auto mt-1.5 block w-20 rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-center text-sm font-bold text-white outline-none focus:border-amber-400" /></label>
            <p className="mt-3 text-xs text-zinc-400">{ui("Normal round win")} · {ui("2 points")}</p>
          </section>
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
            <ProfileAvatar avatarId={avatarId} className="h-12 w-12 shrink-0 rounded-xl" />
            <div><p className="font-bold">{gameUi(profile?.username || ui("You"))}</p><p className="text-xs text-zinc-400">{gameUi(count - 1)} {ui("Bots")}</p></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => { setGame(createSingleWattenRound(count, count - 1, undefined, 1, targetScore)); document.querySelector(".app-viewport")?.scrollTo(0, 0); }} className="flex-1 rounded-xl bg-amber-400 px-6 py-3 font-black text-amber-950 hover:bg-amber-300">{ui("Start Game")}</button>
            <Link to="/games/watten" className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold hover:bg-white/10">{ui("Back")}</Link>
          </div>
        </section>
      </div>
    </main>
  );
  const team = teamOf("0", game.count, game.caller);
  const roundWinner = game.winnerSide;
  const legal = game.phase === "playing" && !game.pendingBid && game.turn === 0 && game.trump && game.schlag ? new Set(game.hands[0].filter(card => canPlayWattenCard(card, game.hands[0], game.trick, game.tricksWon, game.trump, game.schlag)).map(card => card.id)) : new Set<string>();
  const humanTurn = game.phase === "playing" && game.turn === 0 && !game.pendingBid;
  const mustFollow = mustFollowTrumpfOderKritisch(game.hands[0], game.trick, game.tricksWon, game.trump, game.schlag);
  const trumpRuleActive = humanTurn && isTrumpfOderKritischActive(game.trick, game.tricksWon, game.trump, game.schlag);
  const status = game.phase === "playing"
    ? game.pendingBid ? ui("A raise is awaiting an answer") : humanTurn ? ui("Your turn") : `${ui("Bot")} ${game.turn} ${ui("is thinking…")}`
    : ui(game.phase === "cut" ? "Cut the deck" : game.phase === "declare" ? "Choose trump and Schlag" : game.phase === "trickPause" ? "Trick complete" : game.phase === "matchOver" ? "Match finished" : "Round finished");

  const seatName = (seat: number) => seat === 0 ? profile?.username || ui("You") : `${ui("Bot")} ${seat}`;
  const lastTrickRecord: WattenTrickRecord | null = game.lastTrick.length && game.lastTrickWinner !== null
    ? { winnerSeat: game.lastTrickWinner, plays: game.lastTrick.map(entry => ({ seat: Number(entry.playerId), name: seatName(Number(entry.playerId)), card: entry.card })) }
    : null;

  return (
    <WattenScreen>
      <div className="watten-game-content">
        <header className="watten-game-header">
          <div><p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">{ui("Bavarian Watten")}</p><h1 className="font-black">{gameUi(game.count)} {ui("Players")} · {ui("Singleplayer")}</h1></div>
          <div>
            <button type="button" aria-pressed={helpMode} onClick={() => setHelpMode(current => !current)} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${helpMode ? "bg-amber-400 text-amber-950" : "bg-white/10 text-white hover:bg-white/20"}`}>💡 {ui(helpMode ? "Help On" : "Help")}</button>
            <HeaderTools><CardThemeSelector /><TableThemeSelector /></HeaderTools>
            <button type="button" onClick={() => { if (!confirmLeaveGame()) return; setGame(null); setNotice(null); document.querySelector(".app-viewport")?.scrollTo(0, 0); }} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20">{ui("New Game")}</button>
            <WattenFullscreenButton />
            <Link to="/games/watten" onClick={event => { if (!confirmLeaveGame()) event.preventDefault(); }} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20">{ui("Back")}</Link>
          </div>
        </header>
        <WattenTurnNotice player={gameUi(profile?.username || ui("You"))} active={trumpRuleActive} mustFollow={mustFollow} />
        <div className="watten-game-grid watten-single-grid">
          <aside className="space-y-3">
            <section className="watten-single-scoreboard rounded-2xl border border-white/10 bg-zinc-950/80 p-4" style={{ "--seats": game.count } as CSSProperties}>
              <h2 className="text-xs font-black uppercase tracking-widest text-amber-300">{ui("Scoreboard")}</h2>
              <div className="mt-4 space-y-3">{game.scores.map((score, seat) => (
                <div key={gameUi(seat)} className={`rounded-xl border p-3 ${seat === game.turn ? "border-amber-300/40 bg-amber-300/10" : "border-white/10 bg-white/5"}`}>
                  <div className="flex items-center justify-between gap-2"><strong className="text-sm">{gameUi(seat === 0 ? ui("You") : `${ui("Bot")} ${seat}`)}</strong><b className="text-xl text-amber-200">{gameUi(score)}<span className="text-xs text-zinc-500"> / {gameUi(game.targetScore)}</span></b></div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, score / game.targetScore * 100)}%` }} /></div><p className="mt-1 text-xs text-zinc-400">{ui(teamOf(String(seat), game.count, game.caller) === team ? "Your side" : "Opponent")} · {gameUi(game.tricksWon[String(seat)] ?? 0)} {ui("Tricks")}</p>
                </div>
              ))}</div>
            </section>
          </aside>
          <section className={`watten-table watten-single-table${game.count === 3 ? " is-three" : ""}`} style={wattenTableStyle(tableTheme)} aria-label={ui("Game table")}>
            <div className="watten-single-status"><span>{ui("Round")} {gameUi(game.round)}</span><strong>{gameUi(game.trump ? `${SUIT_SYMBOLS[game.trump]} ${game.trump}` : "—")} · {gameUi(game.schlag ?? "—")}</strong><span>{ui("Round value")}: {gameUi(game.roundValue)}</span></div>
            {game.hands.slice(1).map((hand, index) => {
              const seat = index + 1;
              const position = wattenSeatPosition(seat, 0, game.count);
              return (
                <div key={gameUi(seat)} className={`watten-single-seat is-${position} ${game.turn === seat && game.phase === "playing" ? "is-active" : ""}`}>
                  <strong>{seatName(seat)}</strong>
                  <span>{ui(teamOf(String(seat), game.count, game.caller) === team ? "Teammate" : "Opponent")}</span>
                  <div className="watten-single-seat-cards">
                    <div className="watten-single-card-backs" aria-label={gameUi(`${hand.length} ${ui("Cards")}`)}>{hand.map(card => <i key={card.id} />)}</div>
                    <WattenTrickPile count={gameUi(game.tricksWon[String(seat)] ?? 0)} name={seatName(seat)} last={game.lastTrickWinner === seat ? lastTrickRecord : null} cardsPerTrick={gameUi(game.count)} onView={() => setViewedTrick(game.lastTrick)} />
                  </div>
                </div>
              );
            })}
            <div className="watten-single-trick">
              {game.trick.length ? game.trick.map(entry => (
                <div key={`${entry.playerId}-${entry.card.id}`} className={`watten-single-played ${wattenPlayAnimation(Number(entry.playerId), 0, game.count)}`}>
                  <CardImage card={entry.card} /><span>{gameUi(entry.playerId === "0" ? ui("You") : `${ui("Bot")} ${entry.playerId}`)}</span>
                </div>
              )) : game.lastTrick.length ? (
                <div className="text-center"><p className="mb-3 text-xs font-bold text-amber-200">{ui("Last trick")} · {gameUi(game.lastTrickWinner === 0 ? ui("You") : `${ui("Bot")} ${game.lastTrickWinner}`)}</p><div className="flex justify-center gap-2">{game.lastTrick.map(entry => <CardImage key={entry.playerId} card={entry.card} className="!h-20 !w-14 sm:!h-24 sm:!w-16" />)}</div></div>
              ) : <p className="text-center text-sm text-white/45">{ui("Waiting for the first card")}</p>}
            </div>
            {(game.phase === "cut" || game.phase === "declare") && <div className="watten-single-setup">
              {game.phase === "cut" && <section className="rounded-2xl border border-amber-200/30 bg-black/70 p-5">
                <h2 className="font-bold">{ui("Abheben")} · {gameUi(getPreviousPlayer(game.dealer, game.count) === 0 ? ui("You") : `${ui("Bot")} ${getPreviousPlayer(game.dealer, game.count)}`)}</h2>
                {getPreviousPlayer(game.dealer, game.count) === 0 ? <>
                  <p className="mt-2 text-sm text-zinc-300">{ui("Choose where to cut. Revealed critical cards go alternately to the cutter and dealer.")}</p>
                  <div className="mt-4 grid grid-cols-8 gap-1.5" aria-label={ui("Choose a card to cut")}>{game.deck.slice(0, -1).map((card, index) => <button key={card.id} type="button" aria-label={gameUi(`${ui("Cut position")} ${index + 1}`)} aria-pressed={cutIndex === index + 1} onClick={() => setCutIndex(index + 1)} className={`aspect-[2/3] rounded border text-xs font-bold ${cutIndex === index + 1 ? "border-amber-200 bg-amber-400 text-black" : "border-white/20 bg-[#173b2a] text-white hover:border-amber-300"}`}>{gameUi(index + 1)}</button>)}</div>
                  <button type="button" onClick={() => setGame(cutSingleWatten(game, cutIndex))} className="mt-4 w-full rounded-lg bg-amber-300 p-2 font-bold text-black">{ui("Cut the deck")}</button>
                </> : <p role="status" className="mt-2 text-sm text-zinc-300">{ui("The bot is cutting the deck…")}</p>}
              </section>}

        {game.phase === "declare" && <section className="rounded-2xl border border-amber-200/30 bg-black/25 p-5"><h2 className="font-bold">{ui("Choose trump and Schlag")}</h2><label className="mt-3 block text-sm">{ui("Trumpf")}<select value={trump} onChange={event => setTrump(event.target.value as Suit)} className="mt-1 block w-full rounded-lg border border-white/20 bg-[#173b2a] p-2">{SUITS.map(suit => <option key={gameUi(suit)}>{gameUi(suit)}</option>)}</select></label><label className="mt-3 block text-sm">{ui("Schlag")}<select value={schlag} onChange={event => setSchlag(event.target.value as Rank)} className="mt-1 block w-full rounded-lg border border-white/20 bg-[#173b2a] p-2">{RANKS.map(rank => <option key={gameUi(rank)}>{gameUi(rank)}</option>)}</select></label><button type="button" onClick={() => setGame(declareSingleWatten(game, trump, schlag))} className="mt-4 w-full rounded-lg bg-amber-300 p-2 font-bold text-black">{ui("Continue")}</button></section>}
            </div>}
            <div className="watten-single-hand">
              <div className="watten-single-hand-head"><div className="flex items-center gap-2"><ProfileAvatar avatarId={avatarId} className="h-9 w-9 rounded-xl" /><div><strong className="block text-sm">{seatName(0)}</strong><p role="status" className="text-xs text-amber-200">{gameUi(status)}</p></div></div><WattenTrickPile count={game.tricksWon["0"] ?? 0} name={seatName(0)} last={game.lastTrickWinner === 0 ? lastTrickRecord : null} onView={() => setViewedTrick(game.lastTrick)} /></div>
              <div className="watten-single-hand-cards">{game.hands[0].map(card => {
                const comparison = getWattenHelpComparison({ card, hand: game.hands[0], trick: game.trick, tricksWon: game.tricksWon, trump: game.trump, schlag: game.schlag, playerId: "0", active: helpMode && humanTurn });
                return <button type="button" key={card.id} disabled={!legal.has(card.id)} title={humanTurn && mustFollow && !legal.has(card.id) ? ui("Trump or Critical: play a trump or critical card.") : undefined} onClick={() => play(card)} aria-label={gameUi(`${card.suit} ${card.rank}${helpMode && humanTurn ? !legal.has(card.id) ? ` — ${ui("Illegal card")}` : comparison === null ? "" : comparison ? ` — ${ui("Beats the current winner")}` : ` — ${ui("Does not beat the current winner")}` : ""}`)} className={`watten-single-hand-card relative rounded-md transition hover:-translate-y-2 focus-visible:outline-2 focus-visible:outline-amber-200 disabled:cursor-default motion-reduce:transform-none ${humanTurn && mustFollow ? legal.has(card.id) ? "ring-2 ring-emerald-300" : "wt-card-locked" : ""} ${comparison === true ? "ring-2 ring-green-500" : comparison === false ? "ring-2 ring-red-500" : ""}`}><CardImage card={card} />{humanTurn && mustFollow && !legal.has(card.id) && <span className="wt-card-lock" aria-hidden="true">🔒 {ui("Locked")}</span>}{comparison !== null && <span aria-hidden="true" className={`absolute right-0 top-0 rounded-bl-md px-1 text-[10px] font-black ${comparison ? "bg-green-600 text-white" : "bg-red-700 text-white"}`}>{gameUi(comparison ? ui("Wins") : ui("Loses"))}</span>}</button>;
              })}</div>
              {notice && <p role="alert" className="text-center text-sm text-red-200">{gameUi(notice)}</p>}
            </div>
            <WattenLastTrickViewer trick={lastTrickRecord} open={viewedTrick === game.lastTrick} onClose={() => setViewedTrick(null)} nameOf={seatName} />
          </section>
          <aside className="watten-single-controls space-y-3"><section className="watten-single-info rounded-2xl border border-amber-200/20 bg-black/25 p-4"><h2 className="font-serif text-xl">{ui("Round")} {gameUi(game.round)}</h2><p className="mt-3 text-sm">{ui("Trumpf")}: <strong>{gameUi(game.trump ? `${SUIT_SYMBOLS[game.trump]} ${game.trump}` : "—")}</strong></p><p className="mt-1 text-sm">{ui("Schlag")}: <strong>{gameUi(game.schlag ?? "—")}</strong></p><p className="mt-3 text-xs text-zinc-400">{ui("Points to win")}: {gameUi(game.targetScore)}. {ui("Three tricks win a round.")}</p></section>


        {game.cutCards.length > 0 && <section className="watten-single-cut rounded-2xl border border-amber-200/20 bg-black/25 p-4"><h2 className="text-xs font-bold text-amber-200">{ui("Critical cards from the cut")}</h2><div className="mt-3 flex gap-2">{game.cutCards.map(card => <CardImage key={card.id} card={card} className="!h-20 !w-14" />)}</div></section>}
        {game.phase === "playing" && <section className="rounded-2xl border border-amber-200/20 bg-black/25 p-5"><h2 className="font-bold">{ui("Round value")}: {gameUi(game.roundValue)}</h2>{game.pendingBid ? <><p className="mt-2 text-sm text-zinc-300">{gameUi(game.pendingBid.side === team ? ui("Your side raised the round.") : ui("Opponents raised the round."))}</p>{game.pendingBid.side !== team && <div className="mt-3 flex gap-2"><button type="button" onClick={() => setGame(respondSingleWattenBid(game, 0, true))} className="flex-1 rounded-lg bg-amber-300 p-2 font-bold text-black">{ui("Hold")}</button><button type="button" onClick={() => setGame(respondSingleWattenBid(game, 0, false))} className="flex-1 rounded-lg border border-white/20 p-2">{ui("Decline")}</button></div>}</> : canRaiseSingleWatten(game, 0) && <button type="button" onClick={() => setGame(raiseSingleWatten(game, 0))} className="mt-3 w-full rounded-lg border border-amber-300/50 p-2 font-bold text-amber-100 hover:bg-amber-300/10">{ui("Raise")}</button>}</section>}
        {game.phase === "trickPause" && <button type="button" onClick={() => setGame(advanceSingleWatten(game))} className="w-full rounded-xl bg-amber-300 p-3 font-bold text-black">{ui("Next trick")}</button>}
        {(game.phase === "roundOver" || game.phase === "matchOver") && <section className="rounded-2xl border border-amber-200/30 bg-black/25 p-5" role="status"><h2 className="font-serif text-xl">{gameUi(game.phase === "matchOver" ? roundWinner === team ? ui("Your side won the match") : ui("Opponents won the match") : roundWinner === team ? ui("Your side won the round") : ui("Opponents won the round"))}</h2><p className="mt-2 text-sm text-zinc-300">{gameUi(game.scores.map((score, index) => `${index === 0 ? ui("You") : `${ui("Bot")} ${index}`}: ${score}`).join(" · "))}</p>{game.phase === "roundOver" ? <button type="button" onClick={() => setGame(advanceSingleWatten(game))} className="mt-4 rounded-lg bg-amber-300 px-4 py-2 font-bold text-black">{ui("Next round")}</button> : <button type="button" onClick={() => { setGame(null); setNotice(null); }} className="mt-4 rounded-lg bg-amber-300 px-4 py-2 font-bold text-black">{ui("New Game")}</button>}</section>}
        {helpMode && game.trump && game.schlag && game.hands[0].length > 0 && <section className="rounded-2xl border border-amber-200/20 bg-black/25 p-4" aria-label={ui("Help")}><h2 className="font-bold text-amber-200">💡 {ui("Help")}</h2><p className="mt-1 text-xs text-zinc-300">{ui("Only your cards and the cards on the table are used.")}</p><ul className="mt-3 space-y-2 text-xs">{game.hands[0].map(card => {
          const comparison = getWattenHelpComparison({ card, hand: game.hands[0], trick: game.trick, tricksWon: game.tricksWon, trump: game.trump, schlag: game.schlag, playerId: "0", active: humanTurn });
          const activatesRule = humanTurn && game.trick.length === 0 && isFirstTrick(game.tricksWon) && isHauptschlag(card, game.trump, game.schlag);
          return <li key={card.id} className="rounded-lg border border-white/10 bg-white/5 p-2"><strong>{gameUi(SUIT_SYMBOLS[card.suit])} {gameUi(card.rank)}</strong><span className="ml-1 text-zinc-300">· {gameUi(getWattenCardRole(card, game.trick[0]?.card.suit ?? "", game.trump, game.schlag))}</span>{humanTurn && !legal.has(card.id) ? <span className="block text-rose-300">{ui("Trump or Critical: play a trump or critical card.")}</span> : comparison !== null ? <span className={`block ${comparison ? "text-green-300" : "text-red-300"}`}>{ui(comparison ? "Beats the current winner" : "Does not beat the current winner")}</span> : null}{activatesRule && <span className="block text-amber-200">{ui("Playing this Main Schlag activates Trump or Critical.")}</span>}</li>;
        })}</ul></section>}
      </aside>
        </div>
      </div>
    </WattenScreen>
  );
}
