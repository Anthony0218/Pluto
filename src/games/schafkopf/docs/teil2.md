# Schafkopf – Regelwerk & Bot-Logik (Teil 2a: Tipps)

> Ergänzt Teil 1 (Regeln). Tipps sind **fehleranfällig**: Wie zuverlässig sie angewendet werden, hängt von der Stufe ab (Matrix in Abschnitt 3).
> **Grundsatz:** Ein Tipp darf nie eine R-Regel oder eine Engine-Regel (MUSS) brechen. Tipps wählen nur innerhalb der Kandidaten, die die R-Regeln erlauben.
> Beispiele beziehen sich, falls nicht anders angegeben, auf **Sauspiel mit Herz als Trumpf**.

**Legende der Markierungen**

| Markierung | Bedeutung |
|---|---|
| **[N]** | Wert oder Vorgabe von Nico (fix) |
| **[V]** | Vorschlag von Friendly GPT, bitte prüfen |
| ⚠️ OFFEN | Formulierung mehrdeutig, Default-Interpretation ist angegeben |

**Aufbau jedes Tipps:** Situation → Aktion → Ausnahmen → benötigtes Wissen → Stufe.

---

## 1. Wissensklassen (bestimmen, ab welcher Stufe ein Tipp überhaupt anwendbar ist)

