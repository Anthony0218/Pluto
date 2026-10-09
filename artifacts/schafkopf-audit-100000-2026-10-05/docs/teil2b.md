# Schafkopf – Regelwerk & Bot-Logik (Teil 2b: Ansage, Tutorial, offene Punkte, Implementierungs-Prompt)

> Ergänzt **Teil 1** (Regeln) und **Teil 2a** (Tipps).
> Markierungen wie bisher: **[N]** = Vorgabe von Nico · **[V]** = Vorschlag, bitte prüfen · ⚠️ OFFEN = noch zu klären · `CONFIG` = Einstellung.

---

## 1. Ansage-Regeln A4 ff.

A1–A3 aus Teil 1 bleiben verbindlich (Rufsau-Wahl, regelkonform rufen, Rollen festlegen). A4 und A5 sind zum großen Teil von Nico festgelegt **[N]**. Was noch Vorschlag ist, ist mit **[V]** markiert. Alle Schwellen sind konfigurierbar und werden per Simulation überprüft.

### 1.1 Handbewertung (`evaluateHand`)
Jede Hand bekommt pro möglichem Spiel einen Wert. Faktoren:

| Faktor | Bedeutung |
|---|---|
| `trumpCount` | Anzahl Trümpfe in der jeweiligen Spielart |
| `highTrumps` | Anzahl Ober (bzw. im Wenz: Unter) |
| `bremser` | Besitzt man einen der drei höchsten Ober (Eichel-, Gras-, Herz-Ober)? |
| `trumpSchmier` | Anzahl Trumpf-Ass / Trumpf-Zehn |
| `suitsWithoutAce` | Fehlfarben, von denen man Karten hat, aber nicht das Ass |
| `topTrumpRun` | Laufende von oben (mit / ohne) |
| `aces` | Fehlfarben-Asse (ohne Rufsau) |
| `voids` | Farben, in denen man frei ist |
| `lonelyTens` | Zehnen ohne Ass derselben Farbe (Risiko) |

### 1.2 A4 – Mindestanforderungen je Spiel

**Sauspiel [N]**
- **Grundsatz:** Man braucht einen **„Bremser"**, also einen der drei höchsten Ober (Eichel-, Gras- oder Herz-Ober). Er verhindert, dass die Gegner viele Laufende gegen einen haben.
- **Ohne Bremser** ist ein Sauspiel trotzdem okay bei **5 oder 6 Trümpfen**.
  - Bei **5 Trümpfen ohne Bremser** sollte der **Schellen-Ober oder der Eichel-Unter** dabei sein.
- **Mit Bremser:** mindestens 4 Trümpfe mit mindestens 2 Obern/Untern. *(Geklärt [N].)*
- Immer zusätzlich: Es muss eine Sau rufbar sein (Teil 1, 4.3).

**Farbsolo [N]**
- Nur ab **6 Trümpfen**.
- **Höchstens eine Fehlfarbe**, in der man nicht das Ass besitzt. Farben, in denen man frei ist, zählen nicht mit. *(Geklärt [N].)*
- **6 Trümpfe:** mindestens **2 Ober**, am besten **eine oder beide Trumpfschmier** (Ass/Zehn der Trumpffarbe).
- **7 Trümpfe** und generell **jedes Solo:** mindestens **2 Ober**. **Ausnahme:** Mit **8 Trümpfen** kann man immer spielen.

**Farbwenz [N]** (Trumpf: 4 Unter + die 7 Karten der gewählten Farbe)
- Mindestens **5 Trümpfe**, darunter eine **Trumpfschmier** und **mehrere Unter** (mindestens 2). Besser **6 oder mehr** Trümpfe.
- **5 Trümpfe:** einer der **höchsten 2 Unter** (Eichel- oder Gras-Unter) sollte dabei sein.
- **6 Trümpfe:** einer der **höchsten 3 Unter** sollte dabei sein.
- **7+ Trümpfe:** welche Unter, ist egal.

**Ausschlusskriterien für Wenz, Geier und Farbwenz [N]:**
- Jedes Kriterium zählt einmal. Sind **mindestens zwei** der folgenden Kriterien erfüllt, soll das Spiel nicht angesagt werden:
  1. In **zwei Nichttrumpffarben** besitzt man keine Sau / kein Ass.
  2. Bei **Farbwenz** fehlen die Trumpfschmieren, also Trumpf-Ass und Trumpf-Zehn.
  3. Man hält **zwei Unter**, darunter mindestens einen der **höchsten drei Unter**.
  4. Man sitzt auf **Position 1 oder Position 4**.
