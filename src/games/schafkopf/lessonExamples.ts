import type { Card, Rank, Suit } from './schafkopf';
export type LessonExample = { cards: Card[]; caption: string };
const example = (ids: string[], caption: string): LessonExample => ({ cards: ids.map(id => { const [suit, rank] = id.split('-'); return { id, suit: suit as Suit, rank: rank as Rank }; }), caption });
/** All examples refer to Sauspiel with Herz trump unless specified. */
export const SCHAFKOPF_LESSON_EXAMPLES: Record<string, LessonExample> = {
  T1: example(['Gras-7','Eichel-Unter','Herz-Ass'], 'Gras ist angespielt, du bist grasfrei und ein Gegner sitzt hinter dir: Mit Eichel-Unter stichst du und riskierst nur 2 statt 11 Augen.'),
  'T1-points': example(['Gras-Ass','Herz-10','Eichel-Ober'], 'Deinem Team fehlen die Augen zum Sieg: Der sichere Eichel-Ober kann wertvoller sein als das Sparen hoher Trümpfe.'),
  T2: example(['Eichel-Ober','Herz-Ober','Herz-7'], 'Als Mitspieler am Ausspiel ziehst du mit dem Eichel-Ober Trumpf; dein Partner kann Augen zugeben.'),
  'T2-save': example(['Schellen-Unter','Herz-7','Herz-8'], 'Nur ein niedriger Unter bleibt: Spiele Herz-7 und bewahre Schellen-Unter zum späteren Einstechen.'),
  T3a: example(['Eichel-Ass','Gras-7','Schellen-9'], 'Eichel ist gerufen, du hast keine Eichel: Eine andere Fehlfarbe, etwa Gras-7, kann deinen Partner ans Ausspiel bringen.'),
  T3b: example(['Herz-7','Herz-Ober','Herz-8'], 'Trumpf ist angespielt und ein möglicher Partner sitzt hinter dir: Gib niedrig zu, damit er übernehmen und anschließend suchen kann.'),
  T3c: example(['Eichel-Ass','Eichel-10','Eichel-7'], 'Eichel ist gerufen. Wenn ein Gegner vermutlich eichelfrei ist, gib als Ansager Eichel-7 statt Eichel-10 zu.'),
  T4: example(['Eichel-Ass','Eichel-10','Eichel-9','Eichel-7'], 'Eichel ist gerufen: Mit mehreren Rufkarten kannst du hoch mit Eichel-10 suchen. Die einzige volle Schmier sparst du für sichere Teamstiche.'),
  'T4-color': example(['Gras-Ass','Gras-König','Gras-9','Gras-7'], 'Gras wird angespielt und ein Gegner sitzt hinter dir: Mit vielen Graskarten gibst du eher Gras-7 statt Gras-Ass zu.'),
  T5: example(['Eichel-Ober','Schellen-Ass','Schellen-10'], 'Dein Partner gewinnt sicher mit Eichel-Ober: Schellen-Ass kann geschmiert werden; Schellen-10 bleibt als spätere Gewinnkarte.'),
  'T5-solo': example(['Eichel-Ober','Gras-Ass','Gras-10','Gras-7'], 'Im Herz-Solo gegen den Ansager: Gewinnt dein Partner sicher, kannst du Gras-Ass schmieren und Gras-10 behalten.'),
  T6: example(['Schellen-Unter','Herz-Ass'], 'Zwischen diesen Sauspiel-Trümpfen liegt keine weitere Karte: Für den Partner gibst du Herz-Ass (11), für den Gegner Schellen-Unter (2).'),
  T7: example(['Eichel-Ober','Gras-Ober','Herz-Ass'], 'Eichel-Ober liegt im Stich. Bewahre Gras-Ober als höchsten verbleibenden Trumpf und gib Herz-Ass ab, wenn du bedienen musst.'),
  'T7-sacrifice': example(['Eichel-Ober','Herz-Ober','Herz-10'], 'Eichel-Ober liegt im Stich, Gras-Ober ist noch draußen: Opfere den unsicheren Herz-Ober und spare Herz-10 zum Schmieren.'),
  'T7-pro': example(['Schellen-Ober','Eichel-Unter'], 'Ein sicherer Partnerstich: Schellen-Ober gibt 3 Augen, Eichel-Unter 2. Dieses eine Auge kann die Schneidergrenze entscheiden.'),
  T8: example(['Gras-König','Gras-Ass','Gras-10'], 'Ein König bringt 4 Augen, Ass und Zehn 11 bzw. 10: Verteile Augen über mehrere Stiche und spare volle Karten für sichere Teamstiche.'),
  T9: example(['Eichel-Ass','Herz-Ober','Herz-7'], 'Eichel ist gerufen und beide Gegenspieler sind nachweislich trumpffrei: Höhere Bot-Stufen können Trumpf spielen, statt erneut zu suchen.'),
  T10: example(['Eichel-Ober','Herz-Unter','Herz-7'], 'Als Spielerpartei ziehst du mit Trumpfrunden die gegnerischen Trümpfe. Als Gegner willst du ans Ausspiel kommen, um Fehlfarbe zu spielen.'),
  T11: example(['Gras-7','Schellen-Ass','Herz-7'], 'Du bist in der angespielten Farbe frei, dein Partner gewinnt sicher: Wirf die einzelne Gras-7 ab und werde grasfrei; behalte Schellen-Ass.'),
  T12: example(['Eichel-Ober','Gras-Ober'], 'Du hältst die beiden höchsten Trümpfe: Sitzt dein Partner in der Mitte, spiele Eichel-Ober; sitzt er hinten, reicht Gras-Ober.'),
  'T12-hand': example(['Eichel-Ober','Herz-Ober','Eichel-Unter','Herz-Unter','Herz-7'], 'Viele Rangtrümpfe: Erst hoch ausspielen, dann niedrig. Die zwei höchsten Trümpfe und die Partnerposition haben Vorrang.'),
};
