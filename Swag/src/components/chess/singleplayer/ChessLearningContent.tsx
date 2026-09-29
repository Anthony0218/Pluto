import ChessPageHeader from "@/components/chess/ChessPageHeader";
import ChessPiece from "@/components/chess/ChessPiece";
import { boardColors, useChessSettings } from "@/context/ChessSettingsContext";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useAppLanguage } from "@/i18n/languageStore";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Chess, type Square } from "chess.js";
import {
  getCompletedLichessPuzzles,
  getRandomLichessPuzzle,
  getSuggestedLichessPuzzles,
  recordLichessPuzzleCompletion,
  renameLichessPuzzle,
  type CompletedPuzzle,
  type PuzzleLibrarySort,
} from "./lichessPuzzleSource.ts";
import {
  getCompletedPersonalGamePuzzles,
  getPersonalGamePuzzles,
  recordPersonalGamePuzzleCompletion,
  renamePersonalGamePuzzle,
  type CompletedPersonalPuzzle,
} from "./personalGamePuzzleSource.ts";
import { useAuth } from "../../../context/AuthContext";

type TabKey = "rules" | "openings" | "situations" | "puzzles";
type Language = "en" | "de" | "bar" | "ko" | "ru" | "es" | "pt";

const languageOptions: Array<{ value: Language; label: string }> = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "bar", label: "Boarisch" },
  { value: "ko", label: "한국어" },
  { value: "ru", label: "Русский" },
  { value: "es", label: "Español" },
  { value: "pt", label: "Português" },
];

