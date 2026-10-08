# Schafkopf – Regelwerk & Bot-Logik (Teil 1 von 2: Regeln)

> **Zweck:** Spezifikation für die Implementierung (Codex / Claude Code) in der Schafkopf-App.
> **Teil 1** (dieses Dokument): Begriffe, Karten, Spielarten, Stichregeln, Ansagen, Wertung, Sonderfälle, Bot-Pipeline und alle **verbindlichen Bot-Regeln** (A-Regeln für die Ansage, R-Regeln für das Stichspiel).
> **Teil 2** (folgt): Tipps T1–T12 (fehleranfällig), vollständige Stufen-Matrix mit Prozentwerten, Tutorial-Beispiele für den Anfänger-Modus, offene Punkte, fertiger Implementierungs-Prompt.

**Konventionen in diesem Dokument**

| Markierung | Bedeutung |
|---|---|
| **MUSS** | Harte Spielregel, die Engine erzwingt sie (ungültige Züge sind nicht möglich) |
| **R-Regel** | Verbindliche Bot-Regel, gilt für alle Stufen ohne Fehlerquote (Ausnahmen explizit genannt) |
| **A-Regel** | Verbindliche Bot-Regel für Spielauswahl/Ansage |
| `CONFIG` | Hausregel/Tarif – als Einstellung implementieren, nicht hardcoden |
| ⚠️ OFFEN | Punkt ist noch nicht final geklärt, Default-Verhalten ist angegeben |

---

## 1. Begriffe & Definitionen

