# Schafkopf-Audit

`node scripts/audit-schafkopf.mjs --games 100000 --workers 8 --seed 20261005 --output artifacts/schafkopf-audit-100000-2026-10-05`

Ein Anfänger, Amateur, Profi und Legende spielen an jedem Tisch. Alle 24 Sitzkombinationen und vier Geberpositionen wechseln in 96-Verteilungen-Blöcken. Die Zahl bezeichnet **verschiedene Verteilungen**, einschließlich viermal Weiter; es werden keine zusätzlichen Verteilungen untergeschoben. Jede abgeschlossene Partie wird getrennt abgerechnet, anschließend entsteht das fortlaufende Kontobuch je Stufe in Spiel-ID-Reihenfolge.

Standardregeln und Standardbudgets werden aus dem aktuellen Arbeitsstand eingefroren. Anwendungsdateien werden nicht verändert. Die Runtime hat ausschließlich lesende Beobachtungspunkte für Tippkarten, Simulationen und intern abgefangene Fehler. Ein Regressionstest prüft, dass diese Beobachtung mit derselben Zufallsfolge dieselben Entscheidungen liefert. Wegen des bestehenden Zeitlimits hängen Suchentscheidungen trotzdem von der Systemlast ab. **Die gespeicherten Aktionen reproduzieren die konkrete Partie**, ein Seed allein garantiert bei zeitbegrenzter Suche keine identischen Entscheidungen.

## Sicherheit der Ergebnisse

- Jede echte Karte wird auf Engine-Legalität und Zugehörigkeit zu den tatsächlich ermittelten R-Kandidaten geprüft.
- Alle Karten, Augen, Stichsummen und Kontobuchungen werden geprüft; Stichgewinner und Standardabrechnung werden zusätzlich unabhängig berechnet.
- Der Bot bekommt nur seine redigierte Spieleransicht. Reviews verwenden eine andere Zufallsfolge. Fremde Hände erreichen ausschließlich die getrennte nachträgliche Prüfung.
- Die exakte Endspielprüfung untersucht **alle legalen Karten**, auch von R-Regeln ausgeschlossene, in den letzten zwei Stichen. Sie optimiert den endgültigen Cent-Saldo für die Partie mit vollständigem Kartenwissen und optimalen Parteifortsetzungen.
- Jede Tippabweichung, verlorene Tipp-Anwendung, alternative Pro-Review-Karte, kleine/abgebrochene Simulation, verlorene Ansage/Spritze und rückblickend bessere Karte wird mit ID und nullbasiertem Zugindex gespeichert. Diese Kategorien unterscheiden Prüfanlässe, erwarteten Stufenzufall und belegte rückblickende Unterschiede.
- Ein Tippcode kann in einem Zug mehrere Varianten mit verschiedenen Karten treffen. Die Tippstatistik zählt einzelne Varianten, nicht ausschließlich eindeutige Züge.

## Auswertung und Wiederholung

```sh
node scripts/read-schafkopf-audit.mjs --run artifacts/schafkopf-audit-100000-2026-10-05 --game 337 --replay --output /tmp/spiel-337.json
node scripts/schafkopf-audit/review.mjs --run artifacts/schafkopf-audit-100000-2026-10-05
node scripts/schafkopf-audit/probability.mjs --run artifacts/schafkopf-audit-100000-2026-10-05 --follow
```

`review/Einzelspiele.jsonl.gz` enthält sämtliche Einzelspiele samt Händen, Absichten, Geboten, Ansageprüfung, Simulationsschätzungen, allen Stichen und Ergebnis. `review/Spritzen.jsonl.gz` enthält jede ausgeführte Kontra/Re/Sub/Hirsch-Spritze mit damaliger Hand, auslösender Entscheidung, Ergebnis und allen Stichen. Auch nicht angenommene Spritzgelegenheiten bleiben in den ungekürzten Spielprotokollen erhalten. `review/FEEDBACK.md` nennt repräsentative Fälle; `review/Prueffaelle.jsonl.gz` enthält alle Prüfanlässe. Die Originalprotokolle `games/` und `findings/` bleiben vollständig erhalten.

Die Wahrscheinlichkeitsprüfung zählt für auffällige Endspielentscheidungen alle mit eigener Hand, öffentlichen Karten, damaliger Kartenlegalität, Handgrößen, gerufenem Partner und Spritzparteien vereinbaren verdeckten Verteilungen auf. Jede wird gleich gewichtet. Sie vergleicht Karten mit vollständigem Wissen in den Fortsetzungen und ist **kein gemessener Siegquotenvergleich echter Bots**. Diese Modellgrenze steht auch in den Ergebnisdateien. Ein realer Bot kann die je Verteilung optimale Zukunftsstrategie nicht immer unterscheiden.

`--smoke` reduziert ausschließlich im Vorlauf Suchbudgets. Solche Berichte sind ausdrücklich als `smoke-reduced-search-NOT-standard` markiert. `--resume` nutzt unveränderte Quellen aus dem bisherigen Lauf, prüft Dateihashes und überspringt abgeschlossene Blöcke. Angefangene `.partial`-Blöcke werden vollständig wiederholt; sie fließen nicht doppelt in die Wertung ein. Änderungen an Regeln oder Seed benötigen einen neuen Ausgabepfad.

Bei frühen Archivständen haben einzelne Funde noch ihren Telemetrietyp `searchFailure`/`contractEstimate`; `review.mjs` normalisiert diese als `simulation-failure`/`announcement-or-spritz-small-sample` und erhält den ursprünglichen Typ unter `eventType`.

Feedback: **Spiel-ID, Zugindex, gewünschte Karte/Ansage/Spritze und konkrete Begründung**. Die Spielstrategie des Ausgangsstands wird während eines Laufs nicht korrigiert; Feedback gehört in einen anschließenden getrennten Vergleichslauf.
