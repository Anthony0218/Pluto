import { Link } from "react-router-dom";
import { useCardTheme } from "../../context/CardThemeContext";
import { getWattenCardImage } from "../../utils/WattenCardImages";
import { BID_NAMES, cardName, cardStrength, contractName, type Action, type Card, type GameView } from "../../games/schafkopf/schafkopf";
import "./schafkopf.css";

function CardFace({ card }: { card: Card }) {
  const { cardTheme } = useCardTheme();
  return <img src={getWattenCardImage(card, cardTheme)} alt={cardName(card)} draggable={false} />;
}

export function SchafkopfRules() {
  return <details className="sk-panel sk-rules">
    <summary>Spielregeln & Wertung</summary>
    <div className="sk-rule-grid">
      <section><h3>Vier Spieler · 32 Karten</h3><p>Jeder erhält acht Karten. Links vom Geber beginnt Ansage und Ausspiel; danach spielt der Stichgewinner aus. Sau 11, Zehn 10, König 4, Ober 3, Unter 2 Augen. Neun, Acht und Sieben zählen 0. Die Spielerpartei braucht 61, die Gegenpartei 60 Augen.</p></section>
      <section><h3>Trumpf & Zugeben</h3><p>Rufspiel: Ober, Unter, Herz. Solo: Ober, Unter, gewählte Farbe. Wenz: nur Unter. Farbwenz: Unter und gewählte Farbe. Ober/Unter: Eichel vor Gras vor Herz vor Schellen. Übrige Karten: Sau, Zehn, König, Ober (beim Wenz), Neun, Acht, Sieben. Farbe oder Trumpf muss bedient werden; es gibt keinen Stichzwang. Gesperrte Karten sind nicht spielbar.</p></section>
      <section><h3>Ruf-Sau & Davonlaufen</h3><p>Rufen darfst du Eichel, Gras oder Schellen, wenn du eine Nicht-Trumpfkarte dieser Farbe, aber nicht ihre Sau hast. Ihr Besitzer ist dein geheimer Partner. Wird die Farbe gesucht, muss die Sau fallen. Sonst bleibt sie bis zum letzten Stich gesperrt. Selbst ausspielen ist erlaubt; eine kleinere Rufkarte nur mit mindestens vier aktuellen Ruf-Farbkarten. Nach diesem Davonlaufen ist die Sau frei, die normale Bedienpflicht bleibt.</p></section>
      <section><h3>Spielansage</h3><p>Erst Spielabsichten, dann Verhandlung ohne Farbnennung. Reihenfolge: Rufspiel, Farbwenz, Wenz, Solo, Farbwenz Tout, Wenz Tout, Solo Tout, Sie. Bei gleichem Rang hat der frühere Sitz Vorrang. Nur der Gewinner nennt die endgültige Farbe. Viermal Weiter: neuer Geber, neue Karten. Tout verlangt alle acht Stiche. Vier Ober und vier Unter ergeben einen sofort gewonnenen Sie.</p></section>
      <section><h3>Kontra & Re</h3><p>Vor dem Ausspiel erhält jeder eine Bedenkrunde. Die Gegenpartei darf Kontra geben, die Spielerpartei mit Re antworten. Auch im Spiel ist das bis vor der zweiten Karte des ersten Stichs möglich. Kontra verdoppelt, Re vervierfacht. Die Gewinnschwelle bleibt gleich.</p></section>
      <section><h3>Virtuelle Punkte</h3><p>Rufspiel 1, Einzelspiel 5, je 1 für Schneider, Schwarz und jeden Laufenden. Spieler mit höchstens 30 bzw. Gegner mit höchstens 29 Augen sind Schneider. Schwarz bedeutet keinen Stich. Laufende zählen ab drei (Wenz ab zwei), maximal 14 beim Rufspiel, 4 beim Wenz, sonst 8. Tout: doppelter Tarif ohne Schneider/Schwarz; Sie: vierfaches Solo mit acht Laufenden. Solisten gewinnen oder zahlen dreifach. Keine Geldeinsätze.</p></section>
    </div>
    <p>Standard mit langer Karte; ohne Ramsch, Geier, Stock, Legen oder Bockrunden. <a href="https://schafkopfschule.de/regeln.html" target="_blank" rel="noreferrer">Regelgrundlage: Schafkopfschule</a>.</p>
  </details>;
}