const translations: Record<"de" | "bar" | "ko" | "ru", Record<string, string>> & Partial<Record<"es" | "pt", Record<string, string>>> = {
  de: {
    Language: "Sprache",
    "Learn Chess": "Schach lernen",
    "Chess Rules & Tips": "Schachregeln & Tipps",
    "Rules, openings, and common chess patterns":
      "Regeln, Eröffnungen und typische Schachmuster",
    "Back to Chess": "Zurück zu Schach",
    "Rules & Tips": "Regeln & Tipps",
    "Learn the basics": "Grundlagen lernen",
    "Chess Openings": "Schacheröffnungen",
    "Openings (not for beginners yet)": "Eröffnungen (noch nicht für Anfänger)",
    "Recognize common starts": "Häufige Anfänge erkennen",
    "Typical Situations": "Typische Situationen",
    "Learn recurring patterns": "Wiederkehrende Muster lernen",
    "Selected piece": "Ausgewählte Figur",
    "Can move": "Kann ziehen",
    "Can capture": "Kann schlagen",
    "Attack / danger / key squares": "Angriff / Gefahr / wichtige Felder",
    Step: "Schritt",
    "Start position": "Startposition",
    "After it has moved": "Nachdem der Bauer gezogen hat",
    Before: "Vorher",
    "After O-O": "Nach O-O",
    "After O-O-O": "Nach O-O-O",
    "Kingside castling (O-O)": "Kurze Rochade (O-O)",
    "Queenside castling (O-O-O)": "Lange Rochade (O-O-O)",
    "After ...d7-d5": "Nach ...d7-d5",
    "After exd6 e.p.": "Nach exd6 e.p.",
    "Pawn on 7th rank": "Bauer auf der 7. Reihe",
    Promoted: "Umgewandelt",
    "Goal of the Game": "Ziel des Spiels",
    "How a Turn Works": "So funktioniert ein Zug",
    "A Good Beginner Plan": "Ein guter Plan für Anfänger",
    "The Pieces": "Die Figuren",
    "How every chess piece moves": "So ziehen die Schachfiguren",
    "Piece values are useful estimates for comparing trades. They are not strict rules: position, king safety, and activity can make a piece more or less valuable.":
      "Figurenwerte helfen beim Einschätzen von Abtauschen. Sie sind keine festen Regeln: Stellung, Königssicherheit und Aktivität können den Wert einer Figur verändern.",
    "Your goal is to checkmate the opponent's king. Checkmate means the king is under attack and there is no legal move that removes the threat.":
      "Dein Ziel ist es, den gegnerischen König schachmatt zu setzen. Schachmatt bedeutet, dass der König angegriffen wird und es keinen legalen Zug gibt, der die Bedrohung beseitigt.",
    "White moves first. Players then alternate one move at a time. On your turn, move exactly one piece, except during castling where the king and rook move together.":
      "Weiß beginnt. Danach ziehen die Spieler abwechselnd. Pro Zug wird genau eine Figur bewegt, außer bei der Rochade, bei der König und Turm gemeinsam ziehen.",
    "Control the center, develop knights and bishops, castle early, avoid moving the same piece repeatedly without a reason, and check whether your opponent threatens something before every move.":
      "Kontrolliere das Zentrum, entwickle Springer und Läufer, rochiere früh, ziehe nicht ohne Grund mehrfach dieselbe Figur und prüfe vor jedem Zug die Drohungen des Gegners.",
    "Typical value": "Typischer Wert",
    "Tip:": "Tipp:",
    Pawn: "Bauer",
    Knight: "Springer",
    Bishop: "Läufer",
    Rook: "Turm",
    Queen: "Dame",
    King: "König",
    "Moves one square forward. From its starting square it may move two squares. Pawns capture one square diagonally forward.":
      "Zieht ein Feld vorwärts. Von der Ausgangsstellung darf er zwei Felder ziehen. Bauern schlagen ein Feld diagonal nach vorn.",
    "Pawns cannot move backward. A pawn reaching the last rank must be promoted.":
      "Bauern können nicht rückwärts ziehen. Erreicht ein Bauer die letzte Reihe, muss er umgewandelt werden.",
    "Moves in an L-shape: two squares in one direction and then one square sideways.":
      "Zieht L-förmig: zwei Felder in eine Richtung und dann ein Feld seitwärts.",
    "The knight is the only piece that can jump over other pieces.":
      "Der Springer ist die einzige Figur, die über andere Figuren springen kann.",
    "Moves any number of squares diagonally, as long as no piece blocks the path.":
      "Zieht beliebig weit diagonal, solange keine Figur den Weg blockiert.",
    "A bishop always remains on the same square color for the entire game.":
      "Ein Läufer bleibt während der gesamten Partie auf derselben Feldfarbe.",
    "Moves any number of squares horizontally or vertically, as long as the path is clear.":
      "Zieht beliebig weit waagerecht oder senkrecht, solange der Weg frei ist.",
    "Rooks become especially powerful on open files and in the endgame.":
      "Türme sind besonders auf offenen Linien und im Endspiel stark.",
    "Moves any number of squares horizontally, vertically, or diagonally.":
      "Zieht beliebig weit waagerecht, senkrecht oder diagonal.",
    "The queen is the most powerful piece, but bringing it out too early can make it an easy target.":
      "Die Dame ist die stärkste Figur, kann aber bei zu früher Entwicklung leicht angegriffen werden.",
    "Moves one square in any direction. The king may never move onto a square attacked by the opponent.":
      "Zieht ein Feld in jede Richtung. Der König darf niemals auf ein vom Gegner angegriffenes Feld ziehen.",
    "The king has no normal point value because losing it by checkmate ends the game.":
      "Der König hat keinen normalen Punktwert, weil Schachmatt die Partie beendet.",
    "From d2: move to d3 or d4; capture on c3 or e3.":
      "Von d2: nach d3 oder d4 ziehen; auf c3 oder e3 schlagen.",
    "From d5: move to d6; capture on c6 or e6.":
      "Von d5: nach d6 ziehen; auf c6 oder e6 schlagen.",
    "A knight on d4 can reach up to eight squares.":
      "Ein Springer auf d4 kann bis zu acht Felder erreichen.",
    "A bishop moves only on diagonals.": "Ein Läufer zieht nur diagonal.",
    "A rook moves along ranks and files.":
      "Ein Turm zieht entlang von Reihen und Linien.",
    "The queen combines rook and bishop movement.":
      "Die Dame kombiniert die Zugmöglichkeiten von Turm und Läufer.",
    "The king moves one square in any direction.":
      "Der König zieht ein Feld in jede Richtung.",
    "King Safety": "Königssicherheit",
    "Check and checkmate": "Schach und Schachmatt",
    "Understanding the difference between check and checkmate is the most important rule in chess.":
      "Den Unterschied zwischen Schach und Schachmatt zu verstehen, gehört zu den wichtigsten Schachregeln.",
    Check: "Schach",
    Checkmate: "Schachmatt",
    "The king is in check when an enemy piece attacks it. The player must immediately respond by doing one of three things:":
      "Der König steht im Schach, wenn ihn eine gegnerische Figur angreift. Dann muss der Spieler sofort auf eine von drei Arten reagieren:",
    "Move the king to a safe square.":
      "Den König auf ein sicheres Feld ziehen.",
    "Capture the attacking piece.": "Die angreifende Figur schlagen.",
    "Block the attack, if the attacking piece allows it.":
      "Den Angriff blockieren, wenn dies möglich ist.",
    "You may never make a move that leaves your own king in check.":
      "Du darfst niemals einen Zug machen, der deinen eigenen König im Schach lässt.",
    "Checkmate occurs when the king is in check and there is no legal way to escape.":
      "Schachmatt liegt vor, wenn der König im Schach steht und es keinen legalen Ausweg gibt.",
    "The game ends immediately. The player delivering checkmate wins, even if the winning side has fewer pieces.":
      "Die Partie endet sofort. Wer Schachmatt setzt, gewinnt – auch mit weniger Material.",
    "The rook attacks the king along the open e-file.":
      "Der Turm greift den König entlang der offenen e-Linie an.",
    "White is checked and has no legal escape square.":
      "Weiß steht im Schach und hat kein legales Fluchtfeld.",
    "Special Rules": "Sonderregeln",
    "Castling, en passant, and promotion": "Rochade, en passant und Umwandlung",
    "These are the three special move rules every chess player should know.":
      "Diese drei Sonderregeln sollte jeder Schachspieler kennen.",
    Castling: "Rochade",
    "En Passant": "En Passant",
    Promotion: "Umwandlung",
    "Castling moves the king two squares toward a rook, then places the rook on the square next to the king.":
      "Bei der Rochade zieht der König zwei Felder in Richtung eines Turms; anschließend wird der Turm direkt neben den König gestellt.",
    "The king and that rook must not have moved before.":
      "König und beteiligter Turm dürfen vorher noch nicht gezogen haben.",
    "The squares between them must be empty.":
      "Die Felder zwischen ihnen müssen frei sein.",
    "The king may not be in check.": "Der König darf nicht im Schach stehen.",
    "The king may not cross or land on an attacked square.":
      "Der König darf kein angegriffenes Feld überqueren oder darauf landen.",
    "If an enemy pawn moves two squares from its starting position and lands directly beside your pawn, your pawn may capture it as if it had moved only one square.":
      "Zieht ein gegnerischer Bauer von seiner Ausgangsstellung zwei Felder und landet direkt neben deinem Bauern, darfst du ihn schlagen, als wäre er nur ein Feld gezogen.",
    "Important: en passant is only available immediately on the next move. If you do something else first, the opportunity disappears.":
      "Wichtig: En passant ist nur unmittelbar im nächsten Zug möglich. Spielst du zuerst etwas anderes, verfällt die Möglichkeit.",
    "When a pawn reaches the last rank, it must immediately become a queen, rook, bishop, or knight.":
      "Erreicht ein Bauer die letzte Reihe, muss er sofort in Dame, Turm, Läufer oder Springer umgewandelt werden.",
    "Most promotions choose a queen, but sometimes a knight, rook, or bishop is the best choice. This is called underpromotion.":
      "Meist wird zur Dame umgewandelt, manchmal ist jedoch Springer, Turm oder Läufer besser. Das nennt man Unterverwandlung.",
    "Piece Values": "Figurenwerte",
    "A simple guide to material": "Ein einfacher Leitfaden zum Material",
    "Use values as a quick guide when deciding whether a trade is favorable.":
      "Nutze die Werte als schnelle Orientierung, ob ein Abtausch günstig ist.",
    Piece: "Figur",
    "Quick Tips": "Kurztipps",
    "Six habits that immediately improve beginner play":
      "Sechs Gewohnheiten, die Anfängern sofort helfen",
    "You do not need to memorize hundreds of moves. These simple habits already prevent many common mistakes.":
      "Du musst keine Hunderte Züge auswendig lernen. Diese einfachen Gewohnheiten verhindern bereits viele typische Fehler.",
    "Before every move, ask: Is my king safe?":
      "Frage dich vor jedem Zug: Ist mein König sicher?",
    "Check whether your opponent attacks one of your pieces.":
      "Prüfe, ob dein Gegner eine deiner Figuren angreift.",
    "Develop knights and bishops before moving the queen many times.":
      "Entwickle Springer und Läufer, bevor du die Dame mehrfach ziehst.",
    "Try to castle before starting an attack.":
      "Versuche zu rochieren, bevor du einen Angriff startest.",
    "Do not trade a valuable piece for a much cheaper one without a reason.":
      "Tausche keine wertvolle Figur ohne guten Grund gegen eine deutlich billigere.",
    "When unsure, look for checks, captures, and threats.":
      "Wenn du unsicher bist, suche nach Schachs, Schlagzügen und Drohungen.",
    "Important openings worth recognizing":
      "Wichtige Eröffnungen, die man erkennen sollte",
    "You do not need to memorize every variation. First learn the basic idea behind each opening and understand why the opening moves fight for development, king safety, and central control.":
      "Du musst nicht jede Variante auswendig lernen. Verstehe zuerst die Grundidee jeder Eröffnung und warum die Züge um Entwicklung, Königssicherheit und Zentrum kämpfen.",
    "Beginner advice:": "Anfängertipp:",
    "Learn the opening principles first. Opening names become useful because they help you recognize familiar positions, not because you must memorize long sequences.":
      "Lerne zuerst die Eröffnungsprinzipien. Namen helfen dir, bekannte Stellungen wiederzuerkennen – nicht, um lange Varianten auswendig zu lernen.",
    "Opening Principles": "Eröffnungsprinzipien",
    "What matters more than memorization":
      "Was wichtiger ist als Auswendiglernen",
    "If your opponent leaves theory early, these principles tell you what to do next.":
      "Wenn dein Gegner früh von der Theorie abweicht, helfen dir diese Prinzipien weiter.",
    "Control the center": "Zentrum kontrollieren",
    "Central squares give your pieces more space and influence.":
      "Zentralfelder geben deinen Figuren mehr Raum und Einfluss.",
    "Develop pieces": "Figuren entwickeln",
    "Bring knights and bishops into the game instead of moving one piece repeatedly.":
      "Bringe Springer und Läufer ins Spiel, statt dieselbe Figur immer wieder zu ziehen.",
    "Castle early": "Früh rochieren",
    "King safety usually matters more than grabbing an extra pawn in the opening.":
      "Königssicherheit ist in der Eröffnung meist wichtiger als ein zusätzlicher Bauer.",
    "Connect the rooks": "Türme verbinden",
    "After developing and castling, move the queen so your rooks can support each other.":
      "Nach Entwicklung und Rochade solltest du die Dame so stellen, dass sich die Türme gegenseitig unterstützen.",
    "Typical Chess Situations": "Typische Schachsituationen",
    "Patterns you will see again and again":
      "Muster, die immer wieder vorkommen",
    "Recognizing patterns is one of the fastest ways to improve. These ideas appear in games at every level.":
      "Mustererkennung ist einer der schnellsten Wege zur Verbesserung. Diese Motive erscheinen auf jedem Spielniveau.",
    All: "Alle",
    Tactic: "Taktik",
    Strategy: "Strategie",
    Endgame: "Endspiel",
    "Remember:": "Merke:",
    "Italian Game": "Italienische Partie",
    "Ruy Lopez": "Spanische Partie",
    "Sicilian Defense": "Sizilianische Verteidigung",
    "French Defense": "Französische Verteidigung",
    "Caro-Kann Defense": "Caro-Kann-Verteidigung",
    "Scandinavian Defense": "Skandinavische Verteidigung",
    "Queen's Gambit": "Damengambit",
    "King's Indian Defense": "Königsindische Verteidigung",
    "Nimzo-Indian Defense": "Nimzo-Indische Verteidigung",
    "English Opening": "Englische Eröffnung",
    "London System": "London-System",
    "King's Gambit": "Königsgambit",
    "Open Game": "Offene Partie",
    "Semi-Open Game": "Halboffene Partie",
    "Closed Game": "Geschlossene Partie",
    "Indian Defense": "Indische Verteidigung",
    "Flank Opening": "Flankeneröffnung",
    "System Opening": "Systemeröffnung",
    Gambit: "Gambit",
    "Develop quickly, control the center, prepare castling, and create pressure against f7.":
      "Schnell entwickeln, das Zentrum kontrollieren, die Rochade vorbereiten und Druck gegen f7 erzeugen.",
    "Pressure the knight that helps defend e5 and build a long-term positional game.":
      "Den Springer unter Druck setzen, der e5 verteidigt, und eine langfristige positionelle Stellung aufbauen.",
    "Black immediately fights for the center from the side and creates an unbalanced position.":
      "Schwarz kämpft sofort von der Seite um das Zentrum und erzeugt eine unausgeglichene Stellung.",
    "Black challenges White's center and usually builds a strong pawn structure before counterattacking.":
      "Schwarz greift das weiße Zentrum an und baut meist eine stabile Bauernstruktur auf, bevor der Gegenangriff beginnt.",
    "A solid defense that challenges the center while usually allowing the light-squared bishop to develop.":
      "Eine solide Verteidigung, die das Zentrum angreift und meist die Entwicklung des weißfeldrigen Läufers erlaubt.",
    "Black attacks the e4 pawn immediately and accepts early queen activity in exchange for direct central play.":
      "Schwarz greift den e4-Bauern sofort an und nimmt frühe Damenaktivität für direktes Zentrumsspiel in Kauf.",
    "White challenges Black's d5 pawn and tries to gain stronger central control.":
      "Weiß greift den schwarzen d5-Bauern an und versucht, stärkere Zentrumskontrolle zu erreichen.",
    "Black allows White to occupy the center, then attacks it later with pieces and pawn breaks.":
      "Schwarz lässt Weiß zunächst das Zentrum besetzen und greift es später mit Figuren und Bauernhebeln an.",
    "Black develops actively, pins the knight, and fights for control of the central dark squares.":
      "Schwarz entwickelt aktiv, fesselt den Springer und kämpft um die Kontrolle der zentralen schwarzen Felder.",
    "White controls the center indirectly and often reaches flexible positional structures.":
      "Weiß kontrolliert das Zentrum indirekt und erreicht häufig flexible positionelle Strukturen.",
    "A reliable development setup with a strong pawn center and easy kingside castling.":
      "Ein zuverlässiges Entwicklungssystem mit starkem Bauernzentrum und einfacher kurzer Rochade.",
    "White offers a pawn to open lines and accelerate an attack against the black king.":
      "Weiß opfert einen Bauern, um Linien zu öffnen und den Angriff gegen den schwarzen König zu beschleunigen.",
    Fork: "Gabel",
    Pin: "Fesselung",
    Skewer: "Spieß",
    "Discovered Attack": "Abzugsangriff",
    "Double Attack": "Doppelangriff",
    "Hanging Piece": "Ungedeckte Figur",
    "Back-Rank Mate": "Grundreihenmatt",
    "Open File": "Offene Linie",
    "Passed Pawn": "Freibauer",
    "Isolated Pawn": "Isolierter Bauer",
    "Weak Square": "Schwaches Feld",
    Opposition: "Opposition",
    Zugzwang: "Zugzwang",
    "Rook Behind the Passed Pawn": "Turm hinter dem Freibauern",
    "One piece attacks two or more enemy pieces at the same time.":
      "Eine Figur greift gleichzeitig zwei oder mehr gegnerische Figuren an.",
    "Knights are especially dangerous fork pieces because their attacks cannot be blocked.":
      "Springer sind besonders gefährliche Gabelfiguren, weil ihre Angriffe nicht blockiert werden können.",
    "A piece cannot move without exposing a more valuable piece behind it.":
      "Eine Figur kann sich nicht bewegen, ohne eine wertvollere Figur dahinter freizulegen.",
    "An absolute pin happens when moving the pinned piece would expose the king.":
      "Eine absolute Fesselung liegt vor, wenn das Ziehen der gefesselten Figur den König freilegen würde.",
    "A valuable piece is attacked and forced to move, exposing another piece behind it.":
      "Eine wertvolle Figur wird angegriffen und muss ziehen, wodurch eine Figur dahinter freigelegt wird.",
    "Think of a skewer as the reverse of a pin: the more valuable piece is in front.":
      "Ein Spieß ist gewissermaßen die Umkehrung einer Fesselung: Die wertvollere Figur steht vorne.",
    "Moving one piece reveals an attack from another piece that was previously blocked.":
      "Das Ziehen einer Figur öffnet den Angriff einer anderen Figur, die zuvor blockiert war.",
    "If the revealed attack is a check, it is called a discovered check.":
      "Ist der freigelegte Angriff ein Schach, spricht man von Abzugsschach.",
    "One move creates two threats at the same time.":
      "Ein Zug erzeugt gleichzeitig zwei Drohungen.",
    "A fork is one kind of double attack, but double attacks can also involve different pieces.":
      "Eine Gabel ist eine Form des Doppelangriffs, aber Doppelangriffe können auch verschiedene Figuren einbeziehen.",
    "A piece is undefended or can be captured without enough compensation.":
      "Eine Figur ist ungedeckt oder kann ohne ausreichenden Gegenwert geschlagen werden.",
    "Before every move, quickly check whether any of your pieces are left undefended.":
      "Prüfe vor jedem Zug kurz, ob eine deiner Figuren ungedeckt ist.",
    "A king is trapped behind its own pawns and is checkmated by a rook or queen along the back rank.":
      "Ein König ist hinter seinen eigenen Bauern eingeschlossen und wird von Turm oder Dame auf der Grundreihe mattgesetzt.",
    "Creating an escape square for your king can prevent many back-rank mating ideas.":
      "Ein Luftloch für den König verhindert viele Grundreihenmotive.",
    "A file with no pawns on it. Rooks and queens often become very active there.":
      "Eine Linie ohne Bauern. Türme und Damen werden dort oft sehr aktiv.",
    "Try to place a rook on an open file, especially if it leads toward the opponent's position.":
      "Stelle möglichst einen Turm auf eine offene Linie, besonders wenn sie in die gegnerische Stellung führt.",
    "A pawn with no opposing pawns in front of it or on neighboring files that can stop its advance.":
      "Ein Bauer ohne gegnerische Bauern vor sich oder auf benachbarten Linien, die seinen Vormarsch stoppen können.",
    "Passed pawns become increasingly dangerous as the game approaches the endgame.":
      "Freibauern werden zum Endspiel hin immer gefährlicher.",
    "A pawn with no friendly pawn on the neighboring files.":
      "Ein Bauer ohne eigenen Bauern auf den Nachbarlinien.",
    "An isolated pawn may be weak, but it can also provide space and active piece play.":
      "Ein isolierter Bauer kann schwach sein, aber auch Raum und aktives Figurenspiel ermöglichen.",
    "A square that cannot easily be protected by a pawn and can become a strong outpost for an enemy piece.":
      "Ein Feld, das nur schwer von einem Bauern geschützt werden kann und zum starken Vorposten für eine gegnerische Figur werden kann.",
    "Knights are particularly strong when they can occupy a protected weak square.":
      "Springer sind besonders stark auf einem geschützten schwachen Feld.",
    "Keeping the king protected from open lines, checks, and tactical attacks.":
      "Den König vor offenen Linien, Schachs und taktischen Angriffen schützen.",
    "In the opening, castling is often more important than trying to win a pawn.":
      "In der Eröffnung ist die Rochade oft wichtiger als der Gewinn eines Bauern.",
    "A king-versus-king relationship where one king can force the other to give way.":
      "Eine Königsstellung, in der ein König den anderen zum Ausweichen zwingen kann.",
    "Opposition is especially important in king-and-pawn endings.":
      "Opposition ist besonders wichtig in König-und-Bauer-Endspielen.",
    "A position where every legal move makes the player's position worse.":
      "Eine Stellung, in der jeder legale Zug die eigene Position verschlechtert.",
    "Zugzwang appears frequently in pawn endings and simplified endgames.":
      "Zugzwang tritt häufig in Bauernendspielen und vereinfachten Endspielen auf.",
    "A common endgame principle: rooks are often most active behind passed pawns, whether friendly or enemy.":
      "Ein häufiges Endspielprinzip: Türme stehen oft am aktivsten hinter Freibauern – eigenen wie gegnerischen.",
    "From behind, the rook can support its own pawn or attack an enemy pawn while remaining active.":
      "Von hinten kann der Turm den eigenen Bauern unterstützen oder einen gegnerischen Bauern angreifen und aktiv bleiben.",
    Puzzles: "Aufgaben",
    "Solve interactively": "Interaktiv lösen",
    "Interactive Chess Puzzles": "Interaktive Schachaufgaben",
    "Find the best move": "Finde den besten Zug",
    "Play the position, get instant feedback, and learn why moves work.":
      "Spiele die Stellung, erhalte sofortiges Feedback und lerne, warum Züge funktionieren.",
    "All puzzles": "Alle Aufgaben",
    Tactics: "Taktik",
    Checkmates: "Mattaufgaben",
    Puzzle: "Aufgabe",
    Goal: "Ziel",
    Difficulty: "Schwierigkeit",
    Beginner: "Anfänger",
    Intermediate: "Mittel",
    Advanced: "Fortgeschritten",
    "Select a piece and make your move.":
      "Wähle eine Figur und spiele deinen Zug.",
    "Correct!": "Richtig!",
    "Excellent move.": "Ausgezeichneter Zug.",
    "Try another move.": "Versuche einen anderen Zug.",
    "That move is not legal in this position.":
      "Dieser Zug ist in dieser Stellung nicht legal.",
    "Legal move, but not one of the four teaching candidates.":
      "Legal, aber keiner der vier Lernkandidaten.",
    "Combination continues": "Die Kombination geht weiter",
    "Opponent reply": "Gegnerische Antwort",
    "Your move again": "Du bist wieder am Zug",
    "Solved!": "Gelöst!",
    "You found the full combination.":
      "Du hast die vollständige Kombination gefunden.",
    "Reset puzzle": "Aufgabe zurücksetzen",
    "Next puzzle": "Nächste Aufgabe",
    "Show move analysis": "Zuganalyse zeigen",
    "Hide move analysis": "Zuganalyse ausblenden",
    "Candidate move analysis": "Analyse der Kandidatenzüge",
    "Best move": "Bester Zug",
    "2nd choice": "2. Wahl",
    "3rd choice": "3. Wahl",
    "Worst move": "Schlechtester Zug",
    Line: "Variante",
    "Curated teaching ranking — not a live engine evaluation.":
      "Didaktische Auswahl — keine Live-Engine-Bewertung.",
    "Mate in 1": "Matt in 1",
    "Mate in 2": "Matt in 2",
    "Win material": "Material gewinnen",
    "Royal Fork": "Königsgabel",
    "Win the queen with a knight fork.":
      "Gewinne die Dame mit einer Springergabel.",
    "Loose Queen": "Ungedeckte Dame",
    "Spot the hanging queen and take it.":
      "Erkenne die ungedeckte Dame und schlage sie.",
    "Find checkmate in one.": "Finde Schachmatt in einem Zug.",
    "Smothered Mate": "Ersticktes Matt",
    "Deflection to the Back Rank": "Ablenkung zur Grundreihe",
    "Force mate in two by deflecting the queen.":
      "Erzwinge Matt in zwei durch Ablenkung der Dame.",
    "Queen Sacrifice Smothered Mate": "Damenopfer zum erstickten Matt",
    "Force mate in two with a queen sacrifice.":
      "Erzwinge Matt in zwei mit einem Damenopfer.",
    "The opponent reply is played automatically.":
      "Die gegnerische Antwort wird automatisch gespielt.",
    "The combination breaks here. Return to the forcing line.":
      "Hier bricht die Kombination ab. Kehre zur zwingenden Variante zurück.",
    "This is the key move of the puzzle.":
      "Das ist der Schlüsselzug der Aufgabe.",
    "Now finish the combination.": "Beende jetzt die Kombination.",
    "Representative reply": "Beispielantwort",
    Feedback: "Feedback",
    Highlighted: "Markiert",
    "Click a move to highlight it on the board.":
      "Klicke auf einen Zug, um ihn auf dem Brett farbig zu markieren.",
    "Absolute Pin": "Absolute Fesselung",
    "Exploit a pin": "Fesselung ausnutzen",
    "Win the pinned knight before it can escape.":
      "Gewinne den gefesselten Springer, bevor er entkommen kann.",
    "King and Queen Skewer": "König-Dame-Spieß",
    "Check the king and win the queen behind it.":
      "Gib Schach und gewinne anschließend die Dame hinter dem König.",
    "Discovered attack": "Abzugsangriff",
    "Use a forcing bishop move to uncover the rook against the queen.":
      "Nutze einen zwingenden Läuferzug, um den Turmangriff auf die Dame freizulegen.",
    "Improve the rook": "Turm verbessern",
    "Place your rook behind the passed pawn.":
      "Stelle deinen Turm hinter den Freibauern.",
    "Central Knight Outpost": "Zentraler Springer-Vorposten",
    "Find an outpost": "Vorposten finden",
    "Put the knight on a square enemy pawns cannot chase.":
      "Stelle den Springer auf ein Feld, von dem gegnerische Bauern ihn nicht vertreiben können.",
    "Create Luft": "Luft schaffen",
    "King safety": "Königssicherheit",
    "Create a safe escape square for your king without overextending the pawns.":
      "Schaffe ein sicheres Fluchtfeld für deinen König, ohne die Bauern unnötig weit vorzuschieben.",
    "You found the tactical point.": "Du hast das taktische Motiv gefunden.",
    "You found the strategic setup.":
      "Du hast die strategische Aufstellung gefunden.",
    "You found the strategic square.":
      "Du hast das strategische Feld gefunden.",
    "You improved the king's safety.":
      "Du hast die Königssicherheit verbessert.",
    "Really Hard": "Sehr schwer",
    "Clearance Sacrifice for Promotion": "Räumungsopfer zur Umwandlung",
    "Clear the promotion square": "Umwandlungsfeld freiräumen",
    "Sacrifice the rook so the pawn can promote with tempo.":
      "Opfere den Turm, damit der Bauer mit Tempo umwandeln kann.",
    "Deflection Before the Back-Rank Mate": "Ablenkung vor dem Grundreihenmatt",
    "Sacrifice the queen to remove the last defender of the back rank.":
      "Opfere die Dame, um den letzten Verteidiger der Grundreihe zu entfernen.",
    "Boden's Mate": "Bodens Matt",
    "Sacrifice the queen to open both diagonals around the king.":
      "Opfere die Dame, um beide Diagonalen um den König zu öffnen.",
    "Légal's Mate": "Légals Matt",
    "Mate in 3": "Matt in 3",
    "Ignore the attacked queen and calculate the mating combination to the end.":
      "Ignoriere die angegriffene Dame und berechne die Mattkombination bis zum Ende.",
    "Greek Gift Attack": "Griechisches Geschenk",
    "Build a mating attack": "Mattangriff aufbauen",
    "Sacrifice the bishop, force the king out, and bring the queen into the attack.":
      "Opfere den Läufer, zwinge den König heraus und bringe die Dame in den Angriff.",
    "The opponent accepts the queen.": "Der Gegner nimmt die Dame.",
    "The opponent accepts the bishop.": "Der Gegner nimmt den Läufer.",
    "You built the classic Greek Gift attacking setup.":
      "Du hast die klassische Angriffsstellung des griechischen Geschenks aufgebaut.",
    "Difficulty progression": "Schwierigkeitsverlauf",
    "Trade Queens When You Are Ahead": "Damen tauschen, wenn du vorne liegst",
    "Simplify when ahead": "Vereinfachen bei Materialvorteil",
    "You are up a rook. Remove the opponent's queen and reduce counterplay.":
      "Du hast einen Turm mehr. Tausche die gegnerische Dame und reduziere das Gegenspiel.",
    "This is the clean simplifying move.": "Das ist die saubere Vereinfachung.",
    "The queens are gone and your extra rook becomes much easier to use.":
      "Die Damen sind verschwunden und dein Mehrturm lässt sich viel leichter verwerten.",
    "Keep Queens When You Are Behind": "Damen behalten, wenn du hinten liegst",
    "Avoid the wrong trade": "Den falschen Tausch vermeiden",
    "You are down a rook. Keep the queens and create checking chances.":
      "Du hast einen Turm weniger. Behalte die Damen und suche Schachgebote.",
    "You kept the queen and created immediate activity.":
      "Du hast die Dame behalten und sofort Aktivität erzeugt.",
    "Trade a Bad Bishop for a Strong Knight":
      "Schlechten Läufer gegen starken Springer tauschen",
    "Choose the right exchange": "Den richtigen Tausch wählen",
    "Remove the opponent's powerful central knight instead of letting it dominate the board.":
      "Entferne den starken zentralen Springer, statt ihn das Brett beherrschen zu lassen.",
    "You exchanged an ordinary bishop for the opponent's best-placed piece.":
      "Du hast einen gewöhnlichen Läufer gegen die bestplatzierte gegnerische Figur getauscht.",
    "The dangerous knight is gone, and Black is left with a pawn on d5 instead.":
      "Der gefährliche Springer ist weg und Schwarz hat stattdessen nur noch einen Bauern auf d5.",
    "Open the Center Against an Exposed King":
      "Das Zentrum gegen einen ungeschützten König öffnen",
    "Open the center": "Zentrum öffnen",
    "The enemy king is stuck in the middle. Open lines before it can become safe.":
      "Der gegnerische König steckt in der Mitte. Öffne Linien, bevor er sich retten kann.",
    "Opening the e-file immediately exposes the king.":
      "Das Öffnen der e-Linie setzt den König sofort unter Druck.",
    "Keep the Center Closed When Your King Is Unsafe":
      "Das Zentrum geschlossen halten, wenn dein König unsicher steht",
    "Do not open too early": "Nicht zu früh öffnen",
    "Your king is still exposed and Black's pieces are ready. Keep the center closed until you are safer.":
      "Dein König steht noch unsicher und die schwarzen Figuren sind bereit. Halte das Zentrum geschlossen, bis dein König sicherer ist.",
    "You kept the dangerous central file closed.":
      "Du hast die gefährliche zentrale Linie geschlossen gehalten.",
    Selected: "Ausgewählt",
  },
  bar: {
    Language: "Sproch",
    "Learn Chess": "Schach lerna",
    "Chess Rules & Tips": "Schachregeln & Tipps",
    "Rules, openings, and common chess patterns":
      "Regeln, Eröffnungen und typische Schachmuster",
    "Back to Chess": "Zruck zum Schach",
    "Rules & Tips": "Regeln & Tipps",
    "Learn the basics": "Grundlagen lerna",
    "Chess Openings": "Schacheröffnungen",
    "Openings (not for beginners yet)": "Eröffnungen (no ned fia Anfänger)",
    "Recognize common starts": "Typische Anfäng erkenna",
    "Typical Situations": "Typische Situationen",
    "Learn recurring patterns": "Wiederkehrende Muster lerna",
    "Selected piece": "Ausgwählte Figur",
    "Can move": "Ko hi ziagn",
    "Can capture": "Ko schlogn",
    "Attack / danger / key squares": "Angriff / Gfoahr / wichtige Felda",
    Step: "Schritt",
    "Start position": "Startstellung",
    "After it has moved": "Wenn da Baua scho zogn hod",
    Before: "Vorher",
    "After O-O": "Nach O-O",
    "After O-O-O": "Nach O-O-O",
    "Kingside castling (O-O)": "Kurze Rochade (O-O)",
    "Queenside castling (O-O-O)": "Lange Rochade (O-O-O)",
    "After ...d7-d5": "Nach ...d7-d5",
    "After exd6 e.p.": "Nach exd6 e.p.",
    "Pawn on 7th rank": "Bauer auf der 7. Reihe",
    Promoted: "Umgewandelt",
    "Goal of the Game": "Ziel vom Spiel",
    "How a Turn Works": "Wia a Zug funktioniert",
    "A Good Beginner Plan": "A guada Plan fia Anfänger",
    "The Pieces": "De Figuren",
    "How every chess piece moves": "Wia jede Schachfigur ziagt",
    "Piece values are useful estimates for comparing trades. They are not strict rules: position, king safety, and activity can make a piece more or less valuable.":
      "Figurenwerte helfen beim Einschätzen von Abtauschen. Sie sind keine festen Regeln: Stellung, Königssicherheit und Aktivität können den Wert einer Figur verändern.",
    "Your goal is to checkmate the opponent's king. Checkmate means the king is under attack and there is no legal move that removes the threat.":
      "Dei Ziel is, an gegnerischen Kini schachmatt zum setzn. Schachmatt hoaßt: Da Kini werd og'griffa und es gibt koan legalen Zug mehr, der de Gfoahr beseitigt.",
    "White moves first. Players then alternate one move at a time. On your turn, move exactly one piece, except during castling where the king and rook move together.":
      "Weiß fangt o. Danach ziagt ma abwechselnd. Pro Zug ziagst genau a Figur, außer bei da Rochade, do ziagn Kini und Turm zamm.",
    "Control the center, develop knights and bishops, castle early, avoid moving the same piece repeatedly without a reason, and check whether your opponent threatens something before every move.":
      "Kontrollier s Zentrum, entwickl Springa und Läufa, rochier früh, ziag ned ohne Grund dauernd dieselbe Figur und schau vor jedem Zug, wos da Gegner droht.",
    "Typical value": "Typischer Wert",
    "Tip:": "Tipp:",
    Pawn: "Baua",
    Knight: "Springa",
    Bishop: "Läufa",
    Rook: "Turm",
    Queen: "Dame",
    King: "Kini",
    "Moves one square forward. From its starting square it may move two squares. Pawns capture one square diagonally forward.":
      "A Baua ziagt oan Schritt vorwärts. Aus da Startstellung derf er aa zwoa Felda ziagn. Schlogn duat er schräg oan Schritt nach vorn.",
    "Pawns cannot move backward. A pawn reaching the last rank must be promoted.":
      "Bauern kenna ned rückwärts ziagn. Kummt a Baua auf de letzte Reih, muaß er umgwandelt werdn.",
    "Moves in an L-shape: two squares in one direction and then one square sideways.":
      "Da Springa ziagt in L-Form: zwoa Felda in oane Richtung und dann oan Schritt auf d'Seitn.",
    "The knight is the only piece that can jump over other pieces.":
      "Da Springa is de einzige Figur, de über andere Figuren drüberspringa ko.",
    "Moves any number of squares diagonally, as long as no piece blocks the path.":
      "Zieht beliebig weit diagonal, solange keine Figur den Weg blockiert.",
    "A bishop always remains on the same square color for the entire game.":
      "Ein Läufer bleibt während der gesamten Partie auf derselben Feldfarbe.",
    "Moves any number of squares horizontally or vertically, as long as the path is clear.":
      "Zieht beliebig weit waagerecht oder senkrecht, solange der Weg frei ist.",
    "Rooks become especially powerful on open files and in the endgame.":
      "Türme sind besonders auf offenen Linien und im Endspiel stark.",
    "Moves any number of squares horizontally, vertically, or diagonally.":
      "Zieht beliebig weit waagerecht, senkrecht oder diagonal.",
    "The queen is the most powerful piece, but bringing it out too early can make it an easy target.":
      "Die Dame ist die stärkste Figur, kann aber bei zu früher Entwicklung leicht angegriffen werden.",
    "Moves one square in any direction. The king may never move onto a square attacked by the opponent.":
      "Zieht ein Feld in jede Richtung. Der König darf niemals auf ein vom Gegner angegriffenes Feld ziehen.",
    "The king has no normal point value because losing it by checkmate ends the game.":
      "Der König hat keinen normalen Punktwert, weil Schachmatt die Partie beendet.",
    "From d2: move to d3 or d4; capture on c3 or e3.":
      "Von d2 auf d3 oder d4 ziagn; auf c3 oder e3 schlogn.",
    "From d5: move to d6; capture on c6 or e6.":
      "Von d5 auf d6 ziagn; auf c6 oder e6 schlogn.",
    "A knight on d4 can reach up to eight squares.":
      "A Springa auf d4 ko bis zu acht Felda erreichen.",
    "A bishop moves only on diagonals.": "A Läufa ziagt bloß diagonal.",
    "A rook moves along ranks and files.":
      "A Turm ziagt auf Reihen und Linien.",
    "The queen combines rook and bishop movement.":
      "D Dame kombiniert Turm- und Läuferzüge.",
    "The king moves one square in any direction.":
      "Da Kini ziagt oa Feld in jede Richtung.",
    "King Safety": "Kini-Sicherheit",
    "Check and checkmate": "Schach und Schachmatt",
    "Understanding the difference between check and checkmate is the most important rule in chess.":
      "Den Unterschied zwischen Schach und Schachmatt zu verstehen, gehört zu den wichtigsten Schachregeln.",
    Check: "Schach",
    Checkmate: "Schachmatt",
    "The king is in check when an enemy piece attacks it. The player must immediately respond by doing one of three things:":
      "Da Kini steht im Schach, wenn'n a gegnerische Figur ogreift. Dann muaßt sofort auf oane von drei Arten reagieren:",
    "Move the king to a safe square.": "Ziag an Kini auf a sichers Feld.",
    "Capture the attacking piece.": "Schlog de angreifende Figur.",
    "Block the attack, if the attacking piece allows it.":
      "Blockier den Angriff, wenn's geht.",
    "You may never make a move that leaves your own king in check.":
      "Du derfst koan Zug macha, bei dem dei eigener Kini im Schach bleibt.",
    "Checkmate occurs when the king is in check and there is no legal way to escape.":
      "Schachmatt liegt vor, wenn der König im Schach steht und es keinen legalen Ausweg gibt.",
    "The game ends immediately. The player delivering checkmate wins, even if the winning side has fewer pieces.":
      "Die Partie endet sofort. Wer Schachmatt setzt, gewinnt – auch mit weniger Material.",
    "The rook attacks the king along the open e-file.":
      "Da Turm greift an Kini auf da offenen e-Linie o.",
    "White is checked and has no legal escape square.":
      "Weiß steht im Schach und hod koa legales Fluchtfeld.",
    "Special Rules": "Sonderregeln",
    "Castling, en passant, and promotion": "Rochade, en passant und Umwandlung",
    "These are the three special move rules every chess player should know.":
      "Diese drei Sonderregeln sollte jeder Schachspieler kennen.",
    Castling: "Rochade",
    "En Passant": "En Passant",
    Promotion: "Umwandlung",
    "Castling moves the king two squares toward a rook, then places the rook on the square next to the king.":
      "Bei der Rochade zieht der König zwei Felder in Richtung eines Turms; anschließend wird der Turm direkt neben den König gestellt.",
    "The king and that rook must not have moved before.":
      "König und beteiligter Turm dürfen vorher noch nicht gezogen haben.",
    "The squares between them must be empty.":
      "Die Felder zwischen ihnen müssen frei sein.",
    "The king may not be in check.": "Der König darf nicht im Schach stehen.",
    "The king may not cross or land on an attacked square.":
      "Der König darf kein angegriffenes Feld überqueren oder darauf landen.",
    "If an enemy pawn moves two squares from its starting position and lands directly beside your pawn, your pawn may capture it as if it had moved only one square.":
      "Zieht ein gegnerischer Bauer von seiner Ausgangsstellung zwei Felder und landet direkt neben deinem Bauern, darfst du ihn schlagen, als wäre er nur ein Feld gezogen.",
    "Important: en passant is only available immediately on the next move. If you do something else first, the opportunity disappears.":
      "Wichtig: En passant ist nur unmittelbar im nächsten Zug möglich. Spielst du zuerst etwas anderes, verfällt die Möglichkeit.",
    "When a pawn reaches the last rank, it must immediately become a queen, rook, bishop, or knight.":
      "Erreicht ein Bauer die letzte Reihe, muss er sofort in Dame, Turm, Läufer oder Springer umgewandelt werden.",
    "Most promotions choose a queen, but sometimes a knight, rook, or bishop is the best choice. This is called underpromotion.":
      "Meist wird zur Dame umgewandelt, manchmal ist jedoch Springer, Turm oder Läufer besser. Das nennt man Unterverwandlung.",
    "Piece Values": "Figurenwerte",
    "A simple guide to material": "Ein einfacher Leitfaden zum Material",
    "Use values as a quick guide when deciding whether a trade is favorable.":
      "Nutze die Werte als schnelle Orientierung, ob ein Abtausch günstig ist.",
    Piece: "Figur",
    "Quick Tips": "Kurze Tipps",
    "Six habits that immediately improve beginner play":
      "Sechs Gewohnheiten, die Anfängern sofort helfen",
    "You do not need to memorize hundreds of moves. These simple habits already prevent many common mistakes.":
      "Du musst keine Hunderte Züge auswendig lernen. Diese einfachen Gewohnheiten verhindern bereits viele typische Fehler.",
    "Before every move, ask: Is my king safe?":
      "Frag di vor jedem Zug: Is mei Kini sicher?",
    "Check whether your opponent attacks one of your pieces.":
      "Schau, ob da Gegner oane von deine Figuren angreift.",
    "Develop knights and bishops before moving the queen many times.":
      "Entwickle Springer und Läufer, bevor du die Dame mehrfach ziehst.",
    "Try to castle before starting an attack.":
      "Versuch zum rochiern, bevorst an Angriff startst.",
    "Do not trade a valuable piece for a much cheaper one without a reason.":
      "Tausche keine wertvolle Figur ohne guten Grund gegen eine deutlich billigere.",
    "When unsure, look for checks, captures, and threats.":
      "Wennst da ned sicher bist, schau nach Schachs, Schlagzügen und Drohungen.",
    "Important openings worth recognizing":
      "Wichtige Eröffnungen, die man erkennen sollte",
    "You do not need to memorize every variation. First learn the basic idea behind each opening and understand why the opening moves fight for development, king safety, and central control.":
      "Du musst nicht jede Variante auswendig lernen. Verstehe zuerst die Grundidee jeder Eröffnung und warum die Züge um Entwicklung, Königssicherheit und Zentrum kämpfen.",
    "Beginner advice:": "Anfängertipp:",
    "Learn the opening principles first. Opening names become useful because they help you recognize familiar positions, not because you must memorize long sequences.":
      "Lerne zuerst die Eröffnungsprinzipien. Namen helfen dir, bekannte Stellungen wiederzuerkennen – nicht, um lange Varianten auswendig zu lernen.",
    "Opening Principles": "Eröffnungsprinzipien",
    "What matters more than memorization":
      "Was wichtiger ist als Auswendiglernen",
    "If your opponent leaves theory early, these principles tell you what to do next.":
      "Wenn dein Gegner früh von der Theorie abweicht, helfen dir diese Prinzipien weiter.",
    "Control the center": "Zentrum kontrollieren",
    "Central squares give your pieces more space and influence.":
      "Zentralfelder geben deinen Figuren mehr Raum und Einfluss.",
    "Develop pieces": "Figuren entwickeln",
    "Bring knights and bishops into the game instead of moving one piece repeatedly.":
      "Bringe Springer und Läufer ins Spiel, statt dieselbe Figur immer wieder zu ziehen.",
    "Castle early": "Früh rochieren",
    "King safety usually matters more than grabbing an extra pawn in the opening.":
      "Königssicherheit ist in der Eröffnung meist wichtiger als ein zusätzlicher Bauer.",
    "Connect the rooks": "Türme verbinden",
    "After developing and castling, move the queen so your rooks can support each other.":
      "Nach Entwicklung und Rochade solltest du die Dame so stellen, dass sich die Türme gegenseitig unterstützen.",
    "Typical Chess Situations": "Typische Schachsituationen",
    "Patterns you will see again and again": "Muster, de immer wieder kemma",
    "Recognizing patterns is one of the fastest ways to improve. These ideas appear in games at every level.":
      "Muster zum erkenna is oana von de schnellsten Weg, besser zum werdn. De Motive kemma auf jedem Niveau vor.",
    All: "Ois",
    Tactic: "Taktik",
    Strategy: "Strategie",
    Endgame: "Endspui",
    "Remember:": "Merk da:",
    "Italian Game": "Italienische Partie",
    "Ruy Lopez": "Spanische Partie",
    "Sicilian Defense": "Sizilianische Verteidigung",
    "French Defense": "Französische Verteidigung",
    "Caro-Kann Defense": "Caro-Kann-Verteidigung",
    "Scandinavian Defense": "Skandinavische Verteidigung",
    "Queen's Gambit": "Damengambit",
    "King's Indian Defense": "Königsindische Verteidigung",
    "Nimzo-Indian Defense": "Nimzo-Indische Verteidigung",
    "English Opening": "Englische Eröffnung",
    "London System": "London-System",
    "King's Gambit": "Königsgambit",
    "Open Game": "Offene Partie",
    "Semi-Open Game": "Halboffene Partie",
    "Closed Game": "Geschlossene Partie",
    "Indian Defense": "Indische Verteidigung",
    "Flank Opening": "Flankeneröffnung",
    "System Opening": "Systemeröffnung",
    Gambit: "Gambit",
    "Develop quickly, control the center, prepare castling, and create pressure against f7.":
      "Schnell entwickeln, das Zentrum kontrollieren, die Rochade vorbereiten und Druck gegen f7 erzeugen.",
    "Pressure the knight that helps defend e5 and build a long-term positional game.":
      "Den Springer unter Druck setzen, der e5 verteidigt, und eine langfristige positionelle Stellung aufbauen.",
    "Black immediately fights for the center from the side and creates an unbalanced position.":
      "Schwarz kämpft sofort von der Seite um das Zentrum und erzeugt eine unausgeglichene Stellung.",
    "Black challenges White's center and usually builds a strong pawn structure before counterattacking.":
      "Schwarz greift das weiße Zentrum an und baut meist eine stabile Bauernstruktur auf, bevor der Gegenangriff beginnt.",
    "A solid defense that challenges the center while usually allowing the light-squared bishop to develop.":
      "Eine solide Verteidigung, die das Zentrum angreift und meist die Entwicklung des weißfeldrigen Läufers erlaubt.",
    "Black attacks the e4 pawn immediately and accepts early queen activity in exchange for direct central play.":
      "Schwarz greift den e4-Bauern sofort an und nimmt frühe Damenaktivität für direktes Zentrumsspiel in Kauf.",
    "White challenges Black's d5 pawn and tries to gain stronger central control.":
      "Weiß greift den schwarzen d5-Bauern an und versucht, stärkere Zentrumskontrolle zu erreichen.",
    "Black allows White to occupy the center, then attacks it later with pieces and pawn breaks.":
      "Schwarz lässt Weiß zunächst das Zentrum besetzen und greift es später mit Figuren und Bauernhebeln an.",
    "Black develops actively, pins the knight, and fights for control of the central dark squares.":
      "Schwarz entwickelt aktiv, fesselt den Springer und kämpft um die Kontrolle der zentralen schwarzen Felder.",
    "White controls the center indirectly and often reaches flexible positional structures.":
      "Weiß kontrolliert das Zentrum indirekt und erreicht häufig flexible positionelle Strukturen.",
    "A reliable development setup with a strong pawn center and easy kingside castling.":
      "Ein zuverlässiges Entwicklungssystem mit starkem Bauernzentrum und einfacher kurzer Rochade.",
    "White offers a pawn to open lines and accelerate an attack against the black king.":
      "Weiß opfert einen Bauern, um Linien zu öffnen und den Angriff gegen den schwarzen König zu beschleunigen.",
    Fork: "Gabel",
    Pin: "Fesselung",
    Skewer: "Spieß",
    "Discovered Attack": "Abzugsangriff",
    "Double Attack": "Doppelangriff",
    "Hanging Piece": "Ungedeckte Figur",
    "Back-Rank Mate": "Grundreihenmatt",
    "Open File": "Offene Linie",
    "Passed Pawn": "Freibauer",
    "Isolated Pawn": "Isolierter Bauer",
    "Weak Square": "Schwaches Feld",
    Opposition: "Opposition",
    Zugzwang: "Zugzwang",
    "Rook Behind the Passed Pawn": "Turm hinter dem Freibauern",
    "One piece attacks two or more enemy pieces at the same time.":
      "Eine Figur greift gleichzeitig zwei oder mehr gegnerische Figuren an.",
    "Knights are especially dangerous fork pieces because their attacks cannot be blocked.":
      "Springer sind besonders gefährliche Gabelfiguren, weil ihre Angriffe nicht blockiert werden können.",
    "A piece cannot move without exposing a more valuable piece behind it.":
      "Eine Figur kann sich nicht bewegen, ohne eine wertvollere Figur dahinter freizulegen.",
    "An absolute pin happens when moving the pinned piece would expose the king.":
      "Eine absolute Fesselung liegt vor, wenn das Ziehen der gefesselten Figur den König freilegen würde.",
    "A valuable piece is attacked and forced to move, exposing another piece behind it.":
      "Eine wertvolle Figur wird angegriffen und muss ziehen, wodurch eine Figur dahinter freigelegt wird.",
    "Think of a skewer as the reverse of a pin: the more valuable piece is in front.":
      "Ein Spieß ist gewissermaßen die Umkehrung einer Fesselung: Die wertvollere Figur steht vorne.",
    "Moving one piece reveals an attack from another piece that was previously blocked.":
      "Das Ziehen einer Figur öffnet den Angriff einer anderen Figur, die zuvor blockiert war.",
    "If the revealed attack is a check, it is called a discovered check.":
      "Ist der freigelegte Angriff ein Schach, spricht man von Abzugsschach.",
    "One move creates two threats at the same time.":
      "Ein Zug erzeugt gleichzeitig zwei Drohungen.",
    "A fork is one kind of double attack, but double attacks can also involve different pieces.":
      "Eine Gabel ist eine Form des Doppelangriffs, aber Doppelangriffe können auch verschiedene Figuren einbeziehen.",
    "A piece is undefended or can be captured without enough compensation.":
      "Eine Figur ist ungedeckt oder kann ohne ausreichenden Gegenwert geschlagen werden.",
    "Before every move, quickly check whether any of your pieces are left undefended.":
      "Prüfe vor jedem Zug kurz, ob eine deiner Figuren ungedeckt ist.",
    "A king is trapped behind its own pawns and is checkmated by a rook or queen along the back rank.":
      "Ein König ist hinter seinen eigenen Bauern eingeschlossen und wird von Turm oder Dame auf der Grundreihe mattgesetzt.",
    "Creating an escape square for your king can prevent many back-rank mating ideas.":
      "Ein Luftloch für den König verhindert viele Grundreihenmotive.",
    "A file with no pawns on it. Rooks and queens often become very active there.":
      "Eine Linie ohne Bauern. Türme und Damen werden dort oft sehr aktiv.",
    "Try to place a rook on an open file, especially if it leads toward the opponent's position.":
      "Stelle möglichst einen Turm auf eine offene Linie, besonders wenn sie in die gegnerische Stellung führt.",
    "A pawn with no opposing pawns in front of it or on neighboring files that can stop its advance.":
      "Ein Bauer ohne gegnerische Bauern vor sich oder auf benachbarten Linien, die seinen Vormarsch stoppen können.",
    "Passed pawns become increasingly dangerous as the game approaches the endgame.":
      "Freibauern werden zum Endspiel hin immer gefährlicher.",
    "A pawn with no friendly pawn on the neighboring files.":
      "Ein Bauer ohne eigenen Bauern auf den Nachbarlinien.",
    "An isolated pawn may be weak, but it can also provide space and active piece play.":
      "Ein isolierter Bauer kann schwach sein, aber auch Raum und aktives Figurenspiel ermöglichen.",
    "A square that cannot easily be protected by a pawn and can become a strong outpost for an enemy piece.":
      "Ein Feld, das nur schwer von einem Bauern geschützt werden kann und zum starken Vorposten für eine gegnerische Figur werden kann.",
    "Knights are particularly strong when they can occupy a protected weak square.":
      "Springer sind besonders stark auf einem geschützten schwachen Feld.",
    "Keeping the king protected from open lines, checks, and tactical attacks.":
      "Den König vor offenen Linien, Schachs und taktischen Angriffen schützen.",
    "In the opening, castling is often more important than trying to win a pawn.":
      "In der Eröffnung ist die Rochade oft wichtiger als der Gewinn eines Bauern.",
    "A king-versus-king relationship where one king can force the other to give way.":
      "Eine Königsstellung, in der ein König den anderen zum Ausweichen zwingen kann.",
    "Opposition is especially important in king-and-pawn endings.":
      "Opposition ist besonders wichtig in König-und-Bauer-Endspielen.",
    "A position where every legal move makes the player's position worse.":
      "Eine Stellung, in der jeder legale Zug die eigene Position verschlechtert.",
    "Zugzwang appears frequently in pawn endings and simplified endgames.":
      "Zugzwang tritt häufig in Bauernendspielen und vereinfachten Endspielen auf.",
    "A common endgame principle: rooks are often most active behind passed pawns, whether friendly or enemy.":
      "Ein häufiges Endspielprinzip: Türme stehen oft am aktivsten hinter Freibauern – eigenen wie gegnerischen.",
    "From behind, the rook can support its own pawn or attack an enemy pawn while remaining active.":
      "Von hinten kann der Turm den eigenen Bauern unterstützen oder einen gegnerischen Bauern angreifen und aktiv bleiben.",
    Puzzles: "Aufgabn",
    "Solve interactively": "Interaktiv lösn",
    "Interactive Chess Puzzles": "Interaktive Schachaufgabn",
    "Find the best move": "Find den bestn Zug",
    "All puzzles": "Alle Aufgabn",
    Tactics: "Taktik",
    Checkmates: "Mattaufgabn",
    "Correct!": "Richtig!",
    "Try another move.": "Probier an andern Zug.",
    "Solved!": "G'löst!",
    "Reset puzzle": "Aufgab zrucksetzn",
    "Next puzzle": "Nächste Aufgab",
    "Best move": "Bester Zug",
    "Worst move": "Schlechtester Zug",
    Highlighted: "Markiert",
    "Click a move to highlight it on the board.":
      "Klick auf an Zug, dann werd er am Brett farbig markiert.",
    "Absolute Pin": "Absolute Fesselung",
    "Create Luft": "Luft macha",
    "Really Hard": "Sau schwer",
    "Légal's Mate": "Légals Matt",
    "Greek Gift Attack": "Griechisches Gschenk",
    "Difficulty progression": "Schwierigkeitsverlauf",
    "Trade Queens When You Are Ahead": "Damen tauschn, wennst vorn bist",
    "Keep Queens When You Are Behind": "Damen behalten, wennst hint bist",
    "Open the center": "Zentrum aufmachn",
    "Do not open too early": "Ned z'friah aufmachn",
    Selected: "Ausg'wählt",
  },
  ko: {
    Language: "언어",
    "Learn Chess": "체스 배우기",
    "Chess Rules & Tips": "체스 규칙 & 팁",
    "Rules, openings, and common chess patterns":
      "규칙, 오프닝, 자주 나오는 체스 패턴",
    "Back to Chess": "체스로 돌아가기",
    "Rules & Tips": "규칙 & 팁",
    "Learn the basics": "기초 배우기",
    "Chess Openings": "체스 오프닝",
    "Openings (not for beginners yet)": "오프닝 (아직 초보자용 아님)",
    "Recognize common starts": "자주 나오는 시작 알아보기",
    "Typical Situations": "전형적인 상황",
    "Learn recurring patterns": "반복되는 패턴 배우기",
    "Selected piece": "선택된 기물",
    "Can move": "이동 가능",
    "Can capture": "잡을 수 있음",
    "Attack / danger / key squares": "공격 / 위험 / 핵심 칸",
    Step: "단계",
    "Start position": "시작 위치",
    "After it has moved": "이미 한 번 움직인 뒤",
    Before: "이전",
    "After O-O": "O-O 이후",
    "After O-O-O": "O-O-O 이후",
    "Kingside castling (O-O)": "킹사이드 캐슬링 (O-O)",
    "Queenside castling (O-O-O)": "퀸사이드 캐슬링 (O-O-O)",
    "After ...d7-d5": "...d7-d5 이후",
    "After exd6 e.p.": "exd6 e.p. 이후",
    "Pawn on 7th rank": "7랭크의 폰",
    Promoted: "프로모션 후",
    "Goal of the Game": "게임의 목표",
    "How a Turn Works": "한 턴은 어떻게 진행되나",
    "A Good Beginner Plan": "초보자를 위한 좋은 계획",
    "The Pieces": "기물",
    "How every chess piece moves": "각 체스 기물의 이동 방법",
    "Piece values are useful estimates for comparing trades. They are not strict rules: position, king safety, and activity can make a piece more or less valuable.":
      "기물 가치는 교환을 비교할 때 유용한 기준입니다. 절대적인 규칙은 아니며, 포지션·킹의 안전·기물 활동성에 따라 실제 가치는 달라집니다.",
    "Your goal is to checkmate the opponent's king. Checkmate means the king is under attack and there is no legal move that removes the threat.":
      "목표는 상대 킹을 체크메이트하는 것입니다. 체크메이트는 킹이 공격받고 있으며 그 위협을 제거할 합법적인 수가 없는 상태입니다.",
    "White moves first. Players then alternate one move at a time. On your turn, move exactly one piece, except during castling where the king and rook move together.":
      "백이 먼저 둡니다. 이후 서로 한 수씩 번갈아 둡니다. 한 턴에는 보통 기물 하나만 움직이지만, 캐슬링에서는 킹과 룩이 함께 움직입니다.",
    "Control the center, develop knights and bishops, castle early, avoid moving the same piece repeatedly without a reason, and check whether your opponent threatens something before every move.":
      "중앙을 장악하고 나이트와 비숍을 전개하며 일찍 캐슬링하세요. 이유 없이 같은 기물을 반복해서 움직이지 말고 매 수마다 상대의 위협을 확인하세요.",
    "Typical value": "일반적 가치",
    "Tip:": "팁:",
    Pawn: "폰",
    Knight: "나이트",
    Bishop: "비숍",
    Rook: "룩",
    Queen: "퀸",
    King: "킹",
    "Moves one square forward. From its starting square it may move two squares. Pawns capture one square diagonally forward.":
      "한 칸 앞으로 이동합니다. 시작 위치에서는 두 칸 이동할 수 있습니다. 잡을 때는 대각선 앞으로 한 칸 이동합니다.",
    "Pawns cannot move backward. A pawn reaching the last rank must be promoted.":
      "폰은 뒤로 갈 수 없습니다. 마지막 랭크에 도달한 폰은 반드시 승격해야 합니다.",
    "Moves in an L-shape: two squares in one direction and then one square sideways.":
      "L자 모양으로 움직입니다. 한 방향으로 두 칸, 옆으로 한 칸 이동합니다.",
    "The knight is the only piece that can jump over other pieces.":
      "나이트는 다른 기물을 뛰어넘을 수 있는 유일한 기물입니다.",
    "Moves any number of squares diagonally, as long as no piece blocks the path.":
      "다른 기물이 길을 막지 않는 한 대각선으로 원하는 만큼 이동합니다.",
    "A bishop always remains on the same square color for the entire game.":
      "비숍은 게임 내내 같은 색의 칸만 다닙니다.",
    "Moves any number of squares horizontally or vertically, as long as the path is clear.":
      "길이 비어 있다면 가로 또는 세로로 원하는 만큼 이동합니다.",
    "Rooks become especially powerful on open files and in the endgame.":
      "룩은 열린 파일과 엔드게임에서 특히 강력합니다.",
    "Moves any number of squares horizontally, vertically, or diagonally.":
      "가로, 세로, 대각선으로 원하는 만큼 이동합니다.",
    "The queen is the most powerful piece, but bringing it out too early can make it an easy target.":
      "퀸은 가장 강한 기물이지만 너무 일찍 전개하면 쉽게 공격 대상이 될 수 있습니다.",
    "Moves one square in any direction. The king may never move onto a square attacked by the opponent.":
      "모든 방향으로 한 칸 이동합니다. 상대가 공격하는 칸으로는 절대 이동할 수 없습니다.",
    "The king has no normal point value because losing it by checkmate ends the game.":
      "킹은 체크메이트되면 게임이 끝나므로 일반적인 점수 가치가 없습니다.",
    "From d2: move to d3 or d4; capture on c3 or e3.":
      "d2에서 d3 또는 d4로 이동하고, c3 또는 e3의 기물을 잡을 수 있습니다.",
    "From d5: move to d6; capture on c6 or e6.":
      "d5에서는 d6로만 이동하고, c6 또는 e6의 기물을 잡을 수 있습니다.",
    "A knight on d4 can reach up to eight squares.":
      "d4의 나이트는 최대 8개의 칸으로 이동할 수 있습니다.",
    "A bishop moves only on diagonals.": "비숍은 대각선으로만 이동합니다.",
    "A rook moves along ranks and files.":
      "룩은 랭크와 파일을 따라 이동합니다.",
    "The queen combines rook and bishop movement.":
      "퀸은 룩과 비숍의 이동을 모두 할 수 있습니다.",
    "The king moves one square in any direction.":
      "킹은 모든 방향으로 한 칸 이동합니다.",
    "King Safety": "킹 안전",
    "Check and checkmate": "체크와 체크메이트",
    "Understanding the difference between check and checkmate is the most important rule in chess.":
      "체크와 체크메이트의 차이를 이해하는 것은 체스에서 가장 중요한 규칙 중 하나입니다.",
    Check: "체크",
    Checkmate: "체크메이트",
    "The king is in check when an enemy piece attacks it. The player must immediately respond by doing one of three things:":
      "상대 기물이 킹을 공격하면 체크입니다. 플레이어는 즉시 다음 세 가지 중 하나로 대응해야 합니다.",
    "Move the king to a safe square.": "킹을 안전한 칸으로 이동합니다.",
    "Capture the attacking piece.": "공격 기물을 잡습니다.",
    "Block the attack, if the attacking piece allows it.":
      "가능하다면 공격 경로를 막습니다.",
    "You may never make a move that leaves your own king in check.":
      "자신의 킹을 체크 상태로 남겨 두는 수는 둘 수 없습니다.",
    "Checkmate occurs when the king is in check and there is no legal way to escape.":
      "킹이 체크 상태이고 합법적으로 벗어날 방법이 없으면 체크메이트입니다.",
    "The game ends immediately. The player delivering checkmate wins, even if the winning side has fewer pieces.":
      "게임은 즉시 끝나며, 기물이 더 적더라도 체크메이트를 만든 쪽이 승리합니다.",
    "The rook attacks the king along the open e-file.":
      "룩이 열린 e파일을 따라 킹을 공격합니다.",
    "White is checked and has no legal escape square.":
      "백 킹이 체크 상태이며 합법적인 탈출 칸이 없습니다.",
    "Special Rules": "특수 규칙",
    "Castling, en passant, and promotion": "캐슬링, 앙파상, 프로모션",
    "These are the three special move rules every chess player should know.":
      "모든 체스 플레이어가 알아야 할 세 가지 특수 규칙입니다.",
    Castling: "캐슬링",
    "En Passant": "앙파상",
    Promotion: "프로모션",
    "Castling moves the king two squares toward a rook, then places the rook on the square next to the king.":
      "캐슬링에서는 킹이 룩 쪽으로 두 칸 이동하고, 룩이 킹 바로 옆 칸으로 이동합니다.",
    "The king and that rook must not have moved before.":
      "킹과 해당 룩은 이전에 움직인 적이 없어야 합니다.",
    "The squares between them must be empty.":
      "둘 사이의 칸은 비어 있어야 합니다.",
    "The king may not be in check.": "킹은 체크 상태여서는 안 됩니다.",
    "The king may not cross or land on an attacked square.":
      "킹은 공격받는 칸을 지나거나 그 칸에 도착할 수 없습니다.",
    "If an enemy pawn moves two squares from its starting position and lands directly beside your pawn, your pawn may capture it as if it had moved only one square.":
      "상대 폰이 시작 위치에서 두 칸 전진해 내 폰 바로 옆에 오면, 한 칸만 움직인 것처럼 앙파상으로 잡을 수 있습니다.",
    "Important: en passant is only available immediately on the next move. If you do something else first, the opportunity disappears.":
      "중요: 앙파상은 바로 다음 수에서만 가능합니다. 다른 수를 먼저 두면 기회가 사라집니다.",
    "When a pawn reaches the last rank, it must immediately become a queen, rook, bishop, or knight.":
      "폰이 마지막 랭크에 도달하면 즉시 퀸, 룩, 비숍 또는 나이트로 승격해야 합니다.",
    "Most promotions choose a queen, but sometimes a knight, rook, or bishop is the best choice. This is called underpromotion.":
      "대부분 퀸으로 승격하지만 때로는 나이트, 룩, 비숍이 더 좋을 수 있습니다. 이를 언더프로모션이라고 합니다.",
    "Piece Values": "기물 가치",
    "A simple guide to material": "기물 가치에 대한 간단한 안내",
    "Use values as a quick guide when deciding whether a trade is favorable.":
      "교환이 유리한지 판단할 때 기물 가치를 빠른 기준으로 사용하세요.",
    Piece: "기물",
    "Quick Tips": "빠른 팁",
    "Six habits that immediately improve beginner play":
      "초보자의 실력을 바로 높이는 여섯 가지 습관",
    "You do not need to memorize hundreds of moves. These simple habits already prevent many common mistakes.":
      "수백 개의 수를 외울 필요는 없습니다. 이 간단한 습관만으로도 많은 흔한 실수를 줄일 수 있습니다.",
    "Before every move, ask: Is my king safe?":
      "매 수 전에 물어보세요: 내 킹은 안전한가?",
    "Check whether your opponent attacks one of your pieces.":
      "상대가 내 기물 중 하나를 공격하는지 확인하세요.",
    "Develop knights and bishops before moving the queen many times.":
      "퀸을 여러 번 움직이기 전에 나이트와 비숍을 전개하세요.",
    "Try to castle before starting an attack.":
      "공격을 시작하기 전에 캐슬링을 시도하세요.",
    "Do not trade a valuable piece for a much cheaper one without a reason.":
      "이유 없이 가치가 높은 기물을 훨씬 싼 기물과 교환하지 마세요.",
    "When unsure, look for checks, captures, and threats.":
      "확신이 없으면 체크, 잡기, 위협을 먼저 찾으세요.",
    "Important openings worth recognizing": "알아두면 좋은 주요 오프닝",
    "You do not need to memorize every variation. First learn the basic idea behind each opening and understand why the opening moves fight for development, king safety, and central control.":
      "모든 변형을 외울 필요는 없습니다. 먼저 각 오프닝의 기본 아이디어와 왜 전개·킹 안전·중앙 장악을 위해 이런 수를 두는지 이해하세요.",
    "Beginner advice:": "초보자 조언:",
    "Learn the opening principles first. Opening names become useful because they help you recognize familiar positions, not because you must memorize long sequences.":
      "먼저 오프닝 원칙을 배우세요. 오프닝 이름은 긴 수순을 암기하기 위해서가 아니라 익숙한 포지션을 알아보기 위해 유용합니다.",
    "Opening Principles": "오프닝 원칙",
    "What matters more than memorization": "암기보다 더 중요한 것",
    "If your opponent leaves theory early, these principles tell you what to do next.":
      "상대가 이론 수순에서 일찍 벗어나도 이 원칙들이 다음 수를 찾는 데 도움을 줍니다.",
    "Control the center": "중앙 장악",
    "Central squares give your pieces more space and influence.":
      "중앙 칸은 기물에 더 많은 공간과 영향력을 줍니다.",
    "Develop pieces": "기물 전개",
    "Bring knights and bishops into the game instead of moving one piece repeatedly.":
      "같은 기물을 반복해서 움직이기보다 나이트와 비숍을 전개하세요.",
    "Castle early": "일찍 캐슬링",
    "King safety usually matters more than grabbing an extra pawn in the opening.":
      "오프닝에서는 폰 하나를 더 얻는 것보다 킹 안전이 더 중요합니다.",
    "Connect the rooks": "룩 연결",
    "After developing and castling, move the queen so your rooks can support each other.":
      "전개와 캐슬링 후에는 퀸을 옮겨 두 룩이 서로 연결되게 하세요.",
    "Typical Chess Situations": "전형적인 체스 상황",
    "Patterns you will see again and again": "계속해서 만나게 되는 패턴",
    "Recognizing patterns is one of the fastest ways to improve. These ideas appear in games at every level.":
      "패턴을 알아보는 것은 가장 빠른 실력 향상 방법 중 하나입니다. 이런 아이디어는 모든 수준의 게임에서 나타납니다.",
    All: "전체",
    Tactic: "전술",
    Strategy: "전략",
    Endgame: "엔드게임",
    "Remember:": "기억하세요:",
    "Italian Game": "이탈리안 게임",
    "Ruy Lopez": "루이 로페즈",
    "Sicilian Defense": "시실리안 디펜스",
    "French Defense": "프렌치 디펜스",
    "Caro-Kann Defense": "카로칸 디펜스",
    "Scandinavian Defense": "스칸디나비안 디펜스",
    "Queen's Gambit": "퀸스 갬빗",
    "King's Indian Defense": "킹스 인디언 디펜스",
    "Nimzo-Indian Defense": "님조 인디언 디펜스",
    "English Opening": "잉글리시 오프닝",
    "London System": "런던 시스템",
    "King's Gambit": "킹스 갬빗",
    "Open Game": "오픈 게임",
    "Semi-Open Game": "세미 오픈 게임",
    "Closed Game": "클로즈드 게임",
    "Indian Defense": "인디언 디펜스",
    "Flank Opening": "플랭크 오프닝",
    "System Opening": "시스템 오프닝",
    Gambit: "갬빗",
    "Develop quickly, control the center, prepare castling, and create pressure against f7.":
      "빠르게 전개하고 중앙을 장악하며 캐슬링을 준비하고 f7에 압박을 가합니다.",
    "Pressure the knight that helps defend e5 and build a long-term positional game.":
      "e5를 방어하는 나이트를 압박하고 장기적인 포지셔널 게임을 만듭니다.",
    "Black immediately fights for the center from the side and creates an unbalanced position.":
      "흑은 측면에서 즉시 중앙에 도전해 비대칭적인 포지션을 만듭니다.",
    "Black challenges White's center and usually builds a strong pawn structure before counterattacking.":
      "흑은 백의 중앙에 도전하고 견고한 폰 구조를 만든 뒤 반격합니다.",
    "A solid defense that challenges the center while usually allowing the light-squared bishop to develop.":
      "중앙에 도전하면서 밝은 칸 비숍의 전개도 허용하는 견고한 방어입니다.",
    "Black attacks the e4 pawn immediately and accepts early queen activity in exchange for direct central play.":
      "흑은 e4 폰을 즉시 공격하고 직접적인 중앙 플레이를 위해 퀸을 일찍 움직이는 것을 감수합니다.",
    "White challenges Black's d5 pawn and tries to gain stronger central control.":
      "백은 흑의 d5 폰에 도전하며 더 강한 중앙 장악을 노립니다.",
    "Black allows White to occupy the center, then attacks it later with pieces and pawn breaks.":
      "흑은 백이 중앙을 차지하도록 두고 나중에 기물과 폰 브레이크로 공격합니다.",
    "Black develops actively, pins the knight, and fights for control of the central dark squares.":
      "흑은 적극적으로 전개하고 나이트를 핀하며 중앙의 어두운 칸을 장악하려 합니다.",
    "White controls the center indirectly and often reaches flexible positional structures.":
      "백은 중앙을 간접적으로 통제하며 유연한 포지셔널 구조를 만듭니다.",
    "A reliable development setup with a strong pawn center and easy kingside castling.":
      "강한 폰 중앙과 쉬운 킹사이드 캐슬링을 제공하는 안정적인 전개 시스템입니다.",
    "White offers a pawn to open lines and accelerate an attack against the black king.":
      "백은 폰 하나를 내주고 라인을 열어 흑 킹에 대한 공격을 빠르게 전개합니다.",
    Fork: "포크",
    Pin: "핀",
    Skewer: "스큐어",
    "Discovered Attack": "디스커버드 어택",
    "Double Attack": "더블 어택",
    "Hanging Piece": "무방비 기물",
    "Back-Rank Mate": "백랭크 메이트",
    "Open File": "오픈 파일",
    "Passed Pawn": "패스드 폰",
    "Isolated Pawn": "고립 폰",
    "Weak Square": "약한 칸",
    Opposition: "오포지션",
    Zugzwang: "추크츠방",
    "Rook Behind the Passed Pawn": "패스드 폰 뒤의 룩",
    "One piece attacks two or more enemy pieces at the same time.":
      "하나의 기물이 동시에 두 개 이상의 상대 기물을 공격합니다.",
    "Knights are especially dangerous fork pieces because their attacks cannot be blocked.":
      "나이트의 공격은 막을 수 없기 때문에 포크에 특히 강합니다.",
    "A piece cannot move without exposing a more valuable piece behind it.":
      "앞의 기물이 움직이면 뒤의 더 가치 있는 기물이 노출되는 상태입니다.",
    "An absolute pin happens when moving the pinned piece would expose the king.":
      "핀된 기물이 움직이면 킹이 체크에 노출되는 경우를 절대 핀이라고 합니다.",
    "A valuable piece is attacked and forced to move, exposing another piece behind it.":
      "가치 높은 기물이 공격받아 움직여야 하고, 그 뒤의 다른 기물이 노출됩니다.",
    "Think of a skewer as the reverse of a pin: the more valuable piece is in front.":
      "스큐어는 핀의 반대라고 생각하면 됩니다. 더 가치 있는 기물이 앞에 있습니다.",
    "Moving one piece reveals an attack from another piece that was previously blocked.":
      "한 기물을 움직여 이전에 막혀 있던 다른 기물의 공격을 열어 줍니다.",
    "If the revealed attack is a check, it is called a discovered check.":
      "열린 공격이 체크라면 디스커버드 체크라고 합니다.",
    "One move creates two threats at the same time.":
      "한 수로 두 가지 위협을 동시에 만듭니다.",
    "A fork is one kind of double attack, but double attacks can also involve different pieces.":
      "포크는 더블 어택의 한 종류이며, 서로 다른 기물이 두 위협을 만들 수도 있습니다.",
    "A piece is undefended or can be captured without enough compensation.":
      "기물이 방어되지 않거나 충분한 보상 없이 잡힐 수 있는 상태입니다.",
    "Before every move, quickly check whether any of your pieces are left undefended.":
      "매 수 전에 방어되지 않은 기물이 있는지 빠르게 확인하세요.",
    "A king is trapped behind its own pawns and is checkmated by a rook or queen along the back rank.":
      "킹이 자신의 폰 뒤에 갇혀 백랭크에서 룩이나 퀸에게 체크메이트되는 형태입니다.",
    "Creating an escape square for your king can prevent many back-rank mating ideas.":
      "킹에게 탈출 칸을 만들어 두면 많은 백랭크 메이트를 예방할 수 있습니다.",
    "A file with no pawns on it. Rooks and queens often become very active there.":
      "폰이 없는 파일입니다. 룩과 퀸이 매우 활발하게 활동할 수 있습니다.",
    "Try to place a rook on an open file, especially if it leads toward the opponent's position.":
      "가능하면 룩을 오픈 파일에 배치하세요. 특히 상대 진영으로 이어질 때 효과적입니다.",
    "A pawn with no opposing pawns in front of it or on neighboring files that can stop its advance.":
      "앞이나 인접 파일에 전진을 막을 상대 폰이 없는 폰입니다.",
    "Passed pawns become increasingly dangerous as the game approaches the endgame.":
      "패스드 폰은 엔드게임에 가까워질수록 더 위험해집니다.",
    "A pawn with no friendly pawn on the neighboring files.":
      "인접 파일에 같은 편 폰이 없는 폰입니다.",
    "An isolated pawn may be weak, but it can also provide space and active piece play.":
      "고립 폰은 약점이 될 수 있지만 공간과 적극적인 기물 활동을 제공하기도 합니다.",
    "A square that cannot easily be protected by a pawn and can become a strong outpost for an enemy piece.":
      "폰으로 쉽게 지킬 수 없어 상대 기물의 강한 전초기지가 될 수 있는 칸입니다.",
    "Knights are particularly strong when they can occupy a protected weak square.":
      "나이트는 보호받는 약한 칸을 차지할 때 특히 강합니다.",
    "Keeping the king protected from open lines, checks, and tactical attacks.":
      "열린 라인, 체크, 전술적 공격으로부터 킹을 보호하는 것입니다.",
    "In the opening, castling is often more important than trying to win a pawn.":
      "오프닝에서는 폰 하나를 얻는 것보다 캐슬링이 더 중요할 때가 많습니다.",
    "A king-versus-king relationship where one king can force the other to give way.":
      "킹 대 킹 상황에서 한 킹이 상대 킹에게 길을 양보하게 만드는 관계입니다.",
    "Opposition is especially important in king-and-pawn endings.":
      "오포지션은 킹과 폰 엔드게임에서 특히 중요합니다.",
    "A position where every legal move makes the player's position worse.":
      "어떤 합법적인 수를 두더라도 자신의 포지션이 더 나빠지는 상태입니다.",
    "Zugzwang appears frequently in pawn endings and simplified endgames.":
      "추크츠방은 폰 엔드게임과 단순화된 엔드게임에서 자주 등장합니다.",
    "A common endgame principle: rooks are often most active behind passed pawns, whether friendly or enemy.":
      "흔한 엔드게임 원칙입니다. 룩은 자신의 패스드 폰이든 상대의 패스드 폰이든 그 뒤에 있을 때 가장 활발한 경우가 많습니다.",
    "From behind, the rook can support its own pawn or attack an enemy pawn while remaining active.":
      "뒤에서 룩은 자신의 폰을 지원하거나 상대 폰을 공격하면서 활발하게 활동할 수 있습니다.",
    Puzzles: "퍼즐",
    "Solve interactively": "인터랙티브 풀이",
    "Interactive Chess Puzzles": "인터랙티브 체스 퍼즐",
    "Find the best move": "최선의 수를 찾으세요",
    "Play the position, get instant feedback, and learn why moves work.":
      "포지션에서 직접 수를 두고 즉시 피드백을 받으며 왜 좋은 수인지 배웁니다.",
    "All puzzles": "전체 퍼즐",
    Tactics: "전술",
    Checkmates: "체크메이트",
    Puzzle: "퍼즐",
    Goal: "목표",
    Difficulty: "난이도",
    Beginner: "초급",
    Intermediate: "중급",
    Advanced: "고급",
    "Select a piece and make your move.": "기물을 선택하고 수를 두세요.",
    "Correct!": "정답!",
    "Excellent move.": "훌륭한 수입니다.",
    "Try another move.": "다른 수를 시도해 보세요.",
    "That move is not legal in this position.":
      "이 포지션에서는 합법적인 수가 아닙니다.",
    "Legal move, but not one of the four teaching candidates.":
      "합법적인 수이지만 네 개의 학습 후보 수에는 포함되지 않습니다.",
    "Combination continues": "콤비네이션 계속",
    "Opponent reply": "상대의 응수",
    "Your move again": "다시 당신 차례입니다",
    "Solved!": "해결!",
    "You found the full combination.": "전체 콤비네이션을 찾았습니다.",
    "Reset puzzle": "퍼즐 초기화",
    "Next puzzle": "다음 퍼즐",
    "Show move analysis": "수 분석 보기",
    "Hide move analysis": "수 분석 숨기기",
    "Candidate move analysis": "후보 수 분석",
    "Best move": "최선의 수",
    "2nd choice": "2순위",
    "3rd choice": "3순위",
    "Worst move": "최악의 수",
    Line: "진행",
    "Curated teaching ranking — not a live engine evaluation.":
      "학습용으로 엄선한 순위이며 실시간 엔진 평가는 아닙니다.",
    "Mate in 1": "1수 메이트",
    "Mate in 2": "2수 메이트",
    "Win material": "기물 이득",
    "Royal Fork": "로열 포크",
    "Win the queen with a knight fork.": "나이트 포크로 퀸을 얻으세요.",
    "Loose Queen": "느슨한 퀸",
    "Spot the hanging queen and take it.": "보호받지 못한 퀸을 찾아 잡으세요.",
    "Find checkmate in one.": "한 수 체크메이트를 찾으세요.",
    "Smothered Mate": "스머더드 메이트",
    "Deflection to the Back Rank": "백랭크로의 디플렉션",
    "Force mate in two by deflecting the queen.":
      "퀸을 유인해 두 수 안에 메이트를 강제하세요.",
    "Queen Sacrifice Smothered Mate": "퀸 희생 스머더드 메이트",
    "Force mate in two with a queen sacrifice.":
      "퀸 희생으로 두 수 안에 메이트를 강제하세요.",
    "The opponent reply is played automatically.":
      "상대의 응수는 자동으로 진행됩니다.",
    "The combination breaks here. Return to the forcing line.":
      "이 수에서는 콤비네이션이 끊깁니다. 강제 수순으로 돌아가세요.",
    "This is the key move of the puzzle.": "이 수가 퍼즐의 핵심입니다.",
    "Now finish the combination.": "이제 콤비네이션을 마무리하세요.",
    "Representative reply": "대표 응수",
    Feedback: "피드백",
    Highlighted: "강조됨",
    "Click a move to highlight it on the board.":
      "수를 클릭하면 해당 수가 같은 색으로 보드에 강조됩니다.",
    "Absolute Pin": "절대 핀",
    "Exploit a pin": "핀 활용",
    "Win the pinned knight before it can escape.":
      "움직일 수 없는 핀된 나이트가 도망가기 전에 잡으세요.",
    "King and Queen Skewer": "킹-퀸 스큐어",
    "Check the king and win the queen behind it.":
      "킹을 체크해 움직이게 한 뒤 뒤에 있는 퀸을 잡으세요.",
    "Discovered attack": "디스커버드 어택",
    "Use a forcing bishop move to uncover the rook against the queen.":
      "강제적인 비숍 수로 룩의 퀸 공격 라인을 여세요.",
    "Improve the rook": "룩 개선",
    "Place your rook behind the passed pawn.":
      "룩을 패스드 폰 뒤에 배치하세요.",
    "Central Knight Outpost": "중앙 나이트 아웃포스트",
    "Find an outpost": "아웃포스트 찾기",
    "Put the knight on a square enemy pawns cannot chase.":
      "상대 폰이 쫓아낼 수 없는 칸에 나이트를 배치하세요.",
    "Create Luft": "루프트 만들기",
    "King safety": "킹 안전",
    "Create a safe escape square for your king without overextending the pawns.":
      "폰을 과도하게 전진시키지 않으면서 킹의 탈출 칸을 만드세요.",
    "You found the tactical point.": "전술의 핵심을 찾았습니다.",
    "You found the strategic setup.": "전략적인 배치를 찾았습니다.",
    "You found the strategic square.": "전략적인 핵심 칸을 찾았습니다.",
    "You improved the king's safety.": "킹의 안전을 개선했습니다.",
    "Really Hard": "최상급",
    "Clearance Sacrifice for Promotion": "승격을 위한 클리어런스 희생",
    "Clear the promotion square": "승격 칸 비우기",
    "Sacrifice the rook so the pawn can promote with tempo.":
      "룩을 희생해 폰이 템포를 얻으며 승격하도록 만드세요.",
    "Deflection Before the Back-Rank Mate": "백랭크 메이트 전 디플렉션",
    "Sacrifice the queen to remove the last defender of the back rank.":
      "퀸을 희생해 백랭크의 마지막 수비수를 제거하세요.",
    "Boden's Mate": "보든 메이트",
    "Sacrifice the queen to open both diagonals around the king.":
      "퀸을 희생해 킹 주변의 두 대각선을 모두 여세요.",
    "Légal's Mate": "레갈의 메이트",
    "Mate in 3": "3수 메이트",
    "Ignore the attacked queen and calculate the mating combination to the end.":
      "공격받는 퀸을 무시하고 마지막 체크메이트까지 수읽기하세요.",
    "Greek Gift Attack": "그릭 기프트 공격",
    "Build a mating attack": "메이팅 공격 구축",
    "Sacrifice the bishop, force the king out, and bring the queen into the attack.":
      "비숍을 희생해 킹을 끌어내고 퀸을 공격에 합류시키세요.",
    "The opponent accepts the queen.": "상대가 퀸을 잡습니다.",
    "The opponent accepts the bishop.": "상대가 비숍을 잡습니다.",
    "You built the classic Greek Gift attacking setup.":
      "전형적인 그릭 기프트 공격 배치를 완성했습니다.",
    "Difficulty progression": "난이도 진행",
    "Trade Queens When You Are Ahead": "앞서 있을 때 퀸 교환하기",
    "Simplify when ahead": "앞설 때 단순화",
    "You are up a rook. Remove the opponent's queen and reduce counterplay.":
      "룩 하나를 앞서고 있습니다. 상대 퀸을 교환해 반격 가능성을 줄이세요.",
    "This is the clean simplifying move.": "가장 깔끔하게 단순화하는 수입니다.",
    "The queens are gone and your extra rook becomes much easier to use.":
      "퀸이 사라지면 여분의 룩을 훨씬 쉽게 활용할 수 있습니다.",
    "Keep Queens When You Are Behind": "뒤질 때 퀸 유지하기",
    "Avoid the wrong trade": "잘못된 교환 피하기",
    "You are down a rook. Keep the queens and create checking chances.":
      "룩 하나가 부족합니다. 퀸을 남겨 체크와 반격 기회를 만드세요.",
    "You kept the queen and created immediate activity.":
      "퀸을 유지하면서 즉각적인 활동성을 만들었습니다.",
    "Trade a Bad Bishop for a Strong Knight":
      "나쁜 비숍을 강한 나이트와 교환하기",
    "Choose the right exchange": "올바른 교환 선택",
    "Remove the opponent's powerful central knight instead of letting it dominate the board.":
      "상대의 강력한 중앙 나이트가 보드를 지배하기 전에 제거하세요.",
    "You exchanged an ordinary bishop for the opponent's best-placed piece.":
      "평범한 비숍을 상대의 가장 잘 배치된 기물과 교환했습니다.",
    "The dangerous knight is gone, and Black is left with a pawn on d5 instead.":
      "위험한 나이트가 사라지고 흑은 d5의 폰만 남게 됩니다.",
    "Open the Center Against an Exposed King": "노출된 킹을 상대로 중앙 열기",
    "Open the center": "중앙 열기",
    "The enemy king is stuck in the middle. Open lines before it can become safe.":
      "상대 킹이 중앙에 갇혀 있습니다. 안전해지기 전에 라인을 여세요.",
    "Opening the e-file immediately exposes the king.":
      "e파일을 열면 즉시 상대 킹이 노출됩니다.",
    "Keep the Center Closed When Your King Is Unsafe":
      "내 킹이 불안할 때 중앙 닫아두기",
    "Do not open too early": "너무 일찍 열지 않기",
    "Your king is still exposed and Black's pieces are ready. Keep the center closed until you are safer.":
      "내 킹이 아직 노출되어 있고 흑 기물들이 준비되어 있습니다. 안전해질 때까지 중앙을 닫아두세요.",
    "You kept the dangerous central file closed.":
      "위험한 중앙 파일을 닫아두었습니다.",
    Selected: "선택됨",
  },
  ru: {
    Language: "Язык",
    "Learn Chess": "Учимся шахматам",
    "Chess Rules & Tips": "Правила и советы по шахматам",
    "Rules, openings, and common chess patterns":
      "Правила, дебюты и типичные шахматные мотивы",
    "Back to Chess": "Назад к шахматам",
    "Rules & Tips": "Правила и советы",
    "Learn the basics": "Изучить основы",
    "Chess Openings": "Шахматные дебюты",
    "Openings (not for beginners yet)": "Дебюты (пока не для начинающих)",
    "Recognize common starts": "Узнавать типичные начала",
    "Typical Situations": "Типичные ситуации",
    "Learn recurring patterns": "Изучать повторяющиеся мотивы",
    "Selected piece": "Выбранная фигура",
    "Can move": "Можно пойти",
    "Can capture": "Можно взять",
    "Attack / danger / key squares": "Атака / опасность / ключевые поля",
    Step: "Шаг",
    "Start position": "Начальная позиция",
    "After it has moved": "После первого хода",
    Before: "До",
    "After O-O": "После O-O",
    "After O-O-O": "После O-O-O",
    "Kingside castling (O-O)": "Короткая рокировка (O-O)",
    "Queenside castling (O-O-O)": "Длинная рокировка (O-O-O)",
    "After ...d7-d5": "После ...d7-d5",
    "After exd6 e.p.": "После exd6 e.p.",
    "Pawn on 7th rank": "Пешка на 7-й горизонтали",
    Promoted: "После превращения",
    "Goal of the Game": "Цель игры",
    "How a Turn Works": "Как проходит ход",
    "A Good Beginner Plan": "Хороший план для начинающего",
    "The Pieces": "Фигуры",
    "How every chess piece moves": "Как ходит каждая шахматная фигура",
    "Piece values are useful estimates for comparing trades. They are not strict rules: position, king safety, and activity can make a piece more or less valuable.":
      "Ценность фигур помогает оценивать размены. Это не строгие правила: позиция, безопасность короля и активность могут менять реальную ценность фигуры.",
    "Your goal is to checkmate the opponent's king. Checkmate means the king is under attack and there is no legal move that removes the threat.":
      "Цель — поставить мат королю соперника. Мат означает, что король атакован и нет ни одного легального хода, устраняющего угрозу.",
    "White moves first. Players then alternate one move at a time. On your turn, move exactly one piece, except during castling where the king and rook move together.":
      "Белые ходят первыми. Затем игроки делают ходы по очереди. Обычно за ход двигается одна фигура, кроме рокировки, когда двигаются король и ладья.",
    "Control the center, develop knights and bishops, castle early, avoid moving the same piece repeatedly without a reason, and check whether your opponent threatens something before every move.":
      "Контролируйте центр, развивайте коней и слонов, рано рокируйтесь, не ходите одной фигурой многократно без причины и перед каждым ходом проверяйте угрозы соперника.",
    "Typical value": "Обычная ценность",
    "Tip:": "Совет:",
    Pawn: "Пешка",
    Knight: "Конь",
    Bishop: "Слон",
    Rook: "Ладья",
    Queen: "Ферзь",
    King: "Король",
    "Moves one square forward. From its starting square it may move two squares. Pawns capture one square diagonally forward.":
      "Ходит на одно поле вперёд. Из начальной позиции может пойти на два поля. Бьёт на одно поле по диагонали вперёд.",
    "Pawns cannot move backward. A pawn reaching the last rank must be promoted.":
      "Пешки не ходят назад. Достигнув последней горизонтали, пешка обязана превратиться.",
    "Moves in an L-shape: two squares in one direction and then one square sideways.":
      "Ходит буквой «Г»: два поля в одном направлении и одно в сторону.",
    "The knight is the only piece that can jump over other pieces.":
      "Конь — единственная фигура, которая может перепрыгивать через другие фигуры.",
    "Moves any number of squares diagonally, as long as no piece blocks the path.":
      "Ходит по диагонали на любое число полей, пока путь не перекрыт.",
    "A bishop always remains on the same square color for the entire game.":
      "Слон всю партию остаётся на полях одного цвета.",
    "Moves any number of squares horizontally or vertically, as long as the path is clear.":
      "Ходит по горизонтали или вертикали на любое число полей, пока путь свободен.",
    "Rooks become especially powerful on open files and in the endgame.":
      "Ладьи особенно сильны на открытых линиях и в эндшпиле.",
    "Moves any number of squares horizontally, vertically, or diagonally.":
      "Ходит на любое число полей по горизонтали, вертикали или диагонали.",
    "The queen is the most powerful piece, but bringing it out too early can make it an easy target.":
      "Ферзь — самая сильная фигура, но слишком ранний выход делает его удобной мишенью.",
    "Moves one square in any direction. The king may never move onto a square attacked by the opponent.":
      "Ходит на одно поле в любом направлении. Король не может идти на поле, атакованное соперником.",
    "The king has no normal point value because losing it by checkmate ends the game.":
      "У короля нет обычной числовой ценности, потому что мат завершает игру.",
    "From d2: move to d3 or d4; capture on c3 or e3.":
      "С d2: ход на d3 или d4; взятие на c3 или e3.",
    "From d5: move to d6; capture on c6 or e6.":
      "С d5: ход на d6; взятие на c6 или e6.",
    "A knight on d4 can reach up to eight squares.":
      "Конь на d4 может попасть максимум на восемь полей.",
    "A bishop moves only on diagonals.": "Слон ходит только по диагоналям.",
    "A rook moves along ranks and files.":
      "Ладья ходит по горизонталям и вертикалям.",
    "The queen combines rook and bishop movement.":
      "Ферзь сочетает ходы ладьи и слона.",
    "The king moves one square in any direction.":
      "Король ходит на одно поле в любом направлении.",
    "King Safety": "Безопасность короля",
    "Check and checkmate": "Шах и мат",
    "Understanding the difference between check and checkmate is the most important rule in chess.":
      "Понимание разницы между шахом и матом — одно из важнейших правил шахмат.",
    Check: "Шах",
    Checkmate: "Мат",
    "The king is in check when an enemy piece attacks it. The player must immediately respond by doing one of three things:":
      "Король находится под шахом, когда его атакует фигура соперника. Игрок должен немедленно сделать одно из трёх:",
    "Move the king to a safe square.": "Увести короля на безопасное поле.",
    "Capture the attacking piece.": "Взять атакующую фигуру.",
    "Block the attack, if the attacking piece allows it.":
      "Перекрыть линию атаки, если это возможно.",
    "You may never make a move that leaves your own king in check.":
      "Нельзя делать ход, после которого собственный король остаётся под шахом.",
    "Checkmate occurs when the king is in check and there is no legal way to escape.":
      "Мат наступает, когда король под шахом и нет ни одного легального способа уйти от него.",
    "The game ends immediately. The player delivering checkmate wins, even if the winning side has fewer pieces.":
      "Партия заканчивается сразу. Побеждает тот, кто поставил мат, даже если у него меньше материала.",
    "The rook attacks the king along the open e-file.":
      "Ладья атакует короля по открытой вертикали e.",
    "White is checked and has no legal escape square.":
      "Белому королю дан шах, и безопасного легального поля нет.",
    "Special Rules": "Особые правила",
    "Castling, en passant, and promotion":
      "Рокировка, взятие на проходе и превращение",
    "These are the three special move rules every chess player should know.":
      "Это три специальных правила хода, которые должен знать каждый шахматист.",
    Castling: "Рокировка",
    "En Passant": "Взятие на проходе",
    Promotion: "Превращение",
    "Castling moves the king two squares toward a rook, then places the rook on the square next to the king.":
      "При рокировке король идёт на два поля к ладье, после чего ладья ставится рядом с королём.",
    "The king and that rook must not have moved before.":
      "Король и эта ладья не должны были ходить ранее.",
    "The squares between them must be empty.":
      "Поля между ними должны быть свободны.",
    "The king may not be in check.": "Король не должен находиться под шахом.",
    "The king may not cross or land on an attacked square.":
      "Король не может проходить через атакованное поле или останавливаться на нём.",
    "If an enemy pawn moves two squares from its starting position and lands directly beside your pawn, your pawn may capture it as if it had moved only one square.":
      "Если пешка соперника из начальной позиции идёт на два поля и оказывается рядом с вашей пешкой, её можно взять так, как будто она прошла только одно поле.",
    "Important: en passant is only available immediately on the next move. If you do something else first, the opportunity disappears.":
      "Важно: взятие на проходе возможно только немедленно следующим ходом. Если сыграть иначе, возможность исчезает.",
    "When a pawn reaches the last rank, it must immediately become a queen, rook, bishop, or knight.":
      "Достигнув последней горизонтали, пешка сразу превращается в ферзя, ладью, слона или коня.",
    "Most promotions choose a queen, but sometimes a knight, rook, or bishop is the best choice. This is called underpromotion.":
      "Чаще всего выбирают ферзя, но иногда лучше конь, ладья или слон. Это называется неполным превращением.",
    "Piece Values": "Ценность фигур",
    "A simple guide to material": "Простой ориентир по материалу",
    "Use values as a quick guide when deciding whether a trade is favorable.":
      "Используйте ценности как быстрый ориентир при оценке размена.",
    Piece: "Фигура",
    "Quick Tips": "Короткие советы",
    "Six habits that immediately improve beginner play":
      "Шесть привычек, которые сразу улучшают игру новичка",
    "You do not need to memorize hundreds of moves. These simple habits already prevent many common mistakes.":
      "Не нужно запоминать сотни ходов. Эти простые привычки уже помогают избежать многих типичных ошибок.",
    "Before every move, ask: Is my king safe?":
      "Перед каждым ходом спросите: мой король в безопасности?",
    "Check whether your opponent attacks one of your pieces.":
      "Проверьте, атакует ли соперник одну из ваших фигур.",
    "Develop knights and bishops before moving the queen many times.":
      "Развивайте коней и слонов, прежде чем многократно ходить ферзём.",
    "Try to castle before starting an attack.":
      "Постарайтесь рокироваться до начала атаки.",
    "Do not trade a valuable piece for a much cheaper one without a reason.":
      "Не меняйте дорогую фигуру на гораздо более дешёвую без причины.",
    "When unsure, look for checks, captures, and threats.":
      "Если сомневаетесь, ищите шахи, взятия и угрозы.",
    "Important openings worth recognizing":
      "Важные дебюты, которые стоит узнавать",
    "You do not need to memorize every variation. First learn the basic idea behind each opening and understand why the opening moves fight for development, king safety, and central control.":
      "Не нужно запоминать каждый вариант. Сначала поймите идею дебюта и зачем ходы борются за развитие, безопасность короля и центр.",
    "Beginner advice:": "Совет новичку:",
    "Learn the opening principles first. Opening names become useful because they help you recognize familiar positions, not because you must memorize long sequences.":
      "Сначала изучите дебютные принципы. Названия дебютов полезны для распознавания знакомых позиций, а не для заучивания длинных вариантов.",
    "Opening Principles": "Принципы дебюта",
    "What matters more than memorization": "Что важнее заучивания",
    "If your opponent leaves theory early, these principles tell you what to do next.":
      "Если соперник рано выходит из теории, эти принципы подскажут, что делать дальше.",
    "Control the center": "Контролируйте центр",
    "Central squares give your pieces more space and influence.":
      "Центральные поля дают фигурам больше пространства и влияния.",
    "Develop pieces": "Развивайте фигуры",
    "Bring knights and bishops into the game instead of moving one piece repeatedly.":
      "Вводите в игру коней и слонов вместо повторных ходов одной фигурой.",
    "Castle early": "Рано рокируйтесь",
    "King safety usually matters more than grabbing an extra pawn in the opening.":
      "В дебюте безопасность короля обычно важнее лишней пешки.",
    "Connect the rooks": "Соедините ладьи",
    "After developing and castling, move the queen so your rooks can support each other.":
      "После развития и рокировки поставьте ферзя так, чтобы ладьи поддерживали друг друга.",
    "Typical Chess Situations": "Типичные шахматные ситуации",
    "Patterns you will see again and again":
      "Мотивы, которые встречаются снова и снова",
    "Recognizing patterns is one of the fastest ways to improve. These ideas appear in games at every level.":
      "Распознавание типовых мотивов — один из самых быстрых путей к прогрессу. Они встречаются на любом уровне.",
    All: "Все",
    Tactic: "Тактика",
    Strategy: "Стратегия",
    Endgame: "Эндшпиль",
    "Remember:": "Запомните:",
    "Italian Game": "Итальянская партия",
    "Ruy Lopez": "Испанская партия",
    "Sicilian Defense": "Сицилианская защита",
    "French Defense": "Французская защита",
    "Caro-Kann Defense": "Защита Каро — Канн",
    "Scandinavian Defense": "Скандинавская защита",
    "Queen's Gambit": "Ферзевый гамбит",
    "King's Indian Defense": "Староиндийская защита",
    "Nimzo-Indian Defense": "Защита Нимцовича",
    "English Opening": "Английское начало",
    "London System": "Лондонская система",
    "King's Gambit": "Королевский гамбит",
    "Open Game": "Открытая игра",
    "Semi-Open Game": "Полуоткрытая игра",
    "Closed Game": "Закрытая игра",
    "Indian Defense": "Индийская защита",
    "Flank Opening": "Фланговый дебют",
    "System Opening": "Системный дебют",
    Gambit: "Гамбит",
    "Develop quickly, control the center, prepare castling, and create pressure against f7.":
      "Быстро развивайтесь, контролируйте центр, готовьте рокировку и создавайте давление на f7.",
    "Pressure the knight that helps defend e5 and build a long-term positional game.":
      "Давите на коня, защищающего e5, и стройте долгосрочную позиционную игру.",
    "Black immediately fights for the center from the side and creates an unbalanced position.":
      "Чёрные сразу борются за центр с фланга и создают несимметричную позицию.",
    "Black challenges White's center and usually builds a strong pawn structure before counterattacking.":
      "Чёрные атакуют центр белых и обычно строят крепкую пешечную структуру перед контригрой.",
    "A solid defense that challenges the center while usually allowing the light-squared bishop to develop.":
      "Надёжная защита, которая атакует центр и обычно позволяет развить белопольного слона.",
    "Black attacks the e4 pawn immediately and accepts early queen activity in exchange for direct central play.":
      "Чёрные сразу атакуют пешку e4 и соглашаются на раннюю активность ферзя ради прямой игры в центре.",
    "White challenges Black's d5 pawn and tries to gain stronger central control.":
      "Белые давят на пешку d5 и стремятся усилить контроль центра.",
    "Black allows White to occupy the center, then attacks it later with pieces and pawn breaks.":
      "Чёрные позволяют белым занять центр, а затем атакуют его фигурами и пешечными подрывами.",
    "Black develops actively, pins the knight, and fights for control of the central dark squares.":
      "Чёрные активно развиваются, связывают коня и борются за центральные чёрные поля.",
    "White controls the center indirectly and often reaches flexible positional structures.":
      "Белые косвенно контролируют центр и часто получают гибкие позиционные структуры.",
    "A reliable development setup with a strong pawn center and easy kingside castling.":
      "Надёжная схема развития с сильным пешечным центром и простой короткой рокировкой.",
    "White offers a pawn to open lines and accelerate an attack against the black king.":
      "Белые жертвуют пешку, чтобы открыть линии и ускорить атаку на чёрного короля.",
    Fork: "Вилка",
    Pin: "Связка",
    Skewer: "Шпилька",
    "Discovered Attack": "Вскрытое нападение",
    "Double Attack": "Двойное нападение",
    "Hanging Piece": "Незащищённая фигура",
    "Back-Rank Mate": "Мат по последней горизонтали",
    "Open File": "Открытая линия",
    "Passed Pawn": "Проходная пешка",
    "Isolated Pawn": "Изолированная пешка",
    "Weak Square": "Слабое поле",
    Opposition: "Оппозиция",
    Zugzwang: "Цугцванг",
    "Rook Behind the Passed Pawn": "Ладья позади проходной",
    "One piece attacks two or more enemy pieces at the same time.":
      "Одна фигура одновременно атакует две или более фигуры соперника.",
    "Knights are especially dangerous fork pieces because their attacks cannot be blocked.":
      "Кони особенно опасны при вилках, потому что их атаки нельзя перекрыть.",
    "A piece cannot move without exposing a more valuable piece behind it.":
      "Фигура не может уйти, не открыв более ценную фигуру позади.",
    "An absolute pin happens when moving the pinned piece would expose the king.":
      "Абсолютная связка возникает, если ход связанной фигуры откроет короля.",
    "A valuable piece is attacked and forced to move, exposing another piece behind it.":
      "Ценная фигура атакована и вынуждена уйти, открывая фигуру позади.",
    "Think of a skewer as the reverse of a pin: the more valuable piece is in front.":
      "Шпилька похожа на связку наоборот: более ценная фигура находится впереди.",
    "Moving one piece reveals an attack from another piece that was previously blocked.":
      "Ход одной фигуры открывает атаку другой, которая раньше была перекрыта.",
    "If the revealed attack is a check, it is called a discovered check.":
      "Если вскрытая атака даёт шах, это называется вскрытым шахом.",
    "One move creates two threats at the same time.":
      "Один ход создаёт две угрозы одновременно.",
    "A fork is one kind of double attack, but double attacks can also involve different pieces.":
      "Вилка — один вид двойного нападения, но две угрозы могут создавать и разные фигуры.",
    "A piece is undefended or can be captured without enough compensation.":
      "Фигура не защищена или может быть взята без достаточной компенсации.",
    "Before every move, quickly check whether any of your pieces are left undefended.":
      "Перед каждым ходом быстро проверьте, не осталась ли какая-то фигура без защиты.",
    "A king is trapped behind its own pawns and is checkmated by a rook or queen along the back rank.":
      "Король заперт своими пешками и получает мат от ладьи или ферзя по последней горизонтали.",
    "Creating an escape square for your king can prevent many back-rank mating ideas.":
      "Создание форточки для короля предотвращает многие маты по последней горизонтали.",
    "A file with no pawns on it. Rooks and queens often become very active there.":
      "Вертикаль без пешек. Ладьи и ферзи часто очень активны на ней.",
    "Try to place a rook on an open file, especially if it leads toward the opponent's position.":
      "Старайтесь поставить ладью на открытую линию, особенно если она ведёт в позицию соперника.",
    "A pawn with no opposing pawns in front of it or on neighboring files that can stop its advance.":
      "Пешка, перед которой и на соседних вертикалях нет пешек соперника, способных остановить её продвижение.",
    "Passed pawns become increasingly dangerous as the game approaches the endgame.":
      "Проходные пешки становятся всё опаснее по мере приближения эндшпиля.",
    "A pawn with no friendly pawn on the neighboring files.":
      "Пешка, у которой нет своих пешек на соседних вертикалях.",
    "An isolated pawn may be weak, but it can also provide space and active piece play.":
      "Изолированная пешка может быть слабостью, но иногда даёт пространство и активность фигурам.",
    "A square that cannot easily be protected by a pawn and can become a strong outpost for an enemy piece.":
      "Поле, которое трудно защитить пешкой и которое может стать сильным форпостом для фигуры соперника.",
    "Knights are particularly strong when they can occupy a protected weak square.":
      "Кони особенно сильны на защищённых слабых полях.",
    "Keeping the king protected from open lines, checks, and tactical attacks.":
      "Защита короля от открытых линий, шахов и тактических ударов.",
    "In the opening, castling is often more important than trying to win a pawn.":
      "В дебюте рокировка часто важнее попытки выиграть пешку.",
    "A king-versus-king relationship where one king can force the other to give way.":
      "Взаимное расположение королей, при котором один может заставить другого уступить дорогу.",
    "Opposition is especially important in king-and-pawn endings.":
      "Оппозиция особенно важна в королевско-пешечных окончаниях.",
    "A position where every legal move makes the player's position worse.":
      "Позиция, где любой легальный ход ухудшает положение игрока.",
    "Zugzwang appears frequently in pawn endings and simplified endgames.":
      "Цугцванг часто встречается в пешечных и упрощённых эндшпилях.",
    "A common endgame principle: rooks are often most active behind passed pawns, whether friendly or enemy.":
      "Распространённый эндшпильный принцип: ладьи часто наиболее активны позади проходных пешек — своих или чужих.",
    "From behind, the rook can support its own pawn or attack an enemy pawn while remaining active.":
      "Сзади ладья может поддерживать свою пешку или атаковать чужую, оставаясь активной.",
    Puzzles: "Задачи",
    "Solve interactively": "Решать интерактивно",
    "Interactive Chess Puzzles": "Интерактивные шахматные задачи",
    "Find the best move": "Найдите лучший ход",
    "Play the position, get instant feedback, and learn why moves work.":
      "Сыграйте ход, получите мгновенную обратную связь и узнайте, почему ход работает.",
    "All puzzles": "Все задачи",
    Tactics: "Тактика",
    Checkmates: "Маты",
    Puzzle: "Задача",
    Goal: "Цель",
    Difficulty: "Сложность",
    Beginner: "Начальный",
    Intermediate: "Средний",
    Advanced: "Продвинутый",
    "Select a piece and make your move.": "Выберите фигуру и сделайте ход.",
    "Correct!": "Верно!",
    "Excellent move.": "Отличный ход.",
    "Try another move.": "Попробуйте другой ход.",
    "That move is not legal in this position.":
      "Этот ход нелегален в данной позиции.",
    "Legal move, but not one of the four teaching candidates.":
      "Ход легален, но не входит в четыре учебных кандидата.",
    "Combination continues": "Комбинация продолжается",
    "Opponent reply": "Ответ соперника",
    "Your move again": "Снова ваш ход",
    "Solved!": "Решено!",
    "You found the full combination.": "Вы нашли всю комбинацию.",
    "Reset puzzle": "Сбросить задачу",
    "Next puzzle": "Следующая задача",
    "Show move analysis": "Показать анализ ходов",
    "Hide move analysis": "Скрыть анализ ходов",
    "Candidate move analysis": "Анализ ходов-кандидатов",
    "Best move": "Лучший ход",
    "2nd choice": "2-й выбор",
    "3rd choice": "3-й выбор",
    "Worst move": "Худший ход",
    Line: "Вариант",
    "Curated teaching ranking — not a live engine evaluation.":
      "Учебный рейтинг, а не оценка живого движка.",
    "Mate in 1": "Мат в 1",
    "Mate in 2": "Мат в 2",
    "Win material": "Выиграть материал",
    "Royal Fork": "Королевская вилка",
    "Win the queen with a knight fork.": "Выиграйте ферзя коневой вилкой.",
    "Loose Queen": "Незащищённый ферзь",
    "Spot the hanging queen and take it.":
      "Найдите незащищённого ферзя и возьмите его.",
    "Find checkmate in one.": "Найдите мат в один ход.",
    "Smothered Mate": "Спёртый мат",
    "Deflection to the Back Rank": "Отвлечение к последней горизонтали",
    "Force mate in two by deflecting the queen.":
      "Форсируйте мат в два хода, отвлекая ферзя.",
    "Queen Sacrifice Smothered Mate": "Жертва ферзя ради спёртого мата",
    "Force mate in two with a queen sacrifice.":
      "Форсируйте мат в два хода жертвой ферзя.",
    "The opponent reply is played automatically.":
      "Ответ соперника разыгрывается автоматически.",
    "The combination breaks here. Return to the forcing line.":
      "Здесь комбинация рушится. Вернитесь к форсирующей линии.",
    "This is the key move of the puzzle.": "Это ключевой ход задачи.",
    "Now finish the combination.": "Теперь завершите комбинацию.",
    "Representative reply": "Пример ответа",
    Feedback: "Обратная связь",
    Highlighted: "Подсвечено",
    "Click a move to highlight it on the board.":
      "Нажмите на ход, чтобы подсветить его на доске соответствующим цветом.",
    "Absolute Pin": "Абсолютная связка",
    "Exploit a pin": "Использовать связку",
    "Win the pinned knight before it can escape.":
      "Выиграйте связанного коня, пока он не может уйти.",
    "King and Queen Skewer": "Линейный удар король–ферзь",
    "Check the king and win the queen behind it.":
      "Дайте шах королю и затем выиграйте стоящего за ним ферзя.",
    "Discovered attack": "Вскрытое нападение",
    "Use a forcing bishop move to uncover the rook against the queen.":
      "Сделайте форсирующий ход слоном и откройте нападение ладьи на ферзя.",
    "Improve the rook": "Улучшить ладью",
    "Place your rook behind the passed pawn.":
      "Поставьте ладью позади проходной пешки.",
    "Central Knight Outpost": "Центральный форпост коня",
    "Find an outpost": "Найти форпост",
    "Put the knight on a square enemy pawns cannot chase.":
      "Поставьте коня на поле, откуда вражеские пешки не смогут его прогнать.",
    "Create Luft": "Создать форточку",
    "King safety": "Безопасность короля",
    "Create a safe escape square for your king without overextending the pawns.":
      "Создайте королю безопасное поле для отхода, не ослабляя пешки слишком сильно.",
    "You found the tactical point.": "Вы нашли тактическую идею.",
    "You found the strategic setup.":
      "Вы нашли правильную стратегическую расстановку.",
    "You found the strategic square.": "Вы нашли ключевое стратегическое поле.",
    "You improved the king's safety.": "Вы улучшили безопасность короля.",
    "Really Hard": "Очень сложно",
    "Clearance Sacrifice for Promotion":
      "Освобождающая жертва ради превращения",
    "Clear the promotion square": "Освободить поле превращения",
    "Sacrifice the rook so the pawn can promote with tempo.":
      "Пожертвуйте ладью, чтобы пешка превратилась с темпом.",
    "Deflection Before the Back-Rank Mate":
      "Отвлечение перед матом по последней горизонтали",
    "Sacrifice the queen to remove the last defender of the back rank.":
      "Пожертвуйте ферзя, чтобы убрать последнего защитника последней горизонтали.",
    "Boden's Mate": "Мат Бодена",
    "Sacrifice the queen to open both diagonals around the king.":
      "Пожертвуйте ферзя, чтобы открыть обе диагонали вокруг короля.",
    "Légal's Mate": "Мат Легаля",
    "Mate in 3": "Мат в 3",
    "Ignore the attacked queen and calculate the mating combination to the end.":
      "Игнорируйте атакованного ферзя и рассчитайте матовую комбинацию до конца.",
    "Greek Gift Attack": "Греческий дар",
    "Build a mating attack": "Построить матовую атаку",
    "Sacrifice the bishop, force the king out, and bring the queen into the attack.":
      "Пожертвуйте слона, выманите короля и подключите ферзя к атаке.",
    "The opponent accepts the queen.": "Соперник принимает жертву ферзя.",
    "The opponent accepts the bishop.": "Соперник принимает жертву слона.",
    "You built the classic Greek Gift attacking setup.":
      "Вы построили классическую атакующую схему греческого дара.",
    "Difficulty progression": "Рост сложности",
    "Trade Queens When You Are Ahead": "Меняйте ферзей, когда у вас перевес",
    "Simplify when ahead": "Упрощать при материальном перевесе",
    "You are up a rook. Remove the opponent's queen and reduce counterplay.":
      "У вас лишняя ладья. Разменяйте ферзей и уменьшите контригру соперника.",
    "This is the clean simplifying move.":
      "Это самый простой путь к упрощению.",
    "The queens are gone and your extra rook becomes much easier to use.":
      "После размена ферзей реализовать лишнюю ладью намного проще.",
    "Keep Queens When You Are Behind": "Сохраняйте ферзей, когда отстаёте",
    "Avoid the wrong trade": "Избегать неправильного размена",
    "You are down a rook. Keep the queens and create checking chances.":
      "У вас не хватает ладьи. Сохраните ферзей и ищите шахи и контригру.",
    "You kept the queen and created immediate activity.":
      "Вы сохранили ферзя и сразу создали активную игру.",
    "Trade a Bad Bishop for a Strong Knight":
      "Разменяйте плохого слона на сильного коня",
    "Choose the right exchange": "Выбрать правильный размен",
    "Remove the opponent's powerful central knight instead of letting it dominate the board.":
      "Уберите сильного центрального коня соперника, не позволяя ему доминировать.",
    "You exchanged an ordinary bishop for the opponent's best-placed piece.":
      "Вы разменяли обычного слона на лучше всего расположенную фигуру соперника.",
    "The dangerous knight is gone, and Black is left with a pawn on d5 instead.":
      "Опасный конь исчез, а у чёрных вместо него осталась пешка на d5.",
    "Open the Center Against an Exposed King":
      "Открывайте центр против незащищённого короля",
    "Open the center": "Открыть центр",
    "The enemy king is stuck in the middle. Open lines before it can become safe.":
      "Король соперника застрял в центре. Откройте линии, пока он не успел укрыться.",
    "Opening the e-file immediately exposes the king.":
      "Открытие линии e сразу обнажает короля.",
    "Keep the Center Closed When Your King Is Unsafe":
      "Держите центр закрытым, пока ваш король уязвим",
    "Do not open too early": "Не открывать слишком рано",
    "Your king is still exposed and Black's pieces are ready. Keep the center closed until you are safer.":
      "Ваш король ещё уязвим, а фигуры чёрных готовы к атаке. Держите центр закрытым, пока не обеспечите королю безопасность.",
    "You kept the dangerous central file closed.":
      "Вы оставили опасную центральную линию закрытой.",
    Selected: "Выбрано",
  },
};

