# Abgleich mit dem persönlichen Schafkopf-Regelwerk

Stand: 4. Oktober 2026, Abschlussprüfung nach der Unterbrechung fortgesetzt. Quellen: die unveränderten Originaldateien unter `docs/teil1.md`, `docs/teil2.md`, `docs/teil2b.md`.

## Umgesetzt

- Datengetriebene Trumpf-/Fehlfarbenlisten für alle vorhandenen Spielarten, bei unveränderter Kartenrangfolge.
- Bot-Pipeline: legaler Zug → R-Regeln → erlaubte Kandidaten → stufenabhängige Tipps oder Zufall. Fehler können keine gesperrten Karten oder Karten außerhalb der R-Kandidaten erzeugen.
- A1: kürzeste rufbare Farbe, Punktvergleich bei Gleichstand. A2: Engine-Rufbarkeit. A3: eigene sichere Rolle, öffentliche Aufdeckung und Deduktion.
- A4: Bremser, Sauspiel-Mindeststärke, Fünf-Trumpf-Ausnahme, Farbsolo/Farbwenz, Ausschlusskriterien, konservativer Tout-Test. Erwartungen berücksichtigen die eingestellten Tarife. Die weiter unten genannten zusätzlichen bestehenden Wenz-/Geier-Mindestanforderungen bleiben erhalten.
- A5/A6: Anfänger spritzt nie; Amateur selten mit außergewöhnlichem Blatt; höhere Stufen prüfen die Vorgaben und das Informationsrisiko. Profis bewerten Handstruktur, Position, Laufende mit/ohne, Punkte und öffentlich ableitbare Verteilungen; Legende zieht kompatible Verteilungen und spielt sie bis zur Abrechnung aus.
- R1–R6 einschließlich R4a/R6b und der markierten Wissens-/Erkennungsgrenzen. Die Regeln greifen vor Fehlern, Tipps und Simulation.
- T1–T12 mit Unter-Einstechen, Partner-Ausspiel, Suchfarbe, Schmierqualität, Nachbarschaft, Zwei-Stiche-Logik, Punktstreuung, Freimachen und Partnerposition. R3/T9 ist wegen des dokumentinternen Widerspruchs als harte Ausnahme umgesetzt, siehe Frage 12.
- Gemeinsames GameKnowledge aus eigener Hand und öffentlichen Stichen: Trümpfe, Farben, bewiesene Farbfreiheit, Abschmeißhistorie, vermutete Suchfarbenfreiheit, Rollen, Zielschwellen, Constraints und einfache Kartenwahrscheinlichkeiten.
- Anfänger/Amateur erhalten keine frühere Stichhistorie, Farbfreiheit oder Punktstände zur Kartenbewertung. Anfänger hat keine Tipps; Amateur nur H-Wissen. Fortgeschritten merkt sich öffentliche Karten/Freiheiten; Profi berücksichtigt genaue Punkte und gewichtet Tipps.
- Legende: Root-ISMCTS mit UCB, vollständigen kompatiblen Resthänden und Rollouts bis zum Rundenende. Die Rollout-Spieler bekommen jeweils eine gefilterte eigene Sicht. Beachtet Handgrößen, bekannte Freiheiten, Rufsau-Besitz, Rufbarkeit des Ansagers und öffentliches Davonlaufen. Standardbudget: 200 Iterationen bzw. 180 ms, mit Mindestexploration der erlaubten Karten. Ansage/Spritzen verwenden ebenfalls vollständige Rollouts; der erwartete Gewinn ist der Mittelwert der Gewinn-Spielwerte aus den abgeschlossenen Simulationen. Dies bleibt eine Stichprobenschätzung, keine exakte Gewinnwahrscheinlichkeit.
- `chooseCard` liefert Karte, reasonCode, Stufe und Debug-Informationen. `chooseAiAction` liefert reasonCode/botLevel; botLevel ist bewusst getrennt vom numerischen Gebotsfeld `level`.
- Regelbuch: durchsuchbarer Lernindex plus alle drei vollständigen Originale einschließlich Download. Abweichungen und zusätzliche bestehende Tischregeln sind sichtbar gekennzeichnet.
- Lernanzeige: Anfänger zufällig eine Regel; Amateur eine Regel oder einen Tipp; Fortgeschritten einen Tipp. Der Hinweis bleibt bei unverändertem Zug stabil.
- Stich-Review: eigene Hand, Punktstand, Ansagen/Rollen und sichtbare Karten unmittelbar vor dem eigenen Zug rekonstruieren. Spätere Karten und endgültige Partneraufdeckung fließen nicht rückwirkend ein. Anzeige von Empfehlung und zutreffenden Regel-/Tipp-Codes.
- Regelbuch → Bot/KI: Trefferquoten, Ansage-Schwellen, konservative R4a-/T12-Startwerte und Simulationsbudgets. Online werden Bot-Einstellungen serverseitig normalisiert; nur der Gastgeber darf sie ändern.
- Zusätzliche konfigurierbare Hausregeln: Davonlaufen, frühester Rufsau-Abwurf, Laufende-Mindestanzahl und Solo-Höchstanzahl, verlorenen Tout nach einem Stich beenden, Tout-/Sie-Faktoren, zusätzliche Schneider/Schwarz-Zuschläge im Tout sowie Spritz-Grenzen nach der letzten Spritzerpartei. Die bisherigen Standardwerte bleiben bis zur Klärung bestehen.
- Reproduzierbarer Zufall für Tests/Simulationen; Simulation im Script `scripts/simulate-schafkopf.mjs`.

