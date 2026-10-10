/** Regional contract/card names and established game notation are proper terms. */
export const gameTerms = new Set([
  "Schafkopf", "Watten", "Go", "Shogi", "Natura", "Atlas Arena", "Pluto Party",
  "Edravane", "Sauspiel", "Rufspiel", "Rufsau", "Suchsau", "Wenz", "Farbwenz",
  "Geier", "Farbgeier", "Farbsolo", "Solo", "Tout", "Du", "DU", "Sie", "Bettel",
  "Ramsch", "Hochzeit", "Kontra", "Re", "Sub", "Hirsch", "Blaue", "Blauen",
  "Blauer", "Pumpe", "Bums", "Schellige", "Schelligen", "Alte", "Alten", "Alter",
  "Oide", "Oiden", "Roter", "Roten", "Kugel-Bauer-Theres", "Hundsgfickte",
  "Hundsgfickten", "Sau", "Schmier", "Volle", "Bremser", "Schmieren", "Davonlaufen",
  "Schneider", "Schwarz", "Laufende", "Klopfen", "Legen", "Spritzen", "Schlag",
  "Augen", "Fehlfarbe", "Suchen / Suchsau", "jigo",
  "Rechter", "Linker", "Kritische", "Max", "Belli", "Spitz", "Guade", "Weli",
  "Eichel", "Gras", "Herz", "Schellen", "Ober", "Unter", "Ass", "König",
  "Komi", "Ko", "Seki", "Sente", "Gote", "Byo-yomi", "byo-yomi", "Tsume",
  "Tokin", "USI", "SGF", "PGN", "FEN", "Elo", "Stockfish", "KataGo", "WASD",
  "Alte / mit der Alten", "Oide / mit der Oiden", "Blaue / mit der Blauen",
  "Schellige / mit der Schelligen", "Hundsgfickte / mit der Hundsgfickten",
  "I dad scho!", "I spui!", "I würd scho spuin!", "Farb-Solo", "Farb-Sticht", "JSON", "AND", "OR", "NOT",
]);

export function isGameTerm(input: string): boolean {
  const key = input.trim().replace(/[.!]$/, "");
  return gameTerms.has(input.trim()) || gameTerms.has(key) || /^I spui (?:auf|mit) .+(?:\.|…)$/.test(input.trim())
    || key.split(/\s*\/\s*/).every(part => gameTerms.has(part)
    || /^(?:Eichel|Gras|Herz|Schellen)-(?:Ass|Sau|Ober|Unter|König|[789]|10)(?: DU)?$/.test(part))
    || /^(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O(?:-O)?)$/.test(key);
}