- Die Liste ist erweiterbar; zusätzliche Kriterien werden als Konfiguration ergänzt.

**Wenz und Geier [N]:** Die konkrete Farbe wird erst nach dem gewonnenen Bieten angesagt. Für die Auswahl der Spielart gelten die Ausschlusskriterien oben; die Farbe wird danach anhand der Handbewertung gewählt.

**Tout / „Du" [N]:** Tout wird nur angesagt, wenn der Bot **sicher alle Stiche** machen kann. Eine Ausnahme ist eine **blanke einzelne Fehlfarben-Sau / ein einzelnes Fehlfarben-Ass**, und auch diese Ausnahme gilt nur, wenn der Ansager auf **Position 1** sitzt. Eine nicht blanke Fehlfarben-Sau bzw. ein nicht blankes Ass reicht nicht für Tout.

**Auswahl:** Erfüllen mehrere Spiele die Mindestanforderung, wählt der Bot das Spiel mit dem höchsten **erwarteten Gewinn** (Siegchance × Spielwert). Bei Gleichstand gilt die Rangfolge aus Teil 1, 5.2.

### 1.3 A5 – Spritzen (Kontra)

**Gegenspieler spritzt [N]:**
- **Gegen ein Sauspiel:** mindestens **5 Trümpfe**, darunter mindestens **1 Ober**, insgesamt mindestens **3 Ober/Unter**, und in mindestens **einer Farbe frei**.
- **Gegen ein Solo:** mindestens **5 Trümpfe**, darunter mindestens einer der **höchsten 3 Trümpfe**, insgesamt mindestens **3 Ober/Unter**.

**Zurückspritzen [N]**:
- **Bei 5 Trümpfen:** entweder
  - **3 Ober**, oder
  - **2 Ober** und zusätzlich **eine Fehlfarbe frei** oder **ein Fehlfarben-Ass**.
- **Bei 6 Trümpfen:** entweder
  - **3 Ober**, oder
  - **2 Ober** und zusätzlich eine Fehlfarbe frei oder ein Fehlfarben-Ass, oder
  - **1 Ober** und insgesamt mindestens **2 Ober/Unter**.
- Bei 5 oder 6 Trümpfen darf die Fehlfarbenstruktur also schwächer sein als bei einer normalen Hand, wenn die Trumpfstärke entsprechend hoch ist.
- Zurückspritzen bei Solo, Wenz und Geier wird nach denselben Grundprinzipien bewertet; die konkreten Varianten können später ergänzt werden.
- Wer im Sauspiel zurückspritzt, verrät, dass er Mitspieler ist. Ab Profi wird dieses Informationsrisiko mitbewertet.

### 1.4 A6 – Stufenverhalten bei der Ansage *(bestätigt [N])*

| Stufe | Ansage-Verhalten |
|---|---|
| **Anfänger** | Nur Sauspiel nach A4-Faustregel, 20 % Zufallsabweichung (spielt mal zu schwache Hände oder passt starke). Kein Solo/Wenz, außer die Hand ist extrem stark. Spritzt nie. |
| **Amateur** | Sauspiel + Solo nach A4, 10 % Zufallsabweichung. Spritzt selten und nur mit sehr starker Hand. |
| **Fortgeschritten** | Alle Spiele nach A4. Spritzt nach A5. |
| **Profi** | Handbewertung mit Scoring (inkl. Position am Tisch, Laufende, Farbverteilung). Spritzen inklusive Risikoabwägung. |
| **Legende** | Simulation: viele zufällige, mit der eigenen Hand verträgliche Verteilungen der übrigen Karten ziehen und für jedes mögliche Spiel den erwarteten Gewinn berechnen. Gleiches Vorgehen beim Spritzen. |

**A1–A3 gelten auf allen Stufen zu 100 %** (auch der Anfänger ruft korrekt nach A1).

---

## 2. Tutorial-Texte für den Anfänger-Modus

**Idee [V]:** Jede Bot-Entscheidung liefert einen `reasonCode` (z. B. `R2`, `T1`). Im Anfänger-Modus kann die App dazu den passenden Erklärtext anzeigen, als Tipp für den menschlichen Spieler oder als Erklärung „Warum hat der Bot das gespielt?".

### Regeln