## Gesammelte Rückfragen

Die widersprechenden bisherigen Engine-Standards wurden nicht automatisch ersetzt. Bereits angebotene neue Optionen sind standardmäßig nicht aktiviert, soweit sie bisheriges Verhalten ändern würden.

1. **Bieten:** Soll die Dokument-Reihenfolge gelten: zunächst der erste Interessent, dann weitere, jeweils nur Spielart; Wenz = Geier = Farbsolo; Farbe und Tout erst nach gewonnenem Bieten? Bisher beginnt der zweite Interessent, jeder spätere Interessent verpflichtet sich zu einem höheren Mindestspiel, und die Spielarten sowie Tout haben getrennte Ränge. Wo sollen Farbwenz, Farbgeier und Bettel in der neuen Rangfolge stehen?
2. **Spritz-Punkte:** Soll die letzte Spritzerpartei immer 61 zum Gewinnen und 31 für schneiderfrei brauchen? Bisher bleiben 61/31 für die Spielerpartei und 60/30 für die Gegenseite unverändert. Die Dokument-Wertung ist jetzt als Einstellung vorhanden, zunächst ausgeschaltet.
3. **Spritz-Zeitpunkt:** Kontra vor der ersten Karte des ganzen Spiels und Re vor dem nächsten eigenen Zug (Dokument), oder Kontra mit der ersten eigenen Karte und Re im folgenden Stich (App)? Sollen die bestehenden weiteren Stufen Sub/Hirsch erhalten bleiben?
4. **Davonlaufen:** Soll nach Davonlaufen die Rufsau beim Bedienen der Ruffarbe frei wählbar sein (Dokument), oder muss sie wie bisher trotzdem gelegt werden? Darf sie nach Davonlaufen sofort in eine andere Farbe geschmiert werden (bisherige App), oder bleibt die Sperre bis Stich 7 immer bestehen?
5. **Laufende:** Soll das Farbsolo die gesamte Folge von bis zu 14 Trümpfen zählen, oder weiterhin höchstens 8? Das Limit ist jetzt einstellbar; Standard bleibt 8. Für Farbwenz/Farbgeier fehlen explizite Mindest- und Höchstwerte im Dokument; bisher ab 3 und höchstens 8.
6. **Schwarz-Tarif:** Soll Schwarz +20 **anstelle** von Schneider bringen (Dokument), oder ein eigener Zuschlag **zusätzlich** zu Schneider bleiben (App)? Die bisherigen Defaults +10 Schneider und +10 Schwarz ergeben ebenfalls +20, aber benutzerdefinierte Tarife unterscheiden sich.
7. **Sie:** Vierfaches Solo-Tout (Dokument, also achtfaches einfaches Solo einschließlich Laufenden), oder vierfaches einfaches Solo (bisherige App)?
8. **Tout:** Soll ein verlorener Tout standardmäßig sofort nach dem verlorenen Stich beendet oder wie bisher zu Ende gespielt werden? Beides ist jetzt einstellbar; bisheriger Standard bleibt Weiterspielen.
9. **Wenz/Geier:** Ist die Formulierung „konkrete Farbe erst nach dem Bieten“ in Teil 2b nur für Farbwenz/Farbgeier gemeint? Ein reiner Wenz bzw. Geier hat bislang keine Trumpffarbe. Welche Spritz-Mindeststärke soll für reine Wenz/Geier gelten? Die beschriebenen 5/6-Trumpf-Anforderungen können mit deren insgesamt vier Trümpfen nicht erfüllt werden; bis zur Ergänzung spritzen Bots dort nicht.
10. **A4-Ausschlusskriterien:** Zählen beim fehlenden Ass auch Farben, in denen man vollständig frei ist? Aktuell sind gemäß wörtlicher Formulierung alle Nichttrumpffarben berücksichtigt. Soll „zwei Unter, darunter einer der höchsten drei“ beim Geier ebenfalls Unter meinen oder analog Ober? Aktuell sind es wörtlich Unter.
11. **R4a:** Soll die konservative technische Sicherheit gelten: nach dem Überstechen mindestens vier Trümpfe und einer der höchsten sechs übrig? Oder reichen die drei eigenen Trümpfe aus dem Grundsatz / sind drei Trümpfe **über** der Partnerkarte gemeint? Aktuell gelten die konservativen, konfigurierbaren Dokument-Startwerte; für den Ansager außerdem zwei der höchsten sechs vor dem Zug.
12. **T9:** Teil 1 formuliert „bei bewiesener Trumpflosigkeit beider Gegenspieler nicht suchen“ als feste R3-Ausnahme; die Tippmatrix nennt dagegen 85 % bei Fortgeschritten. Immer befolgen oder mit dieser Fehlerquote? Aktuell hat die feste R3-Ausnahme Vorrang.
13. **R2/T11:** Soll bei einem sicheren Partnerstich das Freimachen mit einer punktarmen Einzelkarte Vorrang vor dem Pflicht-Schmieren haben? Der T11-Text sagt ausdrücklich „auf jeden Fall“, R2 fordert Schmieren. Aktuell ist diese T11-Ausnahme nach dem angegebenen Konflikt-Default möglich.
14. **Kurzes Blatt:** Teil 1 nennt 32 Karten „kurzes Blatt“, beschreibt aber vollständig 32 Karten / acht pro Person. Soll zusätzlich ein echtes 24-Karten-Blatt ohne 7/8 angeboten werden? Bisher und aktuell gelten 32 Karten.
15. **Hochzeit:** Das Dokument bezeichnet Hochzeit als bereits implementiert. Tatsächlich existiert nur ein Einstellschalter, keine auswählbare Hochzeit und keine Engine-Regeln dafür. Soll sie ergänzt werden, und nach welchen Regeln?
16. **Endspiel-Präzisierung:** Ab wann zählt eine Lage als „Schwarz-Gefahr“, sodass ein möglicher Null-Augen-Stich die R5-Ausnahme und Tipps übersteuert? Und wie grob soll Fortgeschritten seine Team-Punkte kennen? Aktuell werden die ausdrücklich benannten R5-/T11-Siegschwellen exakt geprüft; eine allgemeine Schwarz-Gefahr-Schwelle oder willkürliche Rundung ist noch nicht ergänzt.

