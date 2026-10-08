# Persönliches Schafkopf-Regelwerk: Umsetzungsstand

Stand: 5. Oktober 2026. Die drei Originalquellen unter `docs/teil1.md`, `docs/teil2.md` und `docs/teil2b.md` bleiben vollständig und unverändert. Die aktuellen Nutzerantworten werden in `docs/klarstellungen-2026-10-05.md` getrennt erfasst und haben bei Widersprüchen Vorrang. Beide Quellenstände sind im Regelbuch lesbar und herunterladbar. Dokumenttext wird als Inhalt behandelt, nicht als Auftrag für externe Aktionen.

## Vorhandene vollständige Integration

- Gemeinsame Bot-Pipeline: legaler Zug, harte R-Regeln, zulässige Kandidaten, stufenabhängige Tipps/Zufall oder Simulation. Fehler und Simulation dürfen keine Karte außerhalb der R-Kandidaten wählen.
- A1–A6, R1–R6b und T1–T12 sind in `bot.ts`/`knowledge.ts` implementiert, einschließlich der unten beschriebenen neuen Präzisierungen. Die übrigen Details der drei Originaldokumente bleiben übernommen.
- Anfänger/Amateur nutzen die eigene Hand und den laufenden Stich. Fortgeschritten nutzt öffentliche Kartenhistorie und bewiesene Farbfreiheit. Die explizit angeordneten T9-Quoten bilden eine begrenzte Wissensausnahme für Amateur. Profi berücksichtigt genaue Punkte und gewichtet Tipps; Legende simuliert kompatible verdeckte Verteilungen.
- Gemeinsames GameKnowledge: öffentliche Rollen und Aufdeckung, Handgrößen, bekannte freie Farben, Abschmeißhistorie, restliche Karten/Trümpfe, Kartenconstraints, Punkte und vorsichtige Kartenwahrscheinlichkeiten. Bots erhalten ausschließlich redigierte Spieleransichten.
- Root-ISMCTS mit UCB, vollständigen Resthänden und Rollouts bis zur Rundenabrechnung; Ansage und Spritzen ebenfalls mit abgeschlossenen Rollouts. Die simulierten Spieler bekommen jeweils nur ihre eigene gefilterte Sicht. Standardbudget bleibt 200 Iterationen/180 ms und 64 Ansage-Verteilungen, konfigurierbar.
- Lernhinweise: Anfänger zufällig eine Regel, Amateur Regel oder Tipp, Fortgeschritten Tipp. Der Hinweis bleibt innerhalb desselben Zuges stabil.
- Stich-Review rekonstruiert eigene Hand, Ansagen, öffentliche Rollen, Punktstände und Karten unmittelbar vor dem eigenen Zug. Spätere Karten und spätere Partneraufdeckung werden nicht als früheres Wissen verwendet. Review und Bots teilen die aktualisierte Regel-/Tipp-Pipeline.
- Regelbuch → Bot/KI zeigt Trefferquoten, Ansage- und Reserveschwellen sowie Simulationsbudgets. Der Online-Gastgeber kann validierte Einstellungen ändern.

## Anpassungen aus der aktuellen Nachricht

