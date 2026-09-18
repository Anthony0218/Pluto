import { createContext, useContext, useState } from "react";
import { Link } from "react-router-dom";
import { Chess } from "chess.js";

type TabKey = "rules" | "openings" | "situations";
type Language = "en" | "de" | "bar" | "ko" | "ru";

const languageOptions: Array<{ value: Language; label: string }> = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "bar", label: "Boarisch" },
  { value: "ko", label: "한국어" },
  { value: "ru", label: "Русский" },
];

const translations: Record<Exclude<Language, "en">, Record<string, string>> = {
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
  },
};

function translate(language: Language, text: string): string {
  if (language === "en") return text;

  if (language === "bar") {
    return translations.bar[text] ?? translations.de[text] ?? text;
  }

  return translations[language][text] ?? text;
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
          bg-[#1a120d]
          p-1.5
          shadow-lg
          shadow-black/20
          ${compact ? "max-w-[178px]" : "max-w-[220px]"}
        `}
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
                    ${isLight ? "bg-[#ddc6a0]" : "bg-[#8a5b3c]"}
                  `}
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
                      {miniPieceSymbols[piece]}
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
              {step.color === "w"
                ? `${step.moveNumber}. ${step.move}`
                : `${step.moveNumber}... ${step.move}`}
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
  const t = useT();

  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-400">
        {t(eyebrow)}
      </p>
      <h2 className="mt-1 text-2xl font-black tracking-tight text-white">
        {t(title)}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
        {t(description)}
      </p>
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
  const t = useT();

  return (
    <section
      className={`
        rounded-3xl
        border
        p-5
        shadow-xl
        shadow-black/10
        ${
          accent
            ? "border-amber-400/20 bg-amber-400/[0.06]"
            : "border-white/10 bg-zinc-900/75"
        }
      `}
    >
      <h3 className="text-base font-black text-zinc-100">{t(title)}</h3>
      <div className="mt-3 text-sm leading-6 text-zinc-400">{children}</div>
    </section>
  );
}

