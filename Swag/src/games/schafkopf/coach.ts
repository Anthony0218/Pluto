import { POINTS, cardName, isTrump, trickWinner, type Card, type GameView, type Trick } from "./schafkopf.ts";

/** Advice uses only a player's view and cards already face up on the table. */
const plainName = (card: Card) => card.rank === "Ass" ? `${card.suit}-Ass` : cardName(card);

export function liveSchafkopfTip(view: GameView): string | null {
  if (view.phase === "legen" && view.turn === view.seat) {
    const aces = view.hand.filter(card => card.rank === "Ass").length;
    const hasTopOber = view.hand.some(card => card.rank === "Ober" && ["Eichel", "Gras", "Herz"].includes(card.suit));
    if (aces >= 2 || !hasTopOber) return "Vorsicht beim Klopfen: Viele Asse oder keiner der drei höchsten Ober können dich nach viermal Weiter zum Spiel zwingen – gegen Laufende wird das dann schnell doppelt teuer.";
    return "Klopfen verdoppelt den Wert. Überlege schon mit diesen vier Karten, ob dein Blatt auch nach viermal Weiter ein Pflichtspiel tragen würde.";
  }
  if (view.phase !== "play" || view.turn !== view.seat || !view.contract) return null;
  const legal = view.hand.filter(card => view.legalCards.includes(card.id));
  if (!legal.length) return null;
  const playedTrumps = view.tricks.flatMap(trick => trick.plays).filter(play => isTrump(play.card, view.contract!)).length;
  if (view.trick.length) {
    const currentWinner = trickWinner(view.trick, view.contract);
    const eyes = view.trick.reduce((sum, play) => sum + POINTS[play.card.rank], 0);
    const canWin = legal.filter(card => trickWinner([...view.trick, { seat: view.seat, card }], view.contract!) === view.seat);
    const lead = view.trick[0].card;
    const freeInLedSuit = !isTrump(lead, view.contract) && !view.hand.some(card => !isTrump(card, view.contract!) && card.suit === lead.suit);
    const legalTrumps = legal.filter(card => isTrump(card, view.contract!));
    if (freeInLedSuit && legalTrumps.length && currentWinner !== view.partner) {
      return "Du bist in der Fehlfarbe frei. Wenn du nicht sicher bist, dass dein Mitspieler den Stich hat, stich mit einem möglichst kleinen Trumpf ein.";
    }
    if (canWin.length && eyes >= 10) return `Im Stich liegen schon ${eyes} Punkte. Prüfe, ob du ihn mit einer möglichst kleinen passenden Karte gewinnen kannst.`;
    if (!canWin.length) return "Du kannst den Stich gerade nicht gewinnen. Gib möglichst wenige Punkte ab.";
    if (currentWinner === view.partner) return "Dein Mitspieler liegt vorn. Eine Karte mit vielen Punkten kann eurem Team helfen.";
    return "Überlege, ob sich eine starke Karte für diesen Stich lohnt oder ob du sie aufheben solltest.";
  }
  if (playedTrumps >= 8) return `Schon ${playedTrumps} Trümpfe sind gefallen. Hohe übrige Trümpfe werden jetzt besonders wertvoll.`;
  const safeAce = legal.find(card => card.rank === "Ass" && !isTrump(card, view.contract!));
  if (safeAce) return `Mit ${plainName(safeAce)} kannst du oft früh Punkte holen. Achte darauf, ob jemand die Farbe noch bedienen kann.`;
  return "Beim Anspiel hilft oft eine kleine Fehlkarte, wenn du deine starken Trümpfe noch brauchst.";
}

export function reviewSchafkopfTrick(view: GameView, trick: Trick): string {
  if (!view.contract) return "Dieser Stich kann ohne Spielansage nicht bewertet werden.";
  const winningPlay = trick.plays.find(play => play.seat === trick.winner);
  if (!winningPlay) return "Der Stich ist noch nicht vollständig.";
  const trump = isTrump(winningPlay.card, view.contract);
  const ownPlay = trick.plays.find(play => play.seat === view.seat);
  const ownEyes = ownPlay ? POINTS[ownPlay.card.rank] : 0;
  if (trick.points >= 20) return `${view.names[trick.winner]} holt ${trick.points} Punkte mit ${plainName(winningPlay.card)}. Bei so vielen Punkten lohnt es sich, einen sicheren Gewinner einzusetzen.`;
  if (ownEyes >= 10 && trick.winner !== view.seat && trick.winner !== view.partner) return `Du hast ${ownEyes} Punkte abgegeben. Prüfe beim nächsten Mal, ob dein Team den Stich sicher gewinnt.`;
  if (trump) return `${plainName(winningPlay.card)} gewinnt als Trumpf. Ein kleinerer Trumpf hätte vielleicht ebenfalls gereicht.`;
  return `${view.names[trick.winner]} gewinnt mit ${plainName(winningPlay.card)} und erhält ${trick.points} Punkte. Merke dir, welche Farbe ausgespielt wurde.`;
}