function translate(language: Language, text: string): string {
  if (language === "en") return text;

  if (language === "bar") {
    return translations.bar[text] ?? translations.de[text] ?? text;
  }

  return translations[language]?.[text] ?? ui(text);
}

const LanguageContext = createContext<Language>("en");

function useT() {
  const language = useContext(LanguageContext);
  return (text: string) => translate(language, text);
}

type MiniPieceCode =
  | "wp"
  | "wn"
  | "wb"
  | "wr"
  | "wq"
  | "wk"
  | "bp"
  | "bn"
  | "bb"
  | "br"
  | "bq"
  | "bk";

type MiniBoardExample = {
  pieces: Record<string, MiniPieceCode>;
  moveSquares?: string[];
  captureSquares?: string[];
  dangerSquares?: string[];
  selectedSquare?: string;
  label?: string;
};

type PieceInfo = {
  symbol: string;
  name: string;
  value: string;
  movement: string;
  tip: string;
  example: MiniBoardExample;
  exampleTitle?: string;
  secondaryExample?: MiniBoardExample;
  secondaryExampleTitle?: string;
};

type OpeningInfo = {
  name: string;
  moves: string;
  category: string;
  idea: string;
};

type SituationInfo = {
  title: string;
  symbol: string;
  category: "Tactic" | "Strategy" | "Endgame";
  description: string;
  tip: string;
  example: MiniBoardExample;
};