function RulesTab() {
  const t = useT();

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-3">
        <InfoCard title="Goal of the Game" accent>
          <p>
            {t(
              "Your goal is to checkmate the opponent's king. Checkmate means the king is under attack and there is no legal move that removes the threat.",
            )}
          </p>
        </InfoCard>

        <InfoCard title="How a Turn Works">
          <p>
            {t(
              "White moves first. Players then alternate one move at a time. On your turn, move exactly one piece, except during castling where the king and rook move together.",
            )}
          </p>
        </InfoCard>

        <InfoCard title="A Good Beginner Plan">
          <p>
            {t(
              "Control the center, develop knights and bishops, castle early, avoid moving the same piece repeatedly without a reason, and check whether your opponent threatens something before every move.",
            )}
          </p>
        </InfoCard>
      </div>

      <section>
        <SectionHeading
          eyebrow="The Pieces"
          title="How every chess piece moves"
          description="Piece values are useful estimates for comparing trades. They are not strict rules: position, king safety, and activity can make a piece more or less valuable."
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
          eyebrow="King Safety"
          title="Check and checkmate"
          description="Understanding the difference between check and checkmate is the most important rule in chess."
        />

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <InfoCard title="Check">
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

          <InfoCard title="Checkmate" accent>
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
          eyebrow="Special Rules"
          title="Castling, en passant, and promotion"
          description="These are the three special move rules every chess player should know."
        />

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <InfoCard title="Castling">
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

          <InfoCard title="En Passant">
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

          <InfoCard title="Promotion">
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
          eyebrow="Piece Values"
          title="A simple guide to material"
          description="Use values as a quick guide when deciding whether a trade is favorable."
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
          eyebrow="Quick Tips"
          title="Six habits that immediately improve beginner play"
          description="You do not need to memorize hundreds of moves. These simple habits already prevent many common mistakes."
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
  const t = useT();

  return (
    <div>
      <SectionHeading
        eyebrow="Chess Openings"
        title="Important openings worth recognizing"
        description="You do not need to memorize every variation. First learn the basic idea behind each opening and understand why the opening moves fight for development, king safety, and central control."
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
          eyebrow="Opening Principles"
          title="What matters more than memorization"
          description="If your opponent leaves theory early, these principles tell you what to do next."
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
        eyebrow="Typical Chess Situations"
        title="Patterns you will see again and again"
        description="Recognizing patterns is one of the fastest ways to improve. These ideas appear in games at every level."
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

export default function ChessRulesAndTips() {
  const [activeTab, setActiveTab] = useState<TabKey>("rules");
  const [language, setLanguage] = useState<Language>("en");
  const t = (value: string) => translate(language, value);

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
      label: "Openings (not for beginners yet)",
      icon: "♙",
      description: "Recognize common starts",
    },
  ];

  return (
    <LanguageContext.Provider value={language}>
      <div
        className="
        min-h-screen
        bg-[radial-gradient(circle_at_top,#21170f_0%,#111111_38%,#090909_100%)]
        px-4
        py-6
        text-zinc-100
        sm:px-6
        lg:px-8
      "
      >
        <div className="mx-auto max-w-[1500px]">
          <header
            className="
            mb-6
            flex
            flex-col
            gap-4
            rounded-3xl
            border
            border-white/5
            bg-zinc-900/50
            px-5
            py-5
            shadow-xl
            shadow-black/20
            backdrop-blur-md
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
          >
            <div className="flex items-center gap-4">
              <div
                className="
                flex
                h-14
                w-14
                shrink-0
                items-center
                justify-center
                rounded-2xl
                border
                border-amber-500/20
                bg-amber-400/10
                font-serif
                text-4xl
                text-amber-100
              "
              >
                ♞
              </div>

              <div>
                <p
                  className="
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.28em]
                  text-amber-400
                "
                >
                  {t("Learn Chess")}
                </p>

                <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {t("Chess Rules & Tips")}
                </h1>

                <p className="mt-1 text-sm text-zinc-500">
                  {t("Rules, openings, and common chess patterns")}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label
                className="
                flex
                items-center
                gap-2
                rounded-full
                border
                border-white/10
                bg-white/5
                px-3
                py-1.5
                text-xs
                font-bold
                text-zinc-400
              "
              >
                <span>🌐</span>
                <span className="hidden lg:inline">{t("Language")}</span>

                <select
                  value={language}
                  onChange={(event) =>
                    setLanguage(event.target.value as Language)
                  }
                  className="
                  bg-transparent
                  text-xs
                  font-bold
                  text-zinc-200
                  outline-none
                  [color-scheme:dark]
                "
                  aria-label={t("Language")}
                >
                  {languageOptions.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-zinc-900 text-zinc-100"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <Link
                to="/chess"
                className="
                rounded-full
                border
                border-white/10
                bg-white/5
                px-4
                py-2
                text-center
                text-xs
                font-bold
                text-zinc-400
                transition
                hover:bg-white/10
                hover:text-white
              "
              >
                ← {t("Back to Chess")}
              </Link>
            </div>
          </header>

          <nav
            className="
            mb-6
            grid
            gap-2
            rounded-3xl
            border
            border-white/10
            bg-zinc-900/70
            p-2
            md:grid-cols-3
          "
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                  flex
                  items-center
                  gap-3
                  rounded-2xl
                  border
                  px-4
                  py-3
                  text-left
                  transition

                  ${
                    active
                      ? "border-amber-400/25 bg-amber-400/[0.08]"
                      : "border-transparent bg-transparent hover:bg-white/5"
                  }
                `}
                >
                  <span
                    className={`
                    flex
                    h-10
                    w-10
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    font-serif
                    text-2xl

                    ${
                      active
                        ? "bg-amber-400/10 text-amber-200"
                        : "bg-white/5 text-zinc-500"
                    }
                  `}
                  >
                    {tab.icon}
                  </span>

                  <span className="min-w-0">
                    <span
                      className={`
                      block
                      text-sm
                      font-black

                      ${active ? "text-white" : "text-zinc-400"}
                    `}
                    >
                      {t(tab.label)}
                    </span>

                    <span className="mt-0.5 block text-[10px] text-zinc-600">
                      {t(tab.description)}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          <main
            className="
            rounded-3xl
            border
            border-white/10
            bg-zinc-950/55
            p-4
            shadow-2xl
            shadow-black/20
            backdrop-blur-md
            sm:p-6
          "
          >
            {activeTab === "rules" && <RulesTab />}
            {activeTab === "situations" && <SituationsTab />}
            {activeTab === "openings" && <OpeningsTab />}
          </main>
        </div>
      </div>
    </LanguageContext.Provider>
  );
}
