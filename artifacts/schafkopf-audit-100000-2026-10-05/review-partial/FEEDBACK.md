# Konkrete Prüffälle – Zwischenstand

Ausgewertet: 2.000 Verteilungen, 1.862 abgeschlossene Spiele. **427 Einzelspiele** stehen vollständig in Einzelspiele.jsonl.gz, **83 Spritzen** in Spritzen.jsonl.gz. Alle Entscheidungen einschließlich abgelehnter Spritzgelegenheiten stehen in games/.

| Stufe | exakt geprüfte Endspielentscheidungen | im Rückblick bessere Karte | R-Regel schließt beste Karte aus |
|---|---:|---:|---:|
| Anfänger | 1.406 | 54 | 8 |
| Amateur | 1.437 | 59 | 14 |
| Profi | 1.420 | 63 | 12 |
| Legende | 1.453 | 17 | 12 |

Diese Befunde nutzen vollständiges Kartenwissen. Sie beweisen keine damals erkennbare Fehlentscheidung. Die Summe der Cent-Abstände ist kein erwartbarer Gewinn eines neuen Bots; mehrere Befunde können dieselbe Partie betreffen. Die Tabelle beschränkt sich auf Entscheidungssituationen mit mehreren legalen Karten in den letzten zwei Stichen.

Tipp-Auswertung in Auswertung.json zählt einzelne Tippvarianten; derselbe Tippcode kann in einem Zug mehrfach mit verschiedenen empfohlenen Karten vorkommen. „exactInferior“ vergleicht jeweils die beste Tippkarte mit der besten übrigen R-Karte für die tatsächliche Verteilung.

Simulationen, die abbrechen, stehen mit Ursache in Auswertung.json. Prueffaelle.jsonl.gz enthält sämtliche Prüfanlässe außer absichtlich erwarteten Anfänger-Abweichungen und reinen Indexeinträgen. Die ungekürzten Originalfunde bleiben in findings/.

Feedback bitte als **Spiel-ID, nullbasierter Zugindex, gewünschte Karte/Ansage/Spritze und Begründung**.

## Beispiele

### Spiel 1, Zugindex 7: card:no-compatible-hands:

- Stufe: Legende; Sitz 3; {"kind":"rufspiel","suit":"Eichel"}.
- Hand damals: Gras-Ass, Eichel-7, Gras-Unter, Gras-10, Eichel-8, Schellen-10, Schellen-8, Herz-10.
- Gespielt: Gras-Unter; Begründung: SIMULATION.
- R-Kandidaten: Gras-Unter, Herz-10.
- Befund: {"id":1,"step":7,"type":"simulation-failure","severity":"unexpected","stage":"card","reason":"no-compatible-hands","iterations":8,"rngState":1178890542,"eventType":"searchFailure"}.
- Vollständiger Fall: [Fall-1-7-0.json](Fall-1-7-0.json).


### Spiel 1920, Zugindex 36: hindsight-better-card:beginner:

- Stufe: Anfänger; Sitz 3; {"kind":"solo","suit":"Gras","tout":false}.
- Hand damals: Eichel-König, Eichel-Ass.
- Gespielt: Eichel-Ass; Begründung: RANDOM.
- R-Kandidaten: Eichel-König, Eichel-Ass.
- Befund: {"id":1920,"step":36,"type":"hindsight-better-card","severity":"hindsight","chosenDelta":-60,"bestDelta":60,"bestCards":["Eichel-König"],"gapCent":120,"withinRCandidates":true}.
- Vollständiger Fall: [Fall-1920-36-1.json](Fall-1920-36-1.json).


### Spiel 191, Zugindex 38: hindsight-better-card:pro:

- Stufe: Profi; Sitz 1; {"kind":"farbwenz","suit":"Gras","tout":false}.
- Hand damals: Herz-10, Eichel-Ass.
- Gespielt: Herz-10; Begründung: RANDOM.
- R-Kandidaten: Herz-10, Eichel-Ass.
- Befund: {"id":191,"step":38,"type":"hindsight-better-card","severity":"hindsight","chosenDelta":-90,"bestDelta":90,"bestCards":["Eichel-Ass"],"gapCent":180,"withinRCandidates":true}.
- Vollständiger Fall: [Fall-191-38-2.json](Fall-191-38-2.json).


### Spiel 26, Zugindex 38: hindsight-tip-inferior:beginner:T5

