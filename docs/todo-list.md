# ToDo List

Die App ist im Tools-Katalog unter `/tools/todo-list` verfügbar, einschließlich Favoriten, zuletzt besuchter Apps, Symbol und Landingpage-Demo. Sie übernimmt die Farben und Karten des Calorie Trackers.

## Aufgaben und Tastatur

ToDos haben Titel, Notizen, Priorität und optional ein Fälligkeitsdatum. Offene, erledigte und gelöschte Aufgaben lassen sich getrennt abrufen. Löschen verschiebt eine Aufgabe in den wiederherstellbaren Papierkorb. Jede Änderung speichert die vorherige Fassung; die Suche durchsucht auch frühere Titel und Notizen. Frühere Fassungen lassen sich wiederherstellen, wobei der bisherige Stand ebenfalls im Verlauf bleibt.

`N` öffnet die Eingabe, `/` die Suche. Innerhalb einer ausgewählten Aufgaben- oder Artikelzeile navigieren die Pfeiltasten, `E` öffnet die Bearbeitung, die Leertaste hakt ab und `Entf` löscht. `Esc` bricht die Eingabe ab; `Strg/⌘ + Enter` speichert ein Formular. Einzeltasten greifen nicht während der Texteingabe.

## Einkaufslisten und Verknüpfungen

Mehrere Listen können angelegt und umbenannt werden. Artikel lassen sich mit Menge und Einheit bearbeiten, abhaken und löschen; die letzte Artikellöschung ist rückgängig machbar. Das Löschen einer ganzen Liste verlangt eine Bestätigung und löscht keine Rechnungen.

Lokale Rezepte, ältere gespeicherte Mahlzeiten und zugängliche geteilte Rezepte des Calorie Trackers stehen zur Auswahl. Gewünschte Portionen bestimmen die Zutatenmenge. Nur gleiche offene Zutaten mit derselben Einheit werden zusammengeführt. Abgehakte Einkäufe bleiben als eigene Einträge erhalten. Die Rezeptquelle wird am Artikel angezeigt. Auch im Rezeptbuch gibt es direkt eine Aktion „Auf Einkaufsliste“.

Bestehende Bill-Splitter-Rechnungen können Listen zugeordnet werden. Die Rechnung bleibt die Quelle für den Betrag; Änderungen erscheinen dadurch auch in der Einkaufsliste. Summen werden nach Währung getrennt ausgewiesen. Beide Apps bieten Links zurück zur verbundenen Liste beziehungsweise Rechnung. Aus der Einkaufsliste kann die Erfassung einer neuen Rechnung mit vorausgewählter Liste gestartet werden. Unzugängliche oder gelöschte Rechnungen entfernen keine Listendaten; ihre Verknüpfung kann bewusst gelöst werden.

## Speicherung

Aufgaben, Verlauf, Einkaufslisten und Zuordnungen werden wie die persönlichen Daten der bestehenden Tools im Browser getrennt nach Gast und Konto gespeichert. Sie synchronisieren zwischen Tabs desselben Browsers, jedoch nicht zwischen Geräten oder Gruppenmitgliedern. Die geteilten Rechnungen bleiben im bestehenden Bill-Splitter-Backend. Für diese Erweiterung ist keine zusätzliche Datenbankmigration erforderlich.

Grenzen: 1.000 ToDos, 200 frühere Fassungen pro ToDo, 50 Einkaufslisten, 500 Artikel und 200 Rechnungszuordnungen pro Liste. Überschreitungen werden mit einer Fehlermeldung abgelehnt; frühere Fassungen werden nicht stillschweigend entfernt. Bei nicht verfügbarem Browser-Speicher weist die App auf eine Speicherung nur für die laufende Sitzung hin.

## Weitere Verbindungsmöglichkeiten

1. **ToDos → Day Planner:** Aufgaben mit einem Zeitfenster planen, bestehende Konfliktprüfung und Erinnerungen nutzen. Ein gemeinsamer Aufgabenstatus würde verhindern, dass eine Aufgabe zweimal abgehakt werden muss.
2. **Einkauf / Bill Splitter → Budget Tracker:** Einkaufsrechnungen als Budgetausgaben übernehmen. Dabei bewusst zwischen Gesamtbetrag, eigenem Anteil und tatsächlicher Zahlung wählen und doppelte Buchungen verhindern.
3. **Rezeptbuch → Wochenplanung:** Mahlzeiten im Day Planner planen und die Wochenzutaten auf einer Einkaufsliste bündeln. Bereits vorhandene Zutaten könnten von einem Vorratsbestand abgezogen werden.
4. **Workout-Routinen → Day Planner:** Wiederkehrende Trainingszeiten planen und den Workout Timer direkt aus einem Termin starten. Abgeschlossene Einheiten könnten einen Trainingsverlauf füllen.
5. **Geburtstage → ToDos / Einkaufslisten:** Optional Geschenk- und Vorbereitungstodos erzeugen, eine passende Einkaufsliste verknüpfen und Gruppenausgaben im Bill Splitter aufteilen.
6. **Gemeinsame Einkaufslisten:** Nach einer bewussten Freigabe an dieselbe Pluto-Gruppe auch Artikel und Zuordnungen synchronisieren. Dafür wären ein eigenes Backend-Datenmodell, Zugriffsregeln und Konfliktbehandlung erforderlich.

## Prüfung

- 28 Daten- und Regressionstests in `todo-tools.test.mjs`, `life-tools.test.mjs` und `final-tools.test.mjs` bestehen.
- Der gezielte Tools-TypeScript-Check und ESLint für die neuen Komponenten bestehen.
- Im Browser geprüft: Anlegen mit Enter; Bearbeiten mit Strg/⌘ + Enter; Abhaken mit Leertaste; Verlauf; Papierkorb und Wiederherstellung; Neuladen; Mengenbearbeitung; mehrere Listen und Umbenennen; Rezeptimport aus beiden Apps und Zusammenführen der Zutaten.
- Mit einem lokalen QA-Gruppenbuch geprüft: bestehende Rechnung zuordnen; in beide Richtungen navigieren; Betrag von 24 auf 30 Euro ändern; automatische Aktualisierung der Einkaufssumme; weitere Rechnung aus der Liste heraus erfassen und zuordnen.
- Desktop und 390-Pixel-Prüfrahmen: keine horizontale Überbreite der ToDo-App. Die 390-Pixel-Ansicht wird in einem echten Iframe-Viewport geprüft, da die Browser-Größensteuerung im verfügbaren In-App-Browser keine Änderung bewirkte.
- Der Gesamtbuild war während der Prüfung durch parallele Spieleseiten-Änderungen blockiert, die auf die noch fehlende Datei `src/i18n/gameUi` verweisen. Ein älterer Katalogtest verweist weiterhin auf die entfernte App `recipe-scaler`. Diese Änderungen wurden nicht angefasst.

Isolierte UI-Prüfung mit laufendem Vite-Server: `/tests/todo-preview.html` und `/tests/todo-mobile-preview.html`. Die separate Testseite nutzt die echten Tools, einen Gastkontext und ein lokales QA-Gruppenbuch ohne Backend-Schreibzugriffe. Die Testseiten gehören nicht zum Produktions-Build.