const miniPieceSymbols: Record<MiniPieceCode, string> = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚",
};

function MiniChessBoard({
  example,
  compact = false,
}: {
  example: MiniBoardExample;
  compact?: boolean;
}) {
  useUiLanguage();
  const { pieceTheme, boardTheme } = useChessSettings();
  const palette = boardColors[boardTheme];
  const t = useT();
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];

  return (
    <div className="mx-auto w-full">
      <div
        className={`
          mx-auto
          overflow-hidden
          rounded-2xl
          border
          border-white/10
          p-1.5
          shadow-lg
          shadow-black/20
          ${compact ? "max-w-[178px]" : "max-w-[220px]"}
        `}
        style={{ backgroundColor: palette.frame }}
      >
        <div className="grid grid-cols-8 overflow-hidden rounded-xl">
          {ranks.flatMap((rank, rankIndex) =>
            files.map((file, fileIndex) => {
              const square = `${file}${rank}`;
              const piece = example.pieces[square];
              const isMoveSquare = example.moveSquares?.includes(square);
              const isCaptureSquare = example.captureSquares?.includes(square);
              const isDanger = example.dangerSquares?.includes(square);
              const isSelected = example.selectedSquare === square;
              const isLight = (rankIndex + fileIndex) % 2 === 0;

              return (
                <div
                  key={square}
                  className={`
                    relative
                    flex
                    aspect-square
                    items-center
                    justify-center
                  `}
                  style={{ backgroundColor: isLight ? palette.light : palette.dark }}
                  title={square}
                >
                  {isMoveSquare && (
                    <span className="pointer-events-none absolute inset-0 bg-emerald-300/50 ring-2 ring-inset ring-emerald-100/85 shadow-[inset_0_0_0_1px_rgba(209,250,229,0.5)]" />
                  )}

                  {isCaptureSquare && (
                    <span className="pointer-events-none absolute inset-0 bg-amber-400/70 ring-2 ring-inset ring-amber-100/90 shadow-[inset_0_0_0_1px_rgba(254,243,199,0.55)]" />
                  )}

                  {isDanger && (
                    <span className="pointer-events-none absolute inset-0 bg-red-500/38 ring-2 ring-inset ring-red-200/70" />
                  )}

                  {isSelected && (
                    <span className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-sky-300" />
                  )}

                  {piece && (
                    <span
                      className={`
                        flex h-full w-full items-center justify-center
                        relative
                        z-10
                        select-none
                        font-serif
                        leading-none
                        drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]
                        ${compact ? "text-[17px] sm:text-[19px]" : "text-[20px] sm:text-[23px]"}
                        ${piece.startsWith("w") ? "text-[#fff3d5]" : "text-[#17120f]"}
                      `}
                    >
                      {pieceTheme === "classic" ? miniPieceSymbols[piece] : <ChessPiece type={piece[1] as "p" | "n" | "b" | "r" | "q" | "k"} color={piece[0] as "w" | "b"} theme={pieceTheme} />}
                    </span>
                  )}

                  {(fileIndex === 0 || rank === 1) && (
                    <span
                      className={`
                        pointer-events-none
                        absolute
                        text-[6px]
                        font-bold
                        ${isLight ? "text-[#76583d]" : "text-[#e4cda7]/70"}
                        ${fileIndex === 0 ? "left-0.5 top-0.5" : "bottom-0.5 right-0.5"}
                      `}
                    >
                      {fileIndex === 0 ? rank : file}
                    </span>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </div>

      {example.label && (
        <p className="mx-auto mt-2 max-w-[240px] text-center text-[10px] leading-4 text-zinc-500">
          {t(example.label)}
        </p>
      )}
    </div>
  );
}

function MiniBoardLegend({ showDanger = true }: { showDanger?: boolean }) {
  useUiLanguage();
  const t = useT();
  const items = [
    {
      label: "Selected piece",
      className: "ring-2 ring-inset ring-sky-300 bg-zinc-900/60",
    },
    {
      label: "Can move",
      className:
        "bg-emerald-300/50 ring-2 ring-inset ring-emerald-100/85 shadow-[inset_0_0_0_1px_rgba(209,250,229,0.5)]",
    },
    {
      label: "Can capture",
      className:
        "bg-amber-400/70 ring-2 ring-inset ring-amber-100/90 shadow-[inset_0_0_0_1px_rgba(254,243,199,0.55)]",
    },
  ];

  if (showDanger) {
    items.push({
      label: "Attack / danger / key squares",
      className: "bg-red-500/38 ring-2 ring-inset ring-red-200/70",
    });
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="
            inline-flex
            items-center
            gap-2
            rounded-full
            border
            border-white/8
            bg-black/20
            px-3
            py-1.5
            text-[10px]
            font-semibold
            text-zinc-400
          "
        >
          <span className={`h-4 w-4 rounded-sm ${item.className}`} />
          <span>{t(item.label)}</span>
        </div>
      ))}
    </div>
  );
}

function MiniBoardPair({
  left,
  right,
  leftTitle,
  rightTitle,
  showArrow = true,
}: {
  left: MiniBoardExample;
  right: MiniBoardExample;
  leftTitle: string;
  rightTitle: string;
  showArrow?: boolean;
}) {
  useUiLanguage();
  const t = useT();

  return (
    <div
      className={
        showArrow
          ? "mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2"
          : "mt-4 grid grid-cols-2 gap-3"
      }
    >
      <div>
        <p className="mb-2 text-center text-[9px] font-black uppercase tracking-wider text-zinc-600">
          {t(leftTitle)}
        </p>
        <MiniChessBoard example={left} compact />
      </div>

      {showArrow && (
        <div className="flex items-center justify-center pt-6">
          <span className="text-2xl font-black text-amber-300">→</span>
        </div>
      )}

      <div>
        <p className="mb-2 text-center text-[9px] font-black uppercase tracking-wider text-zinc-600">
          {t(rightTitle)}
        </p>
        <MiniChessBoard example={right} compact />
      </div>
    </div>
  );
}

function positionToMiniBoardExample({
  game,
  lastMove,
  label,
}: {
  game: Chess;
  lastMove: { from: string; to: string } | null;
  label?: string;
}): MiniBoardExample {
  const pieces: Record<string, MiniPieceCode> = {};
  const board = game.board();

  for (let row = 0; row < board.length; row++) {
    for (let column = 0; column < board[row].length; column++) {
      const piece = board[row][column];
      if (!piece) continue;

      const file = String.fromCharCode(97 + column);
      const rank = 8 - row;
      const square = `${file}${rank}`;
      pieces[square] = `${piece.color}${piece.type}` as MiniPieceCode;
    }
  }

  return {
    pieces,
    selectedSquare: lastMove?.from,
    moveSquares: lastMove ? [lastMove.to] : undefined,
    label,
  };
}

type OpeningStep = {
  ply: number;
  move: string;
  moveNumber: number;
  color: "w" | "b";
  example: MiniBoardExample;
};

function openingToStepExamples(moves: string): OpeningStep[] {
  const game = new Chess();
  const tokens = moves
    .replace(/\d+\.(?:\.\.)?/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const steps: OpeningStep[] = [];

  tokens.forEach((token, index) => {
    try {
      const move = game.move(token);
      const color = move.color;
      const moveNumber = Math.floor(index / 2) + 1;

      steps.push({
        ply: index + 1,
        move: token,
        moveNumber,
        color,
        example: positionToMiniBoardExample({
          game,
          lastMove: { from: move.from, to: move.to },
          label: `${color === "w" ? `${moveNumber}.` : `${moveNumber}...`} ${token}`,
        }),
      });
    } catch {
      // ignore invalid token
    }
  });

  return steps;
}

function OpeningSequenceBoards({ moves }: { moves: string }) {
  useUiLanguage();
  const t = useT();
  const steps = openingToStepExamples(moves);

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {steps.map((step) => (
        <div
          key={`${step.ply}-${step.move}`}
          className="
            rounded-2xl
            border
            border-white/5
            bg-black/20
            p-3
          "
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="rounded-lg bg-amber-400/10 px-2 py-1 text-[10px] font-black text-amber-300">
              {t("Step")} {step.ply}
            </span>

            <span className="font-mono text-[11px] font-bold text-zinc-300">
              {step.color === "w" ? `${step.moveNumber}. ${step.move}` : `${step.moveNumber}... ${step.move}`}
            </span>
          </div>

          <MiniChessBoard example={step.example} compact />
        </div>
      ))}
    </div>
  );
}

const pieces: PieceInfo[] = [
  {
    symbol: "♙",
    name: "Pawn",
    value: "1",
    movement:
      "Moves one square forward. From its starting square it may move two squares. Pawns capture one square diagonally forward.",
    tip: "Pawns cannot move backward. A pawn reaching the last rank must be promoted.",
    exampleTitle: "Start position",
    example: {
      pieces: { d2: "wp", c3: "bp", e3: "bp" },
      selectedSquare: "d2",
      moveSquares: ["d3", "d4"],
      captureSquares: ["c3", "e3"],
      label: "From d2: move to d3 or d4; capture on c3 or e3.",
    },
    secondaryExampleTitle: "After it has moved",
    secondaryExample: {
      pieces: { d5: "wp", c6: "bp", e6: "bp" },
      selectedSquare: "d5",
      moveSquares: ["d6"],
      captureSquares: ["c6", "e6"],
      label: "From d5: move to d6; capture on c6 or e6.",
    },
  },
  {
    symbol: "♘",
    name: "Knight",
    value: "3",
    movement:
      "Moves in an L-shape: two squares in one direction and then one square sideways.",
    tip: "The knight is the only piece that can jump over other pieces.",
    example: {
      pieces: { d4: "wn" },
      selectedSquare: "d4",
      moveSquares: ["b3", "b5", "c2", "c6", "e2", "e6", "f3", "f5"],
      label: "A knight on d4 can reach up to eight squares.",
    },
  },
  {
    symbol: "♗",
    name: "Bishop",
    value: "3",
    movement:
      "Moves any number of squares diagonally, as long as no piece blocks the path.",
    tip: "A bishop always remains on the same square color for the entire game.",
    example: {
      pieces: { d4: "wb" },
      selectedSquare: "d4",
      moveSquares: [
        "c3",
        "b2",
        "a1",
        "c5",
        "b6",
        "a7",
        "e3",
        "f2",
        "g1",
        "e5",
        "f6",
        "g7",
        "h8",
      ],
      label: "A bishop moves only on diagonals.",
    },
  },
  {
    symbol: "♖",
    name: "Rook",
    value: "5",
    movement:
      "Moves any number of squares horizontally or vertically, as long as the path is clear.",
    tip: "Rooks become especially powerful on open files and in the endgame.",
    example: {
      pieces: { d4: "wr" },
      selectedSquare: "d4",
      moveSquares: [
        "d1",
        "d2",
        "d3",
        "d5",
        "d6",
        "d7",
        "d8",
        "a4",
        "b4",
        "c4",
        "e4",
        "f4",
        "g4",
        "h4",
      ],
      label: "A rook moves along ranks and files.",
    },
  },
  {
    symbol: "♕",
    name: "Queen",
    value: "9",
    movement:
      "Moves any number of squares horizontally, vertically, or diagonally.",
    tip: "The queen is the most powerful piece, but bringing it out too early can make it an easy target.",
    example: {
      pieces: { d4: "wq" },
      selectedSquare: "d4",
      moveSquares: [
        "d1",
        "d2",
        "d3",
        "d5",
        "d6",
        "d7",
        "d8",
        "a4",
        "b4",
        "c4",
        "e4",
        "f4",
        "g4",
        "h4",
        "c3",
        "b2",
        "a1",
        "c5",
        "b6",
        "a7",
        "e3",
        "f2",
        "g1",
        "e5",
        "f6",
        "g7",
        "h8",
      ],
      label: "The queen combines rook and bishop movement.",
    },
  },
  {
    symbol: "♔",
    name: "King",
    value: "∞",
    movement:
      "Moves one square in any direction. The king may never move onto a square attacked by the opponent.",
    tip: "The king has no normal point value because losing it by checkmate ends the game.",
    example: {
      pieces: { d4: "wk" },
      selectedSquare: "d4",
      moveSquares: ["c3", "c4", "c5", "d3", "d5", "e3", "e4", "e5"],
      label: "The king moves one square in any direction.",
    },
  },
];

const openings: OpeningInfo[] = [
  {
    name: "Italian Game",
    moves: "1. e4 e5 2. Nf3 Nc6 3. Bc4",
    category: "Open Game",
    idea: "Develop quickly, control the center, prepare castling, and create pressure against f7.",
  },
  {
    name: "Ruy Lopez",
    moves: "1. e4 e5 2. Nf3 Nc6 3. Bb5",
    category: "Open Game",
    idea: "Pressure the knight that helps defend e5 and build a long-term positional game.",
  },
  {
    name: "Sicilian Defense",
    moves: "1. e4 c5",
    category: "Semi-Open Game",
    idea: "Black immediately fights for the center from the side and creates an unbalanced position.",
  },
  {
    name: "French Defense",
    moves: "1. e4 e6 2. d4 d5",
    category: "Semi-Open Game",
    idea: "Black challenges White's center and usually builds a strong pawn structure before counterattacking.",
  },
  {
    name: "Caro-Kann Defense",
    moves: "1. e4 c6 2. d4 d5",
    category: "Semi-Open Game",
    idea: "A solid defense that challenges the center while usually allowing the light-squared bishop to develop.",
  },
  {
    name: "Scandinavian Defense",
    moves: "1. e4 d5",
    category: "Semi-Open Game",
    idea: "Black attacks the e4 pawn immediately and accepts early queen activity in exchange for direct central play.",
  },
  {
    name: "Queen's Gambit",
    moves: "1. d4 d5 2. c4",
    category: "Closed Game",
    idea: "White challenges Black's d5 pawn and tries to gain stronger central control.",
  },
  {
    name: "King's Indian Defense",
    moves: "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7",
    category: "Indian Defense",
    idea: "Black allows White to occupy the center, then attacks it later with pieces and pawn breaks.",
  },
  {
    name: "Nimzo-Indian Defense",
    moves: "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4",
    category: "Indian Defense",
    idea: "Black develops actively, pins the knight, and fights for control of the central dark squares.",
  },
  {
    name: "English Opening",
    moves: "1. c4",
    category: "Flank Opening",
    idea: "White controls the center indirectly and often reaches flexible positional structures.",
  },
  {
    name: "London System",
    moves: "1. d4 d5 2. Nf3 Nf6 3. Bf4",
    category: "System Opening",
    idea: "A reliable development setup with a strong pawn center and easy kingside castling.",
  },
  {
    name: "King's Gambit",
    moves: "1. e4 e5 2. f4",
    category: "Gambit",
    idea: "White offers a pawn to open lines and accelerate an attack against the black king.",
  },
];

const situations: SituationInfo[] = [
  {
    title: "Fork",
    symbol: "⑂",
    category: "Tactic",
    description: "One piece attacks two or more enemy pieces at the same time.",
    tip: "Knights are especially dangerous fork pieces because their attacks cannot be blocked.",
    example: {
      pieces: { a1: "wk", a8: "bk", e5: "wn", c6: "br", f7: "bq" },
      selectedSquare: "e5",
      dangerSquares: ["c6", "f7"],
      label: "The knight attacks the rook and queen at once.",
    },
  },
  {
    title: "Pin",
    symbol: "⇥",
    category: "Tactic",
    description:
      "A piece cannot move without exposing a more valuable piece behind it.",
    tip: "An absolute pin happens when moving the pinned piece would expose the king.",
    example: {
      pieces: { a1: "wk", b5: "wb", c6: "bn", e8: "bk" },
      selectedSquare: "b5",
      dangerSquares: ["c6"],
      moveSquares: ["d7", "e8"],
      label: "The knight on c6 is pinned to its king on e8.",
    },
  },
  {
    title: "Skewer",
    symbol: "⇢",
    category: "Tactic",
    description:
      "A valuable piece is attacked and forced to move, exposing another piece behind it.",
    tip: "Think of a skewer as the reverse of a pin: the more valuable piece is in front.",
    example: {
      pieces: { a1: "wk", b5: "wb", d7: "bk", e8: "br" },
      selectedSquare: "b5",
      dangerSquares: ["d7"],
      moveSquares: ["c6", "e8"],
      label: "The king must move, exposing the rook behind it.",
    },
  },
  {
    title: "Discovered Attack",
    symbol: "✦",
    category: "Tactic",
    description:
      "Moving one piece reveals an attack from another piece that was previously blocked.",
    tip: "If the revealed attack is a check, it is called a discovered check.",
    example: {
      pieces: { a1: "wk", h8: "bk", d1: "wr", d4: "wb", d8: "bq" },
      selectedSquare: "d4",
      moveSquares: ["b6"],
      dangerSquares: ["d8"],
      label: "Move the bishop away and the rook attacks the queen on d8.",
    },
  },
  {
    title: "Double Attack",
    symbol: "⚔",
    category: "Tactic",
    description: "One move creates two threats at the same time.",
    tip: "A fork is one kind of double attack, but double attacks can also involve different pieces.",
    example: {
      pieces: { h1: "wk", a4: "wq", e8: "bk", a8: "br" },
      selectedSquare: "a4",
      dangerSquares: ["e8", "a8"],
      label: "Qa4 attacks the king and rook at the same time.",
    },
  },
  {
    title: "Hanging Piece",
    symbol: "!",
    category: "Tactic",
    description:
      "A piece is undefended or can be captured without enough compensation.",
    tip: "Before every move, quickly check whether any of your pieces are left undefended.",
    example: {
      pieces: { a1: "wk", h8: "bk", e4: "wn", c5: "bb" },
      selectedSquare: "e4",
      dangerSquares: ["c5"],
      label: "The bishop on c5 is undefended and can be taken.",
    },
  },
  {
    title: "Back-Rank Mate",
    symbol: "♜",
    category: "Tactic",
    description:
      "A king is trapped behind its own pawns and is checkmated by a rook or queen along the back rank.",
    tip: "Creating an escape square for your king can prevent many back-rank mating ideas.",
    example: {
      pieces: { a1: "wk", e8: "wr", g8: "bk", f7: "bp", g7: "bp", h7: "bp" },
      selectedSquare: "e8",
      dangerSquares: ["g8"],
      moveSquares: ["f8", "h8"],
      label: "The pawns trap the king while the rook controls the back rank.",
    },
  },
  {
    title: "Open File",
    symbol: "┃",
    category: "Strategy",
    description:
      "A file with no pawns on it. Rooks and queens often become very active there.",
    tip: "Try to place a rook on an open file, especially if it leads toward the opponent's position.",
    example: {
      pieces: { g1: "wk", g8: "bk", d1: "wr", d8: "br" },
      dangerSquares: ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8"],
      label: "No pawns occupy the d-file, so both rooks can use it.",
    },
  },
  {
    title: "Passed Pawn",
    symbol: "♙",
    category: "Strategy",
    description:
      "A pawn with no opposing pawns in front of it or on neighboring files that can stop its advance.",
    tip: "Passed pawns become increasingly dangerous as the game approaches the endgame.",
    example: {
      pieces: { c2: "wk", g8: "bk", d5: "wp", g6: "bp" },
      selectedSquare: "d5",
      moveSquares: ["d6", "d7", "d8"],
      label: "No black pawn can stop the d-pawn from a neighboring file.",
    },
  },
  {
    title: "Isolated Pawn",
    symbol: "◇",
    category: "Strategy",
    description: "A pawn with no friendly pawn on the neighboring files.",
    tip: "An isolated pawn may be weak, but it can also provide space and active piece play.",
    example: {
      pieces: { g1: "wk", g8: "bk", d4: "wp", a2: "wp", g2: "wp" },
      selectedSquare: "d4",
      moveSquares: ["c4", "e4"],
      label: "The d-pawn has no friendly pawn on the c- or e-file.",
    },
  },
  {
    title: "Weak Square",
    symbol: "□",
    category: "Strategy",
    description:
      "A square that cannot easily be protected by a pawn and can become a strong outpost for an enemy piece.",
    tip: "Knights are particularly strong when they can occupy a protected weak square.",
    example: {
      pieces: { g1: "wk", g8: "bk", d5: "wn", c5: "bp", e5: "bp", c4: "wp" },
      selectedSquare: "d5",
      dangerSquares: ["d5"],
      label:
        "The knight occupies d5 where the black pawns cannot chase it away.",
    },
  },
  {
    title: "King Safety",
    symbol: "♔",
    category: "Strategy",
    description:
      "Keeping the king protected from open lines, checks, and tactical attacks.",
    tip: "In the opening, castling is often more important than trying to win a pawn.",
    example: {
      pieces: { g1: "wk", f2: "wp", g2: "wp", h2: "wp", e8: "bk", e1: "wr" },
      moveSquares: ["f2", "g2", "h2"],
      dangerSquares: ["e8"],
      label:
        "White is sheltered by pawns; Black is exposed on the open e-file.",
    },
  },
  {
    title: "Opposition",
    symbol: "↔",
    category: "Endgame",
    description:
      "A king-versus-king relationship where one king can force the other to give way.",
    tip: "Opposition is especially important in king-and-pawn endings.",
    example: {
      pieces: { e4: "wk", e6: "bk" },
      moveSquares: ["e5"],
      label: "The kings face each other with exactly one square between them.",
    },
  },
  {
    title: "Zugzwang",
    symbol: "⌛",
    category: "Endgame",
    description:
      "A position where every legal move makes the player's position worse.",
    tip: "Zugzwang appears frequently in pawn endings and simplified endgames.",
    example: {
      pieces: { c6: "wk", b5: "wp", a5: "bk" },
      selectedSquare: "a5",
      moveSquares: ["a4", "b4"],
      label: "Black to move: every legal king move gives White progress.",
    },
  },
  {
    title: "Rook Behind the Passed Pawn",
    symbol: "♖",
    category: "Endgame",
    description:
      "A common endgame principle: rooks are often most active behind passed pawns, whether friendly or enemy.",
    tip: "From behind, the rook can support its own pawn or attack an enemy pawn while remaining active.",
    example: {
      pieces: { g2: "wk", g8: "bk", d1: "wr", d6: "wp" },
      selectedSquare: "d1",
      moveSquares: ["d2", "d3", "d4", "d5", "d6", "d7", "d8"],
      label: "The rook supports the passed pawn from behind on the d-file.",
    },
  },
];

const checkExample: MiniBoardExample = {
  pieces: { a8: "bk", e8: "br", e1: "wk" },
  selectedSquare: "e8",
  dangerSquares: ["e1"],
  moveSquares: ["e2", "e3", "e4", "e5", "e6", "e7"],
  label: "The rook attacks the king along the open e-file.",
};

const checkmateExample: MiniBoardExample = {
  pieces: { h1: "wk", g2: "bq", f3: "bk" },
  selectedSquare: "g2",
  dangerSquares: ["h1", "g1", "h2"],
  label: "White is checked and has no legal escape square.",
};

const castlingBefore: MiniBoardExample = {
  pieces: { e1: "wk", h1: "wr", a8: "bk" },
  selectedSquare: "e1",
  moveSquares: ["f1", "g1"],
};

const castlingAfter: MiniBoardExample = {
  pieces: { g1: "wk", f1: "wr", a8: "bk" },
  moveSquares: ["f1", "g1"],
};

const queensideCastlingBefore: MiniBoardExample = {
  pieces: { e1: "wk", a1: "wr", h8: "bk" },
  selectedSquare: "e1",
  moveSquares: ["d1", "c1"],
};

const queensideCastlingAfter: MiniBoardExample = {
  pieces: { c1: "wk", d1: "wr", h8: "bk" },
  moveSquares: ["c1", "d1"],
};

const enPassantBefore: MiniBoardExample = {
  pieces: { a1: "wk", h8: "bk", e5: "wp", d5: "bp" },
  selectedSquare: "e5",
  captureSquares: ["d6"],
};

const enPassantAfter: MiniBoardExample = {
  pieces: { a1: "wk", h8: "bk", d6: "wp" },
  selectedSquare: "d6",
  dangerSquares: ["d5"],
};

const promotionBefore: MiniBoardExample = {
  pieces: { a1: "wk", a8: "bk", e7: "wp" },
  selectedSquare: "e7",
  moveSquares: ["e8"],
};

const promotionAfter: MiniBoardExample = {
  pieces: { a1: "wk", a8: "bk", e8: "wq" },
  selectedSquare: "e8",
};

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  useUiLanguage();
  const t = useT();

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-amber-400/10 bg-[linear-gradient(135deg,rgba(13,22,33,.78),rgba(5,10,17,.42))] px-5 py-5 sm:px-6">
      <div className="pointer-events-none absolute -right-8 -top-14 font-serif text-[9rem] leading-none text-amber-200/[0.025]">
        ♞
      </div>

      <div className="relative">
        <div className="mb-3 flex items-center gap-3">
          <span className="h-px w-8 bg-amber-300/45" />
          <p className="text-[9px] font-black uppercase tracking-[0.30em] text-amber-300/85">
            {t(eyebrow)}
          </p>
        </div>

        <h2 className="max-w-4xl font-serif text-2xl font-semibold tracking-[-0.02em] text-[#f6ead1] sm:text-3xl">
          {t(title)}
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          {t(description)}
        </p>
      </div>
    </div>
  );
}

function InfoCard({
  title,
  children,
  accent = false,
}: {
  title: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  useUiLanguage();
  const t = useT();

  return (
    <section
      className={`
        group
        relative
        overflow-hidden
        rounded-[1.6rem]
        border
        p-5
        shadow-2xl
        shadow-black/20
        backdrop-blur-xl
        transition
        duration-300
        hover:-translate-y-0.5
        ${
          accent
            ? "border-amber-400/25 bg-[linear-gradient(145deg,rgba(52,39,16,.42),rgba(7,14,22,.96))]"
            : "border-white/10 bg-[linear-gradient(145deg,rgba(10,18,28,.94),rgba(5,10,17,.90))] hover:border-amber-400/15"
        }
      `}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/20 to-transparent" />
      <h3 className="font-serif text-lg font-semibold text-[#f5e8cf]">
        {t(title)}
      </h3>
      <div className="mt-3 text-sm leading-6 text-zinc-400">{children}</div>
    </section>
  );
}

function RulesTab() {
  useUiLanguage();
  const t = useT();

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-3">
        <InfoCard title={ui("Goal of the Game")} accent>
          <p>
            {t(
              "Your goal is to checkmate the opponent's king. Checkmate means the king is under attack and there is no legal move that removes the threat.",
            )}
          </p>
        </InfoCard>

        <InfoCard title={ui("How a Turn Works")}>
          <p>
            {t(
              "White moves first. Players then alternate one move at a time. On your turn, move exactly one piece, except during castling where the king and rook move together.",
            )}
          </p>
        </InfoCard>

        <InfoCard title={ui("A Good Beginner Plan")}>
          <p>
            {t(
              "Control the center, develop knights and bishops, castle early, avoid moving the same piece repeatedly without a reason, and check whether your opponent threatens something before every move.",
            )}
          </p>
        </InfoCard>
      </div>

      <section>
        <SectionHeading
          eyebrow={ui("The Pieces")}
          title={ui("How every chess piece moves")}
          description={ui("Piece values are useful estimates for comparing trades. They are not strict rules: position, king safety, and activity can make a piece more or less valuable.")}
        />

        <MiniBoardLegend />

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pieces.map((piece) => (
            <article
              key={t(piece.name)}
              className="
                rounded-3xl
                border
                border-white/10
                bg-zinc-900/75
                p-5
                transition
                hover:border-amber-400/20
                hover:bg-zinc-900
              "
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className="
                      flex
                      h-16
                      w-16
                      shrink-0
                      items-center
                      justify-center
                      rounded-2xl
                      border
                      border-amber-400/15
                      bg-amber-400/[0.07]
                      font-serif
                      text-5xl
                      text-[#fff3d5]
                    "
                  >
                    {piece.symbol}
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-white">
                      {t(piece.name)}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Typical value")}
                    </p>
                  </div>
                </div>

                <span
                  className="
                    rounded-xl
                    bg-white/5
                    px-3
                    py-1.5
                    text-sm
                    font-black
                    text-amber-200
                  "
                >
                  {piece.value}
                </span>
              </div>

              <p className="mt-5 text-sm leading-6 text-zinc-300">
                {t(piece.movement)}
              </p>

              <div className="mt-4">
                {piece.secondaryExample ? (
                  <MiniBoardPair
                    left={piece.example}
                    right={piece.secondaryExample}
                    leftTitle={piece.exampleTitle ?? "Example A"}
                    rightTitle={piece.secondaryExampleTitle ?? "Example B"}
                    showArrow={false}
                  />
                ) : (
                  <MiniChessBoard example={piece.example} />
                )}
              </div>

              <div
                className="
                  mt-4
                  rounded-2xl
                  border
                  border-white/5
                  bg-black/20
                  p-3
                  text-xs
                  leading-5
                  text-zinc-500
                "
              >
                <span className="font-black text-amber-300">{t("Tip:")}</span>{" "}
                {t(piece.tip)}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow={ui("King Safety")}
          title={ui("Check and checkmate")}
          description={ui("Understanding the difference between check and checkmate is the most important rule in chess.")}
        />

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <InfoCard title={ui("Check")}>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
              <div>
                <p>
                  {t(
                    "The king is in check when an enemy piece attacks it. The player must immediately respond by doing one of three things:",
                  )}
                </p>

                <div className="mt-3 space-y-2">
                  <p>• {t("Move the king to a safe square.")}</p>
                  <p>• {t("Capture the attacking piece.")}</p>
                  <p>
                    • {t("Block the attack, if the attacking piece allows it.")}
                  </p>
                </div>

                <p className="mt-3">
                  {t(
                    "You may never make a move that leaves your own king in check.",
                  )}
                </p>
              </div>

              <div>
                <MiniChessBoard example={checkExample} />
              </div>
            </div>
          </InfoCard>

          <InfoCard title={ui("Checkmate")} accent>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
              <div>
                <p>
                  {t(
                    "Checkmate occurs when the king is in check and there is no legal way to escape.",
                  )}
                </p>
                <p className="mt-3">
                  {t(
                    "The game ends immediately. The player delivering checkmate wins, even if the winning side has fewer pieces.",
                  )}
                </p>
              </div>

              <div>
                <MiniChessBoard example={checkmateExample} />
              </div>
            </div>
          </InfoCard>
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow={ui("Special Rules")}
          title={ui("Castling, en passant, and promotion")}
          description={ui("These are the three special move rules every chess player should know.")}
        />

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <InfoCard title={ui("Castling")}>
            <p>
              {t(
                "Castling moves the king two squares toward a rook, then places the rook on the square next to the king.",
              )}
            </p>

            <div className="mt-3 space-y-2 text-xs text-zinc-500">
              <p>• {t("The king and that rook must not have moved before.")}</p>
              <p>• {t("The squares between them must be empty.")}</p>
              <p>• {t("The king may not be in check.")}</p>
              <p>
                • {t("The king may not cross or land on an attacked square.")}
              </p>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <p className="mb-2 text-center text-[10px] font-black uppercase tracking-wider text-amber-300">
                  {t("Kingside castling (O-O)")}
                </p>
                <MiniBoardPair
                  left={castlingBefore}
                  right={castlingAfter}
                  leftTitle="Before"
                  rightTitle="After O-O"
                />
              </div>

              <div>
                <p className="mb-2 text-center text-[10px] font-black uppercase tracking-wider text-amber-300">
                  {t("Queenside castling (O-O-O)")}
                </p>
                <MiniBoardPair
                  left={queensideCastlingBefore}
                  right={queensideCastlingAfter}
                  leftTitle="Before"
                  rightTitle="After O-O-O"
                />
              </div>
            </div>
          </InfoCard>

          <InfoCard title={ui("En Passant")}>
            <p>
              {t(
                "If an enemy pawn moves two squares from its starting position and lands directly beside your pawn, your pawn may capture it as if it had moved only one square.",
              )}
            </p>

            <p className="mt-3 text-xs text-zinc-500">
              {t(
                "Important: en passant is only available immediately on the next move. If you do something else first, the opportunity disappears.",
              )}
            </p>

            <MiniBoardPair
              left={enPassantBefore}
              right={enPassantAfter}
              leftTitle="After ...d7-d5"
              rightTitle="After exd6 e.p."
            />
          </InfoCard>

          <InfoCard title={ui("Promotion")}>
            <p>
              {t(
                "When a pawn reaches the last rank, it must immediately become a queen, rook, bishop, or knight.",
              )}
            </p>

            <p className="mt-3 text-xs text-zinc-500">
              {t(
                "Most promotions choose a queen, but sometimes a knight, rook, or bishop is the best choice. This is called underpromotion.",
              )}
            </p>

            <MiniBoardPair
              left={promotionBefore}
              right={promotionAfter}
              leftTitle="Pawn on 7th rank"
              rightTitle="Promoted"
            />
          </InfoCard>
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow={ui("Piece Values")}
          title={ui("A simple guide to material")}
          description={ui("Use values as a quick guide when deciding whether a trade is favorable.")}
        />

        <div
          className="
            mt-5
            overflow-hidden
            rounded-3xl
            border
            border-white/10
            bg-zinc-900/75
          "
        >
          <div className="grid grid-cols-2 border-b border-white/5 bg-black/20 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-600">
            <span>{t("Piece")}</span>
            <span>{t("Typical value")}</span>
          </div>

          {pieces.map((piece) => (
            <div
              key={t(piece.name)}
              className="
                grid
                grid-cols-2
                items-center
                border-b
                border-white/5
                px-5
                py-3
                last:border-0
              "
            >
              <div className="flex items-center gap-3">
                <span className="w-8 text-center font-serif text-2xl text-[#fff3d5]">
                  {piece.symbol}
                </span>
                <span className="text-sm font-bold text-zinc-200">
                  {t(piece.name)}
                </span>
              </div>

              <span className="text-sm font-black text-amber-200">
                {piece.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow={ui("Quick Tips")}
          title={ui("Six habits that immediately improve beginner play")}
          description={ui("You do not need to memorize hundreds of moves. These simple habits already prevent many common mistakes.")}
        />

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            "Before every move, ask: Is my king safe?",
            "Check whether your opponent attacks one of your pieces.",
            "Develop knights and bishops before moving the queen many times.",
            "Try to castle before starting an attack.",
            "Do not trade a valuable piece for a much cheaper one without a reason.",
            "When unsure, look for checks, captures, and threats.",
          ].map((tip, index) => (
            <div
              key={tip}
              className="
                flex
                gap-3
                rounded-2xl
                border
                border-white/5
                bg-black/20
                p-4
              "
            >
              <span
                className="
                  flex
                  h-7
                  w-7
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  bg-amber-400/10
                  text-xs
                  font-black
                  text-amber-300
                "
              >
                {index + 1}
              </span>

              <p className="text-sm leading-6 text-zinc-400">{t(tip)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function OpeningsTab() {
  useUiLanguage();
  const t = useT();

  return (
    <div>
      <SectionHeading
        eyebrow={ui("Chess Openings")}
        title={ui("Important openings worth recognizing")}
        description={ui("You do not need to memorize every variation. First learn the basic idea behind each opening and understand why the opening moves fight for development, king safety, and central control.")}
      />

      <div
        className="
          mt-5
          rounded-3xl
          border
          border-amber-400/15
          bg-amber-400/[0.05]
          p-4
          text-sm
          leading-6
          text-zinc-400
        "
      >
        <strong className="text-amber-200">{t("Beginner advice:")}</strong>{" "}
        {t(
          "Learn the opening principles first. Opening names become useful because they help you recognize familiar positions, not because you must memorize long sequences.",
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {openings.map((opening, index) => (
          <article
            key={t(opening.name)}
            className="
              rounded-3xl
              border
              border-white/10
              bg-zinc-900/75
              p-5
              transition
              hover:border-amber-400/20
              hover:bg-zinc-900
            "
          >
            <div
              className="
                grid
                gap-4
                md:grid-cols-[minmax(190px,0.8fr)_minmax(0,1.2fr)]
                md:items-start
              "
            >
              <div className="flex items-start gap-3">
                <span
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    bg-amber-400/10
                    text-xs
                    font-black
                    text-amber-300
                  "
                >
                  {index + 1}
                </span>

                <div className="min-w-0">
                  <h3 className="text-base font-black text-white">
                    {t(opening.name)}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t(opening.category)}
                  </p>
                </div>
              </div>

              <p
                className="
                  border-l
                  border-white/10
                  pl-4
                  text-sm
                  leading-6
                  text-zinc-400
                  max-md:border-l-0
                  max-md:border-t
                  max-md:pt-3
                  max-md:pl-0
                "
              >
                {t(opening.idea)}
              </p>
            </div>

            <div
              className="
                mt-4
                rounded-xl
                border
                border-white/5
                bg-black/30
                px-3
                py-2.5
                font-mono
                text-sm
                font-bold
                text-amber-100
              "
            >
              {opening.moves}
            </div>

            <OpeningSequenceBoards moves={opening.moves} />
          </article>
        ))}
      </div>

      <section className="mt-8">
        <SectionHeading
          eyebrow={ui("Opening Principles")}
          title={ui("What matters more than memorization")}
          description={ui("If your opponent leaves theory early, these principles tell you what to do next.")}
        />

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: "Control the center",
              text: "Central squares give your pieces more space and influence.",
            },
            {
              title: "Develop pieces",
              text: "Bring knights and bishops into the game instead of moving one piece repeatedly.",
            },
            {
              title: "Castle early",
              text: "King safety usually matters more than grabbing an extra pawn in the opening.",
            },
            {
              title: "Connect the rooks",
              text: "After developing and castling, move the queen so your rooks can support each other.",
            },
          ].map((item) => (
            <InfoCard key={item.title} title={item.title}>
              <p>{t(item.text)}</p>
            </InfoCard>
          ))}
        </div>
      </section>
    </div>
  );
}

function SituationsTab() {
  useUiLanguage();
  const t = useT();
  const [filter, setFilter] = useState<"All" | SituationInfo["category"]>(
    "All",
  );

  const filteredSituations =
    filter === "All"
      ? situations
      : situations.filter((situation) => situation.category === filter);

  return (
    <div>
      <SectionHeading
        eyebrow={ui("Typical Chess Situations")}
        title={ui("Patterns you will see again and again")}
        description={ui("Recognizing patterns is one of the fastest ways to improve. These ideas appear in games at every level.")}
      />

      <div className="mt-5 flex flex-wrap gap-2">
        {(["All", "Tactic", "Strategy", "Endgame"] as const).map((option) => (
          <button
            key={t(option)}
            type="button"
            onClick={() => setFilter(option)}
            className={`
              rounded-full
              border
              px-4
              py-2
              text-xs
              font-black
              transition

              ${
                filter === option
                  ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                  : "border-white/10 bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
              }
            `}
          >
            {t(option)}
          </button>
        ))}
      </div>

      <MiniBoardLegend />

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredSituations.map((situation) => (
          <article
            key={t(situation.title)}
            className="
              rounded-3xl
              border
              border-white/10
              bg-zinc-900/75
              p-5
              transition
              hover:border-amber-400/20
              hover:bg-zinc-900
            "
          >
            <div className="flex items-start justify-between gap-4">
              <div
                className="
                  flex
                  h-12
                  w-12
                  shrink-0
                  items-center
                  justify-center
                  rounded-2xl
                  border
                  border-white/5
                  bg-black/20
                  text-2xl
                  font-black
                  text-amber-200
                "
              >
                {situation.symbol}
              </div>

              <span
                className={`
                  rounded-full
                  px-2.5
                  py-1
                  text-[9px]
                  font-black
                  uppercase
                  tracking-wider

                  ${
                    situation.category === "Tactic"
                      ? "bg-red-500/10 text-red-300"
                      : situation.category === "Strategy"
                        ? "bg-blue-500/10 text-blue-300"
                        : "bg-emerald-500/10 text-emerald-300"
                  }
                `}
              >
                {t(situation.category)}
              </span>
            </div>

            <h3 className="mt-4 text-base font-black text-white">
              {t(situation.title)}
            </h3>

            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {t(situation.description)}
            </p>

            <div className="mt-4">
              <MiniChessBoard example={situation.example} />
            </div>

            <div
              className="
                mt-4
                rounded-2xl
                border
                border-white/5
                bg-black/20
                p-3
                text-xs
                leading-5
                text-zinc-500
              "
            >
              <span className="font-black text-amber-300">
                {t("Remember:")}
              </span>{" "}
              {t(situation.tip)}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

type PuzzleCategory = "Tactic" | "Checkmate" | "Strategy" | "Endgame";
type PuzzleDifficulty =
  | "Beginner"
  | "Intermediate"
  | "Advanced"
  | "Really Hard";
type PuzzleRank = 1 | 2 | 3 | "worst";

type PuzzleCandidate = {
  uci: string;
  label: string;
  rank: PuzzleRank;
  explanation: string;
};

type PuzzleLineMove = {
  uci: string;
  label: string;
  note?: string;
};

type InteractivePuzzle = {
  id: string;
  sourceId: string;
  origin: "lichess" | "singleplayer" | "multiplayer";
  sourceLabel: string;
  title: string;
  category: PuzzleCategory;
  difficulty: PuzzleDifficulty;
  rating: number;
  popularity: number;
  themes: string[];
  objective: string;
  goal: string;
  fen: string;
  orientation: "white" | "black";
  line: PuzzleLineMove[];
  candidates: PuzzleCandidate[];
  quality?: "Inaccuracy" | "Mistake" | "Blunder";
  centipawnLoss?: number;
  moveNumber?: number;
  playedMoveSan?: string;
  createdAt?: string;
};

type PuzzleFeedback = {
  tone: "success" | "info" | "warning";
  title: string;
  text: string;
  moveLabel?: string;
  rank?: PuzzleRank;
};

function puzzleMoveParts(uci: string) {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci.length > 4 ? (uci[4] as "q" | "r" | "b" | "n") : undefined,
  };
}

function puzzleMoveUci(move: { from: string; to: string; promotion?: string }) {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function checkedKingSquare(game: Chess): Square | null {
  if (!game.isCheck()) {
    return null;
  }

  const side = game.turn();
  const files = "abcdefgh";

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const piece = game.board()[row][column];

      if (piece?.type === "k" && piece.color === side) {
        return `${files[column]}${8 - row}` as Square;
      }
    }
  }

  return null;
}

type CandidatePreview = {
  from: Square;
  to: Square;
  rank: PuzzleRank;
  label: string;
  enginePreview?: boolean;
};

function candidatePreviewMarker(rank: PuzzleRank) {
  if (rank === 1) return "1";
  if (rank === 2) return "2";
  if (rank === 3) return "3";
  return "!";
}

function candidateFromClass(rank: PuzzleRank) {
  if (rank === 1) {
    return "ring-4 ring-inset ring-emerald-300/95 bg-emerald-400/20";
  }

  if (rank === 2) {
    return "ring-4 ring-inset ring-orange-200/95 bg-orange-300/28";
  }

  if (rank === 3) {
    return "ring-4 ring-inset ring-amber-400/85 bg-amber-600/18";
  }

  return "ring-4 ring-inset ring-red-300/95 bg-red-400/20";
}

function candidateToClass(rank: PuzzleRank) {
  if (rank === 1) {
    return "ring-4 ring-inset ring-emerald-200 bg-emerald-400/48";
  }

  if (rank === 2) {
    return "ring-4 ring-inset ring-orange-100 bg-orange-300/58";
  }

  if (rank === 3) {
    return "ring-4 ring-inset ring-amber-300/85 bg-amber-600/38";
  }

  return "ring-4 ring-inset ring-red-200 bg-red-400/48";
}

function InteractivePuzzleBoard({
  fen,
  orientation,
  selectedSquare,
  legalSquares,
  lastMove,
  candidatePreview,
  wrongMove,
  correctMove,
  disabled,
  onSquareClick,
}: {
  fen: string;
  orientation: "white" | "black";
  selectedSquare: Square | null;
  legalSquares: Square[];
  lastMove: { from: Square; to: Square } | null;
  candidatePreview: CandidatePreview | null;
  wrongMove?: { from: Square; to: Square } | null;
  correctMove?: { from: Square; to: Square } | null;
  disabled: boolean;
  onSquareClick: (square: Square) => void;
}) {
  useUiLanguage();
  const game = new Chess(fen);
  const checkedSquare = checkedKingSquare(game);

  const { pieceTheme, boardTheme } = useChessSettings();
  const palette = boardColors[boardTheme];
  const files =
    orientation === "white"
      ? ["a", "b", "c", "d", "e", "f", "g", "h"]
      : ["h", "g", "f", "e", "d", "c", "b", "a"];

  const ranks =
    orientation === "white"
      ? [8, 7, 6, 5, 4, 3, 2, 1]
      : [1, 2, 3, 4, 5, 6, 7, 8];

  const arrow = (move: { from: Square; to: Square } | null | undefined, color: string, id: string) => {
    if (!move) return null;
    const point = (square: Square) => ({ x: (files.indexOf(square[0]) + .5) * 100, y: (ranks.indexOf(Number(square[1])) + .5) * 100 });
    const from = point(move.from);
    const to = point(move.to);
    return <svg className="pointer-events-none absolute inset-0 z-[18] h-full w-full" viewBox="0 0 800 800" aria-hidden="true"><defs><marker id={id} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill={color} /></marker></defs><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth="11" strokeLinecap="round" markerEnd={`url(#${id})`} opacity=".9" /></svg>;
  };

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <div className="overflow-hidden rounded-3xl border border-white/10 p-2 shadow-2xl shadow-black/30" style={{ backgroundColor: palette.frame }}>
        <div className="relative grid grid-cols-8 overflow-hidden rounded-2xl">
          {ranks.flatMap((rank, rankIndex) =>
            files.map((file, fileIndex) => {
              const square = `${file}${rank}` as Square;
              const piece = game.get(square);
              const isLight = (rank + files.indexOf(file)) % 2 !== 0;
              const isSelected = selectedSquare === square;
              const isLegal = legalSquares.includes(square);
              const isCapture = isLegal && Boolean(piece);
              const isLastMove =
                lastMove?.from === square || lastMove?.to === square;
              const isChecked = checkedSquare === square;
              const isCandidateFrom = candidatePreview?.from === square;
              const isCandidateTo = candidatePreview?.to === square;
              const isWrongFrom = wrongMove?.from === square;
              const isWrongTo = wrongMove?.to === square;
              const isCorrectFrom = correctMove?.from === square;
              const isCorrectTo = correctMove?.to === square;

              const pieceCode = piece
                ? (`${piece.color}${piece.type}` as MiniPieceCode)
                : null;

              return (
                <button
                  key={square}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSquareClick(square)}
                  className={`
                    relative
                    flex
                    aspect-square
                    items-center
                    justify-center
                    overflow-hidden
                    transition
                    ${disabled ? "cursor-default" : "cursor-pointer"}
                  `}
                  style={{ backgroundColor: isLight ? palette.light : palette.dark }}
                  title={square}
                >
                  {isLastMove && (
                    <span className="pointer-events-none absolute inset-0 bg-amber-300/28" />
                  )}

                  {(isCorrectFrom || isCorrectTo) && (
                    <span className="pointer-events-none absolute inset-0 z-[5] bg-emerald-400/24 ring-4 ring-inset ring-emerald-300/90" />
                  )}

                  {isCorrectTo && (
                    <span className="pointer-events-none absolute right-1 top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-emerald-100/40 bg-emerald-950/85 text-[11px] font-black text-emerald-200 shadow">
                      ✓
                    </span>
                  )}

                  {(isWrongFrom || isWrongTo) && (
                    <span className="pointer-events-none absolute inset-0 z-[6] bg-rose-500/18 ring-4 ring-inset ring-rose-400/85" />
                  )}

                  {isWrongTo && (
                    <span className="pointer-events-none absolute bottom-1 right-1 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-rose-100/35 bg-rose-950/85 text-[11px] font-black text-rose-200 shadow">
                      ×
                    </span>
                  )}

                  {isCandidateFrom && candidatePreview && (
                    <span
                      className={`
                        pointer-events-none
                        absolute
                        inset-0
                        z-[4]
                        ${
                          candidatePreview.enginePreview
                            ? "ring-4 ring-inset ring-yellow-300/95 bg-yellow-300/24"
                            : candidateFromClass(candidatePreview.rank)
                        }
                      `}
                    />
                  )}

                  {isCandidateTo && candidatePreview && (
                    <>
                      <span
                        className={`
                          pointer-events-none
                          absolute
                          inset-0
                          z-[4]
                          ${
                            candidatePreview.enginePreview
                              ? "ring-4 ring-inset ring-yellow-200/95 bg-yellow-300/44"
                              : candidateToClass(candidatePreview.rank)
                          }
                        `}
                      />

                      {!candidatePreview.enginePreview && (
                        <span
                          className="
                            pointer-events-none
                            absolute
                            right-1
                            top-1
                            z-20
                            flex
                            h-5
                            min-w-5
                            items-center
                            justify-center
                            rounded-full
                            border
                            border-black/20
                            bg-zinc-950/80
                            px-1
                            text-[9px]
                            font-black
                            text-white
                            shadow
                          "
                        >
                          {candidatePreviewMarker(candidatePreview.rank)}
                        </span>
                      )}
                    </>
                  )}

                  {isSelected && (
                    <span className="pointer-events-none absolute inset-0 ring-4 ring-inset ring-sky-300/90" />
                  )}

                  {isChecked && (
                    <span className="pointer-events-none absolute inset-0 bg-red-500/40 ring-4 ring-inset ring-red-200/80" />
                  )}

                  {isLegal && !isCapture && (
                    <span className="pointer-events-none absolute h-[28%] w-[28%] rounded-full bg-emerald-950/45 ring-2 ring-emerald-100/60" />
                  )}

                  {isCapture && (
                    <span className="pointer-events-none absolute inset-[7%] rounded-full border-[4px] border-amber-200/75" />
                  )}

                  {pieceCode && (
                    <span
                      className={`
                        flex h-full w-full items-center justify-center
                        relative
                        z-10
                        select-none
                        font-serif
                        text-[30px]
                        leading-none
                        drop-shadow-[0_2px_2px_rgba(0,0,0,0.55)]
                        sm:text-[40px]
                        lg:text-[46px]
                        ${piece?.color === "w" ? "text-[#fff3d5]" : "text-[#17120f]"}
                      `}
                    >
                      {pieceTheme === "classic" ? miniPieceSymbols[pieceCode] : <ChessPiece type={pieceCode[1] as "p" | "n" | "b" | "r" | "q" | "k"} color={pieceCode[0] as "w" | "b"} theme={pieceTheme} />}
                    </span>
                  )}

                  {(fileIndex === 0 || rankIndex === ranks.length - 1) && (
                    <span
                      className={`
                        pointer-events-none
                        absolute
                        text-[8px]
                        font-black
                        ${isLight ? "text-[#76583d]" : "text-[#ead5b1]/75"}
                        ${fileIndex === 0 ? "left-1 top-1" : "bottom-1 right-1"}
                      `}
                    >
                      {fileIndex === 0 ? rank : file}
                    </span>
                  )}
                </button>
              );
            }),
          )}
          {arrow(wrongMove, "#fb5165", "puzzle-wrong-arrow")}
          {arrow(correctMove, "#38ef8e", "puzzle-correct-arrow")}
        </div>
      </div>
    </div>
  );
}

function compactPuzzleTitle(title: string) {
  if (title.length <= 24) {
    return title;
  }

  const words = title.split(" ");

  if (words.length <= 3) {
    return title;
  }

  return `${words.slice(0, 3).join(" ")}…`;
}

function PuzzlesTab({ compact = false }: { compact?: boolean }) {
  useUiLanguage();
  const { user } = useAuth();

  type LibraryTab = "suggested" | "from-games" | "completed";

  const [libraryTab, setLibraryTab] = useState<LibraryTab>("suggested");
  const [categoryFilter, setCategoryFilter] = useState<"All" | PuzzleCategory>(
    "All",
  );
  const [difficultyFilter, setDifficultyFilter] = useState<
    "All" | PuzzleDifficulty
  >("All");
  const [sortBy, setSortBy] = useState<PuzzleLibrarySort>("random");
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [difficultyFilterOpen, setDifficultyFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [loadingMoreSuggestions, setLoadingMoreSuggestions] = useState(false);

  const [suggestions, setSuggestions] = useState<InteractivePuzzle[]>([]);
  const [personalPuzzles, setPersonalPuzzles] = useState<InteractivePuzzle[]>(
    [],
  );
  const [completedPuzzles, setCompletedPuzzles] = useState<CompletedPuzzle[]>(
    [],
  );
  const [completedPersonalPuzzles, setCompletedPersonalPuzzles] = useState<
    CompletedPersonalPuzzle[]
  >([]);

  const [puzzle, setPuzzle] = useState<InteractivePuzzle | null>(null);
  const [remotePuzzleLoading, setRemotePuzzleLoading] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [personalLibraryLoading, setPersonalLibraryLoading] = useState(false);
  const [remotePuzzleError, setRemotePuzzleError] = useState<string | null>(
    null,
  );
  const [editingPuzzleTitle, setEditingPuzzleTitle] = useState(false);
  const [puzzleTitleDraft, setPuzzleTitleDraft] = useState("");
  const [puzzleTitleSaving, setPuzzleTitleSaving] = useState(false);
  const [puzzleTitleError, setPuzzleTitleError] = useState<string | null>(null);

  const [fen, setFen] = useState(new Chess().fen());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalSquares, setLegalSquares] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [wrongMove, setWrongMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [correctMove, setCorrectMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [lineStep, setLineStep] = useState(0);
  const [feedback, setFeedback] = useState<PuzzleFeedback | null>(null);
  const [autoReplying, setAutoReplying] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [candidatePreview, setCandidatePreview] =
    useState<CandidatePreview | null>(null);

  const completionRecordedRef = useRef<string | null>(null);
  const correctRevealTimer = useRef<number | null>(null);

  useEffect(() => () => { if (correctRevealTimer.current !== null) window.clearTimeout(correctRevealTimer.current); }, []);

  const solved = Boolean(puzzle) && lineStep >= (puzzle?.line.length ?? 0);

  const completedTotal =
    completedPuzzles.length + completedPersonalPuzzles.length;

  const sortLabel: Record<PuzzleLibrarySort, string> = {
    random: "Random",
    "popularity-desc": "Popularity · high → low",
    "popularity-asc": "Popularity · low → high",
    "elo-desc": "Elo · high → low",
    "elo-asc": "Elo · low → high",
    "difficulty-desc": "Difficulty · hard → easy",
    "difficulty-asc": "Difficulty · easy → hard",
  };

  function resetInteraction(nextPuzzle: InteractivePuzzle) {
    if (correctRevealTimer.current !== null) window.clearTimeout(correctRevealTimer.current);
    setFen(nextPuzzle.fen);
    setSelectedSquare(null);
    setLegalSquares([]);
    setLastMove(null);
    setWrongMove(null);
    setCorrectMove(null);
    setLineStep(0);
    setFeedback(null);
    setAutoReplying(false);
    setMistakes(0);
    setCandidatePreview(null);
    setRemotePuzzleError(null);
    completionRecordedRef.current = null;
  }

  function loadPuzzle(nextPuzzle: InteractivePuzzle) {
    setPuzzle(nextPuzzle);
    setEditingPuzzleTitle(false);
    setPuzzleTitleDraft(nextPuzzle.title);
    setPuzzleTitleError(null);
    resetInteraction(nextPuzzle);
  }

  function beginPuzzleTitleEdit() {
    if (!puzzle || !user) {
      return;
    }

    setPuzzleTitleDraft(puzzle.title);
    setPuzzleTitleError(null);
    setEditingPuzzleTitle(true);
  }

  function cancelPuzzleTitleEdit() {
    setEditingPuzzleTitle(false);
    setPuzzleTitleDraft(puzzle?.title ?? "");
    setPuzzleTitleError(null);
  }

  async function savePuzzleTitle() {
    if (!puzzle || !user || puzzleTitleSaving) {
      return;
    }

    const nextTitle = puzzleTitleDraft.trim();

    if (!nextTitle) {
      setPuzzleTitleError("Puzzle title cannot be empty.");
      return;
    }

    setPuzzleTitleSaving(true);
    setPuzzleTitleError(null);

    try {
      if (puzzle.origin === "lichess") {
        await renameLichessPuzzle(puzzle.sourceId, nextTitle);
      } else {
        await renamePersonalGamePuzzle(puzzle.sourceId, nextTitle);
      }

      setPuzzle((current) =>
        current
          ? {
              ...current,
              title: nextTitle.slice(0, 80),
            }
          : current,
      );

      setSuggestions((current) =>
        current.map((item) =>
          item.origin === "lichess" && item.sourceId === puzzle.sourceId
            ? {
                ...item,
                title: nextTitle.slice(0, 80),
              }
            : item,
        ),
      );

      setCompletedPuzzles((current) =>
        current.map((item) =>
          item.puzzle.origin === "lichess" &&
          item.puzzle.sourceId === puzzle.sourceId
            ? {
                ...item,
                puzzle: {
                  ...item.puzzle,
                  title: nextTitle.slice(0, 80),
                },
              }
            : item,
        ),
      );

      setPersonalPuzzles((current) =>
        current.map((item) =>
          item.sourceId === puzzle.sourceId
            ? {
                ...item,
                title: nextTitle.slice(0, 80),
              }
            : item,
        ),
      );

      setCompletedPersonalPuzzles((current) =>
        current.map((item) =>
          item.puzzle.sourceId === puzzle.sourceId
            ? {
                ...item,
                puzzle: {
                  ...item.puzzle,
                  title: nextTitle.slice(0, 80),
                },
              }
            : item,
        ),
      );

      setEditingPuzzleTitle(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      console.error("Could not rename puzzle:", message);
      setPuzzleTitleError(message);
    } finally {
      setPuzzleTitleSaving(false);
    }
  }

  function resetCurrentPuzzle() {
    if (!puzzle) {
      return;
    }

    resetInteraction(puzzle);
  }

  async function loadCompletedLibrary() {
    if (!user) {
      setCompletedPuzzles([]);
      return;
    }

    try {
      const completed = await getCompletedLichessPuzzles(100);
      setCompletedPuzzles(completed);
    } catch (error) {
      console.error("Could not load completed Lichess puzzles:", error);
    }
  }

  async function loadPersonalLibraries() {
    if (!user) {
      setPersonalPuzzles([]);
      setCompletedPersonalPuzzles([]);
      return;
    }

    setPersonalLibraryLoading(true);

    try {
      const [unsolved, completed] = await Promise.all([
        getPersonalGamePuzzles(100),
        getCompletedPersonalGamePuzzles(100),
      ]);

      setPersonalPuzzles(unsolved);
      setCompletedPersonalPuzzles(completed);
    } catch (error) {
      console.error("Could not load personal game puzzles:", error);
    } finally {
      setPersonalLibraryLoading(false);
    }
  }

  async function loadSuggestionSet({
    keepCurrent = false,
  }: {
    keepCurrent?: boolean;
  } = {}) {
    setLibraryLoading(true);
    setRemotePuzzleError(null);

    try {
      const nextSuggestions = await getSuggestedLichessPuzzles({
        category: categoryFilter,
        difficulty: difficultyFilter,
        sort: sortBy,
        count: 5,
      });

      setSuggestions(nextSuggestions);

      if (!keepCurrent && nextSuggestions[0]) {
        loadPuzzle(nextSuggestions[0]);
      }

      if (nextSuggestions.length === 0) {
        setRemotePuzzleError(
          "No unsolved puzzles matched these filters. Try widening them.",
        );
      }
    } catch (error) {
      console.error("Could not load puzzle suggestions:", error);
      setRemotePuzzleError("Could not load puzzle suggestions from Supabase.");
    } finally {
      setLibraryLoading(false);
    }
  }

  async function loadMoreSuggestions() {
    if (libraryLoading || loadingMoreSuggestions || suggestions.length >= 20) {
      return;
    }

    const remaining = 20 - suggestions.length;
    const count = Math.min(5, remaining);

    setLoadingMoreSuggestions(true);
    setRemotePuzzleError(null);

    try {
      const more = await getSuggestedLichessPuzzles({
        category: categoryFilter,
        difficulty: difficultyFilter,
        sort: sortBy,
        count,
        excludeIds: suggestions.map((item) => item.sourceId),
      });

      const existingIds = new Set(suggestions.map((item) => item.sourceId));

      const uniqueMore = more.filter((item) => !existingIds.has(item.sourceId));

      setSuggestions((current) => [...current, ...uniqueMore].slice(0, 20));

      if (uniqueMore.length === 0) {
        setRemotePuzzleError("No more unsolved puzzles matched these filters.");
      }
    } catch (error) {
      console.error("Could not load more puzzle suggestions:", error);
      setRemotePuzzleError(
        "Could not load more puzzle suggestions from Supabase.",
      );
    } finally {
      setLoadingMoreSuggestions(false);
    }
  }

  useEffect(() => {
    void loadSuggestionSet();
  }, [categoryFilter, difficultyFilter, sortBy, user?.id]);

  useEffect(() => {
    void Promise.all([loadCompletedLibrary(), loadPersonalLibraries()]);
  }, [user?.id]);

  async function nextPuzzle() {
    if (remotePuzzleLoading) {
      return;
    }

    /*
     * "From My Games" is a separate private queue. Keep Next Puzzle
     * inside that queue instead of unexpectedly jumping to Lichess.
     */
    if (libraryTab === "from-games" && puzzle && puzzle.origin !== "lichess") {
      const nextPersonal = personalPuzzles.find(
        (item) => item.sourceId !== puzzle.sourceId,
      );

      if (nextPersonal) {
        loadPuzzle(nextPersonal);
        return;
      }

      setRemotePuzzleError(
        "No other unsolved puzzles from your games are available yet.",
      );
      return;
    }

    setRemotePuzzleLoading(true);
    setRemotePuzzleError(null);

    try {
      const excludeIds = [
        ...suggestions.map((item) => item.sourceId),
        ...(puzzle?.origin === "lichess" && puzzle.sourceId
          ? [puzzle.sourceId]
          : []),
      ];

      const next = await getRandomLichessPuzzle({
        category: categoryFilter,
        difficulty: difficultyFilter,
        excludeIds,
      });

      if (!next) {
        setRemotePuzzleError("No new unsolved puzzle matched these filters.");
        return;
      }

      loadPuzzle(next);
    } catch (error) {
      console.error("Error loading next puzzle:", error);
      setRemotePuzzleError("Could not load the next puzzle.");
    } finally {
      setRemotePuzzleLoading(false);
    }
  }

  async function recordCompletion() {
    if (!puzzle?.sourceId) {
      return;
    }

    const completionKey = `${puzzle.origin}:${puzzle.sourceId}`;

    if (completionRecordedRef.current === completionKey) {
      return;
    }

    completionRecordedRef.current = completionKey;

    if (!user) {
      return;
    }

    try {
      if (puzzle.origin === "lichess") {
        await recordLichessPuzzleCompletion(puzzle.sourceId, mistakes);

        await Promise.all([
          loadCompletedLibrary(),
          loadSuggestionSet({ keepCurrent: true }),
        ]);
      } else {
        await recordPersonalGamePuzzleCompletion(puzzle.sourceId, mistakes);

        await loadPersonalLibraries();
      }
    } catch (error) {
      console.error("Could not record puzzle completion:", error);
      completionRecordedRef.current = null;
    }
  }

  function attemptMove(from: Square, to: Square) {
    if (!puzzle || autoReplying || solved || lineStep % 2 === 1) {
      return;
    }

    const game = new Chess(fen);
    let move;

    try {
      const movingPiece = game.get(from);
      const needsPromotion =
        movingPiece?.type === "p" && (to[1] === "8" || to[1] === "1");

      move = game.move(
        needsPromotion
          ? {
              from,
              to,
              promotion: "q",
            }
          : {
              from,
              to,
            },
      );
    } catch {
      move = null;
    }

    if (!move) {
      setFeedback({
        tone: "warning",
        title: "Illegal move",
        text: "That move cannot be played in this position.",
      });
      return;
    }

    const expected = puzzle.line[lineStep];
    const playedUci = puzzleMoveUci(move);

    setSelectedSquare(null);
    setLegalSquares([]);
    setCandidatePreview(null);

    if (!expected || playedUci !== expected.uci) {
      const expectedParts = expected ? puzzleMoveParts(expected.uci) : null;

      setMistakes((value) => value + 1);
      setWrongMove({
        from: move.from,
        to: move.to,
      });
      setCorrectMove(null);
      if (correctRevealTimer.current !== null) window.clearTimeout(correctRevealTimer.current);
      if (expectedParts) correctRevealTimer.current = window.setTimeout(() => {
        setCorrectMove({ from: expectedParts.from, to: expectedParts.to });
        correctRevealTimer.current = null;
      }, 700);

      setFeedback({
        tone: "warning",
        title: "Not quite",
        moveLabel: move.san,
        text: "Your move is marked red. Watch for the green correct move, then try it on the board.",
      });

      return;
    }

    if (correctRevealTimer.current !== null) window.clearTimeout(correctRevealTimer.current);
    setWrongMove(null);
    setCorrectMove(null);
    setFen(game.fen());
    setLastMove({
      from: move.from,
      to: move.to,
    });

    const nextStep = lineStep + 1;
    setLineStep(nextStep);

    if (nextStep >= puzzle.line.length) {
      setFeedback({
        tone: "success",
        rank: 1,
        title: "Solved!",
        moveLabel: expected.label,
        text:
          mistakes === 0
            ? "Perfect. You found the full continuation without a mistake."
            : "Correct. You recovered and finished the full continuation.",
      });

      void recordCompletion();
      return;
    }

    setFeedback({
      tone: "success",
      rank: 1,
      title: "Correct!",
      moveLabel: expected.label,
      text: "Clean move. The opponent reply is coming next.",
    });
  }

  function handleSquareClick(square: Square) {
    if (!puzzle || autoReplying || solved || lineStep % 2 === 1) {
      return;
    }

    setCandidatePreview(null);

    const game = new Chess(fen);

    if (!selectedSquare) {
      const piece = game.get(square);

      if (!piece || piece.color !== game.turn()) {
        return;
      }

      setSelectedSquare(square);
      setLegalSquares(
        game
          .moves({
            square,
            verbose: true,
          })
          .map((move) => move.to),
      );
      return;
    }

    if (legalSquares.includes(square)) {
      attemptMove(selectedSquare, square);
      return;
    }

    const clickedPiece = game.get(square);

    if (clickedPiece?.color === game.turn()) {
      setSelectedSquare(square);
      setLegalSquares(
        game
          .moves({
            square,
            verbose: true,
          })
          .map((move) => move.to),
      );
      return;
    }

    setSelectedSquare(null);
    setLegalSquares([]);
  }

  useEffect(() => {
    if (
      !puzzle ||
      solved ||
      lineStep >= puzzle.line.length ||
      lineStep % 2 === 0
    ) {
      return;
    }

    setAutoReplying(true);

    const timer = window.setTimeout(() => {
      const game = new Chess(fen);
      const reply = puzzle.line[lineStep];
      const parts = puzzleMoveParts(reply.uci);

      let move;

      try {
        move = game.move(parts);
      } catch {
        move = null;
      }

      if (!move) {
        setAutoReplying(false);
        return;
      }

      setFen(game.fen());
      setLastMove({
        from: move.from,
        to: move.to,
      });
      setWrongMove(null);
      setCorrectMove(null);

      const nextStep = lineStep + 1;
      setLineStep(nextStep);
      setAutoReplying(false);

      if (nextStep >= puzzle.line.length) {
        setFeedback({
          tone: "success",
          rank: 1,
          title: "Solved!",
          moveLabel: reply.label,
          text: "You found the full continuation.",
        });

        void recordCompletion();
        return;
      }

      setFeedback({
        tone: "info",
        title: "Opponent reply",
        moveLabel: reply.label,
        text: "Your move again.",
      });
    }, 650);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fen, lineStep, puzzle, solved]);

  const completedLibraryItems = [
    ...completedPuzzles.map((item) => ({
      puzzle: item.puzzle as InteractivePuzzle,
      completedAt: item.completedAt,
      mistakes: item.mistakes,
    })),
    ...completedPersonalPuzzles.map((item) => ({
      puzzle: item.puzzle as InteractivePuzzle,
      completedAt: item.completedAt,
      mistakes: item.mistakes,
    })),
  ].sort(
    (left, right) =>
      new Date(right.completedAt).getTime() -
      new Date(left.completedAt).getTime(),
  );

  const libraryItems =
    libraryTab === "suggested"
      ? suggestions.map((item) => ({
          puzzle: item,
          completedAt: null as string | null,
          mistakes: null as number | null,
        }))
      : libraryTab === "from-games"
        ? personalPuzzles.map((item) => ({
            puzzle: item,
            completedAt: null as string | null,
            mistakes: null as number | null,
          }))
        : completedLibraryItems;

  const feedbackVisual =
    feedback?.tone === "success"
      ? {
          icon: "✓",
          shell:
            "border-emerald-400/25 bg-[linear-gradient(135deg,rgba(16,82,57,.20),rgba(4,18,16,.72))]",
          iconClass: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
          titleClass: "text-emerald-100",
        }
      : feedback?.tone === "warning"
        ? {
            icon: "×",
            shell:
              "border-rose-400/25 bg-[linear-gradient(135deg,rgba(105,25,45,.20),rgba(20,5,11,.72))]",
            iconClass: "border-rose-300/25 bg-rose-300/10 text-rose-200",
            titleClass: "text-rose-100",
          }
        : {
            icon: "•",
            shell:
              "border-sky-400/15 bg-[linear-gradient(135deg,rgba(20,59,87,.14),rgba(4,12,20,.70))]",
            iconClass: "border-sky-300/20 bg-sky-300/[0.07] text-sky-200",
            titleClass: "text-sky-100",
          };

  return (
    <div>
      {!compact && <SectionHeading
        eyebrow={ui("Interactive Chess Puzzles")}
        title={ui("Find the best move")}
        description={ui("Fresh Lichess challenges plus positions you personally missed in Singleplayer and Multiplayer games.")}
      />}

      {!compact && <section className="mt-5 overflow-hidden rounded-[1.8rem] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(9,16,25,.90),rgba(4,9,15,.88))] p-4 shadow-xl shadow-black/20">
        {libraryTab === "suggested" ? (
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-300/80">{ui("Puzzle Library")}</p>
            <h3 className="mt-1 font-serif text-xl font-semibold text-[#f5e8cf]">{ui("Five fresh challenges")}</h3>
            <p className="mt-1 text-xs text-zinc-600">{ui("Filter and sort directly inside the puzzle list. Completed Lichess puzzles stay excluded automatically.")}</p>
          </div>
        ) : libraryTab === "from-games" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-violet-300/80">{ui("Personal Training")}</p>
              <h3 className="mt-1 font-serif text-xl font-semibold text-[#f5e8cf]">{ui("Positions from your games")}</h3>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-600">{ui("One meaningful missed position is created automatically when you analyze a finished Singleplayer or Multiplayer game in Game Review. Hotseat never creates personal puzzles.")}</p>
            </div>

            <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-[0.11em]">
              <span className="rounded-full border border-sky-400/15 bg-sky-400/[0.06] px-3 py-1.5 text-sky-200">{ui("Singleplayer")}</span>
              <span className="rounded-full border border-violet-400/15 bg-violet-400/[0.06] px-3 py-1.5 text-violet-200">{ui("Multiplayer")}</span>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-300/80">{ui("Training History")}</p>
            <h3 className="mt-1 font-serif text-xl font-semibold text-[#f5e8cf]">{ui("Completed puzzles")}</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-600">{ui("Your solved Lichess puzzles and solved positions from your own games are kept together here.")}</p>
          </div>
        )}
      </section>}

      <div className={`${compact ? "mt-1" : "mt-5"} grid items-start gap-4 lg:grid-cols-[270px_minmax(0,1fr)_260px] xl:grid-cols-[330px_minmax(0,1fr)_300px] 2xl:grid-cols-[390px_minmax(0,1fr)_340px]`}>
        <aside className="min-w-0 rounded-3xl border border-white/10 bg-zinc-900/55 p-4">
          <div className="grid grid-cols-3 rounded-2xl border border-white/8 bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setLibraryTab("suggested")}
              className={`rounded-xl px-2 py-2 text-[9px] font-black uppercase tracking-[0.08em] transition ${
                libraryTab === "suggested"
                  ? "bg-amber-400/10 text-amber-200"
                  : "text-zinc-600 hover:text-zinc-300"
              }`}
            >{ui("Suggested ·")}{suggestions.length}
            </button>

            <button
              type="button"
              onClick={() => setLibraryTab("from-games")}
              className={`rounded-xl px-2 py-2 text-[9px] font-black uppercase tracking-[0.08em] transition ${
                libraryTab === "from-games"
                  ? "bg-violet-400/[0.08] text-violet-200"
                  : "text-zinc-600 hover:text-zinc-300"
              }`}
            >{ui("My Games ·")}{user ? personalPuzzles.length : "—"}
            </button>

            <button
              type="button"
              onClick={() => setLibraryTab("completed")}
              className={`rounded-xl px-2 py-2 text-[9px] font-black uppercase tracking-[0.08em] transition ${
                libraryTab === "completed"
                  ? "bg-emerald-400/[0.08] text-emerald-200"
                  : "text-zinc-600 hover:text-zinc-300"
              }`}
            >{ui("Completed ·")}{user ? completedTotal : "—"}
            </button>
          </div>

          {libraryTab === "suggested" && (
            <div className="mt-3 space-y-2 rounded-[1.35rem] border border-amber-300/[0.10] bg-[linear-gradient(145deg,rgba(78,52,23,.10),rgba(0,0,0,.20))] p-3">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilterOpen((open) => !open);
                    setDifficultyFilterOpen(false);
                    setSortOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                    categoryFilterOpen
                      ? "border-amber-300/25 bg-amber-300/[0.08]"
                      : "border-white/[0.07] bg-[#050a10] hover:border-amber-200/15 hover:bg-[#09121b]"
                  }`}
                >
                  <span>
                    <span className="block text-[8px] font-black uppercase tracking-[0.16em] text-amber-200/50">{ui("Category")}</span>
                    <span className="mt-0.5 block text-[11px] font-black text-zinc-300">
                      {categoryFilter === "All" ? ui("All") : categoryFilter === "Tactic" ? ui("Tactics") : categoryFilter === "Checkmate" ? ui("Checkmates") : categoryFilter === "Endgame" ? ui("Endgames") : categoryFilter}
                    </span>
                  </span>

                  <span
                    className={`text-xs text-amber-200/65 transition-transform ${
                      categoryFilterOpen ? "rotate-180" : ""
                    }`}
                  >
                    ▾
                  </span>
                </button>

                {categoryFilterOpen && (
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded-xl border border-amber-300/[0.10] bg-[#03070c] p-2 shadow-[0_14px_35px_rgba(0,0,0,.35)]">
                    {(
                      [
                        ["All", "All"],
                        ["Tactic", "Tactics"],
                        ["Checkmate", "Checkmates"],
                        ["Strategy", "Strategy"],
                        ["Endgame", "Endgames"],
                      ] as const
                    ).map(([value, label]) => {
                      const active = categoryFilter === value;

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setCategoryFilter(value);
                            setCategoryFilterOpen(false);
                          }}
                          className={`rounded-lg border px-2.5 py-2 text-left text-[10px] font-black transition ${
                            active
                              ? "border-amber-300/30 bg-amber-300/[0.11] text-amber-100"
                              : "border-white/[0.055] bg-[#071018] text-zinc-500 hover:border-amber-200/15 hover:bg-[#0b1621] hover:text-zinc-300"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            {ui(label)}
                            {active && (
                              <span className="text-amber-300">✓</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    setDifficultyFilterOpen((open) => !open);
                    setCategoryFilterOpen(false);
                    setSortOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                    difficultyFilterOpen
                      ? "border-violet-300/20 bg-violet-300/[0.07]"
                      : "border-white/[0.07] bg-[#050a10] hover:border-violet-200/15 hover:bg-[#09121b]"
                  }`}
                >
                  <span>
                    <span className="block text-[8px] font-black uppercase tracking-[0.16em] text-violet-200/50">{ui("Difficulty")}</span>
                    <span className="mt-0.5 block text-[11px] font-black text-zinc-300">
                      {ui(difficultyFilter)}
                    </span>
                  </span>

                  <span
                    className={`text-xs text-violet-200/65 transition-transform ${
                      difficultyFilterOpen ? "rotate-180" : ""
                    }`}
                  >
                    ▾
                  </span>
                </button>

                {difficultyFilterOpen && (
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded-xl border border-violet-300/[0.09] bg-[#03070c] p-2 shadow-[0_14px_35px_rgba(0,0,0,.35)]">
                    {(
                      [
                        ["All", "All"],
                        ["Beginner", "Beginner"],
                        ["Intermediate", "Intermediate"],
                        ["Advanced", "Advanced"],
                        ["Really Hard", "Really Hard"],
                      ] as const
                    ).map(([value, label]) => {
                      const active = difficultyFilter === value;

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setDifficultyFilter(value);
                            setDifficultyFilterOpen(false);
                          }}
                          className={`rounded-lg border px-2.5 py-2 text-left text-[10px] font-black transition ${
                            active
                              ? "border-violet-300/25 bg-violet-300/[0.10] text-violet-100"
                              : "border-white/[0.055] bg-[#071018] text-zinc-500 hover:border-violet-200/15 hover:bg-[#0b1621] hover:text-zinc-300"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            {ui(label)}
                            {active && (
                              <span className="text-violet-300">✓</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    setSortOpen((open) => !open);
                    setCategoryFilterOpen(false);
                    setDifficultyFilterOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                    sortOpen
                      ? "border-sky-300/20 bg-sky-300/[0.06]"
                      : "border-white/[0.07] bg-[#050a10] hover:border-sky-200/15 hover:bg-[#09121b]"
                  }`}
                >
                  <span>
                    <span className="block text-[8px] font-black uppercase tracking-[0.16em] text-sky-200/45">{ui("Sort")}</span>
                    <span className="mt-0.5 block text-[10px] font-black text-zinc-300">
                      {ui(sortLabel[sortBy])}
                    </span>
                  </span>

                  <span
                    className={`text-xs text-sky-200/60 transition-transform ${
                      sortOpen ? "rotate-180" : ""
                    }`}
                  >
                    ▾
                  </span>
                </button>

                {sortOpen && (
                  <div className="mt-1.5 space-y-1 rounded-xl border border-sky-300/[0.08] bg-[#03070c] p-2 shadow-[0_14px_35px_rgba(0,0,0,.35)]">
                    {(
                      [
                        ["random", "Random"],
                        ["popularity-desc", "Popularity · high → low"],
                        ["popularity-asc", "Popularity · low → high"],
                        ["elo-desc", "Elo · high → low"],
                        ["elo-asc", "Elo · low → high"],
                        ["difficulty-desc", "Difficulty · hard → easy"],
                        ["difficulty-asc", "Difficulty · easy → hard"],
                      ] as const
                    ).map(([value, label]) => {
                      const active = sortBy === value;

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setSortBy(value);
                            setSortOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-[10px] font-black transition ${
                            active
                              ? "border-sky-300/20 bg-sky-300/[0.08] text-sky-100"
                              : "border-white/[0.05] bg-[#071018] text-zinc-500 hover:border-sky-200/15 hover:bg-[#0b1621] hover:text-zinc-300"
                          }`}
                        >
                          <span>{ui(label)}</span>
                          {active && <span className="text-sky-300">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => void loadSuggestionSet()}
                disabled={libraryLoading || loadingMoreSuggestions}
                className="w-full rounded-xl border border-amber-300/20 bg-amber-300/[0.07] px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.10em] text-amber-200 transition hover:bg-amber-300/[0.12] disabled:cursor-wait disabled:opacity-40"
              >
                {libraryLoading ? ui("Loading...") : ui("Refresh first 5")}
              </button>
            </div>
          )}

          {(libraryTab === "completed" || libraryTab === "from-games") &&
          !user ? (
            <div className="mt-3 rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] p-4">
              <p className="font-serif text-base font-semibold text-[#f2e4c7]">{ui("Sign in to use personal training")}</p>
              <p className="mt-2 text-xs leading-5 text-zinc-500">{ui("Personal game puzzles and completion history are private to your account.")}</p>
            </div>
          ) : (
            <div className="mt-3 max-h-[760px] overflow-y-auto pr-1 [scrollbar-width:thin]">
              {(libraryTab === "suggested" && libraryLoading) ||
              (libraryTab !== "suggested" && personalLibraryLoading) ? (
                <div className="space-y-2">
                  {Array.from({
                    length: libraryTab === "suggested" ? 5 : 3,
                  }).map((_, index) => (
                    <div
                      key={index}
                      className="h-[126px] animate-pulse rounded-[1.35rem] border border-white/[0.06] bg-white/[0.025]"
                    />
                  ))}
                </div>
              ) : libraryItems.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-center">
                  <p className="text-xs font-bold text-zinc-500">
                    {libraryTab === "completed" ? ui("No completed puzzles yet.") : libraryTab === "from-games" ? ui("No personal puzzles yet. Finish a Singleplayer or Multiplayer game, open Game Review, and run the analysis.") : ui("No puzzles match these filters.")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {libraryItems.map((entry) => {
                    const item = entry.puzzle;
                    const isActive =
                      puzzle?.origin === item.origin &&
                      puzzle?.sourceId === item.sourceId;
                    const isPersonal = item.origin !== "lichess";

                    return (
                      <button
                        key={`${libraryTab}-${item.origin}-${item.sourceId}`}
                        type="button"
                        onClick={() => loadPuzzle(item)}
                        className={`group w-full rounded-[1.35rem] border p-3 text-left transition hover:-translate-y-0.5 ${
                          isActive
                            ? "border-amber-400/30 bg-amber-400/[0.085]"
                            : "border-white/8 bg-black/20 hover:border-amber-400/15 hover:bg-white/[0.035]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                                  item.origin === "singleplayer"
                                    ? "border-sky-400/15 bg-sky-400/[0.06] text-sky-300"
                                    : item.origin === "multiplayer"
                                      ? "border-violet-400/15 bg-violet-400/[0.06] text-violet-300"
                                      : "border-amber-400/15 bg-amber-400/[0.06] text-amber-300"
                                }`}
                              >
                                {item.sourceLabel}
                              </span>

                              {isPersonal ? (
                                <span className="rounded-full border border-rose-400/15 bg-rose-400/[0.06] px-2 py-0.5 text-[8px] font-black text-rose-300">
                                  {item.quality}
                                </span>
                              ) : (
                                <>
                                  <span className="rounded-full border border-white/8 bg-white/[0.035] px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-zinc-500">
                                    {ui(item.category)}
                                  </span>
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-[8px] font-black ${
                                      item.difficulty === "Beginner"
                                        ? "border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300"
                                        : item.difficulty === "Intermediate"
                                          ? "border-sky-400/15 bg-sky-400/[0.06] text-sky-300"
                                          : item.difficulty === "Advanced"
                                            ? "border-violet-400/15 bg-violet-400/[0.06] text-violet-300"
                                            : "border-red-400/15 bg-red-400/[0.06] text-red-300"
                                    }`}
                                  >
                                    {ui(item.difficulty)}
                                  </span>
                                </>
                              )}
                            </div>

                            <p className="mt-2 truncate font-serif text-[15px] font-semibold text-[#eee1c8]">
                              {compactPuzzleTitle(item.title)}
                            </p>

                            {isPersonal && item.playedMoveSan && (
                              <p className="mt-1 text-[9px] text-zinc-600">{ui("You played")}{item.playedMoveSan}
                              </p>
                            )}
                          </div>

                          <span className="shrink-0 font-mono text-[11px] font-black text-amber-200/80">
                            {isPersonal ? `${((item.centipawnLoss ?? 0) / 100).toFixed(1)}Δ` : item.rating}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.05] pt-2">
                          <span className="text-[9px] text-zinc-600">
                            {entry.completedAt ? new Date(entry.completedAt).toLocaleDateString() : isPersonal ? `Move ${item.moveNumber ?? "?"}` : `${item.themes.slice(0, 2).join(" · ")} · Popularity ${item.popularity}`}
                          </span>

                          <span className="text-[9px] font-black text-zinc-500">
                            {entry.mistakes !== null ? entry.mistakes === 0 ? ui("Perfect ✓") : `${entry.mistakes} mistake${entry.mistakes === 1 ? "" : "s"}` : isActive ? ui("Selected") : ui("Solve →")}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {libraryTab === "suggested" && (
                    <div className="pt-2">
                      {suggestions.length < 20 ? (
                        <button
                          type="button"
                          onClick={() => void loadMoreSuggestions()}
                          disabled={
                            libraryLoading ||
                            loadingMoreSuggestions ||
                            suggestions.length >= 20
                          }
                          className="w-full rounded-[1.1rem] border border-amber-300/15 bg-[linear-gradient(145deg,rgba(86,57,24,.10),rgba(0,0,0,.22))] px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-amber-200 transition hover:border-amber-300/25 hover:bg-amber-300/[0.07] disabled:cursor-wait disabled:opacity-40"
                        >
                          {loadingMoreSuggestions ? ui("Loading 5 more...") : `Load 5 more · ${suggestions.length}/20`}
                        </button>
                      ) : (
                        <div className="rounded-[1.1rem] border border-emerald-300/10 bg-emerald-300/[0.035] px-4 py-3 text-center">
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-200/70">{ui("20 puzzle limit reached")}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>

        <section className="min-w-0 rounded-3xl border border-white/10 bg-zinc-900/65 p-4 sm:p-5">
          {puzzle ? (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`text-[10px] font-black uppercase tracking-[0.22em] ${
                        puzzle.origin === "singleplayer"
                          ? "text-sky-300"
                          : puzzle.origin === "multiplayer"
                            ? "text-violet-300"
                            : "text-amber-400"
                      }`}
                    >
                      {puzzle.sourceLabel}
                    </p>

                    {/* Lichess-only Elo. Personal Singleplayer/Multiplayer
                        puzzles use review quality + eval loss instead. */}
                    {puzzle.origin === "lichess" ? (
                      <span className="rounded-full border border-sky-400/15 bg-sky-400/[0.06] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-sky-300">{ui("Elo")}{puzzle.rating}
                      </span>
                    ) : (
                      <span className="rounded-full border border-rose-400/15 bg-rose-400/[0.06] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-rose-300">
                        {puzzle.quality}{ui(" · Move ")}{puzzle.moveNumber}
                      </span>
                    )}
                  </div>

                  {editingPuzzleTitle ? (
                    <div className="mt-2 max-w-xl">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={puzzleTitleDraft}
                          maxLength={80}
                          autoFocus
                          onChange={(event) => {
                            setPuzzleTitleDraft(event.target.value);
                            setPuzzleTitleError(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void savePuzzleTitle();
                            }

                            if (event.key === "Escape") {
                              cancelPuzzleTitleEdit();
                            }
                          }}
                          className="min-w-0 flex-1 rounded-xl border border-amber-300/25 bg-black/30 px-3 py-2 font-serif text-lg font-semibold text-[#f5e8cf] outline-none transition placeholder:text-zinc-700 focus:border-amber-300/45"
                          placeholder={ui("Puzzle title")}
                        />

                        <button
                          type="button"
                          disabled={puzzleTitleSaving}
                          onClick={() => void savePuzzleTitle()}
                          className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-300/[0.13] disabled:opacity-40"
                        >
                          {puzzleTitleSaving ? ui("Saving...") : ui("Save")}
                        </button>

                        <button
                          type="button"
                          disabled={puzzleTitleSaving}
                          onClick={cancelPuzzleTitleEdit}
                          className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-500 transition hover:bg-white/[0.07] hover:text-zinc-300 disabled:opacity-40"
                        >{ui("Cancel")}</button>
                      </div>

                      {puzzleTitleError && (
                        <p className="mt-1.5 text-[10px] text-rose-300">
                          {puzzleTitleError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <h3 className="font-serif text-xl font-semibold text-[#f5e8cf]">
                        {ui(puzzle.title)}
                      </h3>

                      {user && (
                        <button
                          type="button"
                          onClick={beginPuzzleTitleEdit}
                          className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-zinc-500 transition hover:border-amber-300/20 hover:bg-amber-300/[0.06] hover:text-amber-200"
                          title={ui("Rename puzzle")}
                        >{ui("✎ Rename")}</button>
                      )}
                    </div>
                  )}

                  <p className="mt-1 text-xs text-zinc-500">
                    {puzzle.origin === "lichess" ? ui("Find the best continuation.") : ui("Replay the position and find what you missed during the game.")}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {puzzle.origin === "lichess" ? (
                    <>
                      <span className="rounded-full border border-violet-400/15 bg-violet-400/[0.06] px-2.5 py-1 text-[10px] font-black text-violet-300">
                        {ui(puzzle.difficulty)}
                      </span>
                      <span className="rounded-full border border-amber-400/15 bg-amber-400/[0.06] px-2.5 py-1 text-[10px] font-black text-amber-300">
                        {puzzle.category}
                      </span>
                    </>
                  ) : (
                    <span className="rounded-full border border-rose-400/15 bg-rose-400/[0.06] px-2.5 py-1 text-[10px] font-black text-rose-300">
                      {(puzzle.centipawnLoss ?? 0) / 100 >= 1 ? `${((puzzle.centipawnLoss ?? 0) / 100).toFixed(1)} pawns missed` : `${puzzle.centipawnLoss ?? 0} cp missed`}
                    </span>
                  )}
                </div>
              </div>

              <InteractivePuzzleBoard
                fen={fen}
                orientation={puzzle.orientation}
                selectedSquare={selectedSquare}
                legalSquares={legalSquares}
                lastMove={lastMove}
                candidatePreview={candidatePreview}
                wrongMove={wrongMove}
                correctMove={correctMove}
                disabled={autoReplying || solved || lineStep % 2 === 1}
                onSquareClick={handleSquareClick}
              />

              <div
                className={`mt-4 rounded-2xl border p-3.5 transition ${feedbackVisual.shell}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-lg font-black ${feedbackVisual.iconClass}`}
                  >
                    {autoReplying ? "…" : feedbackVisual.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p
                        className={`font-serif text-base font-semibold ${feedbackVisual.titleClass}`}
                      >
                        {autoReplying ? ui("Opponent reply") : (feedback?.title ?? "Your move")}
                      </p>

                      {feedback?.moveLabel && (
                        <span className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 font-mono text-[10px] font-black text-zinc-300">
                          {feedback.moveLabel}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs leading-5 text-zinc-400">
                      {autoReplying ? ui("The reply is being played automatically.") : (feedback?.text ??
                          "Select a piece and calculate the strongest continuation.")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={resetCurrentPuzzle}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-zinc-400 transition hover:bg-white/10 hover:text-white"
                >{ui("↺ Reset")}</button>

                <button
                  type="button"
                  onClick={() => void nextPuzzle()}
                  disabled={remotePuzzleLoading}
                  className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-wait disabled:opacity-50"
                >
                  {remotePuzzleLoading ? ui("Finding puzzle...") : ui("Next puzzle →")}
                </button>

                <div className="ml-auto flex items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                  <span className="text-[9px] font-black uppercase tracking-wider text-zinc-700">{ui("Mistakes")}</span>
                  <span
                    className={`font-mono text-xs font-black ${
                      mistakes > 0 ? "text-rose-300" : "text-emerald-300"
                    }`}
                  >
                    {mistakes}
                  </span>
                </div>
              </div>

              {remotePuzzleError && (
                <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-3 py-2.5 text-xs leading-5 text-red-200">
                  {remotePuzzleError}
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-[520px] items-center justify-center text-center">
              <div>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] font-serif text-3xl text-amber-100">
                  ♞
                </div>
                <p className="mt-4 font-serif text-lg font-semibold text-[#eee1c8]">{ui("Loading your puzzle set")}</p>
                <p className="mt-1 text-xs text-zinc-600">{ui("Completed puzzles are filtered out automatically.")}</p>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-white/10 bg-[linear-gradient(145deg,rgba(10,18,28,.92),rgba(5,10,17,.88))] p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">{ui("Puzzle details")}</p>

            {puzzle ? (
              puzzle.origin === "lichess" ? (
                <>
                  <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[8px] font-black uppercase tracking-wider text-zinc-700">{ui("Puzzle title")}</p>
                        <p className="mt-1 truncate font-serif text-sm font-semibold text-[#eee1c8]">
                          {ui(puzzle.title)}
                        </p>
                      </div>

                      {user && (
                        <button
                          type="button"
                          onClick={beginPuzzleTitleEdit}
                          className="shrink-0 rounded-lg border border-amber-300/15 bg-amber-300/[0.055] px-2.5 py-1.5 text-[9px] font-black text-amber-200 transition hover:bg-amber-300/[0.10]"
                        >{ui("Rename")}</button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                      <p className="text-[8px] font-black uppercase tracking-wider text-zinc-700">{ui("Elo")}</p>
                      <p className="mt-1 font-mono text-lg font-black text-amber-200">
                        {puzzle.rating}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                      <p className="text-[8px] font-black uppercase tracking-wider text-zinc-700">{ui("Difficulty")}</p>
                      <p className="mt-1 text-xs font-black text-zinc-300">
                        {ui(puzzle.difficulty)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                      <p className="text-[8px] font-black uppercase tracking-wider text-zinc-700">{ui("Popularity")}</p>
                      <p className="mt-1 font-mono text-lg font-black text-emerald-200">
                        {puzzle.popularity}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 p-3">
                    <p className="text-[8px] font-black uppercase tracking-wider text-zinc-700">{ui("Themes")}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {puzzle.themes.slice(0, 6).map((theme) => (
                        <span
                          key={theme}
                          className="rounded-full border border-white/8 bg-white/[0.035] px-2 py-1 text-[9px] font-bold text-zinc-500"
                        >
                          {theme.replace(/([a-z])([A-Z])/g, "$1 $2")}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-3 rounded-2xl border border-violet-400/15 bg-violet-400/[0.045] p-3">
                    <p className="text-[8px] font-black uppercase tracking-wider text-violet-300/60">{ui("Source")}</p>
                    <p className="mt-1 text-xs font-black text-violet-100">
                      {puzzle.sourceLabel}
                    </p>
                  </div>

                  <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[8px] font-black uppercase tracking-wider text-zinc-700">{ui("Puzzle title")}</p>
                        <p className="mt-1 truncate font-serif text-sm font-semibold text-[#eee1c8]">
                          {ui(puzzle.title)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={beginPuzzleTitleEdit}
                        className="shrink-0 rounded-lg border border-amber-300/15 bg-amber-300/[0.055] px-2.5 py-1.5 text-[9px] font-black text-amber-200 transition hover:bg-amber-300/[0.10]"
                      >{ui("Rename")}</button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                      <p className="text-[8px] font-black uppercase tracking-wider text-zinc-700">{ui("Missed on")}</p>
                      <p className="mt-1 font-mono text-lg font-black text-amber-200">{ui("Move")}{puzzle.moveNumber}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                      <p className="text-[8px] font-black uppercase tracking-wider text-zinc-700">{ui("Eval loss")}</p>
                      <p className="mt-1 font-mono text-lg font-black text-rose-200">
                        {((puzzle.centipawnLoss ?? 0) / 100).toFixed(1)}
                      </p>
                    </div>
                  </div>

                  {puzzle.playedMoveSan && (
                    <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 p-3">
                      <p className="text-[8px] font-black uppercase tracking-wider text-zinc-700">{ui("Move you played")}</p>
                      <p className="mt-1 font-mono text-base font-black text-zinc-300">
                        {puzzle.playedMoveSan}
                      </p>
                    </div>
                  )}
                </>
              )
            ) : (
              <p className="mt-3 text-xs text-zinc-600">{ui("No puzzle selected.")}</p>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-[linear-gradient(145deg,rgba(10,18,28,.92),rgba(5,10,17,.88))] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">{ui("Your progress")}</p>
                <p className="mt-1 font-serif text-base font-semibold text-[#eee1c8]">
                  {user ? `${completedTotal} completed` : ui("Not signed in")}
                </p>
              </div>

              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                  user
                    ? "border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300"
                    : "border-white/8 bg-white/[0.03] text-zinc-600"
                }`}
              >
                ✓
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-zinc-600">
              {user ? ui("Lichess completions and personal training puzzles are saved privately to your account.") : ui("Sign in to keep permanent puzzle progress and create training positions from your games.")}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function ChessLearningContent({ puzzlePage = false }: { puzzlePage?: boolean }) {
  useUiLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab: TabKey = puzzlePage ? "puzzles" : requestedTab === "openings" || requestedTab === "situations" ? requestedTab : "rules";
  const setActiveTab = (tab: TabKey) => setSearchParams(current => { const next = new URLSearchParams(current); next.set("tab", tab); return next; }, { replace: true });
  const { language, setLanguage } = useAppLanguage();
  const t = (value: string) => translate(language, value);
  if (!puzzlePage && requestedTab === "puzzles") return <Navigate to="/games/chess/puzzles" replace />;

  const tabs: Array<{
    key: TabKey;
    label: string;
    icon: string;
    description: string;
  }> = [
    {
      key: "rules",
      label: "Rules & Tips",
      icon: "♔",
      description: "Learn the basics",
    },
    {
      key: "situations",
      label: "Typical Situations",
      icon: "♞",
      description: "Learn recurring patterns",
    },
    {
      key: "openings",
      label: "Openings",
      icon: "♙",
      description: "Recognize common starts",
    },
  ];

  return (
    <LanguageContext.Provider value={language}>
      <div className="relative left-1/2 min-h-[var(--app-height)] w-screen -translate-x-1/2 overflow-x-hidden bg-[#03070d] text-zinc-100">
        {/* CINEMATIC BACKDROP */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_17%_12%,rgba(181,132,46,.11),transparent_30%),radial-gradient(circle_at_82%_24%,rgba(52,83,116,.10),transparent_28%),linear-gradient(180deg,#050a11_0%,#020509_52%,#04080d_100%)]" />
          <div className="absolute left-[7%] top-24 h-[34rem] w-px bg-gradient-to-b from-transparent via-amber-200/10 to-transparent" />
          <div className="absolute right-[10%] top-0 h-[42rem] w-px bg-gradient-to-b from-amber-100/5 via-white/5 to-transparent" />
          <div className="absolute -right-12 top-16 font-serif text-[24rem] leading-none text-amber-100/[0.018] sm:text-[34rem]">
            ♞
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[1640px] px-4 pb-12 pt-4 sm:px-6 lg:px-8">
          {/* TOP STRIP */}
          <ChessPageHeader className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
            <Link
              to="/games/chess"
              className="group inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.20em] text-zinc-500 transition hover:text-amber-200"
            >
              <span className="transition group-hover:-translate-x-1">←</span>
              {t("Back to Chess")}
            </Link>

            <label className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-bold text-zinc-500 backdrop-blur-xl">
              <span className="text-amber-300/80">◎</span>
              <span className="hidden sm:inline">{t("Language")}</span>

              <select
                value={language}
                onChange={(event) =>
                  setLanguage(event.target.value as Language)
                }
                className="bg-transparent text-xs font-bold text-zinc-300 outline-none [color-scheme:dark]"
                aria-label={t("Language")}
              >
                {languageOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-zinc-950 text-zinc-100"
                  >
                    {ui(option.label)}
                  </option>
                ))}
              </select>
            </label>
          </ChessPageHeader>

          {/* HERO */}
          <section className={puzzlePage ? "py-3" : "grid gap-8 py-9 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end lg:py-12"}>
            <div>
              <div className="flex items-center gap-3">
                <span className="h-px w-10 bg-amber-300/55" />
                <p className="text-[10px] font-black uppercase tracking-[0.34em] text-amber-300/90">
                  {t("Learn Chess")}
                </p>
              </div>

              <h1 className={`${puzzlePage ? "mt-2 text-[clamp(2rem,4vw,3rem)]" : "mt-5 text-[clamp(3rem,7vw,6.6rem)]"} max-w-5xl font-serif font-medium leading-[0.88] tracking-[-0.05em] text-[#f2e4c7]`}>
                {t(puzzlePage ? "Puzzles" : "Chess Rules")}
                {!puzzlePage && <span className="block italic text-amber-200/80">{ui("& Tips")}</span>}
              </h1>

              <p className={`${puzzlePage ? "mt-2" : "mt-5"} max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base`}>
                {t(puzzlePage ? "Solve interactively" : "Rules, openings, and common chess patterns")}
              </p>
            </div>

            {!puzzlePage && <div className="relative overflow-hidden rounded-[2rem] border border-amber-400/15 bg-[linear-gradient(145deg,rgba(24,18,8,.72),rgba(6,12,19,.92))] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="absolute -right-8 -top-10 font-serif text-[9rem] text-amber-100/[0.035]">
                ♜
              </div>

              <div className="relative">
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-300/70">
                  {t(puzzlePage ? "Puzzles" : "Chess Rules & Tips")}
                </p>

                <p className="mt-3 font-serif text-xl leading-7 text-[#eadcc0]">{ui(puzzlePage ? "Find the move. Solve the position." : "Study the rule. See the pattern. Play the position.")}</p>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    ["01", "Rules"],
                    ["02", "Patterns"],
                    ["03", "Practice"],
                  ].map(([number, label]) => (
                    <div
                      key={number}
                      className="rounded-2xl border border-white/[0.07] bg-black/20 px-3 py-3"
                    >
                      <p className="font-mono text-[9px] text-amber-300/70">
                        {number}
                      </p>
                      <p className="mt-1 text-[10px] font-bold text-zinc-400">
                        {ui(label)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>}
          </section>

          {/* LESSON SELECTOR */}
          {!puzzlePage && <nav className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {tabs.map((tab, index) => {
              const active = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`group relative overflow-hidden rounded-[1.65rem] border px-4 py-4 text-left shadow-xl shadow-black/10 transition duration-300 hover:-translate-y-0.5 ${
                    active
                      ? "border-amber-400/30 bg-[linear-gradient(145deg,rgba(47,35,14,.55),rgba(7,14,22,.96))] shadow-[0_0_34px_rgba(251,191,36,.045)]"
                      : "border-white/[0.08] bg-[linear-gradient(145deg,rgba(9,16,25,.9),rgba(4,9,15,.86))] hover:border-amber-400/15"
                  }`}
                >
                  <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/20 to-transparent" />

                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border font-serif text-2xl transition ${
                        active
                          ? "border-amber-300/20 bg-amber-300/[0.09] text-amber-100"
                          : "border-white/[0.07] bg-white/[0.03] text-zinc-600 group-hover:text-amber-200/70"
                      }`}
                    >
                      {tab.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`font-serif text-lg font-semibold ${
                            active ? "text-[#f5e8cf]" : "text-zinc-300"
                          }`}
                        >
                          {t(tab.label)}
                        </span>

                        <span className="font-mono text-[9px] text-zinc-700">
                          0{index + 1}
                        </span>
                      </div>

                      <span className="mt-0.5 block text-[10px] text-zinc-600">
                        {t(tab.description)}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`mt-3 h-px transition ${
                      active
                        ? "bg-gradient-to-r from-amber-300/55 via-amber-300/15 to-transparent"
                        : "bg-white/[0.04]"
                    }`}
                  />
                </button>
              );
            })}
          </nav>}

          {!puzzlePage && <Link to="/games/chess/puzzles" className="mt-4 inline-flex rounded-xl border border-amber-400/25 px-4 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-400/10 focus-visible:outline-2 focus-visible:outline-amber-200">{t("Puzzles")} →</Link>}

          {/* CONTENT */}
          <main className={`${puzzlePage ? "mt-2" : "mt-5"} rounded-[2rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(6,12,19,.88),rgba(3,8,13,.92))] p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6 lg:p-7`}>
            {activeTab === "rules" && <RulesTab />}
            {activeTab === "situations" && <SituationsTab />}
            {activeTab === "puzzles" && <PuzzlesTab compact={puzzlePage} />}
            {activeTab === "openings" && <OpeningsTab />}
          </main>
        </div>
      </div>
    </LanguageContext.Provider>
  );
}