| Begriff | Definition |
|---|---|
| **Ansager** | Die Person, die das Spiel ansagt (festlegt, was gespielt wird). |
| **(Mit-)Spieler / Spielerpartei** | Der Ansager und sein Partner. Im Solo/Wenz/Geier besteht die Spielerpartei nur aus dem Ansager. |
| **Mitspieler** | Der Partner des Ansagers im Sauspiel (Besitzer der gerufenen Sau). |
| **Gegenspieler** | Alle Personen, die nicht mit dem Ansager zusammenspielen (feste Rolle im Spiel). |
| **Gegner** | Relativer Begriff aus individueller Sicht: die Personen, mit denen *ich* nicht zusammenspiele – egal ob ich Spielerpartei oder Gegenspieler bin. |
| **Partner** | Relativer Begriff: die Person(en) im eigenen Team (für Gegenspieler im Sauspiel: der andere Gegenspieler). |
| **Ausspieler** | Wer die erste Karte eines Stichs legt. |
| **Position 1–4** | Reihenfolge im aktuellen Stich (1 = Ausspieler, 4 = „ganz hinten"). „Hinten sitzen" = nach den relevanten Gegnern am Zug sein, also mit voller Information entscheiden. |
| **Schmieren** | Punkte in einen Stich legen, damit der Partner den Stich mit diesen Punkten macht und das Team gemeinsam Punkte sammelt. |
| **Volle Schmier** | Ass oder Zehn. |
| **Abwerfen** | Eine wertlose/wertarme Karte in einen Stich legen, den man nicht gewinnen will oder kann. |
| **Stechen / Einstechen** | Eine Fehlfarbe mit Trumpf gewinnen (nur möglich, wenn man in der Farbe frei ist). |
| **Überstechen** | Einen bereits im Stich liegenden Trumpf mit einem höheren Trumpf schlagen. |
| **Frei sein** | Keine Karte einer Farbe (bzw. keinen Trumpf) mehr auf der Hand haben. Aus dem Spielverlauf ableitbar: Wer eine angespielte Farbe nicht bedient, ist nachweislich frei. |
| **Sich frei machen** | Gezielt die letzte(n) Karte(n) einer Farbe loswerden, um später einstechen zu können. |
| **Abschmeißen** | Eine Fehlfarbe in einen Stich einer *anderen* Farbe legen, weil man in der angespielten Farbe frei ist (→ der Spieler hat in dieser Farbe eine Karte weniger; relevant für T4). |
| **Suchen** | Als Gegenspieler die Ruffarbe ausspielen, damit die gerufene Sau fällt und der Mitspieler aufgedeckt wird. |
| **Rufsau / Suchsau / gesuchte Sau** | Das vom Ansager im Sauspiel gerufene Ass. |
| **Ruffarbe / Suchfarbe** | Farbe der Rufsau. |
| **Davonlaufen** | Der Besitzer der Rufsau spielt die Ruffarbe mit einer anderen Karte als der Sau aus (nur unter Bedingungen erlaubt, siehe 4.3). |
| **„Zu sein"** | Das Team hat die zum Sieg nötige Punktzahl: **Spielerpartei 61 Punkte**, **Gegenspieler 60 Punkte**. |
| **Schneiderfrei** | **Spielerpartei ab 31 Punkten**, **Gegenspieler ab 30 Punkten**. |
| **Jemanden schneider spielen** | Den Gegner unter seiner Schneidergrenze halten (Spieler gewinnt mit ≥ 91 → Gegenspieler ≤ 29; Gegenspieler gewinnen mit ≥ 90 → Spieler ≤ 30). |
| **Schwarz** | Eine Partei macht keinen einzigen Stich. |
| **Spritzen / Zurückspritzen** | Kontra / Re (Verdopplung). Sonderregel zur Punktgrenze siehe 6.4. |
| **Laufende** | Ununterbrochene Folge der höchsten Trümpfe (von oben), die eine Partei gemeinsam hält – oder die ihr ab dem höchsten Trumpf fehlen („ohne X"). |
| **Trumpfhoheit** | Man besitzt die höchsten noch im Spiel befindlichen Trümpfe bzw. als Einziger noch Trumpf. |

---

## 2. Karten, Farben & Punktwerte

**Blatt:** 32 Karten (Kurzes Blatt, optional `CONFIG`), 4 Farben: **Eichel, Gras (Grün/Blatt), Herz, Schellen**. Farbrang (für Ober/Unter): Eichel > Gras > Herz > Schellen.
Je Farbe: Ass (Sau), Zehn, König, Ober, Unter, 9, 8, 7. Jeder Spieler bekommt **8 Karten**, es gibt **8 Stiche**.

| Karte | Punkte (Augen) |
|---|---|
| Ass / Sau | 11 |
| Zehn | 10 |
| König | 4 |
| Ober | 3 |
| Unter | 2 |
| 9 / 8 / 7 | 0 |

**Summe: 120 Punkte.** Nützliche Konstanten: 30 Punkte pro Farbe (je 4 Farben à A+10+K+O+U).

> Hinweis für spätere Profi-Logik: 1-Punkt-Unterschiede zählen (Ober = 3, Unter = 2).

---

## 3. Spielarten (datengetrieben implementieren)

Jede Spielart wird als **Datensatz** definiert: `trumpfListe` (absteigend), `fehlfarbenRang` je Farbe, `teamModus`, `laufendeAb`, `tarifKlasse`. Die gesamte Bot-Logik greift nur über diese Daten auf „Trumpf", „ranghöchster Trumpf" usw. zu – **keine Sonderlogik pro Spielart hardcoden.**

### 3.1 Sauspiel (Rufspiel)
- **Team:** Ansager + Besitzer der gerufenen Sau (2 gegen 2). Der Mitspieler ist den anderen zunächst unbekannt.
- **Trümpfe (14, absteigend):** Eichel-Ober, Gras-Ober, Herz-Ober, Schellen-Ober, Eichel-Unter, Gras-Unter, Herz-Unter, Schellen-Unter, Herz-Ass, Herz-10, Herz-König, Herz-9, Herz-8, Herz-7.
- **Fehlfarben (je 6):** Eichel, Gras, Schellen: Ass > 10 > König > 9 > 8 > 7.
- **Laufende:** ab 3 (`CONFIG`).

### 3.2 Farbsolo (Eichel-, Gras-, Herz-, Schellen-Solo)
- **Team:** Ansager allein gegen 3.
- **Trümpfe (14):** alle Ober, alle Unter (Reihenfolge wie oben), dann die 6 Karten der Solofarbe (Ass > 10 > König > 9 > 8 > 7).
- **Fehlfarben:** die drei übrigen Farben (je 6 Karten).
- **Laufende:** ab 3 (`CONFIG`).

### 3.3 Wenz
- **Team:** Ansager allein gegen 3.
- **Trümpfe (4):** Eichel-Unter > Gras-Unter > Herz-Unter > Schellen-Unter.
- **Fehlfarben (je 7, alle vier Farben inkl. Herz):** Ass > 10 > König > **Ober** > 9 > 8 > 7.
- **Laufende:** ab 2 (`CONFIG`).

### 3.4 Geier (`CONFIG`, optional)
- **Team:** Ansager allein gegen 3.
- **Trümpfe (4):** Eichel-Ober > Gras-Ober > Herz-Ober > Schellen-Ober.
- **Fehlfarben (je 7):** Ass > 10 > König > **Unter** > 9 > 8 > 7.
- **Laufende:** ab 2 (`CONFIG`).

### 3.5 Weitere optionale Varianten (`CONFIG`)
- **Farbwenz / Farbgeier:** 4 Unter bzw. 4 Ober + die Karten einer Farbe als Trumpf.
- **Tout** (auch „Du"): wird zusammen mit der Farbe angesagt, also erst nachdem man das Spiel gewonnen hat (siehe 5.1). Ansage zusätzlich „Tout" zu einem Solo/Wenz/Geier – der Ansager muss **alle 8 Stiche** machen; ein verlorener Stich = Spiel verloren. Tarif erhöht (siehe 6.3).
- **Sie:** Wer alle 4 Ober und alle 4 Unter auf der Hand hat. Wird nicht gespielt, sondern sofort mit höchstem Tarif gewertet.
- **Ramsch:** Falls niemand spielt (statt Zusammenwerfen): jeder gegen jeden, wer die meisten Punkte hat, verliert. Trumpf wie im Sauspiel.
- **Hochzeit, Bettel** etc.: in der App bereits implementiert. Die Bot-Logik dafür ist nicht Teil dieses Dokuments. *(Geklärt [N].)*

> **Wichtig für die Bot-Regeln:** Beispiele in diesem Dokument beziehen sich (falls nicht anders angegeben) auf **Sauspiel / Herz-Trumpf**. Begriffe wie „ranghöchster Trumpf", „die höchsten vier/sechs Trümpfe", „schwacher Trumpf (z. B. Herz 7)" werden aus der `trumpfListe` der aktuellen Spielart abgeleitet.

---

## 4. Stichregeln (Engine – MUSS)

### 4.1 Grundablauf
1. Der Spieler links vom Geber spielt den ersten Stich aus; danach spielt jeweils der Gewinner des letzten Stichs aus.
2. Gespielt wird im Uhrzeigersinn, jeder legt genau eine Karte.
3. **Stichgewinn:** Liegt mindestens ein Trumpf im Stich, gewinnt der höchste Trumpf. Sonst gewinnt die höchste Karte der **angespielten** Farbe. Karten anderer Fehlfarben können nie gewinnen.
4. Gleichstände sind unmöglich (jede Karte ist eindeutig).

### 4.2 Bedienpflicht (Farb- und Trumpfzwang)
- **MUSS:** Wird Trumpf angespielt, muss Trumpf zugegeben werden, falls vorhanden.
- **MUSS:** Wird eine Fehlfarbe angespielt, muss diese Farbe bedient werden, falls vorhanden. **Ober und Unter gehören (in Ober/Unter-Spielen) nicht zu ihrer Farbe**, sondern sind Trumpf – ein Eichel-Ober bedient also *nicht* Eichel.
- Ist man frei: beliebige Karte (Trumpf oder andere Fehlfarbe). Es gibt **keinen Stechzwang** und **keinen Überstechzwang**.
- Jede Nicht-Bedienung wird in `GameKnowledge` als **„Spieler X ist frei in Farbe/Trumpf Y"** gespeichert (Grundlage fast aller höheren Stufen).

### 4.3 Sonderregeln Sauspiel (Rufsau)
- **MUSS (Ansage):** Gerufen werden darf nur eine **Fehlfarben-Sau** (nicht Herz). Der Ansager darf die gerufene Sau nicht selbst besitzen und muss **mindestens eine Karte der Ruffarbe** besitzen (Ober/Unter zählen nicht). Wer keine rufbare Sau hat, kann kein Sauspiel ansagen.
- **MUSS (Bedienen):** Wird die Ruffarbe angespielt, **muss** der Besitzer der Rufsau die Sau legen (auch wenn er andere Karten dieser Farbe hat).
- **MUSS (Ausspielen):** Spielt der Besitzer der Rufsau die Ruffarbe aus, muss er die Sau spielen – **außer beim Davonlaufen:** Besitzt er (inkl. Sau) **4 oder mehr** Karten der Ruffarbe, darf er eine andere Karte der Ruffarbe ausspielen (`CONFIG`: Davonlaufen erlaubt ja/nein). Danach entfällt die Pflicht, die Sau beim Bedienen zu legen.
- **MUSS (Abwerfen):** Die Rufsau darf nicht in eine andere Farbe abgeworfen/geschmiert werden, solange die Ruffarbe nicht gespielt wurde – Hausregel dieses Projekts: **frühestens im vorletzten Stich** (`CONFIG: rufsauAbwerfenAbStich = 7`). *(Geklärt [N].)*
- **Team-Aufdeckung:** Mit dem Fallen der Rufsau ist der Mitspieler für alle bekannt. **Der Mitspieler selbst kennt seine Rolle von Anfang an** (er hält die Sau). Der Ansager und die Gegenspieler kennen die Teams erst nach dem Fallen der Sau oder durch eindeutige Deduktion.

### 4.4 Solo, Wenz, Geier
- Keine Partnersuche, Teams sind ab der Ansage bekannt (1 gegen 3).
- Bedienpflicht gilt analog mit der jeweiligen Trumpfliste (im Wenz ist z. B. der Herz-Ober eine normale Herz-Karte).

### 4.5 Tout
- Der Ansager muss jeden Stich machen. Sobald er einen Stich verliert, ist das Spiel verloren (`CONFIG`: sofort abbrechen oder zu Ende spielen).

---

## 5. Ansagen (Reizen / Spielauswahl)

### 5.1 Ablauf
1. Ab dem Spieler links vom Geber erklärt jeder reihum „Ich spiele" / „Weiter" (bzw. „Ich hätt' auch was").
2. **Wollen mehrere spielen** *(geklärt [N])*:
   1. Der **erste** Spieler (in Sitzreihenfolge) gibt zuerst an, **welche Spielart** es werden soll (z. B. Sauspiel, Wenz, Solo), noch **ohne Farbe**.
   2. Danach gibt der **zweite** Spieler seine Spielart an.
   3. Wer das **höhere** Spiel ansagt, darf spielen. Bei gleichwertigem Spiel gewinnt, wer **früher** in der Reihenfolge sitzt (Vorhand-Vorrang).
3. Erst der Gewinner nennt die **Farbe** (bzw. bei Sauspiel die Rufsau) und gegebenenfalls **„Tout"** (auch „Du" genannt).
4. Spielt niemand: **Zusammenwerfen** (neu geben) oder **Ramsch** (`CONFIG`).

**Folge für den Bot:** In der Bietphase legt er sich nur auf die **Spielart** fest. Farbe und Tout entscheidet er erst, wenn er das Spiel gewonnen hat. Die Farbe muss also zur Handbewertung der Spielart passen, mit der er geboten hat.

### 5.2 Rangfolge der Spiele (`CONFIG`, Default)
`Sauspiel < Wenz = Geier = Farbsolo < Tout (jeweils) < Sie`
(Optional `CONFIG`: Wenz über Farbsolo, Farbwenz/Geier-Einordnung.)

### 5.3 Kontra / Re (Spritzen)
- Gegenspieler (bzw. jeder, der nicht zur Spielerpartei gehört) dürfen **Spritzen** (Kontra) sagen, die Spielerpartei darauf **Zurückspritzen** (Re). Jede Stufe verdoppelt den Spielwert.
- Zeitpunkt (`CONFIG`, Default): Spritzen bis vor dem Legen der ersten Karte des ersten Stichs; Zurückspritzen bis vor dem nächsten eigenen Kartenzug.
- Im Sauspiel darf auch der (noch unbekannte) Mitspieler zurückspritzen – verrät damit aber seine Rolle.
- `GameKnowledge` muss speichern: **Spritz-Status** und **wer der letzte Spritzer ist** (für 6.4).

### 5.4 Optional (`CONFIG`)
- **Klopfen/Legen** (Verdopplung nach den ersten 4 Karten), **Stock**, **Pflichtsolo** – aktuell nicht im Scope.

---

## 6. Wertung

### 6.1 Spielentscheid
| Partei | Gewinnt mit | Schneiderfrei ab | Schneider gespielt (Gegner) bei |
|---|---|---|---|
| Spielerpartei | **≥ 61** Punkten | **31** Punkten | Gegenspieler ≤ 29 (Spieler ≥ 91) |
| Gegenspieler | **≥ 60** Punkten | **30** Punkten | Spieler ≤ 30 (Gegenspieler ≥ 90) |

- 60:60 → Spielerpartei verliert (ohne Spritzen, siehe 6.4).
- **Schwarz:** Eine Partei macht keinen Stich (Stichanzahl, nicht Punkte!). Achtung: 0 Punkte ≠ schwarz (ein Stich mit 0 Augen zählt).

### 6.2 Spielwert (Tarif, `CONFIG`, Default-Beispiel)
| Bestandteil | Sauspiel | Solo / Wenz / Geier |
|---|---|---|
| Grundtarif | 10 | **30** *(geklärt [N])* |
| Schneider | +10 | +10 |
| Schwarz | +20 (statt Schneider) | +20 |
| je Laufender | +10 | +10 |

- **Laufende:** Sauspiel/Farbsolo ab 3, Wenz/Geier ab 2 (`CONFIG`). Laufende zählen „mit" oder „ohne" (fehlende höchste Trümpfe beim Gegner zählen genauso).
- **Sauspiel:** Jeder Gegenspieler zahlt an je einen Spieler der Gegenseite (bzw. umgekehrt) den Spielwert.
- **Solo:** Jeder der 3 Gegenspieler zahlt den Spielwert an den Solisten (bzw. der Solist an jeden).
- **Tout:** Spielwert × 2 (`CONFIG`), Schneider/Schwarz entfallen bzw. sind enthalten (`CONFIG`).
- **Sie:** Spielwert × 4 eines Solo-Tout (`CONFIG`).

### 6.3 Multiplikatoren
- Spritzen ×2, Zurückspritzen ×4 (`CONFIG`: weitere Stufen).
- Klopfen je ×2 (falls aktiviert).

### 6.4 Sonderregel Spritzen – Punktgrenzen (Hausregel dieses Projekts)
- Wurde gespritzt bzw. zurückgespritzt, muss der **letzte „Spritzer"** (die Partei, die zuletzt gespritzt hat) unabhängig von ihrer Rolle **61 Punkte** zum Gewinnen und **31 Punkte** für schneiderfrei sammeln.
- Die Bot-Logik (alle punktbasierten Entscheidungen, z. B. „zu sein", T1, T8, Endspiel-Scoring) verwendet immer die **aktuell gültigen Zielschwellen** aus `GameKnowledge.targetThresholds`.
- **60:60 nach Spritzen:** Der letzte Spritzer verliert. *(Geklärt [N].)*

---

## 7. Sonderfälle (Engine)

| Fall | Behandlung |
|---|---|
| Niemand will spielen | Zusammenwerfen oder Ramsch (`CONFIG`) |
| Sauspiel ohne rufbare Sau | Sauspiel für diesen Spieler nicht wählbar (UI deaktiviert, Bot berücksichtigt es in A-Regeln) |
| Davonlaufen | Nur mit ≥ 4 Karten der Ruffarbe (inkl. Sau), `CONFIG` |
| Rufsau abwerfen | Frühestens im vorletzten Stich (Hausregel, `CONFIG`) |
| Mitspieler-Identität | Für Ansager/Gegenspieler unbekannt bis Rufsau fällt; Mitspieler kennt sich selbst immer |
| Tout verloren | Spiel sofort verloren (`CONFIG`: weiterspielen für Statistik) |
| Sie | Keine Stiche, sofortige Wertung |
| Spritzen | Schwellen gemäß 6.4 anpassen |
| Letzter Stich | Alle „Aufheben"-Logiken (Rufsau, volle Schmier sparen) entfallen – nur noch Stichmaximierung |
| Schwarz-Gefahr | Bei Schwarz-Gefahr zählt jeder einzelne Stich (auch 0 Punkte) – Punktlogik weicht Stichlogik |

---

## 8. Bot-Architektur

### 8.1 GameKnowledge (für alle Stufen identisch)
Die Datenbasis wird **einmal** implementiert; Stufen unterscheiden sich nur darin, **welche Felder sie nutzen dürfen** und wie zuverlässig.

**Statisch:** Spielart + Trumpf-/Fehlfarbenlisten · Ansager · Rufsau/Ruffarbe · eigene Hand · Sitzordnung · Spritz-Status + letzter Spritzer + gültige Zielschwellen.

**Dynamisch (pro Stich fortgeschrieben):**
- aktueller Stich (Karten, Reihenfolge, Spieler, aktueller Stichbesitzer)
- vollständige Stichhistorie
- gefallene Trümpfe (Anzahl **und** Identität) → noch im Spiel befindliche Trümpfe
- gefallene Karten je Fehlfarbe; wurde eine Farbe schon angespielt (erste Runde ja/nein)
- Farbfreiheit je Spieler × Farbe/Trumpf (nachweislich)
- Abschmeiß-Historie (wer hat welche Farbe wann abgeschmissen)
- Punktestand je Team, verbleibende Stiche, verbleibende Punkte im Spiel
- Rollenstatus je Spieler: `SICHER_SPIELERPARTEI` / `SICHER_GEGENSPIELER` / `UNBEKANNT`
- **Ab Profi:** Constraint-Set je Gegner (welche Karten kann er noch haben) + Wahrscheinlichkeiten

> **Leitplanke (alle Stufen, auch Legende):** Die KI sieht **niemals** die echten Handkarten anderer Spieler. Erlaubt ist nur, was aus Spielverlauf, Bedienpflicht, Rufsau-Regeln und Kartenzählung eindeutig erschließbar ist. Legende arbeitet mit Determinisierung über plausible Verteilungen (Information Sets), nie mit der echten Verteilung.

### 8.2 Entscheidungs-Pipeline (`choose_card`)
```
1. Gültige Karten ermitteln (Engine, Kapitel 4)            → MUSS
2. R-Regeln anwenden (Kapitel 10), in Prioritätsreihenfolge → Kandidatenmenge einschränken
   - Regeln, die Rundengedächtnis brauchen, nur ab der freigegebenen Stufe
3. Stufe = Anfänger → zufällige Wahl aus Kandidaten
4. Sonst: Tipps (Teil 2) als Scoring auf die Kandidaten
5. Fehlerwurf der Stufe → bei Treffer zufällige Wahl aus Kandidaten (NIE außerhalb der R-Regeln)
6. Karte spielen, GameKnowledge aktualisieren
```
**Wichtig:** Ein „Fehler" ist immer eine **zufällige Wahl innerhalb der von den R-Regeln erlaubten Kandidaten** – niemals ein gezielt schlechter Zug und niemals ein Regelbruch.

### 8.3 Entscheidungs-Pipeline Ansage (`choose_game`)
```
1. Handbewertung (Trümpfe, Ober/Unter, Asse, Freiheiten, Laufende)
2. Mögliche Spiele ermitteln (Rufbarkeit, Kapitel 4.3)
3. A-Regeln anwenden (Kapitel 9)
4. Entscheidung Spielen/Weiter + ggf. Spritzen/Zurückspritzen
```

### 8.4 Welche Stufe darf was?
| Fähigkeit | Anfänger | Amateur | Fortgeschritten | Profi | Legende |
|---|---|---|---|---|---|
| Infos des aktuellen Stichs + eigene Hand + Sitzordnung + Rollen | ✅ | ✅ | ✅ | ✅ | ✅ |
| Trumpfzählung (Anzahl + Identität) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Farbfreiheits-Tracking | ❌ | ❌ | ✅ (binär) | ✅ (Constraints) | ✅ (Information Sets) |
| Punktestand für Entscheidungen | ❌ | ❌ | grob | exakt (inkl. 1-Punkt-Unterschiede) | exakt |
| Wahrscheinlichkeiten | ❌ | ❌ | ❌ | ✅ | ✅ (Simulation) |
| Fehlerquote bei Tipps | Tipps aus | zufällig (Ausnahmen in Teil 2) | Details Teil 2 | 1–3 % | 0 % |

---

## 9. A-Regeln – Spielauswahl & Ansage (verbindlich, alle Stufen)

**A1 – Wahl der Rufsau:** Beim Sauspiel ruft man die Sau der Fehlfarbe, von der man selbst **die wenigsten Karten** besitzt. Bei Gleichstand wählt man die Farbe, in der man die Karte mit der **höheren Punktzahl** besitzt.
*(Braucht nur die eigene Hand → 100 % auf allen Stufen. Vorher als „B1" geführt.)*

**A2 – Nur regelkonform rufen:** Der Bot ruft nie eine Sau, die er selbst hat, nie Herz, und nie eine Farbe, von der er keine Karte besitzt (Engine-Regel 4.3).

**A3 – Rolle ab der Ansage festlegen:** Nach der Ansage setzt jeder Bot seinen Rollenstatus:
- Ansager → `SPIELERPARTEI`
- Besitzer der Rufsau → `SPIELERPARTEI` (weiß es sofort)
- alle anderen → `GEGENSPIELER` (sich selbst sicher), der Status der Mitspieler bleibt `UNBEKANNT`, bis die Rufsau fällt oder eindeutig deduzierbar ist
- Im Solo/Wenz/Geier: Teams sofort bekannt.

> Die Schwellen der Handbewertung (A4), die Spritz-Kriterien (A5) und das Stufenverhalten bei der Ansage (A6) stehen in **Teil 2b**.

---

## 10. R-Regeln – Stichspiel (verbindlich, keine Fehlerquote)

Die R-Regeln werden **immer** befolgt. Die einzigen Stufenunterschiede entstehen dort, wo eine Regel Informationen braucht, die eine Stufe nicht hat (explizit markiert).

**Allgemeiner Default bei unklarer Team-Zugehörigkeit:** Solange ein Bot nicht sicher weiß, wer sein Partner ist, verhält er sich wie ein **Gegenspieler** (sucht im Normalfall, spielt als Ausspieler keinen Trumpf). Ein Mitspieler, dessen Rolle den anderen noch nicht bekannt ist, weiß selbst dennoch, dass er zur Spielerpartei gehört, und spielt entsprechend.

### R1 – Ausspiel-Grundsatz
- Ist ein Mitglied der **Spielerpartei** am Ausspiel, spielt es **Trumpf**, falls vorhanden.
- Ist ein **Gegenspieler** am Ausspiel, spielt er **keinen Trumpf**, sofern er noch eine Fehlfarbe hat.

**R1-Erweiterung (Trumpferschöpfung, ab Fortgeschritten – braucht Trumpfzählung):** Ist aus der Anzahl bzw. Identität der gefallenen Trümpfe klar, dass **nur noch der Ausspieler und ggf. sein Partner** Trumpf haben, kann die Spielerpartei auf **Fehlfarbe** wechseln.
Gleiches gilt spiegelbildlich: Ist man Mitspieler und hat keinen Trumpf mehr, bzw. hat nur noch das eigene Team Trumpf, kann man Fehlfarben nachspielen, in denen der Partner frei ist oder bei denen der Partner hinten sitzt.
**Vor dem Fall der Rufsau** (Partner des Ansagers noch unbekannt) *(geklärt [N])*:
- **Bis Fortgeschritten:** Wechsel auf Fehlfarbe nur, wenn bewiesen ist, dass alle Gegenspieler trumpffrei sind.
- **Ab Profi, auf jeden Fall bei Legende:** Man darf auch ohne diesen Beweis eine Fehlfarbe nachspielen, wenn alle drei Bedingungen erfüllt sind:
  1. Der Partner ist in dieser Farbe frei.
  2. Dem Team fehlen noch Punkte.
  3. Der Partner könnte noch Trumpf haben.
  Profi bewertet das über Wahrscheinlichkeiten, Legende über die Simulation.

### R2 – Schmieren bei sicherem Partner-Stich
Hat der Partner den Stich **sicher**, wird geschmiert. „Sicher" heißt:
- Der Partner hat den **ranghöchsten Trumpf der Spielart** gelegt (im Sauspiel/Solo: Eichel-Ober; im Wenz: Eichel-Unter; im Geier: Eichel-Ober), **oder**
- hinter mir sitzt **kein Gegner** mehr (ich bin der letzte Gegner-relevante Spieler im Stich), **oder**
- *(ab Fortgeschritten, braucht Trumpfzählung)* der Partner hat den **höchsten noch im Spiel befindlichen** Trumpf gelegt, bzw. kein Gegner hinter mir kann den Stich laut Farbfreiheits-Tracking noch schlagen.

*Was* geschmiert wird (Ass vs. Zehn, Rufsau, 1-Punkt-Feinschliff), regeln R5-Erweiterung und die Tipps T5/T7 in Teil 2.

### R3 – Suchen als Gegenspieler
Ist man Gegenspieler (im Sauspiel), am Ausspiel und kann suchen (man besitzt eine Karte der Ruffarbe), dann **sucht** man.
- Welche Karte der Ruffarbe gelegt wird: siehe T4 (Teil 2).
- **Ausnahme T9:** Haben beide Gegenspieler nachweislich keinen Trumpf mehr, wird ab Fortgeschritten nicht gesucht (braucht Trumpfzählung). *(Geklärt [N].)*
- Bin ich selbst in der Suchfarbe frei, greift T3a (Teil 2a).

### R4 – Partner nicht überstechen
Man übersticht den eigenen Partner nicht mit Trumpf, **sobald klar ist**, dass er der Partner ist und seine Karte den Stich gewinnt.
- **Ausnahmen:** R6 (kontrolliertes Überstechen) und R4a (unten). Beide haben Vorrang vor R4.

**R4a – Überstechen, um erneut Trumpf zu ziehen** *(geklärt [N])*
- **Grundsatz:** Man spielt, wenn möglich, keinen Trumpf, der **nur eine Stufe höher** ist als die Karte des Partners. Die einzige Ausnahme dazu ist R6.
- **Erlaubt:** Hat der Partner einen mittleren Trumpf gelegt (z. B. den **Eichel-Unter**), darf man mit einem deutlich höheren Trumpf (z. B. dem **Eichel-Ober**) drüberstechen, um selbst auszuspielen und **erneut Trumpf zu ziehen** (Ziel aus T10).
- **Voraussetzungen [N]:**
  1. Der Partner sitzt **direkt vor mir** und sitzt nach dem Überstechen im nächsten Stich **hinten** (Position 4).
  2. Ich habe für diesen Zweck **mindestens drei eigene Trümpfe** zur Verfügung; der einzige Trumpf der höchsten 6 wird nicht leichtfertig verschwendet.
  3. Für den Ansager gilt zusätzlich als starke Sicherheitsbedingung: Er sollte **zwei der höchsten 6 Trümpfe** besitzen. Diese Bedingung ist besonders für den Ansager relevant, weil seine Partneridentität und seine Trumpfverteilung anders zu bewerten sind.
- **Technische Sicherheitsbedingung [V]:** Wenn die strengere Bedingung „mindestens drei Trümpfe darüber" nicht eindeutig aus dem Spielzustand berechnet werden kann, darf der Bot nur überstechen, wenn er nach dem Stich noch mindestens einen der höchsten 6 und insgesamt mindestens 4 Trümpfe hat. Beide Grenzwerte müssen als `CONFIG` implementiert werden.
- **Wissen:** H (Partnerposition und eigene Hand). „Höchste 6 der **verbleibenden** Trümpfe" braucht G, also ab Fortgeschritten.

### R5 – Einstechen bei Farbfreiheit
Ist man in der angespielten Fehlfarbe **frei**, sticht man mit Trumpf ein – **außer**:
1. **Der Stich gehört bereits sicher dem Partner** (dann gilt R2 → schmieren), **oder**
2. **Ausnahme 0-Punkte-Stich:** Der Stich enthält 0 Punkte (bzw. sehr wenige) **und** der einzige Trumpf, mit dem man einstechen könnte, ist sehr wertvoll (einer der höchsten noch im Spiel befindlichen Trümpfe). Dann darf man statt einzustechen abwerfen (Details zur Wahl der Abwurfkarte: T11 in Teil 2).
   **Schwelle:** Im Stich liegen weniger als 5 Punkte. *(Geklärt [N].)*

**R5-Erweiterung – erste Runde einer Fehlfarbe:**
Wird eine Fehlfarbe **zum ersten Mal** in diesem Spiel angespielt und gehört der Stich dem Partner (sicher, im Sinne von R2), darf man – wenn man frei ist – statt einzustechen **schmieren**. Dabei gilt:
- Ein **Ass einer Farbe, die noch nicht gespielt wurde**, wird nur in Ausnahmefällen geschmiert: wenn das Team dadurch **„zu" ist** (Spielerpartei ≥ 61 / Gegenspieler ≥ 60, bzw. Schwellen nach 6.4).
- Besitzt man von einer Farbe **Ass und Zehn**, kann das Ass **unbedenklich** geschmiert werden (die Zehn übernimmt).
- **Rufsau:** Die Rufsau darf **erst im vorletzten Stich** geschmiert werden (entspricht Engine-Regel 4.3, hier nochmals als Bot-Regel verankert).

*(R5-Erweiterung setzt „wurde diese Farbe schon gespielt?" voraus – das ist Rundengedächtnis → erst ab Fortgeschritten. Anfänger und Amateur stechen nach R5 ein bzw. schmieren nach R2 ohne diese Feinheiten.)*
*Hinweis (Korrektur zum früheren Chatstand):* Die frühere Formulierung „Ausnahme für die Rufsau ist genau die Situation erste Runde + Partner sicher" war falsch und ist hier gestrichen – die Rufsau bleibt bis zum vorletzten Stich gesperrt.

### R6 – Kontrolliertes Überstechen des eigenen Partners
**Ziel:** Sitzt der Partner **direkt vor mir**, kann ich durch Überstechen erreichen, dass ich den nächsten Stich ausspiele und der Partner dann **hinten sitzt** (Position 4) – das ist gut und gewollt.

**Bedingung:** Der Partner hat einen Trumpf gelegt, und ich besitze **sowohl den nächsthöheren als auch den nächstniedrigeren Trumpf** zur Karte des Partners. Dann übersteche ich mit dem nächsthöheren Trumpf.

**Beispiel:** Der Mitspieler spielt den **Schellen-Ober**. Ich habe den **Herz-Ober** (direkt darüber) und den **Eichel-Unter** (direkt darunter). → Ich übersteche mit dem Herz-Ober; der Partner sitzt im nächsten Stich hinten.

**Dritte Karte** *(geklärt [N])*:
- R6 ist hauptsächlich für den Fall gedacht, dass man **genau die zwei Nachbarkarten** hat. Dann übersticht man mit der höheren.
- Hat man zusätzlich eine **dritte passende Karte**, spielt man **diese** statt überzustechen. Der Partner behält den Stich, die hohen Trümpfe bleiben für später.
  - Bevorzugt eine **Schmier** (Trumpf-Ass oder Trumpf-Zehn).
  - Ebenfalls in Ordnung: **jedes beliebige Herz** (bzw. schwacher Trumpf der Spielart) oder ein **schwacher Unter**.

**R6b – Trumpfschmier, wenn der Stich sicher an den Gegner geht** *(geklärt [N])*
- **Situation:** Man hat hohe Trümpfe und eine Trumpfschmier, und der Stich geht **sicher an den Gegner**.
- **Aktion:** Man legt die Schmier und behält die hohen Trümpfe **nur**, wenn **beide danach sicher stechen**. Sonst legt man einen hohen Trumpf und behält die Schmier (vgl. T7, Beispiel 2).
- **Korrekt erkannt** (braucht Trumpfzählung): Fortgeschritten **75 %**, Profi **90 %**, Legende **100 %**. Anfänger und Amateur wenden R6b nicht an und wählen zufällig unter den erlaubten Karten.

**Direkte vs. deduzierte Nachbarschaft:**
- **Direkt:** Nachbarschaft ergibt sich aus der festen Trumpfreihenfolge (wie im Beispiel) → wird angewendet, sobald R6 aktiv ist, mit 100 %.
- **Deduziert:** Nachbarschaft ergibt sich erst dadurch, dass die dazwischenliegenden Trümpfe **bereits gefallen** sind (braucht Trumpfzählung) → korrekt erkannt bei **Fortgeschritten 50 %**, **Profi 75 %**, **Legende 100 %** (hier soll die Entscheidung immer richtig sein).
- Wird die deduzierte Nachbarschaft nicht erkannt, verhält sich der Bot so, als gäbe es sie nicht (R4 gilt).
- **Aktiv ab Amateur** (der direkte Fall braucht nur eigene Hand + aktuellen Stich), bei Anfänger nicht. *(Geklärt [N].)*

### 10.1 Prioritätsreihenfolge der R-Regeln
Wenn mehrere Regeln gleichzeitig greifen (Default, zum Review):
1. Engine-MUSS (Kapitel 4) – immer
2. Rufsau-Sperre (R5-Erweiterung / 4.3)
3. R6 / R6b und R4a (vor R4)
4. R4
5. R2 (Schmieren) vor R5 (Einstechen)
6. R5 inkl. 0-Punkte-Ausnahme
7. R3 (Suchen) – ggf. mit T9-Ausnahme
8. R1 / R1-Erweiterung

---

## 11. Vorschau Teil 2
- **Tipps T1–T12** (vollständig, inkl. aller Ergänzungen): „Mim Unter gehst nie unter", Mitspieler-Ausspiel mit hohem Trumpf (inkl. Abwechseln, höchste 6 bei Position 4), Suchen/Fehlfarbenwahl (T3a–c), Fehlfarbenmenge & Suchsau-Ausnahmen (T4), Schmier-Qualität inkl. Solo (T5), konsekutive Karten (T6), sicherer Stich vs. Ober sparen / Zwei-Stiche-Logik (T7), Punkte streuen 5–12 (T8), Trumpflosigkeit beider Gegenspieler (T9), Trumpfrunden erzwingen (T10), vorsorgliches Freimachen (T11), die zwei höchsten Trümpfe ausspielen (T12)
- Stufen-Matrix mit Prozentwerten je Tipp
- A4 ff. (Handbewertung, Spritzen) als Vorschlag
- Tutorial-Texte für den Anfänger-Modus
- Liste offener Punkte/Widersprüche
- Fertiger Implementierungs-Prompt für Codex / Claude Code