| Klasse | Inhalt | Verfügbar ab |
|---|---|---|
| **H** – Hand/Stich | eigene Hand, aktueller Stich, Sitzposition, Rollen | Anfänger (Tipps aber erst ab Amateur) |
| **G** – Gedächtnis | gefallene Trümpfe, gespielte Farben, Farbfreiheit, Abschmeiß-Historie | Fortgeschritten |
| **P** – Punkte | Punktestand, Zielschwellen („zu", schneiderfrei, Spritz-Regel) | grob ab Fortgeschritten, exakt ab Profi |
| **W** – Wahrscheinlichkeit | Constraint-Sets, Kartenverteilung | Profi (Scoring), Legende (Simulation) |

Braucht ein Tipp eine Klasse, die die Stufe nicht hat, wird er **nicht angewendet** und die Stufe wählt **zufällig** unter den erlaubten Kandidaten **[N]**. Das ist kein gezielt falscher Zug.

---

## 2. Die Tipps

### T1 – „Mim Unter gehst nie unter!"
- **Situation:** Ich bin in einer angespielten Fehlfarbe frei und steche ein (R5). Hinter mir sitzt noch ein Gegner, der ebenfalls frei sein und überstechen könnte.
- **Aktion:** Nicht die Herz-10 oder das Herz-Ass legen, sondern einen **Unter** (z. B. den Herz-Unter).
- **Warum:** Es geht nicht darum, sicher zu stechen. Wird man überstochen, soll kein Stich mit sehr vielen Punkten an den Gegner gehen (Ass und Zehn wären selbst 11 bzw. 10 Punkte). Außerdem muss der Gegner einen **hohen Trumpf opfern**, um den Stich zu bekommen.
- **Ergänzung ab Profi/Legende (P):** Der Punktestand fließt mit ein. Ist man durch den Stich mit dem höchsten Trumpf **„zu"**, wird man dadurch **schneiderfrei** oder spielt man den Gegner **schneider**, dann sticht man genau so. Die Unter-Logik tritt dann zurück.
- **Wissen:** H (Basis). Für „könnte hinter mir auch frei sein" ist G genauer (ab Fortgeschritten). Ohne G gilt die Annahme: Jeder Gegner hinter mir könnte frei sein.

### T2 – Mitspieler spielt hohen Trumpf aus
- **Situation:** Ich bin **Mitspieler** (Partner des Ansagers) und am Ausspiel.
- **Aktion:** Einen der **höchsten vier Trümpfe** (die Ober) direkt ausspielen, am besten immer den **höchsten**, den ich habe.
- **Warum:** Das nimmt dem Spieler am Anfang eine Last ab. Er hat tendenziell mehr Trümpfe als alle anderen, kann seine hohen Trümpfe sparen und hat sie später noch.
- **Erweiterung:** Sitzt der **Ansager ganz hinten** (Position 4, der Mitspieler spielt aus), darf der Mitspieler auch einen der **höchsten sechs** Trümpfe ausspielen. *(Geklärt [N].)*
- **Abwechseln:** Hat der Mitspieler **3–4 Trümpfe**, kann er sich abwechseln: erst einen hohen spielen, in der zweiten Trumpfrunde einen niedrigen.
  - **Außer** er kann direkt den höchsten oder einen gleich hohen Trumpf hinterherspielen. Dann spielt er wieder hoch.
  - Ist nur noch ein **niedriger Unter** übrig, hebt man ihn lieber zum **Einstechen** auf und spielt z. B. eine **Herz-7** aus.
- **Wissen:** H (Basis, Ober-Regel). „Höchster noch im Spiel" und „gleich hoch hinterherspielen" brauchen G.

### T3 – Suchen und Farbwahl (Gegenspieler; T3c: Ansager)
- **T3a – Selbst frei in der Suchfarbe:** Bin ich als Gegenspieler in der Farbe der gesuchten Sau frei (kann also nicht suchen), spiele ich eine **andere Fehlfarbe** an. So kommt der **andere Gegenspieler** an den Stich und kann suchen.
  - **Ausnahme:** Habe ich selbst keinen Trumpf mehr, ist die Wahl egal.
- **T3b – Trumpf wurde angespielt:** Wird ein Stich mit **Trumpf angespielt**, versucht man als Gegenspieler **nicht zu stechen**, wenn auch ein **möglicher Partner** stechen und danach suchen könnte.
- **T3c – Ansager, ein Gegenspieler hat die Suchfarbe vermutlich nicht [N]:**
  - **Situation:** Alle Bedingungen müssen erfüllt sein:
    1. Ich bin **Ansager**.
    2. Es wird **gesucht** (die Suchfarbe ist angespielt).
    3. Ein Gegenspieler hat früher als Ausspieler eine **andere Fehlfarbe** gespielt, **ohne zu suchen**. Daraus schließt man, dass er die Suchfarbe vermutlich nicht hat, also frei ist und einstechen kann.
    4. Ich habe **mehrere Karten der Suchfarbe**.
  - **Aktion:** Ich lege die Karte der Suchfarbe mit **weniger Punkten**, weil der Stich wahrscheinlich vom freien Gegenspieler gestochen wird.
  - **Implementierung:** `GameKnowledge` merkt sich pro Gegenspieler das Flag `vermutlichFreiInSuchfarbe`. Es wird gesetzt, wenn der Gegenspieler ausspielt, solange die Rufsau noch nicht gefallen ist, und dabei eine andere Fehlfarbe spielt statt zu suchen. Das deckt auch das T3a-Verhalten ab (bewusst eine andere Farbe spielen, weil man in der Suchfarbe frei ist). Das Flag ist eine **Vermutung**, keine bewiesene Farbfreiheit: Ab Profi fließt es als Wahrscheinlichkeit ein, nicht als harte Tatsache.
- **Wissen:** T3a H · T3b H (+W für „möglicher Partner könnte stechen") · T3c G (Beobachtung des Ausspielverhaltens).

### T4 – Viele Karten einer Fehlfarbe, Gegner hinter mir
- **Situation:** Ich habe **3 oder 4 Karten** einer Fehlfarbe, diese Farbe wird gespielt und **ein Gegner sitzt hinter mir**.
- **Aktion:** Eher eine Karte mit **weniger Punkten** legen, damit der Gegner nicht so viele Punkte sammelt. Bei 3–4 eigenen Karten ist die Chance hoch, dass jemand frei ist und einsticht.
- **Wird hinfällig,** wenn der Gegner hinter mir bereits **keinen Trumpf** mehr zugegeben hat oder **kein Trumpf mehr** im Spiel ist.
- **Ausnahme Suchsau:** Geht es um die **Suchfarbe**, sucht man immer mit der **punktehöchsten** Karte. Der Partner ist ziemlich sicher frei, denn die Sau und mindestens eine Karte zum Rufen liegen sicher bei der Spielerpartei.
  - **Ausnahme zur Ausnahme:** Ist z. B. die **10 der Suchfarbe deine einzige volle Schmier**, hebe sie für einen **sicheren Stich des eigenen Teams** auf.
  - Bei **4 Karten** der Suchfarbe spielt man **immer** die punktehöchste Karte. **Außer** der Spieler hat sich in dieser Farbe **abgeschmissen**, also die Farbe bereits in einem anderen Stich gespielt, als er dort frei war.
- **Wissen:** H (Basis) · G (Trumpffreiheit des Gegners, Abschmeiß-Historie).

### T5 – Wann und was schmieren
- **Grundsatz:** Schmieren sollte man am besten, wenn die **Wahrscheinlichkeit hoch** ist, dass der Partner den Stich macht. Ist der Stich sicher, gilt die Pflicht aus R2.
- **Nur eine volle Schmier auf der Hand** (eine 10 bzw. ein Ass): für einen Stich aufheben, den der Partner **sicher** macht.
- **Mehrere 10er/Asse:** Man darf mehr **Risiko** eingehen. **Außer** es ist klar oder sehr wahrscheinlich, dass der Gegner sticht.
- **Vorsicht beim Ass:** Kein Ass schmieren, das später selbst **einen Stich in seiner Fehlfarbe** machen würde (Farbe noch nicht gelaufen, Ass würde „durchgehen").
- **Solo:** Im Solo schmiert man eher auch ein Ass, im Optimalfall wenn:
  - man selbst noch **viele andere Karten dieser Farbe** hat (das Ass geht also eh nicht durch bzw. wird wahrscheinlich weggestochen),
  - der Gegenspieler in dieser Farbe **bereits frei** war bzw. die Farbe **schon gespielt** wurde,
  - man damit **über 60 Punkte** kommt (Schwellen nach Teil 1, 6.4),
  - oder man die **10 dahinter** hat.
- **Rufsau:** Frühestens im vorletzten Stich schmieren (R5-Erweiterung, Teil 1).
- **Wissen:** H (Anzahl eigener voller Schmieren) · G (Farbe schon gespielt, Freiheit) · P (60er-Grenze) · W (Stichwahrscheinlichkeit).

### T6 – Direkt aufeinanderfolgende Karten
- **Situation:** Ich besitze mehrere Karten, die in der Rangfolge **direkt nacheinander** kommen, z. B. **Schellen-Unter und Herz-Ass** (im Sauspiel direkt benachbarte Trümpfe).
- **Aktion:** Welche man legt, hängt davon ab, **wem der Stich gehört**. Beide Karten haben die gleiche Stichkraft, aber unterschiedlich viele Punkte.
  - Stich gehört dem **Partner**: die punktereichere Karte legen (Herz-Ass, 11 Punkte).
  - Stich gehört dem **Gegner**: die punktärmere Karte legen (Schellen-Unter, 2 Punkte).
  - Muss ich den Stich selbst übernehmen: die punktärmere Karte legen (gleiche Stärke, weniger Risiko).
- **Stufe:** ab **Amateur** **[N]**, wenn die Nachbarschaft direkt aus der festen Rangfolge ablesbar ist (H).
- **Deduzierte Nachbarschaft** (die Karten dazwischen sind schon gefallen): braucht G → ab Fortgeschritten **[V]**.
- *Hinweis:* In einer früheren Zusammenfassung stand hier fälschlich „Trumpf-9/Ass-Kombination". Das ist korrigiert.

### T7 – Sicherer Stich und Zwei-Stiche-Logik
- **Grundsatz:** Kann man mit einer Karte einen **sicheren Stich** machen, indem man eine **andere Karte** spielt, tut man das. **Amateur 75 % [N], ab Fortgeschritten immer [N].** Die Logik bezieht sich auf **zwei Stiche**: Man gibt im ersten Stich mehr Punkte her, um den zweiten Stich zu machen.
- **Vorrang:** Kann man den **aktuellen Stich** gewinnen (stechen), tut man das natürlich. Die folgende Logik gilt nur, wenn der aktuelle Stich nicht zu holen ist, z. B. weil der Eichel-Ober gespielt wurde. *(Geklärt [N].)*
- **Beispiel 1 – Gras-Ober behalten [N]:** Man hat **zwei Trümpfe**, einer davon ist der **Gras-Ober**. Der **Eichel-Ober** wurde gespielt. → Man **behält den Gras-Ober** und legt den anderen Trumpf. Der Gras-Ober ist jetzt der höchste Trumpf im Spiel und macht sicher einen späteren Stich. Das gilt selbst dann, wenn man dadurch z. B. das **Herz-Ass dem Gegner schmiert**.
- **Beispiel 2 – Herz-Ober opfern [N]:** Man hat **zwei Trümpfe**: den **Herz-Ober** und eine **Trumpf-Schmier** (z. B. Herz-Ass oder Herz-10). Der **Eichel-Ober** wurde gespielt, der **Gras-Ober** ist noch im Spiel. → Man **legt den Herz-Ober**. Er ist nicht sicher und würde später wahrscheinlich eh gestochen. Die Schmier behält man, um sie später in einen Stich des Partners zu legen.
- **Entscheidungskern:** Man behält den Trumpf, der **sicher** einen späteren Stich macht (alle höheren Trümpfe gefallen). Ist keiner sicher, legt man den **unsicheren hohen** Trumpf und behält die Schmier.
- **Drei Trümpfe:** Mit drei Karten behält man den Herz-Ober natürlich. Von den beiden anderen legt man die **punktärmste**; macht der Partner den Stich, die **punktereichste**. *(Geklärt [N].)*
- **Ober schonen:** Kann man einen **Unter, König oder 0-Punkte-Trumpf** legen, um einen Ober zu behalten, macht man das natürlich.
- **Partner sticht:** Man hebt sich immer die **höhere** Karte auf und legt die **niedrigere**, im Optimalfall die mit mehr Punkten.
- **Besonders beim Schmieren anwenden.**
- **Profi-Feinschliff (P):** Punktentscheidungen werden genauer. Beispiel: Macht der Partner den Stich und man muss zwischen **Schellen-Ober (3)** und **Eichel-Unter (2)** wählen, legt man den Schellen-Ober. Das ist ein Punkt Unterschied.
- **Wissen:** H (Basis, wenn der höhere Trumpf im aktuellen Stich liegt) · G (gefallene Trümpfe) · P (Profi-Feinschliff).

### T8 – Punkte streuen (5–12 Punkte pro Stich)
- **Situation:** Besonders bei **Solos**, aber auch in **Sauspielen**.
- **Aktion:** In jeden Stich insgesamt **zwischen 5 und 12 Punkte** legen, damit sich kein Gegenspieler, der frei ist, von einer anderen Fehlfarbe **befreien** kann, ohne dabei zumindest ein paar Punkte zu verlieren.
- **Ausnahme:** Hast du nur **2 oder 3 Karten mit 4 Punkten oder mehr**, spare sie lieber für Momente auf, in denen man den Stich **sicher** macht.
- **Ab Profi (P):** Der aktuelle Punktestand fließt in die Entscheidung mit ein.
- **Priorität:** Die Ausnahme gewinnt vor dem Grundziel. Ab Profi darf man trotzdem streuen, wenn der Punktestand zeigt, dass die Punkte im Stich spielentscheidend sind. *(Geklärt [N].)*

### T9 – Beide Gegenspieler ohne Trumpf
- **Situation:** Beide Gegenspieler haben **keinen Trumpf mehr** zugegeben.
- **Aktion:** Als Gegenspieler **nicht suchen**. Der Stich geht sicher an die Spielerpartei.
- **Verhältnis zu R3:** gilt als **Ausnahme zu R3** **[V]**.
- **Wissen:** G → ab Fortgeschritten.

### T10 – Trumpfrunden erzwingen
- **Grundgedanke:** Als Spielerpartei ist es das Ziel, **möglichst viele Trumpfrunden** zu spielen. Man hat tendenziell mehr Trümpfe und kann dadurch in den letzten Stichen die **Trumpfhoheit** erreichen.
- **Aktion:** Deshalb kann man auch bei **niedrigem Trumpfanspiel** einen **hohen Trumpf** spielen bzw. einen anderen **überstechen**, um das eigene Interesse zu verfolgen. Das gilt sowohl als Spieler als auch als Gegenspieler:
  - **Gegenspieler:** an den Stich kommen, um zu **suchen** oder auf **Fehlfarbe zu wechseln**, solange der Partner noch Trumpf hat, falls er in dieser Farbe frei ist.
  - **Spieler:** an den Stich kommen, um **weiter Trumpf** zu spielen.
- **Verhältnis zu R4:** Den eigenen Partner übersticht man nur unter den Bedingungen von **R4a** (Teil 1): kein Trumpf nur eine Stufe höher, genug Auswahl an Trümpfen, den einzigen der höchsten 6 nicht verschwenden. Beispiel: Partner legt Eichel-Unter, man sticht mit Eichel-Ober, um erneut Trumpf zu ziehen. *(Geklärt [N].)*
- **Verhältnis zu T3b:** Konfliktfall. Default **[V]**: T3b gewinnt, wenn der mögliche Partner hinter mir sitzt und stechen kann.
- **Wissen:** H (Basis) · G (hat der Partner noch Trumpf, ist er frei).

### T11 – Vorsorglich frei machen statt einzustechen
- **Situation:** Man ist in der angespielten Farbe **frei**, und eine der folgenden Bedingungen trifft zu:
  - im Stich liegen **unter 5 Punkte**, **oder**
  - man müsste für **unter 15 Punkte** seinen **letzten sehr hohen Trumpf** spielen (ca. die Top 4 der übrigen Trümpfe), **oder**
  - der **Partner sticht**.
- **Aktion:** Es kann sinnvoll sein, eine Karte einer **anderen, bisher nicht gespielten Farbe** zu legen, von der man **nur eine Karte** hat.
- **Nutzen:** Wird diese Fehlfarbe später gespielt, kann man:
  - **einstechen**, wenn wahrscheinlich der Gegner sticht,
  - **schmieren** oder sich **nochmal frei machen**, wenn der Partner sticht.
- **Verhältnis zu R5:** T11 konkretisiert die 0-Punkte-Ausnahme von R5 (Teil 1). Die Bedingungen „< 15 Punkte / letzter Top-4-Trumpf" und „Partner sticht" erweitern sie.
- **Verhältnis zu T7** *(geklärt [N])*:
  - Kann man einen **sicheren Stich** machen und liegen darin **mindestens 10 Punkte**, oder ist man damit **„zu"** → den Stich nehmen (T7).
  - Sonst → **frei machen** (T11), sofern der Stich nicht sicher an einen Gegner geht.
  - Gehört der Stich dem **Partner** bzw. sticht der Partner → T11 greift **auf jeden Fall**. Die punktarme Einzelkarte der noch nicht gespielten Farbe wird abgelegt; eine volle Schmier wird nicht zum bloßen Freimachen geopfert, sondern möglichst als Schmier eingesetzt.
  - Sticht der **Gegner** sicher → T11 **nicht** anwenden; der Bot versucht nicht, sich für später freizumachen, wenn dadurch der Gegner den aktuellen Stich sicher erhält.
  - Ist der Stichbesitz noch nicht sicher und hat man **3 oder 4 volle Schmieren**, darf T11 angewendet werden. Hat man nur **1 oder 2 volle Schmieren**, wird T11 nicht allein wegen des Freimachens angewendet.
  - **Frei machen nie mit einer vollen Schmier** (Ass oder Zehn) *(geklärt [N])*. Frei gemacht wird mit einer punktarmen Einzelkarte. Ist die einzige Karte der noch nicht gespielten Farbe eine volle Schmier, macht man sich mit dieser Farbe nicht frei.
- **Wissen:** H (Punkte im Stich, Partner sticht) · G (Farbe noch nicht gespielt, Top-4 der verbleibenden Trümpfe).

### T12 – Die beiden höchsten Trümpfe auf der Hand
- **Situation:** Man hat selbst die **höchsten beiden Trümpfe** und spielt aus.
- **Aktion:**
  - Partner sitzt an **vierter Stelle** oder man spielt ein **Solo** → den **zweithöchsten** spielen.
  - Partner sitzt in der **Mitte** (Position 2 oder 3) → den **höchsten** spielen (z. B. Eichel-Ober), damit der Partner **schmieren** kann.
- **Wissen:** H, sofern es um die höchsten beiden Trümpfe der Spielart geht → ab Amateur zuverlässig **[V]**. „Die höchsten beiden **verbleibenden** Trümpfe" braucht G → ab Fortgeschritten.
- **Partner unbekannt** (Sauspiel, Rufsau noch nicht gefallen) *(geklärt [N])*: Man kann den **Eichel-Ober** ausspielen.
- **Ausspielstrategie nach Handstruktur** *(geklärt [N])*:
  - **Viele Trümpfe, wenige hohe:** Man kann einen **niedrigen** Trumpf ausspielen.
  - **Viele hohe Trümpfe:** erst einen **hohen**, danach einen **niedrigen** Trumpf ausspielen.
  - **Definitionen:**
    - **Viele Trümpfe** = mindestens **5** (zu Spielbeginn).
    - **Hohe Trümpfe** = **Ober**.
    - **Viele hohe** = z. B. **2 Ober und 2 Unter**. Als Startwert gilt: mindestens 2 Ober und insgesamt mindestens 4 Ober/Unter.
- Hat man die beiden höchsten Trümpfe und ist der Partner bekannt, gilt weiterhin: Partner in der Mitte → höchsten spielen; Partner hinten oder Solo → zweithöchsten spielen. Ist der Partner noch unbekannt, kann man den **Eichel-Ober** spielen.

---

## 3. Stufen-Matrix der Tipps

Die Werte geben an, **wie oft der Tipp korrekt angewendet wird**, wenn er greift. In den übrigen Fällen wird zufällig unter den erlaubten Kandidaten gewählt.
**Anfänger:** wendet **keine** Tipps an (nur R-Regeln + Zufall).
**Legende:** keine Einzelregeln nötig. Die Tipps ergeben sich aus der Simulation (ISMCTS), kein künstliches Rauschen **[N]**. Die Tipps dienen dort als **Prior bzw. Rollout-Policy** und zur Plausibilitätsprüfung **[V]**.

| Tipp | Wissen | Amateur | Fortgeschritten | Profi | Legende |
|---|---|---|---|---|---|
| T1 Unter einstechen | H (+G, P ab Profi) | zufällig **[N]** | 85 % **[V]** | 97–99 % | Simulation |
| T2 Mitspieler hoch ausspielen | H (+G) | 60 % **[V]** | 85 % **[V]** | 97–99 % | Simulation |
| T3a/b Suchen/Farbwahl | H (+W) | zufällig | 55 % **[V]** | 97–99 % | Simulation |
| T3c Ansager, Gegenspieler vermutlich frei in Suchfarbe | G | zufällig | 60 % **[V]** | 97–99 % | Simulation |
| T4 Fehlfarbenmenge/Suchsau | H + G | zufällig | 85 % **[V]** | 97–99 % | Simulation |
| T5 Schmier-Qualität | H+G+P+W | zufällig | grob 70 % **[V]** | 97–99 % | Simulation |
| T6 Aufeinanderfolgende Karten | H / G | direkt: 75 % **[V]** | direkt 100 %, deduziert 60 % **[V]** | 97–99 % | Simulation |
| T7 Sicherer Stich | H / G | **75 % [N]** | **100 % [N]** | **100 %** (+1-Punkt-Feinschliff) | Simulation |
| T8 Punkte streuen | H (+P) | zufällig | 55 % **[V]** | 97–99 % (inkl. Punktestand) | Simulation |
| T9 Kein Suchen bei Trumpflosigkeit | G | zufällig | 85 % **[V]** | 97–99 % | Simulation |
| T10 Trumpfrunden erzwingen | H + G | zufällig | 80 % **[V]** | 97–99 % | Simulation |
| T11 Vorsorglich frei machen | H + G | zufällig | 60 % **[V]** | 97–99 % | Simulation |
| T12 Zwei höchste Trümpfe / Handstruktur | H (+G) | 90 % **[V]** | 95 % **[V]** | 97–99 % | Simulation |

**Profi:** Die Fehlerquote liegt insgesamt bei **1–3 % [N]** (daher 97–99 %). Außerdem werden die Tipps als **gewichtete Scoring-Faktoren** gegeneinander abgewogen statt starr nacheinander angewendet.

**Zugehörige R-Regel-Werte aus Teil 1 (zur Vollständigkeit):** R6 bei deduzierter Nachbarschaft: Fortgeschritten **50 %**, Profi **75 %**, Legende **100 % [N]**.

---

## 4. Konfliktauflösung zwischen Tipps (Default [V], zum Review)

Die Reihenfolge gilt für die regelbasierten Stufen (Amateur, Fortgeschritten). Ab Profi läuft die Abwägung über das Scoring, ab Legende über die Simulation.

1. **T1-Ergänzung (P):** Die Punktgewissheit („zu", schneiderfrei, schneider spielen) schlägt alles.
2. **T7:** sicherer Stich, aber nur ab 10 Punkten im Stich bzw. wenn man damit „zu" ist. Sonst gilt T11.
3. **T9** (vor R3)
4. **T3b** vor **T10**
5. **T4-Suchsau-Ausnahme** vor T4-Grundregel
6. **T11** vor R5-Einstechen (nur unter den T11-Bedingungen)
7. **T5 / T6 / T7-Feinschliff:** Wahl der konkreten Karte
8. **T8:** Punkte streuen (Ausnahme vor Grundziel)
9. **T2 / T12:** Ausspielwahl

---

*Teil 2b folgt: Vorschläge für Ansage-Regeln (A4 ff.), Tutorial-Texte für den Anfänger-Modus, vollständige Liste der offenen Punkte und der fertige Implementierungs-Prompt für Codex / Claude Code.*