1. Der besondere erzwungene Ruf ist auf Eichel-Ober-Pflichtspiel begrenzt. Fehlende Sauen gehaltener Farben haben Vorrang; danach fehlende Zehn/König/Neun/Acht/Sieben, andernfalls Solo. Normale Klopfer bekommen diesen Ruf nicht mehr.
2. Zeitlich letzter Klopfer statt letztem Sitz: tatsächliche Reihenfolge wird gespeichert. Standardmäßig muss er nach viermal Weiter eines der erlaubten Spiele wählen. Mit allen drei Fehlfarben-Assen ist kein normales Sauspiel möglich, daher Einzelspiel.
3. Neuer Muss-Spiel-Schalter, standardmäßig aktiv. Ohne ihn gelten Eichel-Ober/Ramsch/Neugeben nach den bestehenden Tischoptionen. Alle Klopfverdopplungen bleiben erhalten.
4. Hotseat-Klopfzeit 20 Sekunden, Multiplayer 30 Sekunden, getrennte Menüwerte von 5–180 Sekunden. Online validiert der echte Edge-Handler beide Zeiten. Einzelspieler bleibt beim Klopfen unbefristet; Zug-Erinnerung erst nach 60 Sekunden.
5. Neue Kriterien für die erste Viererhand beim Klopf-Bot: zwei Unter plus Herz/Farbpaar, drei Trümpfe mit einem der drei höchsten Ober oder vier mit einem der höchsten sechs. Das getrennte Drei-Ober/Unter-Kriterium für zweites Legen ist als Funktion vorbereitet, aber bis zur Klärung seiner Bedeutung nicht an einen Spielablauf gebunden.
6. Ramsch-Gleichstand: sämtliche Spieler mit höchsten Augen teilen die Summe der Gewinnerzahlungen, einschließlich doppelter Jungfrauenanteile. Vier gleiche Punktstände erzeugen Nullzahlungen. Ergebnisanzeige benennt alle Verlierer. Eine Cent-Rundungsregel ist offen.
7. Laufende über die gesamte Folge, maximal 14 im Farbsolo und 11 im Farbwenz/Farbgeier. Neuer Aktiv-Schalter; Bot-Tarifbewertung und Tout berücksichtigen ihn ebenfalls. Früheres gespeichertes Solo-Limit wird ignoriert.
8. Wenz/Geier: Zwei beliebige Rangtrümpfe mit drei Fehlfarben-Assen oder zwei Assen und zwei freien Farben sind zulässig. Maximal zwei freie Farben; freie Farben zählen nicht als gehaltene Farben ohne Ass. Geier-Kriterien verwenden Ober.
9. Neue Gebotsränge und erster Interessent als erster Bieter. Gleiches Gebot hält der frühere Sitz. Sauspiel-Tout wurde ergänzt. Hochzeit sowie Bettel-/Hochzeit-Tout bleiben wegen offener Ziele und Austauschregeln nicht spielbar.
10. Letzte Spritzpartei braucht fest 61/31, andere Partei 60/30. Einstelloption entfernt; alte gespeicherte Abweichungen werden ignoriert. Kontra/Re/Sub/Hirsch bleiben mit dem eigenen Zug kombiniert.
11. Wenz-/Geier-Bots spritzen nach erstem Teamstich über 30 Augen plus höchstem Trumpf oder zwei Trümpfen mit einem der höchsten beiden. Dafür Kontra nach dem ersten Stich ermöglicht. Geltung für Menschen und persönlicher Stich versus Parteistich sind noch zu bestätigen.
12. Nach Davonlaufen sind passende Rufkarten beim Führen und Bedienen frei wählbar, einschließlich Suchsau. Bedienen bleibt Pflicht.
13. Schneider +10 und Schwarz zusätzlich +10 als Standards. Tout fest ×2, Sie fest ×4, beide mit Laufenden ohne Schneider-/Schwarz-Zuschläge. Alte Faktoren-/Zuschlagsoptionen sind entfernt und werden beim Rechnen ignoriert. Tout standardmäßig sofort nach verlorenem Stich beendet, Weiterspielen bleibt wählbar.
14. R6 nur im eindeutigen Fall, dass die gesamte Hand aus den beiden angrenzenden Karten besteht. Frühere Anwendung mit dritter nicht angrenzender Karte entfällt. Die deduzierte Nachbarschaft berücksichtigt jetzt auch die bereits gelegte Partnerkarte als Bezugspunkt; sie fehlte zuvor in der Liste verbleibender Trümpfe. Reichweite für zusätzliche Fehlfarben bleibt offen.
15. R4a behält konservative einstellbare Reserven: vier Trümpfe und ein hoher Trumpf nach dem Überstechen; Ansager braucht zwei hohe davor. Der einzige hohe Trumpf wird nicht geopfert.
16. T9: Suchquoten Anfänger 100 %, Amateur 75 %, Fortgeschritten 50 %, Profi 25 %, Legende 0 %, wenn beide Gegenspieler bewiesen trumpffrei sind. Ältere gespeicherte T9-Werte werden überschrieben; andere Bot-Einstellungen bleiben erhalten.
17. T11 nur bei noch nicht angespielter Farbe. Ungespieltes Ass ohne Zehn wird geschützt; Zehn ohne Ass und Ass mit Zehn dürfen geschmiert werden. Profi/Legende priorisieren sichere Punkte zum Spielgewinn oder Gegner-Schneider vor dem Freimachen.
18. Fortgeschritten kennt vor Teamklärung eigene Augen, danach genaue Teampunkte. Kleine sichere Stiche werden bei Spielgewinn, Schneiderfreiheit in den letzten beiden Stichen oder Verhindern von Schwarz genommen.
19. Lerntexte, Live-Hinweise, Stich-Review und Menü-Regelstand sind aktualisiert; die inzwischen beantworteten alten Fragen wurden ersetzt.
20. Kein kurzes Blatt ergänzt. Es bleiben vier Spieler und 32 Karten.

## Ergänzende technische Entscheidungen