**R1 – Wer spielt Trumpf aus?**
„Gehörst du zur Spielerpartei und bist am Ausspiel, spielst du Trumpf. So ziehst du den Gegnern die Trümpfe raus. Bist du Gegenspieler, spielst du lieber eine Fehlfarbe aus."

**R2 – Schmieren**
„Dein Partner hat den Eichel-Ober gelegt, oder hinter dir sitzt kein Gegner mehr: Der Stich gehört sicher euch. Leg jetzt Punkte dazu, zum Beispiel ein Ass oder eine Zehn. Das nennt man Schmieren."

**R3 – Suchen**
„Du bist Gegenspieler und hast eine Karte der gerufenen Farbe? Dann spiel sie aus! So muss die gerufene Sau fallen, und ihr wisst, wer der Mitspieler ist."

**R4 – Partner nicht überstechen**
„Dein Partner gewinnt den Stich schon sicher. Dann legst du keinen höheren Trumpf drauf, den brauchst du später noch."

**R5 – Einstechen**
„Du hast die angespielte Farbe nicht mehr? Dann darfst du mit Trumpf stechen und dir den Stich holen, außer dein Partner hat ihn schon sicher."

**R6 – Partner bewusst überstechen**
„Dein Mitspieler spielt den Schellen-Ober aus. Du hast den Herz-Ober und den Eichel-Unter. Die beiden Karten liegen direkt über und direkt unter dem Schellen-Ober. Stich mit dem Herz-Ober drüber: Dann spielst du den nächsten Stich aus, und dein Mitspieler sitzt ganz hinten. So kann er in Ruhe entscheiden."

**A4 – Der Bremser (Ansage)**
„Willst du ein Sauspiel ansagen, solltest du einen der drei höchsten Ober haben: Eichel-, Gras- oder Herz-Ober. Das ist dein Bremser. Ohne ihn haben die Gegner schnell viele Laufende gegen dich. Mit 5 oder 6 Trümpfen geht es zur Not auch ohne."

**R4a – Drüberstechen, um Trumpf zu ziehen**
„Dein Partner hat den Eichel-Unter gelegt. Du hast den Eichel-Ober und noch genug andere Trümpfe. Dann darfst du drüberstechen, um selbst auszuspielen und nochmal Trumpf zu ziehen. Hast du aber nur einen einzigen hohen Trumpf, heb ihn dir auf."

**Rufsau**
„Die gerufene Sau darfst du erst im vorletzten Stich schmieren. Sonst verrätst du dich zu früh, und deinem Team fehlt ein wichtiger Stich."

### Tipps

**T1 – „Mim Unter gehst nie unter!"**
„Du stichst in eine Fehlfarbe ein, aber hinter dir sitzt noch ein Gegner, der auch frei sein könnte. Nimm lieber den Herz-Unter statt der Herz-Zehn oder dem Herz-Ass. Wirst du überstochen, verlierst du nur wenige Punkte, und der Gegner muss einen hohen Trumpf opfern."

**T2 – Mitspieler spielt hoch aus**
„Als Mitspieler spielst du deinen höchsten Ober aus. Damit nimmst du dem Spieler Arbeit ab: Er hat meistens mehr Trümpfe und kann seine hohen Trümpfe für später sparen."

**T2 – Trumpf zum Einstechen aufheben**
„Du hast als Mitspieler nur noch einen niedrigen Unter und ein paar Herz-Karten. Heb dir den Unter zum Einstechen auf und spiel stattdessen zum Beispiel die Herz-7 aus."

**T3a – Selbst frei in der Suchfarbe**
„Du willst suchen, hast aber keine Karte der gerufenen Farbe? Spiel eine andere Fehlfarbe an. So kommt vielleicht dein Partner an den Stich und kann suchen."

**T3c – Als Ansager wenig Punkte in die Suchfarbe**
„Du bist Ansager, und ein Gegenspieler hat vorhin eine andere Farbe gespielt, statt zu suchen. Wahrscheinlich hat er die gesuchte Farbe gar nicht und sticht ein. Wird jetzt gesucht, legst du die Karte mit den wenigsten Punkten."

**T4 – Mit der Suchfarbe hoch suchen**
„Beim Suchen spielst du die Karte mit den meisten Punkten. Die Sau und mindestens eine weitere Karte dieser Farbe hat die Spielerpartei. Dein Partner ist darum ziemlich sicher frei und kann einstechen."

