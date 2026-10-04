import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCardTheme } from "@/context/CardThemeContext";
import { getWattenCardImage } from "@/utils/WattenCardImages";
import { RANKS, SUITS, SUIT_SYMBOLS, WATTEN_CARD_CLIP, canPlayWattenCard, getWattenCardRole, isHauptschlag, isFirstTrick, type Rank, type Suit, type WattenCard } from "@/utils/watten";
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
import { wattenPlayAnimation, wattenSeatPosition, wattenTableStyle } from "@/games/watten/presentation";
import { isTrumpfOderKritischActive, mustFollowTrumpfOderKritisch } from "@/utils/watten";
import "@/components/Watten/wattenGameScreen.css";
import "./wattenMenus.css";
import { ui, useUiLanguage } from "@/i18n/ui";

function CardImage({ card, className = "" }: { card: WattenCard; className?: string }) {
  const { cardTheme } = useCardTheme();
  return <img src={getWattenCardImage(card, cardTheme)} alt={`${card.suit} ${card.rank}`} draggable={false} style={{ clipPath: WATTEN_CARD_CLIP }} className={`h-28 w-[74px] rounded-md object-fill shadow-xl sm:h-36 sm:w-24 ${className}`} />;
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
  const [cutIndex, setCutIndex] = useState(16);
  const [notice, setNotice] = useState<string | null>(null);
  const [helpMode, setHelpMode] = useState(false);
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
  function confirmLeaveGame() {
    return !game || game.phase === "matchOver" || window.confirm(ui("Leave this game? Current progress will be lost."));
  }
  if (!game) return (
    <main className="watten-menu px-4 py-8 text-white sm:py-12">
      <div className="mx-auto max-w-2xl">
        <section className="watten-menu__panel rounded-3xl border p-5 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">{ui("Bavarian Watten")}</p>
          <h1 className="mt-2 text-3xl font-black">{ui("Singleplayer")}</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{ui("Play against rule-aware bots. Choose three players for solo against two, or four players for teams.")}</p>
          <p className="mb-3 mt-6 text-sm font-bold text-zinc-300">{ui("Number of players")}</p>
          <div className="grid grid-cols-2 gap-3">
            {([3, 4] as const).map(value => (
              <button key={value} type="button" aria-pressed={count === value} onClick={() => setCount(value)} className={`rounded-2xl border p-4 text-left transition sm:p-5 ${count === value ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                <span className="text-xl font-black">{value} {ui("Players")}</span>
                <span className="mt-2 block text-xs leading-5 text-zinc-400">{ui(value === 3 ? "One solo player against a team of two." : "Two fixed teams with partners sitting opposite each other.")}</span>
              </button>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
            <ProfileAvatar avatarId={avatarId} className="h-12 w-12 shrink-0 rounded-xl" />
            <div><p className="font-bold">{profile?.username || ui("You")}</p><p className="text-xs text-zinc-400">{count - 1} {ui("Bots")}</p></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => { setGame(createSingleWattenRound(count)); document.querySelector(".app-viewport")?.scrollTo(0, 0); }} className="flex-1 rounded-xl bg-amber-400 px-6 py-3 font-black text-amber-950 hover:bg-amber-300">{ui("Start Game")}</button>
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

  return (
    <main className="watten-game-screen bg-transparent px-2 py-3 text-white sm:px-4 sm:py-4 md:px-8 md:py-6">
      <div className="watten-game-content mx-auto w-full max-w-[1800px]">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-amber-400">{ui("Bavarian Watten")}</p><h1 className="mt-1 text-2xl font-black">{game.count} {ui("Players")} · {ui("Singleplayer")}</h1></div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-pressed={helpMode} onClick={() => setHelpMode(current => !current)} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${helpMode ? "bg-amber-400 text-amber-950" : "bg-white/10 text-white hover:bg-white/20"}`}>💡 {ui(helpMode ? "Help On" : "Help")}</button>
            <HeaderTools><CardThemeSelector /><TableThemeSelector /></HeaderTools>
            <button type="button" onClick={() => { if (!confirmLeaveGame()) return; setGame(null); setNotice(null); document.querySelector(".app-viewport")?.scrollTo(0, 0); }} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20">{ui("New Game")}</button>
            <Link to="/games/watten" onClick={event => { if (!confirmLeaveGame()) event.preventDefault(); }} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20">{ui("Back")}</Link>
          </div>
        </header>
        <WattenTurnNotice player={profile?.username || ui("You")} active={trumpRuleActive} mustFollow={mustFollow} />
        <div className="watten-game-grid watten-single-grid grid grid-cols-[16rem_minmax(0,1fr)_16rem] gap-4">
          <aside className="space-y-3">
            <section className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-amber-300">{ui("Scoreboard")}</h2>
              <div className="mt-4 space-y-3">{game.scores.map((score, seat) => (
                <div key={seat} className={`rounded-xl border p-3 ${seat === game.turn ? "border-amber-300/40 bg-amber-300/10" : "border-white/10 bg-white/5"}`}>
                  <div className="flex items-center justify-between gap-2"><strong className="text-sm">{seat === 0 ? ui("You") : `${ui("Bot")} ${seat}`}</strong><b className="text-xl text-amber-200">{score}<span className="text-xs text-zinc-500"> / 15</span></b></div>
                  <p className="mt-1 text-xs text-zinc-400">{ui(teamOf(String(seat), game.count, game.caller) === team ? "Your side" : "Opponent")} · {game.tricksWon[String(seat)] ?? 0} {ui("Tricks")}</p>
                </div>
              ))}</div>
            </section>
          </aside>
          <section className="watten-table watten-single-table" style={wattenTableStyle(tableTheme)} aria-label={ui("Game table")}>
            <div className="watten-single-status"><span>{ui("Round")} {game.round}</span><strong>{game.trump ? `${SUIT_SYMBOLS[game.trump]} ${game.trump}` : "—"} · {game.schlag ?? "—"}</strong><span>{ui("Round value")}: {game.roundValue}</span></div>
            {game.hands.slice(1).map((hand, index) => {
              const seat = index + 1;
              const position = wattenSeatPosition(seat, 0, game.count);
              return (
                <div key={seat} className={`watten-single-seat is-${position} ${game.turn === seat && game.phase === "playing" ? "is-active" : ""}`}>
                  <strong>{ui("Bot")} {seat}</strong>
                  <span>{ui(teamOf(String(seat), game.count, game.caller) === team ? "Teammate" : "Opponent")} · {game.tricksWon[String(seat)]} {ui("Tricks")}</span>
                  <div className="watten-single-card-backs" aria-label={`${hand.length} ${ui("Cards")}`}>{hand.map(card => <i key={card.id} />)}</div>
                </div>
              );
            })}
            <div className="watten-single-trick">
              {game.trick.length ? game.trick.map(entry => (
                <div key={`${entry.playerId}-${entry.card.id}`} className={`watten-single-played ${wattenPlayAnimation(Number(entry.playerId), 0, game.count)}`}>
                  <CardImage card={entry.card} /><span>{entry.playerId === "0" ? ui("You") : `${ui("Bot")} ${entry.playerId}`}</span>
                </div>
              )) : game.lastTrick.length ? (
                <div className="text-center"><p className="mb-3 text-xs font-bold text-amber-200">{ui("Last trick")} · {game.lastTrickWinner === 0 ? ui("You") : `${ui("Bot")} ${game.lastTrickWinner}`}</p><div className="flex justify-center gap-2">{game.lastTrick.map(entry => <CardImage key={entry.playerId} card={entry.card} className="!h-20 !w-14 sm:!h-24 sm:!w-16" />)}</div></div>
              ) : <p className="text-center text-sm text-white/45">{ui("Waiting for the first card")}</p>}
            </div>
            {(game.phase === "cut" || game.phase === "declare") && <div className="watten-single-setup">
        {game.phase === "cut" && <section className="rounded-2xl border border-amber-200/30 bg-black/25 p-5"><h2 className="font-bold">{ui("Cut the deck")}</h2><p className="mt-2 text-sm text-zinc-300">{ui("Choose where to cut. Revealed critical cards go alternately to the cutter and dealer.")}</p><input aria-label={ui("Cut position")} type="range" min="1" max={game.deck.length - 1} value={cutIndex} onChange={event => setCutIndex(Number(event.target.value))} className="mt-4 w-full accent-amber-300" /><p className="mt-1 text-sm">{ui("Cut position")}: {cutIndex}</p><button type="button" onClick={() => setGame(cutSingleWatten(game, cutIndex))} className="mt-4 w-full rounded-lg bg-amber-300 p-2 font-bold text-black">{ui("Cut the deck")}</button></section>}
        {game.phase === "declare" && <section className="rounded-2xl border border-amber-200/30 bg-black/25 p-5"><h2 className="font-bold">{ui("Choose trump and Schlag")}</h2><label className="mt-3 block text-sm">{ui("Trumpf")}<select value={trump} onChange={event => setTrump(event.target.value as Suit)} className="mt-1 block w-full rounded-lg border border-white/20 bg-[#173b2a] p-2">{SUITS.map(suit => <option key={suit}>{suit}</option>)}</select></label><label className="mt-3 block text-sm">{ui("Schlag")}<select value={schlag} onChange={event => setSchlag(event.target.value as Rank)} className="mt-1 block w-full rounded-lg border border-white/20 bg-[#173b2a] p-2">{RANKS.map(rank => <option key={rank}>{rank}</option>)}</select></label><button type="button" onClick={() => setGame(declareSingleWatten(game, trump, schlag))} className="mt-4 w-full rounded-lg bg-amber-300 p-2 font-bold text-black">{ui("Continue")}</button></section>}
            </div>}
            <div className="watten-single-hand">
              <div className="mb-3 flex items-center justify-center gap-2"><ProfileAvatar avatarId={avatarId} className="h-9 w-9 rounded-xl" /><div><strong className="block text-sm">{profile?.username || ui("You")}</strong><p role="status" className="text-xs text-amber-200">{status}</p></div></div>
              <div className="flex justify-center gap-2">{game.hands[0].map(card => {
                const comparison = getWattenHelpComparison({ card, hand: game.hands[0], trick: game.trick, tricksWon: game.tricksWon, trump: game.trump, schlag: game.schlag, playerId: "0", active: helpMode && humanTurn });
                return <button type="button" key={card.id} disabled={!legal.has(card.id)} onClick={() => play(card)} aria-label={`${card.suit} ${card.rank}${helpMode && humanTurn ? !legal.has(card.id) ? ` — ${ui("Illegal card")}` : comparison === null ? "" : comparison ? ` — ${ui("Beats the current winner")}` : ` — ${ui("Does not beat the current winner")}` : ""}`} className={`watten-single-hand-card relative rounded-md transition hover:-translate-y-2 focus-visible:outline-2 focus-visible:outline-amber-200 disabled:cursor-default motion-reduce:transform-none ${humanTurn && mustFollow ? legal.has(card.id) ? "ring-2 ring-emerald-300" : "opacity-40 grayscale" : ""} ${comparison === true ? "ring-2 ring-green-500" : comparison === false ? "ring-2 ring-red-500" : ""}`}><CardImage card={card} />{comparison !== null && <span aria-hidden="true" className={`absolute right-0 top-0 rounded-bl-md px-1 text-[10px] font-black ${comparison ? "bg-green-600 text-white" : "bg-red-700 text-white"}`}>{comparison ? ui("Wins") : ui("Loses")}</span>}</button>;
              })}</div>
              {notice && <p role="alert" className="mt-3 text-center text-sm text-red-200">{notice}</p>}
            </div>
          </section>
          <aside className="watten-single-controls space-y-3"><section className="rounded-2xl border border-amber-200/20 bg-black/25 p-5"><h2 className="font-serif text-xl">{ui("Round")} {game.round}</h2><p className="mt-3 text-sm">{ui("Trumpf")}: <strong>{game.trump ? `${SUIT_SYMBOLS[game.trump]} ${game.trump}` : "—"}</strong></p><p className="mt-1 text-sm">{ui("Schlag")}: <strong>{game.schlag ?? "—"}</strong></p><p className="mt-3 text-xs text-zinc-400">{ui("First to 15 points wins. Three tricks win a round.")}</p></section>

        {game.cutCards.length > 0 && game.phase !== "cut" && <p className="rounded-xl border border-amber-200/20 bg-black/25 p-3 text-xs text-amber-100">{ui("Critical cards from the cut")}: {game.cutCards.map(card => `${SUIT_SYMBOLS[card.suit]} ${card.rank}`).join(" · ")}</p>}

        {game.phase === "playing" && <section className="rounded-2xl border border-amber-200/20 bg-black/25 p-5"><h2 className="font-bold">{ui("Round value")}: {game.roundValue}</h2>{game.pendingBid ? <><p className="mt-2 text-sm text-zinc-300">{game.pendingBid.side === team ? ui("Your side raised the round.") : ui("Opponents raised the round.")}</p>{game.pendingBid.side !== team && <div className="mt-3 flex gap-2"><button type="button" onClick={() => setGame(respondSingleWattenBid(game, 0, true))} className="flex-1 rounded-lg bg-amber-300 p-2 font-bold text-black">{ui("Hold")}</button><button type="button" onClick={() => setGame(respondSingleWattenBid(game, 0, false))} className="flex-1 rounded-lg border border-white/20 p-2">{ui("Decline")}</button></div>}</> : canRaiseSingleWatten(game, 0) && <button type="button" onClick={() => setGame(raiseSingleWatten(game, 0))} className="mt-3 w-full rounded-lg border border-amber-300/50 p-2 font-bold text-amber-100 hover:bg-amber-300/10">{ui("Raise")}</button>}</section>}
        {game.phase === "trickPause" && <button type="button" onClick={() => setGame(advanceSingleWatten(game))} className="w-full rounded-xl bg-amber-300 p-3 font-bold text-black">{ui("Next trick")}</button>}
        {(game.phase === "roundOver" || game.phase === "matchOver") && <section className="rounded-2xl border border-amber-200/30 bg-black/25 p-5" role="status"><h2 className="font-serif text-xl">{game.phase === "matchOver" ? roundWinner === team ? ui("Your side won the match") : ui("Opponents won the match") : roundWinner === team ? ui("Your side won the round") : ui("Opponents won the round")}</h2><p className="mt-2 text-sm text-zinc-300">{game.scores.map((score, index) => `${index === 0 ? ui("You") : `${ui("Bot")} ${index}`}: ${score}`).join(" · ")}</p>{game.phase === "roundOver" ? <button type="button" onClick={() => setGame(advanceSingleWatten(game))} className="mt-4 rounded-lg bg-amber-300 px-4 py-2 font-bold text-black">{ui("Next round")}</button> : <button type="button" onClick={() => { setGame(null); setNotice(null); }} className="mt-4 rounded-lg bg-amber-300 px-4 py-2 font-bold text-black">{ui("New Game")}</button>}</section>}
        {helpMode && game.trump && game.schlag && game.hands[0].length > 0 && <section className="rounded-2xl border border-amber-200/20 bg-black/25 p-4" aria-label={ui("Help")}><h2 className="font-bold text-amber-200">💡 {ui("Help")}</h2><p className="mt-1 text-xs text-zinc-300">{ui("Only your cards and the cards on the table are used.")}</p><ul className="mt-3 space-y-2 text-xs">{game.hands[0].map(card => {
          const comparison = getWattenHelpComparison({ card, hand: game.hands[0], trick: game.trick, tricksWon: game.tricksWon, trump: game.trump, schlag: game.schlag, playerId: "0", active: humanTurn });
          const activatesRule = humanTurn && game.trick.length === 0 && isFirstTrick(game.tricksWon) && isHauptschlag(card, game.trump, game.schlag);
          return <li key={card.id} className="rounded-lg border border-white/10 bg-white/5 p-2"><strong>{SUIT_SYMBOLS[card.suit]} {card.rank}</strong><span className="ml-1 text-zinc-300">· {getWattenCardRole(card, game.trick[0]?.card.suit ?? "", game.trump, game.schlag)}</span>{humanTurn && !legal.has(card.id) ? <span className="block text-rose-300">{ui("Trump or Critical: play a trump or critical card.")}</span> : comparison !== null ? <span className={`block ${comparison ? "text-green-300" : "text-red-300"}`}>{ui(comparison ? "Beats the current winner" : "Does not beat the current winner")}</span> : null}{activatesRule && <span className="block text-amber-200">{ui("Playing this Main Schlag activates Trump or Critical.")}</span>}</li>;
        })}</ul></section>}
      </aside>
        </div>
      </div>
    </main>
  );
}