- Ältere gespeicherte Runden erhalten eine Versionsmigration der Gebotszahlen, ohne Hände, bisherige Ergebnisse oder Kontostände zurückzusetzen. Auch der Online-Handler migriert eingelesene Runden. Laufende historische Gebote behalten ihre laufende Auktion; neue Auktionen beginnen mit dem ersten Interessenten.
- Bei unvollständiger Simulation aller Kandidaten gilt die gewichtete Tippbewertung für alle zulässigen Karten. Neu: Gleichstände werden reproduzierbar zufällig aufgelöst, statt die Reihenfolge der Hand zu bevorzugen.
- Beim Fehlfarbenwechsel mit unbekanntem Partner bleibt die konservative 60-%-Schwelle. Gemeint ist die geschätzte Wahrscheinlichkeit des Suchsau-Besitzes bei einem farbfreien, noch trumpffähigen Spieler, nicht die Wahrscheinlichkeit eines gewonnenen Stichs. Es gibt keine Einsicht in fremde Hände.
- Der Regelbuchdialog wurde beim UI-Test am oberen Bildschirmrand abgeschnitten. Er wird jetzt als Portal außerhalb des verschobenen Spieltisch-Containers angezeigt und bleibt vollständig scrollbar; im Vollbild wird der Vollbild-Container genutzt.

## Offene Punkte

Die sechs gebündelten Fragen stehen wörtlich im Abschnitt „Noch offene Details“ von `docs/klarstellungen-2026-10-05.md`: R6-Reichweite; Bedeutung/Kriterien des zweiten und weiteren Legens einschließlich Farbpaar; Hochzeit-Austausch/Trumpfzahl/Tarif; Bettel-/Hochzeit-Tout; Wenz-/Geier-Spritzzeit und Bezug auf Partei oder Person; Ramsch-Bruchteile und Rundung. Abhängige Funktionen sind ausdrücklich gekennzeichnet; Hochzeit bleibt deaktiviert.

## Zusätzliche erhaltene App-Regeln

- Sofortige Freigabe der zweiten Viererhand nach eigener Klopfentscheidung; jede positive Entscheidung verdoppelt.
- Rückfall-Vorrang Eichel-Ober vor Ramsch, sonst Neugeben; Jungfrau bekommt im Ramsch eine doppelte Gewinnzahlung.
- Bettel trumpflos mit null eigenen Stichen, Sie nur mit acht Ober/Unter.
- Laufenden-Minimum drei im Farbspiel, zwei im Wenz/Geier; Mindestzahlen und Geldtarife bleiben einstellbar.
- Suchsau-Abwurf ohne Davonlaufen standardmäßig ab Stich 7, einstellbar; Davonlaufen abschaltbar.
- Früherer Interessent darf gleiches Gebot halten; Online-Zugfrist 60 Sekunden, Hotseat-Erinnerung 30 Sekunden, Einzelspieler-Klopfen immer aktiv ohne Frist.
- Frühere zusätzliche Wenz-/Geier-Mindeststärke bleibt als alternative Ansagebedingung zu den neuen Zwei-Trumpf-Ausnahmen. Die zusätzliche Farbgeier-Bot-Ansagelogik bleibt erhalten.

## Prüfung und Grenzen

- 104 erfolgreiche Engine-, Bot-, Review-, Wissensgrenzen-, Migrations- und Online-Handler-Tests, darunter 18 neue Grenzfalltests.
- `verification/10000-games-refinements-2026-10-05.json`: 10.000 abgeschlossene Runden mit wechselnden Hausregeln, 320.000 Kartenzüge und 29.577 Suchiterationen. Null unerlaubte Engine-Züge und null Auswahlen außerhalb der R-Kandidaten. Karten, Augen und Nullsumme der Abrechnung werden in jeder Runde geprüft. Laufzeit 240,759 Sekunden. Bei diesem Lauf trat kein vorzeitig verlorener Tout auf; der Abbruch wird gesondert durch Szenariotests geprüft.
- Das Schnellprofil nutzt bewusst nur ein Legende-Rollout/1 ms und maximal vier Ansage-Verteilungen. Die Siegquoten 46,59/48,25/49,57/51,33/51,52 % belegen keine statistisch sichere Rangfolge Profi/Legende und sind kein Nachweis regulärer Spielstärke. Historische Berichte vom vorigen Stand bleiben separat erhalten.
- Der vollständige Client-/Party-TypeScript-/Vite-Build besteht. Gemeinsame neue Module und Regelbuch/Bot-Einstellungen bestehen ESLint. Der umfassende Schafkopf-Lint enthält weiterhin die bereits vorhandenen React-Hook-Verstöße in `SchafkopfGame.tsx` und `SchafkopfTable.tsx`.
- Browserprüfung: aktueller Regeltext, alle Originale, Hausregeln, neue Standards und praktisch umgeschaltete Laufendenwertung. `verification/einstellungen-2026-10-05.jpg` zeigt die neuen Schalter und Zeiten.
- Online-Code ist lokal am echten Edge-Handler mit gemockten Auth-/Datenbankgrenzen getestet. Er wurde nicht auf Supabase bereitgestellt. Für die Online-Nutzung ist ein Deployment der Funktion samt importierten Modulen erforderlich.