**T5 – Vorsicht beim Ass-Schmieren**
„Du hast nur ein Ass? Heb es dir für einen Stich auf, den dein Partner sicher macht. Und schmier kein Ass, das später selbst einen Stich in seiner Farbe machen würde."

**T6 – Gleich starke Karten**
„Schellen-Unter und Herz-Ass liegen im Sauspiel direkt nebeneinander. Gehört der Stich deinem Partner, leg das Herz-Ass (11 Punkte). Gehört er dem Gegner, leg den Schellen-Unter (2 Punkte)."

**T7 – Den sicheren Trumpf behalten**
„Du hast noch zwei Trümpfe, einer davon ist der Gras-Ober. Der Eichel-Ober ist schon gefallen. Behalte den Gras-Ober: Er ist jetzt der höchste Trumpf und macht sicher noch einen Stich. Den anderen Trumpf gibst du her, auch wenn es das Herz-Ass ist."

**T7 – Den unsicheren Ober opfern**
„Du hast noch zwei Trümpfe: den Herz-Ober und die Herz-Zehn. Der Eichel-Ober ist gefallen, der Gras-Ober aber noch nicht. Leg den Herz-Ober. Er wird später wahrscheinlich eh vom Gras-Ober gestochen. Die Herz-Zehn kannst du dann noch deinem Partner schmieren."

**T7 – Jeder Punkt zählt (Profi)**
„Wenn dein Mitspieler den Stich sowieso macht, legst du lieber den Schellen-Ober (3 Punkte) als den Eichel-Unter (2 Punkte). Der eine Punkt kann am Ende über Schneider entscheiden."

**T8 – Punkte streuen**
„Leg in jeden Stich ein paar Punkte, etwa 5 bis 12. So kann sich kein Gegner billig von einer Farbe frei machen."

**T9 – Nicht mehr suchen**
„Beide Gegenspieler haben keinen Trumpf mehr? Dann lohnt sich Suchen nicht mehr: Die Spielerpartei sticht sowieso."

**T10 – Viele Trumpfrunden**
„Die Spielerpartei hat meistens mehr Trümpfe. Je öfter Trumpf gespielt wird, desto eher hat sie am Ende als Einzige noch Trumpf. Darum darfst du auch mal hoch überstechen, um selbst ausspielen zu können."

**T11 – Vorsorglich frei machen**
„Im Stich liegen fast keine Punkte, und du müsstest deinen letzten hohen Trumpf opfern? Leg lieber deine einzige Karte einer anderen Farbe ab, aber kein Ass und keine Zehn. Wird diese Farbe später gespielt, kannst du einstechen oder schmieren."

**T12 – Die zwei höchsten Trümpfe**
„Du hast die beiden höchsten Trümpfe. Sitzt dein Partner in der Mitte, spiel den höchsten aus, dann kann er gleich schmieren. Sitzt er ganz hinten oder spielst du ein Solo, reicht der zweithöchste. Weißt du noch nicht, wer dein Partner ist, kannst du den Eichel-Ober spielen."

---

## 3. Noch offene Punkte

Die wesentlichen Regeln sind geklärt. Übrig bleiben nur technische Präzisierungen bzw. bewusst konfigurierbare Erweiterungen:

| # | Punkt | Aktueller Default |
|---|---|---|
| 1 | **R4a: „mindestens 3 Trümpfe darüber"** – genaue technische Bedeutung dieses Ausdrucks | Partner muss danach hinten sitzen; mindestens 3 eigene Trümpfe; Sicherheitsbedingung zusätzlich konfigurierbar |
| 2 | **Ausschlusskriterien für Wenz/Geier/Farbwenz:** weitere Kriterien | Liste aus Abschnitt 1.2; später erweiterbar |
| 3 | **Tout-Ausnahme:** genaue Definition der „blanken einzelnen Fehlfarben-Sau / des Asses" | nur eine Karte dieser Fehlfarbe und Ansager auf Position 1 |
| 4 | **Zurückspritzen bei Solo/Wenz/Geier** | vorerst nach Grundprinzipien, konkrete Varianten später |
| 5 | **T12 „viele hohe"** | Startwert: mindestens 2 Ober und insgesamt 4 Ober/Unter |

## 4. Implementierungs-Prompt für Codex / Claude Code

> Diesen Block zusammen mit den drei Dateien (`schafkopf-regelwerk-teil1.md`, `schafkopf-regelwerk-teil2-tipps.md`, `schafkopf-regelwerk-teil2b.md`) übergeben.