export default function SchafkopfTable({ view, onAction, busy = false, error, hidden = false, onReveal, allowNext = true, subtitle }: {
  view: GameView; onAction: (action: Action) => void; busy?: boolean; error?: string | null;
  hidden?: boolean; onReveal?: () => void; allowNext?: boolean; subtitle?: string;
}) {
  const mine = view.turn === view.seat;
  const active = mine && !hidden && !busy;
  const done = view.phase === "finished" || view.phase === "redeal";
  const hand = [...view.hand].sort((a, b) => view.contract ? cardStrength(b, view.contract) - cardStrength(a, view.contract) || a.suit.localeCompare(b.suit) : a.suit.localeCompare(b.suit) || a.id.localeCompare(b.id));
  const phaseText = { intent: "Spielabsicht", auction: "Spielverhandlung", declare: "Spiel ansagen", kontra: "Kontra / Re", re: "Antwort auf Kontra", play: "Karte spielen", trick: "Stich einsammeln", finished: "Runde beendet", redeal: "Zusammengeworfen" }[view.phase];
  const dispatch = (action: Action) => { if (!busy) onAction(action); };
  const displayTrick = view.trick.length ? view.trick : view.tricks.at(-1)?.plays ?? [];
  return <main className="sk-page">
    <header className="sk-header"><div><span className="sk-eyebrow">{subtitle ?? "Bayerisches Kartenspiel"} · Runde {view.round}</span><h1>Schafkopf</h1><p>{view.contract ? contractName(view.contract) : "Wer spielt?"}{view.multiplier > 1 ? ` · ×${view.multiplier}` : ""}</p></div><Link className="sk-button sk-secondary" to="/games/schafkopf">Menü</Link></header>
    <div className="sk-scoreboard">{view.names.map((name, seat) => <div key={seat} className={`sk-seat ${seat === view.turn && !done ? "sk-seat-active" : ""}`}>
      <span>{name}{seat === view.seat ? " (du)" : ""}</span><strong>{view.totals[seat]} <small>Pkt.</small></strong>
      <small>{seat === view.dealer ? "Geber · " : ""}{view.counts[seat]} Karten{seat === view.declarer ? " · Spielmacher" : view.partner === seat && (!hidden || view.partnerRevealed || done) ? " · Rufpartner" : ""}</small>
    </div>)}</div>
    <section className="sk-table" aria-label="Spieltisch">
      <div className="sk-table-heading"><span>{phaseText}</span><strong>{done ? (view.phase === "redeal" ? "Alle haben gepasst" : "Abrechnung") : mine && !hidden ? "Du bist am Zug" : `${view.names[view.turn]} ist am Zug`}</strong><small>Stich {Math.min(8, view.tricks.length + (view.phase === "trick" ? 0 : 1))} / 8</small></div>
      <div className="sk-trick">{displayTrick.map(play => <div className="sk-played" key={play.seat}><small>{view.names[play.seat]}</small><CardFace card={play.card} /></div>)}{!displayTrick.length && <span className="sk-table-mark" aria-hidden="true">♧</span>}</div>
      {view.phase === "trick" && <p className="sk-trick-result">{view.names[view.turn]} gewinnt den Stich · {view.tricks.at(-1)?.points} Augen</p>}
      {!view.trick.length && view.tricks.length > 0 && !done && <small>Letzter Stich · {view.names[view.tricks.at(-1)!.winner]}</small>}
    </section>
    {error && <p className="sk-error" role="alert">{error}</p>}
    <section className="sk-panel sk-controls" aria-live="polite">
      {hidden && !done ? <div className="sk-handoff"><h2>Weitergeben an {view.names[view.seat]}</h2><p>Die nächste Hand bleibt verdeckt, bis der Spieler bereit ist.</p><button className="sk-button" onClick={onReveal}>Ich bin {view.names[view.seat]} – Karten zeigen</button></div> : <>
        {!mine && !done && <p>Warte auf {view.names[view.turn]} …</p>}
        {mine && view.phase === "intent" && <><h2>Möchtest du spielen?</h2><p>Deine Ansage muss mindestens {BID_NAMES[view.intents.length + 1]} ermöglichen. Die Farbe bleibt zunächst geheim.</p><div className="sk-actions"><button className="sk-button" disabled={!active || !view.canIntent} onClick={() => dispatch({ type: "intent", play: true })}>Ich möchte spielen</button><button className="sk-button sk-secondary" disabled={!active} onClick={() => dispatch({ type: "intent", play: false })}>Weiter</button></div></>}
        {mine && view.phase === "auction" && <><h2>Aktuelles Gebot: {BID_NAMES[view.bidLevel]}</h2>{!view.canPassBid && <p>Deine Spielabsicht ist verbindlich. Nenne zuerst einen zulässigen Spielrang.</p>}<div className="sk-actions">{view.bidLevels.map(level => <button className="sk-button" key={level} disabled={!active} onClick={() => dispatch({ type: "bid", level })}>{BID_NAMES[level]}</button>)}<button className="sk-button sk-secondary" disabled={!active || !view.canPassBid} onClick={() => dispatch({ type: "bid", level: null })}>Weiter</button></div></>}
        {mine && view.phase === "declare" && <><h2>Dein Spiel wählen</h2><div className="sk-actions">{view.contracts.map(contract => <button className="sk-button sk-secondary" key={contractName(contract)} disabled={!active} onClick={() => dispatch({ type: "declare", contract })}>{contractName(contract)}</button>)}</div></>}
        {mine && (view.phase === "kontra" || view.phase === "re") && <><h2>{view.multiplier === 2 ? "Re geben?" : view.multiplier === 4 ? "Re wurde gegeben" : "Kontra geben?"}</h2><div className="sk-actions">{view.canDouble && <button className="sk-button" disabled={!active} onClick={() => dispatch({ type: "double", accept: true })}>{view.multiplier === 1 ? "Kontra" : "Re"}</button>}<button className="sk-button sk-secondary" disabled={!active} onClick={() => dispatch({ type: "double", accept: false })}>Weiter</button></div></>}
        {view.phase === "play" && <><h2>{mine ? "Du bist am Zug" : "Deine Hand"}</h2><p>{mine ? "Helle Karten sind spielbar. Gesperrte Karten zeigen den Grund darunter." : "Deine Karten bleiben sichtbar; spielen kannst du, sobald du am Zug bist."}</p>{view.canDouble && <button className="sk-button sk-secondary" disabled={busy} onClick={() => dispatch({ type: "double", accept: true })}>{view.multiplier === 1 ? "Kontra" : "Re"}</button>}</>}
        {mine && view.phase === "trick" && <button className="sk-button" disabled={!active} onClick={() => dispatch({ type: "collect" })}>Stich einsammeln</button>}
        {!done && <div className="sk-hand">{hand.map(card => {
          const locked = view.phase === "play" && mine ? view.locks[card.id] : undefined;
          const playable = active && view.legalCards.includes(card.id);
          return <div className="sk-hand-slot" key={card.id}><button className={`sk-card ${locked ? "sk-card-locked" : ""}`} disabled={!playable} title={locked ?? cardName(card)} aria-label={`${cardName(card)}${locked ? ` – gesperrt: ${locked}` : ""}`} onClick={() => dispatch({ type: "play", cardId: card.id })}><CardFace card={card} />{locked && <span className="sk-lock">Gesperrt</span>}</button><small>{locked ?? cardName(card)}</small></div>;
        })}</div>}
      </>}
      {view.result && <div className="sk-result"><h2>{view.result.declarerWon ? "Spielerpartei gewinnt" : "Gegenpartei gewinnt"}</h2><p>{view.result.team.map(seat => view.names[seat]).join(" & ")} · {view.result.declarerPoints} : {view.result.opponentPoints} Augen</p><p>{view.contract?.kind === "sie" ? "Sie · " : view.contract?.tout ? "Tout · " : `${view.result.schwarz ? "Schwarz · " : view.result.schneider ? "Schneider · " : ""}`}{view.result.laufende} Laufende · Spielwert {view.result.value}</p><div className="sk-actions">{view.names.map((name, seat) => <span key={seat}>{name}: <strong>{view.result!.deltas[seat] > 0 ? "+" : ""}{view.result!.deltas[seat]}</strong></span>)}</div></div>}
      {done && (allowNext ? <button className="sk-button" disabled={busy} onClick={() => dispatch({ type: "next" })}>Nächste Runde · {view.names[(view.dealer + 1) % 4]} gibt</button> : <p>Der Gastgeber startet die nächste Runde.</p>)}
    </section>
    <details className="sk-panel"><summary>Ansagen & Stiche</summary><ol className="sk-log">{view.announcements.map((text, index) => <li key={index}>{text}</li>)}</ol>{view.tricks.length > 0 && <div className="sk-log">{(done ? view.tricks : view.tricks.slice(-1)).map((trick, index) => <p key={index}>{done ? index + 1 : view.tricks.length}. Stich: {trick.plays.map(play => `${view.names[play.seat]}: ${cardName(play.card)}`).join(" · ")} → {view.names[trick.winner]} ({trick.points} Augen)</p>)}</div>}</details>
    <SchafkopfRules />
  </main>;
}