## Zusätzliche bestehende Regeln, die erhalten bleiben

- Eichel-Ober-Pflichtspiel nach viermal Weiter, optional.
- Erzwungener Ruf: fehlende Sau in einer gehaltenen Fehlfarbe zuerst, sonst die höchste fehlende Zehn/König/Neun/Acht/Sieben; gegebenenfalls Einzelspiel. Legen-Pflichtspieler kann auch ein Einzelspiel wählen.
- Der letzte Klopfer muss nach viermal Weiter spielen. Die zweite Viererhand wird unmittelbar nach der eigenen Entscheidung gegeben. Einzelspieler hat Legen immer aktiv und ohne Zeitlimit.
- Lokale Hotseat-Klopfzeit 15 Sekunden, online 20 Sekunden; online Zugzeit 60 Sekunden. Die Klopfentscheidung ist unabhängig und parallel möglich.
- Ramsch: jeder Spieler ohne Stich („Jungfrau“) erhält eine doppelte Gewinnzahlung; bei gleichem höchsten Punktstand verliert der niedrigste Sitzindex.
- Bettel ohne Trümpfe: kein eigener Stich nötig zum Sieg; bestehende Tarifklasse. Farbwenz/Farbgeier optional mit ihren bestehenden Kartenfolgen und Tarifzuordnungen.
- Laufende im Farbwenz/Farbgeier ab drei und höchstens acht; zusätzliche obere Grenze im Farbsolo bleibt bis Klärung standardmäßig acht.
- Sub und Hirsch als weitere Verdopplungsstufen; ihre zukünftige zeitliche Einordnung ist Frage 3.
- Wenz/Geier-Bots behalten mangels neuer vollständiger Mindestanforderung zusätzlich die frühere Mindeststärke: alle vier Rangtrümpfe oder die höchsten drei plus mindestens ein Fehlfarben-Ass. Die neuen Ausschlusskriterien gelten zusätzlich.
- Der vorhandene Klopf-Bot bewertet nur seine ersten vier Karten anhand der Ober-/Unter-Kombinationen und höchsten Trümpfe. Das Dokument definiert keinen neuen Klopfalgorithmus.
- Sitzung, Geberwechsel, private Online-Sichten, manuelle KI-Übernahme, Sortierung, Einsammelzeiten und virtuelle Zahlung ohne echte Geldeinsätze bleiben bestehen.