```text
Du implementierst die Spiel-Engine und die Bot-KI für eine Schafkopf-App.
Die vollständige Spezifikation steht in drei Markdown-Dateien:
- schafkopf-regelwerk-teil1.md       (Begriffe, Karten, Spielarten, Stichregeln,
                                       Ansagen, Wertung, Sonderfälle, Architektur,
                                       A-Regeln A1–A3, R-Regeln R1–R6)
- schafkopf-regelwerk-teil2-tipps.md (Tipps T1–T12, Stufen-Matrix, Konfliktauflösung)
- schafkopf-regelwerk-teil2b.md      (Ansage-Regeln A4–A6, Tutorial-Texte,
                                       offene Punkte, dieser Prompt)
Lies alle drei Dateien vollständig, bevor du Code schreibst. Die Dateien sind
die einzige Quelle der Wahrheit. Erfinde keine zusätzlichen Regeln. Wo etwas mit
"⚠️ OFFEN" markiert ist, implementiere den angegebenen Default und mache ihn
über eine Konfiguration umschaltbar.

GRUNDPRINZIPIEN
1. Engine-Regeln (MUSS) werden von der Engine erzwungen. Ein Bot kann nie
   einen ungültigen Zug machen.
2. R-Regeln und A1–A3 gelten für ALLE Stufen ohne Fehlerquote. Ausnahmen gibt
   es nur dort, wo eine Stufe laut Spezifikation das nötige Wissen nicht hat.
3. Tipps werden nur innerhalb der Kandidaten angewendet, die die R-Regeln
   erlauben. Ein "Fehler" einer Stufe ist IMMER eine zufällige Wahl unter
   diesen Kandidaten, nie ein gezielt schlechter Zug und nie ein Regelbruch.
4. Kein Bot (auch nicht Legende) sieht fremde Handkarten. Erlaubt ist nur,
   was aus Spielverlauf, Bedienpflicht, Rufsau-Regeln und Kartenzählung
   eindeutig erschließbar ist. Legende nutzt Determinisierung über plausible
   Verteilungen (Information Sets) + ISMCTS.
5. Spielarten sind datengetrieben (Trumpfliste, Fehlfarbenrang, Teammodus,
   Laufende, Tarif). Keine Sonderlogik pro Spielart hardcoden. Alle Begriffe
   wie "ranghöchster Trumpf" oder "höchste sechs Trümpfe" werden aus der
   Trumpfliste der aktuellen Spielart abgeleitet.
6. Hausregeln und Tarife sind Konfiguration (alles, was mit CONFIG markiert ist).

ARCHITEKTUR (Vorschlag, passe an den bestehenden Tech-Stack an)
- rules/       Spielarten-Definitionen, Kartenrang, Bedienpflicht, Stichgewinn,
               Rufsau-Regeln, Wertung (inkl. Spritz-Sonderregel 6.4)
- engine/      Spielablauf: Geben, Ansage, Spritzen, 8 Stiche, Abrechnung
- knowledge/   GameKnowledge (Teil 1, 8.1): gefallene Karten und Trümpfe,
               Farbfreiheit, Abschmeiß-Historie, Rollenstatus, Punktestand,
               Zielschwellen, Flag vermutlichFreiInSuchfarbe (T3c),
               ab Profi Constraint-Sets + Wahrscheinlichkeiten
- bot/
  - pipeline   choose_card und choose_game gemäß Teil 1, 8.2/8.3
  - rules      R1–R6 + A1–A3, je Regel eine Funktion mit Priorität (Teil 1, 10.1)
  - tips       T1–T12, je Tipp eine Funktion, die Kandidaten bewertet
  - levels     Anfänger, Amateur, Fortgeschritten, Profi, Legende:
               welche Wissensklassen (H/G/P/W) erlaubt sind, Zuverlässigkeit
               je Tipp laut Stufen-Matrix (Teil 2a, 3), Fehlerquote
  - ismcts     nur für Legende
- tutorial/    reasonCode -> Erklärtext (Teil 2b, Abschnitt 2)

JEDE BOT-ENTSCHEIDUNG liefert zurück:
  { card, reasonCode (z.B. "R2", "T1", "RANDOM"), level, debugInfo }
reasonCode wird im Anfänger-Modus für Erklärtexte genutzt und hilft beim Testen.

ZUFALL
- Alle Zufallsentscheidungen laufen über einen seedbaren Zufallsgenerator,
  damit Tests und Simulationen reproduzierbar sind.

TESTS (Pflicht)
1. Unit-Tests für jede Engine-Regel (Bedienpflicht, Ober/Unter zählen nicht
   zur Farbe, Rufsau-Pflicht, Davonlaufen, Stichgewinn, Wertung, Schneider,
   Schwarz, Laufende, Spritzen inkl. 6.4).
2. Pro R-Regel und pro Tipp mindestens ein Szenario-Test mit festgelegter Hand
   und festgelegtem Stich. Nutze die Beispiele aus den Dateien, u.a.:
   - R6: Partner spielt Schellen-Ober, Bot hat Herz-Ober + Eichel-Unter
     -> Bot sticht mit Herz-Ober.
   - T7a: Bot hat Gras-Ober + einen weiteren Trumpf, Eichel-Ober liegt im
     Stich -> Bot behält Gras-Ober.
   - T7b: Bot hat Herz-Ober + Herz-Zehn, Eichel-Ober liegt im Stich, Gras-Ober
     noch im Spiel -> Bot legt Herz-Ober.
   - T7-Profi: Partner macht den Stich, Wahl Schellen-Ober vs. Eichel-Unter
     -> Profi legt Schellen-Ober.
   - T1: Bot ist frei, sticht ein, Gegner hinter ihm -> Unter statt Herz-Ass.
   - R4a: Partner legt Eichel-Unter, Bot hat Eichel-Ober und mindestens
     drei eigene Trümpfe; der Partner sitzt nach dem Stich hinten
     -> Überstechen ist erlaubt. Hat der Bot nur einen hohen Trumpf und
     keine ausreichende Auswahl -> nicht überstechen.
   - T11: Partner sticht -> T11 anwenden; Gegner sticht sicher -> T11 nicht
     anwenden; bei unklarem Stichbesitz T11 nur bei 3–4 vollen Schmieren.
   - A4: Zwei Ausschlusskriterien für Wenz/Geier/Farbwenz erfüllt
     -> Spiel nicht ansagen.
   - Tout: nur bei sicherem Gewinn aller Stiche; blankes einzelnes Ass nur
     auf Position 1.
   - Bietablauf: Zwei Spieler wollen spielen -> erst nennt jeder nur die
     Spielart, der höhere gewinnt, erst danach werden Farbe und Tout angesagt.
   - A4: Hand mit 5 Trümpfen ohne Bremser, aber mit Schellen-Ober
     -> Sauspiel erlaubt; ohne Schellen-Ober und Eichel-Unter -> kein Sauspiel.
   - T3c: Bot ist Ansager, Gegenspieler hat zuvor Fehlfarbe statt Suchfarbe
     ausgespielt, Bot hat mehrere Karten der Suchfarbe, es wird gesucht
     -> Bot legt die punktärmste Karte der Suchfarbe.
3. Test, dass kein Bot auf fremde Handkarten zugreift (z.B. Bot-Interface
   bekommt nur eine gefilterte Sicht auf den Spielzustand).
4. Test, dass R-Regeln auf allen Stufen immer eingehalten werden
   (z.B. 10.000 zufällige Spiele, Regelverstöße zählen = 0).

BALANCING
- Simulationsskript: Stufen gegeneinander über mindestens 10.000 Spiele,
  gemischte Tische. Metriken: Siegquote, Punkteschnitt, Ansagehäufigkeit,
  Siegquote als Ansager.
- Ziel: Anfänger < Amateur < Fortgeschritten < Profi < Legende, jeweils
  deutlich messbar.
- Prozentwerte mit [V] und die A4-Schwellen sind Startwerte. Mach sie
  konfigurierbar und gib nach der Simulation eine Empfehlung aus.

VORGEHEN
1. Engine + Regeln + Tests
2. GameKnowledge + Tests
3. Bot-Pipeline mit Anfänger und Amateur
4. Fortgeschritten, dann Profi (Scoring)
5. Legende (ISMCTS, Rechenbudget konfigurierbar, z.B. 200–1000 Simulationen
   pro Zug, Zeitlimit pro Zug)
6. Tutorial-Anbindung über reasonCode
7. Balancing-Simulation
Melde nach jedem Schritt, was umgesetzt ist, und liste Stellen auf, an denen
die Spezifikation unklar war und welchen Default du gewählt hast.
```