- Stufe: Anfänger; Sitz 0; {"kind":"rufspiel","suit":"Eichel"}.
- Hand damals: Eichel-9, Gras-10.
- Gespielt: Gras-10; Begründung: RANDOM.
- R-Kandidaten: Eichel-9, Gras-10.
- Befund: {"id":26,"step":38,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T5","recommended":["Eichel-9"],"alternatives":[{"card":"Eichel-9","delta":-20},{"card":"Gras-10","delta":-10}]}.
- Vollständiger Fall: [Fall-26-38-3.json](Fall-26-38-3.json).


### Spiel 1398, Zugindex 38: hindsight-better-card:legend:

- Stufe: Legende; Sitz 1; {"kind":"farbwenz","suit":"Eichel","tout":false}.
- Hand damals: Gras-Unter, Herz-10.
- Gespielt: Gras-Unter; Begründung: R1.
- R-Kandidaten: Gras-Unter.
- Befund: {"id":1398,"step":38,"type":"hindsight-better-card","severity":"hindsight","chosenDelta":-90,"bestDelta":90,"bestCards":["Herz-10"],"gapCent":180,"withinRCandidates":false}.
- Vollständiger Fall: [Fall-1398-38-4.json](Fall-1398-38-4.json).


### Spiel 36, Zugindex 38: hindsight-rule-excludes-best:legend:R4

- Stufe: Legende; Sitz 1; {"kind":"rufspiel","suit":"Gras"}.
- Hand damals: Eichel-Unter, Herz-7.
- Gespielt: Herz-7; Begründung: R4.
- R-Kandidaten: Herz-7.
- Befund: {"id":36,"step":38,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["R4"],"candidates":["Herz-7"],"alternatives":[{"card":"Eichel-Unter","delta":10},{"card":"Herz-7","delta":-10}],"gapCent":20}.
- Vollständiger Fall: [Fall-36-38-5.json](Fall-36-38-5.json).


### Spiel 37, Zugindex 8: contract:no-compatible-hands:

- Stufe: Legende; Sitz 3; {"kind":"rufspiel","suit":"Gras"}.
- Hand damals: Herz-Ober, Schellen-8, Gras-Unter, Schellen-Ober, Herz-König, Gras-9, Gras-König, Herz-Unter.
- Gespielt: Gras-Unter; Begründung: SIMULATION.
- R-Kandidaten: Herz-Ober, Gras-Unter, Schellen-Ober, Herz-König, Herz-Unter.
- Befund: {"id":37,"step":8,"type":"simulation-failure","severity":"unexpected","stage":"contract","contract":{"kind":"rufspiel","suit":"Gras"},"reason":"no-compatible-hands","iteration":1,"rngState":1343520168,"eventType":"searchFailure"}.
- Vollständiger Fall: [Fall-37-8-6.json](Fall-37-8-6.json).


### Spiel 39, Zugindex 37: hindsight-rule-excludes-best:pro:R3

- Stufe: Profi; Sitz 0; {"kind":"rufspiel","suit":"Schellen"}.
- Hand damals: Eichel-8, Schellen-10.
- Gespielt: Schellen-10; Begründung: R3.
- R-Kandidaten: Schellen-10.
- Befund: {"id":39,"step":37,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["R3"],"candidates":["Schellen-10"],"alternatives":[{"card":"Eichel-8","delta":-40},{"card":"Schellen-10","delta":-50}],"gapCent":10}.
- Vollständiger Fall: [Fall-39-37-7.json](Fall-39-37-7.json).


### Spiel 51, Zugindex 35: hindsight-tip-inferior:pro:T12

- Stufe: Profi; Sitz 1; {"kind":"solo","suit":"Gras","tout":false}.
- Hand damals: Gras-Ober, Schellen-Unter.
- Gespielt: Schellen-Unter; Begründung: T12.
- R-Kandidaten: Gras-Ober, Schellen-Unter.
- Befund: {"id":51,"step":35,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T12","recommended":["Schellen-Unter"],"alternatives":[{"card":"Gras-Ober","delta":210},{"card":"Schellen-Unter","delta":180}]}.
- Vollständiger Fall: [Fall-51-35-8.json](Fall-51-35-8.json).


### Spiel 521, Zugindex 37: hindsight-better-card:amateur:

- Stufe: Amateur; Sitz 3; {"kind":"solo","suit":"Eichel","tout":false}.
- Hand damals: Gras-Ober, Herz-Ass.
- Gespielt: Gras-Ober; Begründung: R1.
- R-Kandidaten: Gras-Ober.
- Befund: {"id":521,"step":37,"type":"hindsight-better-card","severity":"hindsight","chosenDelta":-90,"bestDelta":90,"bestCards":["Herz-Ass"],"gapCent":180,"withinRCandidates":false}.
- Vollständiger Fall: [Fall-521-37-9.json](Fall-521-37-9.json).


### Spiel 54, Zugindex 40: hindsight-tip-inferior:pro:T8

- Stufe: Profi; Sitz 2; {"kind":"rufspiel","suit":"Schellen"}.
- Hand damals: Herz-Unter, Herz-10.
- Gespielt: Herz-10; Begründung: T7.
- R-Kandidaten: Herz-Unter, Herz-10.
- Befund: {"id":54,"step":40,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T8","recommended":["Herz-Unter"],"alternatives":[{"card":"Herz-Unter","delta":10},{"card":"Herz-10","delta":20}]}.
- Vollständiger Fall: [Fall-54-40-10.json](Fall-54-40-10.json).


### Spiel 63, Zugindex 36: hindsight-tip-inferior:legend:T5

- Stufe: Legende; Sitz 3; {"kind":"solo","suit":"Eichel","tout":false}.
- Hand damals: Gras-8, Eichel-Ass.
- Gespielt: Eichel-Ass; Begründung: SIMULATION.
- R-Kandidaten: Eichel-Ass, Gras-8.
- Befund: {"id":63,"step":36,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T5","recommended":["Gras-8"],"alternatives":[{"card":"Gras-8","delta":-90},{"card":"Eichel-Ass","delta":90}]}.
- Vollständiger Fall: [Fall-63-36-11.json](Fall-63-36-11.json).


### Spiel 65, Zugindex 40: hindsight-tip-inferior:amateur:T5

- Stufe: Amateur; Sitz 3; {"kind":"rufspiel","suit":"Eichel"}.
- Hand damals: Schellen-7, Schellen-10.
- Gespielt: Schellen-7; Begründung: RANDOM.
- R-Kandidaten: Schellen-7, Schellen-10.
- Befund: {"id":65,"step":40,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T5","recommended":["Schellen-7"],"alternatives":[{"card":"Schellen-7","delta":-20},{"card":"Schellen-10","delta":20}]}.
- Vollständiger Fall: [Fall-65-40-12.json](Fall-65-40-12.json).


### Spiel 1398, Zugindex 38: hindsight-rule-excludes-best:legend:R1

- Stufe: Legende; Sitz 1; {"kind":"farbwenz","suit":"Eichel","tout":false}.
- Hand damals: Gras-Unter, Herz-10.
- Gespielt: Gras-Unter; Begründung: R1.
- R-Kandidaten: Gras-Unter.
- Befund: {"id":1398,"step":38,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["R1"],"candidates":["Gras-Unter"],"alternatives":[{"card":"Gras-Unter","delta":-90},{"card":"Herz-10","delta":90}],"gapCent":180}.
- Vollständiger Fall: [Fall-1398-38-13.json](Fall-1398-38-13.json).


### Spiel 90, Zugindex 40: hindsight-rule-excludes-best:pro:R2

- Stufe: Profi; Sitz 0; {"kind":"rufspiel","suit":"Schellen"}.
- Hand damals: Gras-7, Eichel-Ober.
- Gespielt: Eichel-Ober; Begründung: R2.
- R-Kandidaten: Eichel-Ober.
- Befund: {"id":90,"step":40,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["R2"],"candidates":["Eichel-Ober"],"alternatives":[{"card":"Gras-7","delta":10},{"card":"Eichel-Ober","delta":-10}],"gapCent":20}.
- Vollständiger Fall: [Fall-90-40-14.json](Fall-90-40-14.json).


### Spiel 91, Zugindex 35: hindsight-tip-inferior:amateur:T4

- Stufe: Amateur; Sitz 2; {"kind":"rufspiel","suit":"Eichel"}.
- Hand damals: Eichel-9, Eichel-König.
- Gespielt: Eichel-König; Begründung: RANDOM.
- R-Kandidaten: Eichel-9, Eichel-König.
- Befund: {"id":91,"step":35,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T4","recommended":["Eichel-König"],"alternatives":[{"card":"Eichel-9","delta":-50},{"card":"Eichel-König","delta":-60}]}.
- Vollständiger Fall: [Fall-91-35-15.json](Fall-91-35-15.json).


### Spiel 133, Zugindex 39: hindsight-tip-inferior:pro:T3b

- Stufe: Profi; Sitz 0; {"kind":"rufspiel","suit":"Eichel"}.
- Hand damals: Herz-König, Herz-8.
- Gespielt: Herz-8; Begründung: T3b.
- R-Kandidaten: Herz-König, Herz-8.
- Befund: {"id":133,"step":39,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T3b","recommended":["Herz-8"],"alternatives":[{"card":"Herz-König","delta":-20},{"card":"Herz-8","delta":-40}]}.
- Vollständiger Fall: [Fall-133-39-16.json](Fall-133-39-16.json).


### Spiel 156, Zugindex 39: hindsight-tip-inferior:pro:T5

- Stufe: Profi; Sitz 2; {"kind":"solo","suit":"Eichel","tout":false}.
- Hand damals: Schellen-Ass, Schellen-9.
- Gespielt: Schellen-Ass; Begründung: T7.
- R-Kandidaten: Schellen-Ass, Schellen-9.
- Befund: {"id":156,"step":39,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T5","recommended":["Schellen-9"],"alternatives":[{"card":"Schellen-Ass","delta":-30},{"card":"Schellen-9","delta":-40}]}.
- Vollständiger Fall: [Fall-156-39-17.json](Fall-156-39-17.json).


### Spiel 317, Zugindex 40: hindsight-rule-excludes-best:pro:R4+R2

- Stufe: Profi; Sitz 3; {"kind":"rufspiel","suit":"Eichel"}.
- Hand damals: Schellen-König, Herz-Ass.
- Gespielt: Herz-Ass; Begründung: R2.
- R-Kandidaten: Herz-Ass.
- Befund: {"id":317,"step":40,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["R4","R2"],"candidates":["Herz-Ass"],"alternatives":[{"card":"Schellen-König","delta":10},{"card":"Herz-Ass","delta":-10}],"gapCent":20}.
- Vollständiger Fall: [Fall-317-40-18.json](Fall-317-40-18.json).


### Spiel 191, Zugindex 40: hindsight-rule-excludes-best:amateur:R5

- Stufe: Amateur; Sitz 3; {"kind":"farbwenz","suit":"Gras","tout":false}.
- Hand damals: Gras-Ass, Eichel-9.
- Gespielt: Gras-Ass; Begründung: R5.
- R-Kandidaten: Gras-Ass.
- Befund: {"id":191,"step":40,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["R5"],"candidates":["Gras-Ass"],"alternatives":[{"card":"Gras-Ass","delta":-30},{"card":"Eichel-9","delta":30}],"gapCent":60}.
- Vollständiger Fall: [Fall-191-40-19.json](Fall-191-40-19.json).


### Spiel 203, Zugindex 40: hindsight-rule-excludes-best:amateur:R4+R2

- Stufe: Amateur; Sitz 0; {"kind":"rufspiel","suit":"Gras"}.
- Hand damals: Gras-7, Gras-Ass.
- Gespielt: Gras-Ass; Begründung: R2.
- R-Kandidaten: Gras-Ass.
- Befund: {"id":203,"step":40,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["R4","R2"],"candidates":["Gras-Ass"],"alternatives":[{"card":"Gras-7","delta":50},{"card":"Gras-Ass","delta":40}],"gapCent":10}.
- Vollständiger Fall: [Fall-203-40-20.json](Fall-203-40-20.json).


### Spiel 521, Zugindex 37: hindsight-rule-excludes-best:amateur:R1

- Stufe: Amateur; Sitz 3; {"kind":"solo","suit":"Eichel","tout":false}.
- Hand damals: Gras-Ober, Herz-Ass.
- Gespielt: Gras-Ober; Begründung: R1.
- R-Kandidaten: Gras-Ober.
- Befund: {"id":521,"step":37,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["R1"],"candidates":["Gras-Ober"],"alternatives":[{"card":"Gras-Ober","delta":-90},{"card":"Herz-Ass","delta":90}],"gapCent":180}.
- Vollständiger Fall: [Fall-521-37-21.json](Fall-521-37-21.json).


### Spiel 274, Zugindex 37: hindsight-rule-excludes-best:beginner:R1

- Stufe: Anfänger; Sitz 3; {"kind":"rufspiel","suit":"Eichel"}.
- Hand damals: Eichel-10, Gras-Unter.
- Gespielt: Gras-Unter; Begründung: R1.
- R-Kandidaten: Gras-Unter.
- Befund: {"id":274,"step":37,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["R1"],"candidates":["Gras-Unter"],"alternatives":[{"card":"Eichel-10","delta":10},{"card":"Gras-Unter","delta":-10}],"gapCent":20}.
- Vollständiger Fall: [Fall-274-37-22.json](Fall-274-37-22.json).


### Spiel 913, Zugindex 40: hindsight-rule-excludes-best:beginner:R2

- Stufe: Anfänger; Sitz 0; {"kind":"rufspiel","suit":"Gras"}.
- Hand damals: Eichel-Unter, Eichel-8.
- Gespielt: Eichel-Unter; Begründung: R2.
- R-Kandidaten: Eichel-Unter.
- Befund: {"id":913,"step":40,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["R2"],"candidates":["Eichel-Unter"],"alternatives":[{"card":"Eichel-Unter","delta":-10},{"card":"Eichel-8","delta":10}],"gapCent":20}.
- Vollständiger Fall: [Fall-913-40-23.json](Fall-913-40-23.json).


### Spiel 387, Zugindex 38: hindsight-tip-inferior:pro:T10

- Stufe: Profi; Sitz 1; {"kind":"rufspiel","suit":"Schellen"}.
- Hand damals: Gras-8, Herz-7.
- Gespielt: Herz-7; Begründung: T10.
- R-Kandidaten: Herz-7, Gras-8.
- Befund: {"id":387,"step":38,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T10","recommended":["Herz-7"],"alternatives":[{"card":"Gras-8","delta":10},{"card":"Herz-7","delta":-10}]}.
- Vollständiger Fall: [Fall-387-38-24.json](Fall-387-38-24.json).


### Spiel 424, Zugindex 39: hindsight-tip-inferior:amateur:T1

- Stufe: Amateur; Sitz 1; {"kind":"rufspiel","suit":"Gras"}.
- Hand damals: Schellen-Unter, Herz-9.
- Gespielt: Herz-9; Begründung: RANDOM.
- R-Kandidaten: Schellen-Unter, Herz-9.
- Befund: {"id":424,"step":39,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T1","recommended":["Schellen-Unter"],"alternatives":[{"card":"Schellen-Unter","delta":10},{"card":"Herz-9","delta":20}]}.
- Vollständiger Fall: [Fall-424-39-25.json](Fall-424-39-25.json).


### Spiel 483, Zugindex 36: hindsight-rule-excludes-best:beginner:R5

- Stufe: Anfänger; Sitz 0; {"kind":"rufspiel","suit":"Eichel"}.
- Hand damals: Gras-König, Herz-8.
- Gespielt: Herz-8; Begründung: R5.
- R-Kandidaten: Herz-8.
- Befund: {"id":483,"step":36,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["R5"],"candidates":["Herz-8"],"alternatives":[{"card":"Gras-König","delta":40},{"card":"Herz-8","delta":-40}],"gapCent":80}.
- Vollständiger Fall: [Fall-483-36-26.json](Fall-483-36-26.json).


### Spiel 494, Zugindex 40: hindsight-rule-excludes-best:legend:R5

- Stufe: Legende; Sitz 2; {"kind":"rufspiel","suit":"Eichel"}.
- Hand damals: Eichel-Unter, Schellen-9.
- Gespielt: Eichel-Unter; Begründung: R5.
- R-Kandidaten: Eichel-Unter.
- Befund: {"id":494,"step":40,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["R5"],"candidates":["Eichel-Unter"],"alternatives":[{"card":"Eichel-Unter","delta":-20},{"card":"Schellen-9","delta":-10}],"gapCent":10}.
- Vollständiger Fall: [Fall-494-40-27.json](Fall-494-40-27.json).


### Spiel 500, Zugindex 38: hindsight-tip-inferior:pro:T2

- Stufe: Profi; Sitz 2; {"kind":"rufspiel","suit":"Eichel"}.
- Hand damals: Gras-Ober, Schellen-Unter.
- Gespielt: Gras-Ober; Begründung: T2.
- R-Kandidaten: Gras-Ober, Schellen-Unter.
- Befund: {"id":500,"step":38,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T2","recommended":["Gras-Ober"],"alternatives":[{"card":"Gras-Ober","delta":-20},{"card":"Schellen-Unter","delta":-10}]}.
- Vollständiger Fall: [Fall-500-38-28.json](Fall-500-38-28.json).


### Spiel 624, Zugindex 36: hindsight-tip-inferior:legend:T8

- Stufe: Legende; Sitz 0; {"kind":"rufspiel","suit":"Eichel"}.
- Hand damals: Schellen-8, Schellen-Ass.
- Gespielt: Schellen-Ass; Begründung: SIMULATION.
- R-Kandidaten: Schellen-8, Schellen-Ass.
- Befund: {"id":624,"step":36,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T8","recommended":["Schellen-8"],"alternatives":[{"card":"Schellen-8","delta":50},{"card":"Schellen-Ass","delta":60}]}.
- Vollständiger Fall: [Fall-624-36-29.json](Fall-624-36-29.json).


### Spiel 741, Zugindex 35: hindsight-rule-excludes-best:legend:T9

- Stufe: Legende; Sitz 0; {"kind":"rufspiel","suit":"Gras"}.
- Hand damals: Schellen-8, Gras-10.
- Gespielt: Schellen-8; Begründung: T9.
- R-Kandidaten: Schellen-8.
- Befund: {"id":741,"step":35,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["T9"],"candidates":["Schellen-8"],"alternatives":[{"card":"Schellen-8","delta":-10},{"card":"Gras-10","delta":10}],"gapCent":20}.
- Vollständiger Fall: [Fall-741-35-30.json](Fall-741-35-30.json).


### Spiel 759, Zugindex 37: hindsight-tip-inferior:pro:T7

- Stufe: Profi; Sitz 0; {"kind":"rufspiel","suit":"Eichel"}.
- Hand damals: Gras-Unter, Gras-Ober.
- Gespielt: Gras-Ober; Begründung: T7.
- R-Kandidaten: Gras-Unter, Gras-Ober.
- Befund: {"id":759,"step":37,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T7","recommended":["Gras-Ober"],"alternatives":[{"card":"Gras-Unter","delta":10},{"card":"Gras-Ober","delta":-10}]}.
- Vollständiger Fall: [Fall-759-37-31.json](Fall-759-37-31.json).


### Spiel 821, Zugindex 37: hindsight-tip-inferior:legend:T12

- Stufe: Legende; Sitz 1; {"kind":"rufspiel","suit":"Schellen"}.
- Hand damals: Herz-Ober, Herz-7.
- Gespielt: Herz-7; Begründung: SIMULATION.
- R-Kandidaten: Herz-Ober, Herz-7.
- Befund: {"id":821,"step":37,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T12","recommended":["Herz-7"],"alternatives":[{"card":"Herz-Ober","delta":20},{"card":"Herz-7","delta":10}]}.
- Vollständiger Fall: [Fall-821-37-32.json](Fall-821-37-32.json).


### Spiel 830, Zugindex 39: hindsight-tip-inferior:amateur:T7

- Stufe: Amateur; Sitz 3; {"kind":"rufspiel","suit":"Schellen"}.
- Hand damals: Herz-10, Eichel-Unter.
- Gespielt: Eichel-Unter; Begründung: RANDOM.
- R-Kandidaten: Herz-10, Eichel-Unter.
- Befund: {"id":830,"step":39,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T7","recommended":["Eichel-Unter"],"alternatives":[{"card":"Herz-10","delta":-100},{"card":"Eichel-Unter","delta":-120}]}.
- Vollständiger Fall: [Fall-830-39-33.json](Fall-830-39-33.json).


### Spiel 831, Zugindex 36: hindsight-tip-inferior:legend:T10

- Stufe: Legende; Sitz 3; {"kind":"rufspiel","suit":"Schellen"}.
- Hand damals: Herz-10, Gras-König.
- Gespielt: Gras-König; Begründung: SIMULATION.
- R-Kandidaten: Herz-10, Gras-König.
- Befund: {"id":831,"step":36,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T10","recommended":["Herz-10"],"alternatives":[{"card":"Herz-10","delta":-10},{"card":"Gras-König","delta":10}]}.
- Vollständiger Fall: [Fall-831-36-34.json](Fall-831-36-34.json).


### Spiel 1020, Zugindex 39: hindsight-rule-excludes-best:pro:R5+R5

- Stufe: Profi; Sitz 2; {"kind":"rufspiel","suit":"Eichel"}.
- Hand damals: Herz-Ass, Eichel-9.
- Gespielt: Herz-Ass; Begründung: R5.
- R-Kandidaten: Herz-Ass.
- Befund: {"id":1020,"step":39,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["R5","R5"],"candidates":["Herz-Ass"],"alternatives":[{"card":"Herz-Ass","delta":-20},{"card":"Eichel-9","delta":-10}],"gapCent":10}.
- Vollständiger Fall: [Fall-1020-39-35.json](Fall-1020-39-35.json).


### Spiel 1084, Zugindex 39: hindsight-tip-inferior:legend:T6

- Stufe: Legende; Sitz 2; {"kind":"rufspiel","suit":"Schellen"}.
- Hand damals: Eichel-9, Eichel-Ass.
- Gespielt: Eichel-9; Begründung: SIMULATION.
- R-Kandidaten: Eichel-9, Eichel-Ass.
- Befund: {"id":1084,"step":39,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T6","recommended":["Eichel-Ass"],"alternatives":[{"card":"Eichel-9","delta":10},{"card":"Eichel-Ass","delta":-10}]}.
- Vollständiger Fall: [Fall-1084-39-36.json](Fall-1084-39-36.json).


### Spiel 1085, Zugindex 40: hindsight-rule-excludes-best:legend:R2

- Stufe: Legende; Sitz 1; {"kind":"solo","suit":"Herz","tout":false}.
- Hand damals: Schellen-Ass, Schellen-8.
- Gespielt: Schellen-Ass; Begründung: R2.
- R-Kandidaten: Schellen-Ass.
- Befund: {"id":1085,"step":40,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["R2"],"candidates":["Schellen-Ass"],"alternatives":[{"card":"Schellen-Ass","delta":-30},{"card":"Schellen-8","delta":30}],"gapCent":60}.
- Vollständiger Fall: [Fall-1085-40-37.json](Fall-1085-40-37.json).


### Spiel 1091, Zugindex 39: hindsight-tip-inferior:legend:T3b

- Stufe: Legende; Sitz 1; {"kind":"rufspiel","suit":"Gras"}.
- Hand damals: Eichel-Ober, Herz-Ass.
- Gespielt: Eichel-Ober; Begründung: SIMULATION.
- R-Kandidaten: Eichel-Ober, Herz-Ass.
- Befund: {"id":1091,"step":39,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T3b","recommended":["Herz-Ass"],"alternatives":[{"card":"Eichel-Ober","delta":10},{"card":"Herz-Ass","delta":-10}]}.
- Vollständiger Fall: [Fall-1091-39-38.json](Fall-1091-39-38.json).


### Spiel 1097, Zugindex 35: hindsight-rule-excludes-best:legend:R3

- Stufe: Legende; Sitz 1; {"kind":"rufspiel","suit":"Eichel"}.
- Hand damals: Gras-König, Eichel-9.
- Gespielt: Eichel-9; Begründung: R3.
- R-Kandidaten: Eichel-9.
- Befund: {"id":1097,"step":35,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["R3"],"candidates":["Eichel-9"],"alternatives":[{"card":"Gras-König","delta":-40},{"card":"Eichel-9","delta":-50}],"gapCent":10}.
- Vollständiger Fall: [Fall-1097-35-39.json](Fall-1097-35-39.json).


### Spiel 1121, Zugindex 37: hindsight-tip-inferior:amateur:T3b

- Stufe: Amateur; Sitz 3; {"kind":"solo","suit":"Gras","tout":false}.
- Hand damals: Herz-Unter, Gras-8.
- Gespielt: Herz-Unter; Begründung: T7.
- R-Kandidaten: Herz-Unter, Gras-8.
- Befund: {"id":1121,"step":37,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T3b","recommended":["Gras-8"],"alternatives":[{"card":"Herz-Unter","delta":30},{"card":"Gras-8","delta":-30}]}.
- Vollständiger Fall: [Fall-1121-37-40.json](Fall-1121-37-40.json).


### Spiel 1269, Zugindex 37: hindsight-rule-excludes-best:pro:R1

- Stufe: Profi; Sitz 3; {"kind":"rufspiel","suit":"Eichel"}.
- Hand damals: Gras-Ass, Herz-7.
- Gespielt: Gras-Ass; Begründung: R1.
- R-Kandidaten: Gras-Ass.
- Befund: {"id":1269,"step":37,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["R1"],"candidates":["Gras-Ass"],"alternatives":[{"card":"Gras-Ass","delta":-20},{"card":"Herz-7","delta":20}],"gapCent":40}.
- Vollständiger Fall: [Fall-1269-37-41.json](Fall-1269-37-41.json).


### Spiel 1359, Zugindex 39: hindsight-tip-inferior:amateur:T10

- Stufe: Amateur; Sitz 1; {"kind":"farbwenz","suit":"Gras","tout":false}.
- Hand damals: Schellen-9, Schellen-10.
- Gespielt: Schellen-10; Begründung: RANDOM.
- R-Kandidaten: Schellen-9, Schellen-10.
- Befund: {"id":1359,"step":39,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T10","recommended":["Schellen-10"],"alternatives":[{"card":"Schellen-9","delta":30},{"card":"Schellen-10","delta":-30}]}.
- Vollständiger Fall: [Fall-1359-39-42.json](Fall-1359-39-42.json).


### Spiel 1368, Zugindex 37: hindsight-tip-inferior:beginner:T3b

- Stufe: Anfänger; Sitz 3; {"kind":"solo","suit":"Schellen","tout":false}.
- Hand damals: Eichel-Unter, Schellen-8.
- Gespielt: Eichel-Unter; Begründung: RANDOM.
- R-Kandidaten: Eichel-Unter, Schellen-8.
- Befund: {"id":1368,"step":37,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T3b","recommended":["Schellen-8"],"alternatives":[{"card":"Eichel-Unter","delta":30},{"card":"Schellen-8","delta":-30}]}.
- Vollständiger Fall: [Fall-1368-37-43.json](Fall-1368-37-43.json).


### Spiel 1466, Zugindex 40: hindsight-rule-excludes-best:amateur:R2

- Stufe: Amateur; Sitz 1; {"kind":"rufspiel","suit":"Gras"}.
- Hand damals: Schellen-9, Eichel-Ober.
- Gespielt: Eichel-Ober; Begründung: R2.
- R-Kandidaten: Eichel-Ober.
- Befund: {"id":1466,"step":40,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["R2"],"candidates":["Eichel-Ober"],"alternatives":[{"card":"Schellen-9","delta":10},{"card":"Eichel-Ober","delta":-10}],"gapCent":20}.
- Vollständiger Fall: [Fall-1466-40-44.json](Fall-1466-40-44.json).


### Spiel 1496, Zugindex 38: hindsight-tip-inferior:amateur:T6

- Stufe: Amateur; Sitz 0; {"kind":"rufspiel","suit":"Gras"}.
- Hand damals: Schellen-Unter, Herz-Ass.
- Gespielt: Herz-Ass; Begründung: T7.
- R-Kandidaten: Schellen-Unter, Herz-Ass.
- Befund: {"id":1496,"step":38,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T6","recommended":["Schellen-Unter"],"alternatives":[{"card":"Schellen-Unter","delta":-20},{"card":"Herz-Ass","delta":-10}]}.
- Vollständiger Fall: [Fall-1496-38-45.json](Fall-1496-38-45.json).


### Spiel 1592, Zugindex 40: hindsight-tip-inferior:legend:T1

- Stufe: Legende; Sitz 2; {"kind":"rufspiel","suit":"Eichel"}.
- Hand damals: Schellen-7, Herz-Unter.
- Gespielt: Schellen-7; Begründung: SIMULATION.
- R-Kandidaten: Herz-Unter, Schellen-7.
- Befund: {"id":1592,"step":40,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T1","recommended":["Herz-Unter"],"alternatives":[{"card":"Schellen-7","delta":10},{"card":"Herz-Unter","delta":-10}]}.
- Vollständiger Fall: [Fall-1592-40-46.json](Fall-1592-40-46.json).


### Spiel 1673, Zugindex 39: hindsight-tip-inferior:beginner:T10

- Stufe: Anfänger; Sitz 2; {"kind":"rufspiel","suit":"Eichel"}.
- Hand damals: Gras-Ass, Schellen-Ober.
- Gespielt: Schellen-Ober; Begründung: R5.
- R-Kandidaten: Schellen-Ober, Gras-Ass.
- Befund: {"id":1673,"step":39,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T10","recommended":["Schellen-Ober"],"alternatives":[{"card":"Gras-Ass","delta":10},{"card":"Schellen-Ober","delta":-10}]}.
- Vollständiger Fall: [Fall-1673-39-47.json](Fall-1673-39-47.json).


### Spiel 1714, Zugindex 37: hindsight-rule-excludes-best:legend:R4+R2

- Stufe: Legende; Sitz 2; {"kind":"rufspiel","suit":"Gras"}.
- Hand damals: Schellen-Ass, Gras-8.
- Gespielt: Schellen-Ass; Begründung: R2.
- R-Kandidaten: Schellen-Ass.
- Befund: {"id":1714,"step":37,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["R4","R2"],"candidates":["Schellen-Ass"],"alternatives":[{"card":"Schellen-Ass","delta":40},{"card":"Gras-8","delta":50}],"gapCent":10}.
- Vollständiger Fall: [Fall-1714-37-48.json](Fall-1714-37-48.json).


### Spiel 1817, Zugindex 35: hindsight-tip-inferior:legend:T2

- Stufe: Legende; Sitz 1; {"kind":"rufspiel","suit":"Schellen"}.
- Hand damals: Herz-König, Herz-10.
- Gespielt: Herz-König; Begründung: SIMULATION.
- R-Kandidaten: Herz-König, Herz-10.
- Befund: {"id":1817,"step":35,"type":"hindsight-tip-inferior","severity":"hindsight","tip":"T2","recommended":["Herz-10"],"alternatives":[{"card":"Herz-König","delta":10},{"card":"Herz-10","delta":-10}]}.
- Vollständiger Fall: [Fall-1817-35-49.json](Fall-1817-35-49.json).


### Spiel 1933, Zugindex 37: hindsight-rule-excludes-best:pro:T9

- Stufe: Profi; Sitz 0; {"kind":"rufspiel","suit":"Eichel"}.
- Hand damals: Gras-9, Eichel-8.
- Gespielt: Gras-9; Begründung: T9.
- R-Kandidaten: Gras-9.
- Befund: {"id":1933,"step":37,"type":"hindsight-rule-excludes-best","severity":"hindsight","rules":["T9"],"candidates":["Gras-9"],"alternatives":[{"card":"Gras-9","delta":-40},{"card":"Eichel-8","delta":40}],"gapCent":80}.
- Vollständiger Fall: [Fall-1933-37-50.json](Fall-1933-37-50.json).