## Umgesetzte Ideen und technische Defaults

- Suchbarer Kurzindex, vollständige Originalansicht und Originaldownload ergänzen einander.
- Dieselbe Bot-Pipeline für Review und Entscheidung verhindert widersprüchliche Ratschläge.
- Historische eigene Hand statt aktueller Hand in der Review; neue öffentliche Spritz-Ereignisse erlauben korrekte zeitliche Rollenrekonstruktion. Alte gespeicherte Runden ohne Spritz-Ereignisse liefern diese Information nicht vollständig.
- Root-ISMCTS nutzt Tipps als Startbewertung. Wenn ein bewusst sehr kleines Suchbudget nicht jede erlaubte Karte prüfen kann, fällt die Auswahl auf diese Tippbewertung zurück, statt ungeprüfte Karten allein wegen ihrer Reihenfolge zu bevorzugen.
- Einfache Constraint-Gewichte reduzieren die angenommene Wahrscheinlichkeit einer Suchfarbenkarte bei beobachtetem Nicht-Suchen; das ist weiterhin eine Vermutung und kein harter Ausschluss. Ein Fehlfarbenwechsel mit unbekanntem Partner wird ab Profi nur bei einer ausreichenden geschätzten Wahrscheinlichkeit (Startwert 60 %) zugelassen.
- Die Tout-Prüfung ist konservativ: eigene Trumpffolge lückenlos von oben; ausschließlich Trümpfe oder ein einziges blankes Fehlfarben-Ass an erster Position. Keine erfundene Garantie aus fremden tatsächlichen Händen.
- Spritz-Simulation bewahrt bereits gespielte Stiche und Resthandgrößen; Ansage-Simulation beginnt dagegen am tatsächlichen ersten Ausspieler. Beide verwenden dieselbe Engine-Wertung samt einstellbaren Tarifen.
- Ein bisheriger Absturz bei der Bettel-Wertung ohne Trumpfliste wurde behoben; die Wertungsregel bleibt erhalten.

## Prüfung und Grenzen

- 86 erfolgreiche Tests: Szenarien für A1/A4/A5, R1–R6b, T1–T12, Wissensgrenzen, Kartenconstraints, Datenschutz, rückblickfreie Review und vollständig gewertete Ansage-/Spritz-Rollouts; bestehende Engine- und Online-Tests bleiben enthalten.
- `verification/10000-games-quick.json`: 10.000 vollständige gemischte Spiele, 320.000 reale Kartenzüge; 0 ungültige Engine-Züge, 0 Auswahlen außerhalb der vom Bot ermittelten R-Kandidaten. Reduziertes Legende-Budget: ein Rollout / 1 ms, höchstens vier Ansage-Verteilungen. Dies ist eine Regel-/Integrationsprüfung, **kein Beweis der Standard-Spielstärke**. Laufzeit ca. 209 Sekunden.
- `verification/100-games-standard.json`: zusätzlich 100 Spiele mit regulärem Budget, 3.200 reale Kartenzüge, 28.152 Suchiterationen; keine Engine-/Kandidatenverstöße.
- Die gewünschte statistisch klare Rangfolge Anfänger < Amateur < Fortgeschritten < Profi < Legende ist noch **nicht belegt**. Im Schnellprofil steigen die Siegquoten zwar (55,55 / 57,45 / 58,59 / 59,33 / 59,44 %), Profi und Legende liegen aber praktisch gleichauf. Die 100 Standardspiele sind für eine belastbare Aussage zu klein. Vor Empfehlungen zur Änderung der vorgegebenen Prozentwerte sollte mit den endgültig geklärten Engine-Regeln ein großer Standardlauf stattfinden; das Simulationsscript ist vorhanden.
- Browserprüfung: vollständiges Regelbuch, Suchindex, Bot-Matrix, Lernhinweis und laufende Stich-Review. `verification/stich-review.jpg` zeigt die Empfehlung aus damaliger Sicht mit einer angewendeten R-Regel.
- Der Client-Build funktioniert. Die neuen eigenen Module bestehen ESLint. Der umfassende Schafkopf-Lint meldet bestehende React-Hook-Probleme in `SchafkopfGame.tsx` und `SchafkopfTable.tsx` (synchrone Zustandsänderungen in Effekten, Ref-Zugriff beim Rendern).
- Online-Code und Validierung sind geändert und lokal mit dem echten Edge-Handler und gemockten Auth-/Datenbankgrenzen getestet. Kein Deployment auf Supabase wurde durchgeführt; hierfür muss die Schafkopf-Funktion samt importierter Module neu bereitgestellt werden.
