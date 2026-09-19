import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Language = "en" | "de" | "bar" | "ko" | "ru";

type VariantCard = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  route?: string;
  rulesRoute?: string;
  available: boolean;
  accent:
    | "red"
    | "violet"
    | "amber"
    | "rose"
    | "sky"
    | "emerald"
    | "zinc"
    | "orange"
    | "cyan"
    | "fuchsia"
    | "indigo"
    | "lime"
    | "pink"
    | "teal"
    | "blue";
  aiRoute?: string;
};

const languageOptions: Array<{ value: Language; label: string }> = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "bar", label: "Boarisch" },
  { value: "ko", label: "한국어" },
  { value: "ru", label: "Русский" },
];

function getInitialChessLanguage(): Language {
  if (typeof window === "undefined") return "en";

  const stored = window.localStorage.getItem("chess-language");

  return languageOptions.some((option) => option.value === stored)
    ? (stored as Language)
    : "en";
}

const translations: Record<Exclude<Language, "en">, Record<string, string>> = {
  de: {
    Rules: "Regeln",
    "Chess Variants": "Schachvarianten",
    "Different rules. Same board.": "Andere Regeln. Dasselbe Brett.",
    "Seven ways to turn classic chess into something completely different.":
      "Sieben Arten, klassisches Schach in etwas völlig anderes zu verwandeln.",
    "Back to Chess": "Zurück zu Schach",
    Language: "Sprache",
    Available: "Verfügbar",
    "Coming soon": "Demnächst",
    "Play Hotseat": "Hotseat spielen",
    "Three Lives Chess": "Drei-Leben-Schach",
    "Every check hurts": "Jedes Schach tut weh",
    "Both players start with three lives. Every check removes one life; checkmate still wins instantly.":
      "Beide Spieler beginnen mit drei Leben. Jedes Schach kostet ein Leben; Schachmatt gewinnt weiterhin sofort.",
    "3 HP": "3 LP",
    "Check damage": "Schach-Schaden",
    Hotseat: "Hotseat",
    "Mutation Chess": "Mutationsschach",
    "The board changes itself": "Das Brett verändert sich selbst",
    "Every ten plies, a random non-king piece mutates into another piece.":
      "Alle zehn Halbzüge mutiert eine zufällige Nicht-Königsfigur in eine andere Figur.",
    "Random events": "Zufallsereignisse",
    Mutations: "Mutationen",
    "Capitalism Chess": "Kapitalismus-Schach",
    "Chess with an economy": "Schach mit Wirtschaft",
    "Earn coins from captures, checks, castling, bounties and missions, then use them for strategic advantages.":
      "Verdiene Münzen durch Schlagen, Schach, Rochade, Kopfgelder und Missionen und nutze sie für strategische Vorteile.",
    Economy: "Wirtschaft",
    Bounties: "Kopfgelder",
    Missions: "Missionen",
    "King Powers": "Königskräfte",
    "Horror Chess": "Horror-Schach",
    "The board is dangerous": "Das Brett ist gefährlich",
    "Infection, cursed pieces, burning squares and knight-triggered freezing turn the board into a survival game.":
      "Infektion, verfluchte Figuren, brennende Felder und Springer-Frost machen das Brett zum Überlebensspiel.",
    Infection: "Infektion",
    Curses: "Flüche",
    "Hot squares": "Heiße Felder",
    "Knight freeze": "Springer-Frost",
    "Fog of War Chess": "Nebel-des-Krieges-Schach",
    "You cannot see everything": "Du kannst nicht alles sehen",
    "Limited vision combines with randomized legal starting positions to create hidden-information chess.":
      "Begrenzte Sicht wird mit zufälligen legalen Startstellungen zu Schach mit verborgenen Informationen.",
    "Fog of war": "Nebel des Krieges",
    "Random start": "Zufallsstart",
    "Hidden information": "Verborgene Information",
    "Draft Chess": "Draft-Schach",
    "Build your own army": "Stelle deine eigene Armee zusammen",
    "Spend a point budget on your starting army. The king must remain on the back rank.":
      "Stelle mit einem Punktebudget deine Startarmee zusammen. Der König muss auf der Grundreihe bleiben.",
    Budget: "Budget",
    "Custom army": "Eigene Armee",
    "Back-rank king": "König auf Grundreihe",
    "Mirror Chess": "Spiegelschach",
    "Custom but symmetrical": "Individuell, aber symmetrisch",
    "Create a custom legal formation and mirror it for the opponent so both sides begin symmetrically.":
      "Erstelle eine eigene legale Formation und spiegle sie für den Gegner, sodass beide Seiten symmetrisch beginnen.",
    "Custom setup": "Eigene Aufstellung",
    Symmetry: "Symmetrie",
    "Fair start": "Fairer Start",
    "Variant roadmap": "Varianten-Roadmap",
    "We build one rules system at a time, starting with local Hotseat before AI or Multiplayer.":
      "Wir bauen ein Regelsystem nach dem anderen, beginnend mit lokalem Hotseat vor KI oder Multiplayer.",
    "Fifteen ways to turn classic chess into something completely different.":
      "Fünfzehn Arten, klassisches Schach in etwas völlig anderes zu verwandeln.",
    "Chess Roulette": "Schach-Roulette",
    "Every Lucky Square is a gamble": "Jedes Glücksfeld ist ein Glücksspiel",
    "Visible Lucky Squares can destroy, teleport, swap or transform the piece that lands on them.":
      "Sichtbare Glücksfelder können die landende Figur zerstören, teleportieren, tauschen oder verwandeln.",
    "Lucky Squares": "Glücksfelder",
    "Random effects": "Zufallseffekte",
    Transformations: "Verwandlungen",
    "Hot Potato Chess": "Hot-Potato-Schach",
    "The bomb always belongs to someone": "Die Bombe gehört immer jemandem",
    "A random non-king piece carries a ticking bomb. Move it, pass it by capture, or escape before the 3×3 blast.":
      "Eine zufällige Nicht-Königsfigur trägt eine tickende Bombe. Bewege sie, übergib sie durch Schlagen oder entkomme vor der 3×3-Explosion.",
    "Bomb carrier": "Bombenträger",
    "4–12 fuse": "4–12 Zünder",
    Explosions: "Explosionen",
    "Chess Collapse": "Schach-Kollaps",
    "The board is disappearing": "Das Brett verschwindet",
    "Warned outer edges collapse permanently while both Kings race toward the surviving central battlefield.":
      "Gewarnte Außenränder stürzen dauerhaft ein, während beide Könige zum überlebenden Zentrum fliehen.",
    "Shrinking board": "Schrumpfendes Brett",
    "3 King lives": "3 Königsleben",
    Survival: "Überleben",
    "Boss Battle Chess": "Boss-Battle-Schach",
    "White plays chess. Black plays the boss.":
      "Weiß spielt Schach. Schwarz spielt den Boss.",
    "A full White army faces a reduced Black force led by a 5-HP Boss King with powers, armor and Rage.":
      "Eine vollständige weiße Armee kämpft gegen eine reduzierte schwarze Truppe mit einem 5-HP-Bosskönig, Kräften, Rüstung und Rage.",
    Asymmetric: "Asymmetrisch",
    "Boss Powers": "Boss-Kräfte",
    Rage: "Rage",
    "Four Player Chess": "Vier-Spieler-Schach",
    "Four armies. One battlefield.": "Vier Armeen. Ein Schlachtfeld.",
    "Four players fight around a cross-shaped board. Checkmate eliminates a player; the last army standing wins.":
      "Vier Spieler kämpfen auf einem kreuzförmigen Brett. Schachmatt eliminiert einen Spieler; die letzte Armee gewinnt.",
    "4 Players": "4 Spieler",
    "Free-for-all": "Jeder gegen jeden",
    Elimination: "Elimination",
    "Random Start Chess": "Zufallsstart-Schach",
    "Forget your opening book": "Vergiss dein Eröffnungsbuch",
    "White and Black receive independently shuffled back ranks, creating a different non-mirrored opening every game.":
      "Weiß und Schwarz erhalten unabhängig gemischte Grundreihen, wodurch jede Partie mit einer anderen nicht gespiegelten Stellung beginnt.",
    "Random setup": "Zufallsaufstellung",
    "Asymmetric start": "Asymmetrischer Start",
    "No castling": "Keine Rochade",
    "Tectonic Chess": "Tectonic Chess",
    "Move pieces. Then move the board.":
      "Ziehe Figuren. Dann bewege das Brett.",
    "Every four normal plies, a player can rotate one 4×4 quadrant and reshape the geometry of the entire position.":
      "Alle vier normalen Halbzüge kann ein Spieler einen 4×4-Quadranten drehen und die Geometrie der gesamten Stellung verändern.",
    "4×4 Rotation": "4×4-Drehung",
    "Board Shift": "Brettverschiebung",
    Strategy: "Strategie",
    "Chess Market": "Schachmarkt",
    "Every move has a price": "Jeder Zug hat seinen Preis",
    "Earn coins through captures, checks, missions and bounties, then spend them on limited Royal Powers.":
      "Verdiene Münzen durch Schlagen, Schach, Missionen und Kopfgelder und gib sie für begrenzte Königskräfte aus.",
    "Royal Powers": "Königskräfte",
    "Complete Chaos": "Komplettes Chaos",
    "Nothing starts where it should": "Nichts beginnt dort, wo es sollte",
    "Every starting piece is scattered onto a random square across the entire board. Pure positional madness from move one.":
      "Jede Startfigur wird auf ein zufälliges Feld des gesamten Bretts verteilt. Reiner Positionswahnsinn ab Zug eins.",
    "Full-board setup": "Ganzbrett-Aufstellung",
    "Maximum chaos": "Maximales Chaos",
    Future: "Zukunft",
  },
  bar: {
    Rules: "Regeln",
    "Chess Variants": "Schachvariantn",
    "Different rules. Same board.": "Andere Regeln. S gleiche Brett.",
    "Seven ways to turn classic chess into something completely different.":
      "Sieben Arten, wia aus klassischem Schach wos ganz anders werd.",
    "Back to Chess": "Zruck zum Schach",
    Language: "Sproch",
    Available: "Verfügbar",
    "Coming soon": "Kimmt boid",
    "Play Hotseat": "Hotseat spuin",
    "Three Lives Chess": "Drei-Lebn-Schach",
    "Every check hurts": "Jeds Schach kost a Lebn",
    "Both players start with three lives. Every check removes one life; checkmate still wins instantly.":
      "Beide fangn mit drei Lebn o. Jeds Schach kost a Lebn; Schachmatt gwinnt trotzdem sofort.",
    "3 HP": "3 Lebn",
    "Check damage": "Schach-Schodn",
    Hotseat: "Hotseat",
    "Mutation Chess": "Mutationsschach",
    "The board changes itself": "S Brett verändert si",
    "Every ten plies, a random non-king piece mutates into another piece.":
      "Alle zehn Halbzüg mutiert a zufällige Figur außer'm Kini.",
    "Random events": "Zufallsereignisse",
    Mutations: "Mutationen",
    "Capitalism Chess": "Kapitalismus-Schach",
    "Chess with an economy": "Schach mit Wirtschaft",
    Economy: "Wirtschaft",
    Bounties: "Kopfgelder",
    Missions: "Missionen",
    "King Powers": "Kini-Kräfte",
    "Horror Chess": "Horror-Schach",
    "The board is dangerous": "S Brett is g'fährlich",
    Infection: "Infektion",
    Curses: "Flüach",
    "Hot squares": "Heiße Felder",
    "Knight freeze": "Springa-Frost",
    "Fog of War Chess": "Nebel-Schach",
    "You cannot see everything": "Du siehst ned ois",
    "Fog of war": "Nebel",
    "Random start": "Zufallsstart",
    "Hidden information": "Verborgene Infos",
    "Draft Chess": "Draft-Schach",
    "Build your own army": "Bau da dei eigene Armee",
    Budget: "Budget",
    "Custom army": "Eigene Armee",
    "Back-rank king": "Kini hinten",
    "Mirror Chess": "Spiegelschach",
    "Custom but symmetrical": "Eigen, oba symmetrisch",
    "Custom setup": "Eigene Aufstellung",
    Symmetry: "Symmetrie",
    "Fair start": "Fairer Start",
    "Variant roadmap": "Variantn-Plan",
    "We build one rules system at a time, starting with local Hotseat before AI or Multiplayer.":
      "Mia bauen oane Regelwelt nach da andern, z'erst lokal Hotseat, später KI und Multiplayer.",
    "Fifteen ways to turn classic chess into something completely different.":
      "Fünfzehn Arten, wia aus klassischem Schach wos ganz anders werd.",
    "Complete Chaos": "Kompletts Chaos",
    "Nothing starts where it should": "Nix fangt do o, wo's sollt",
    Future: "Später",
  },
  ko: {
    Rules: "규칙",
    "Chess Variants": "체스 변형",
    "Different rules. Same board.": "다른 규칙. 같은 체스판.",
    "Seven ways to turn classic chess into something completely different.":
      "클래식 체스를 완전히 다른 게임으로 바꾸는 일곱 가지 방식입니다.",
    "Back to Chess": "체스로 돌아가기",
    Language: "언어",
    Available: "사용 가능",
    "Coming soon": "준비 중",
    "Play Hotseat": "핫시트 플레이",
    "Three Lives Chess": "세 목숨 체스",
    "Every check hurts": "체크마다 목숨 감소",
    "Both players start with three lives. Every check removes one life; checkmate still wins instantly.":
      "양쪽 모두 목숨 3개로 시작합니다. 체크를 받을 때마다 목숨 1개가 줄며, 체크메이트는 즉시 승리합니다.",
    "3 HP": "3 HP",
    "Check damage": "체크 피해",
    Hotseat: "핫시트",
    "Mutation Chess": "돌연변이 체스",
    "The board changes itself": "체스판이 스스로 변합니다",
    "Every ten plies, a random non-king piece mutates into another piece.":
      "10수(하프무브)마다 킹이 아닌 무작위 기물 하나가 다른 기물로 변합니다.",
    "Random events": "랜덤 이벤트",
    Mutations: "돌연변이",
    "Capitalism Chess": "자본주의 체스",
    "Chess with an economy": "경제 시스템이 있는 체스",
    "Earn coins from captures, checks, castling, bounties and missions, then use them for strategic advantages.":
      "기물 잡기, 체크, 캐슬링, 현상금, 미션으로 코인을 벌고 전략적 보너스에 사용합니다.",
    Economy: "경제",
    Bounties: "현상금",
    Missions: "미션",
    "King Powers": "킹 능력",
    "Horror Chess": "호러 체스",
    "The board is dangerous": "체스판 자체가 위험합니다",
    "Infection, cursed pieces, burning squares and knight-triggered freezing turn the board into a survival game.":
      "감염, 저주받은 기물, 불타는 칸, 나이트 체크의 동결 효과가 체스를 생존 게임으로 바꿉니다.",
    Infection: "감염",
    Curses: "저주",
    "Hot squares": "위험 칸",
    "Knight freeze": "나이트 동결",
    "Fog of War Chess": "전장의 안개 체스",
    "You cannot see everything": "모든 것을 볼 수 없습니다",
    "Limited vision combines with randomized legal starting positions to create hidden-information chess.":
      "제한된 시야와 무작위 합법 시작 배치를 결합한 정보 비대칭 체스입니다.",
    "Fog of war": "전장의 안개",
    "Random start": "랜덤 시작",
    "Hidden information": "숨겨진 정보",
    "Draft Chess": "드래프트 체스",
    "Build your own army": "직접 군대를 구성합니다",
    "Spend a point budget on your starting army. The king must remain on the back rank.":
      "포인트 예산으로 시작 군대를 구성합니다. 킹은 반드시 마지막 랭크에 있어야 합니다.",
    Budget: "예산",
    "Custom army": "커스텀 군대",
    "Back-rank king": "후방 랭크 킹",
    "Mirror Chess": "미러 체스",
    "Custom but symmetrical": "커스텀이지만 대칭적",
    "Create a custom legal formation and mirror it for the opponent so both sides begin symmetrically.":
      "합법적인 커스텀 배치를 만들면 상대에게 그대로 대칭 복제되어 양쪽이 공정하게 시작합니다.",
    "Custom setup": "커스텀 배치",
    Symmetry: "대칭",
    "Fair start": "공정한 시작",
    "Variant roadmap": "변형 체스 로드맵",
    "We build one rules system at a time, starting with local Hotseat before AI or Multiplayer.":
      "먼저 로컬 핫시트부터 하나씩 규칙 시스템을 만들고, 이후 AI와 멀티플레이로 확장합니다.",
    "Fifteen ways to turn classic chess into something completely different.":
      "클래식 체스를 완전히 다른 게임으로 바꾸는 열다섯 가지 방식입니다.",
    "Chess Roulette": "체스 룰렛",
    "Every Lucky Square is a gamble": "모든 행운 칸은 도박입니다",
    "Visible Lucky Squares can destroy, teleport, swap or transform the piece that lands on them.":
      "보이는 행운 칸은 그 위에 도착한 기물을 파괴, 순간이동, 교환 또는 변형시킬 수 있습니다.",
    "Lucky Squares": "행운 칸",
    "Random effects": "랜덤 효과",
    Transformations: "변형",
    "Hot Potato Chess": "핫 포테이토 체스",
    "The bomb always belongs to someone": "폭탄은 항상 누군가에게 있습니다",
    "A random non-king piece carries a ticking bomb. Move it, pass it by capture, or escape before the 3×3 blast.":
      "무작위 킹 이외의 기물이 시한폭탄을 가집니다. 움직이거나 잡기로 넘기거나 3×3 폭발 전에 피하세요.",
    "Bomb carrier": "폭탄 보유자",
    "4–12 fuse": "4–12 카운트",
    Explosions: "폭발",
    "Chess Collapse": "체스 콜랩스",
    "The board is disappearing": "체스판이 사라집니다",
    "Warned outer edges collapse permanently while both Kings race toward the surviving central battlefield.":
      "경고된 바깥 가장자리가 영구적으로 붕괴하며 두 킹은 살아남는 중앙 전장으로 이동해야 합니다.",
    "Shrinking board": "축소되는 보드",
    "3 King lives": "킹 목숨 3개",
    Survival: "생존",
    "Boss Battle Chess": "보스 배틀 체스",
    "White plays chess. Black plays the boss.":
      "백은 체스를 두고 흑은 보스를 조종합니다.",
    "A full White army faces a reduced Black force led by a 5-HP Boss King with powers, armor and Rage.":
      "완전한 백 군대가 능력, 방어막, 분노를 가진 5 HP 보스 킹과 축소된 흑 군대를 상대합니다.",
    Asymmetric: "비대칭",
    "Boss Powers": "보스 능력",
    Rage: "분노",
    "Four Player Chess": "4인 체스",
    "Four armies. One battlefield.": "네 군대. 하나의 전장.",
    "Four players fight around a cross-shaped board. Checkmate eliminates a player; the last army standing wins.":
      "네 플레이어가 십자형 보드에서 싸웁니다. 체크메이트된 플레이어는 탈락하고 마지막 군대가 승리합니다.",
    "4 Players": "4인",
    "Free-for-all": "개인전",
    Elimination: "탈락",
    "Random Start Chess": "랜덤 스타트 체스",
    "Forget your opening book": "오프닝 책을 잊으세요",
    "White and Black receive independently shuffled back ranks, creating a different non-mirrored opening every game.":
      "백과 흑의 후방 랭크가 각각 독립적으로 섞여 매 게임 서로 대칭이 아닌 새로운 시작 배치가 만들어집니다.",
    "Random setup": "랜덤 배치",
    "Asymmetric start": "비대칭 시작",
    "No castling": "캐슬링 없음",
    "Tectonic Chess": "텍토닉 체스",
    "Move pieces. Then move the board.":
      "기물을 움직인 뒤, 체스판 자체를 움직입니다.",
    "Every four normal plies, a player can rotate one 4×4 quadrant and reshape the geometry of the entire position.":
      "일반 하프무브 4회마다 플레이어는 4×4 사분면 하나를 회전해 전체 포지션의 기하를 바꿀 수 있습니다.",
    "4×4 Rotation": "4×4 회전",
    "Board Shift": "보드 시프트",
    Strategy: "전략",
    "Chess Market": "체스 마켓",
    "Every move has a price": "모든 수에는 가격이 있습니다",
    "Earn coins through captures, checks, missions and bounties, then spend them on limited Royal Powers.":
      "잡기, 체크, 미션, 현상금으로 코인을 벌고 제한된 로열 파워에 사용합니다.",
    "Royal Powers": "로열 파워",
    "Complete Chaos": "컴플리트 카오스",
    "Nothing starts where it should":
      "아무 기물도 원래 자리에서 시작하지 않습니다",
    "Every starting piece is scattered onto a random square across the entire board. Pure positional madness from move one.":
      "모든 시작 기물이 보드 전체의 무작위 칸에 흩어집니다. 첫 수부터 완전한 포지션 혼돈입니다.",
    "Full-board setup": "전체 보드 배치",
    "Maximum chaos": "최대 혼돈",
    Future: "향후",
  },
  ru: {
    Rules: "Правила",
    "Chess Variants": "Варианты шахмат",
    "Different rules. Same board.": "Другие правила. Та же доска.",
    "Seven ways to turn classic chess into something completely different.":
      "Семь способов превратить классические шахматы в совсем другую игру.",
    "Back to Chess": "Назад к шахматам",
    Language: "Язык",
    Available: "Доступно",
    "Coming soon": "Скоро",
    "Play Hotseat": "Играть Hotseat",
    "Three Lives Chess": "Шахматы «Три жизни»",
    "Every check hurts": "Каждый шах отнимает жизнь",
    "Both players start with three lives. Every check removes one life; checkmate still wins instantly.":
      "Оба игрока начинают с тремя жизнями. Каждый шах отнимает одну жизнь; мат всё равно побеждает сразу.",
    "3 HP": "3 HP",
    "Check damage": "Урон шахом",
    Hotseat: "Hotseat",
    "Mutation Chess": "Мутационные шахматы",
    "The board changes itself": "Доска меняется сама",
    "Every ten plies, a random non-king piece mutates into another piece.":
      "Каждые десять полуходов случайная фигура, кроме короля, превращается в другую.",
    "Random events": "Случайные события",
    Mutations: "Мутации",
    "Capitalism Chess": "Капиталистические шахматы",
    "Chess with an economy": "Шахматы с экономикой",
    Economy: "Экономика",
    Bounties: "Награды",
    Missions: "Миссии",
    "King Powers": "Силы короля",
    "Horror Chess": "Хоррор-шахматы",
    "The board is dangerous": "Сама доска опасна",
    Infection: "Инфекция",
    Curses: "Проклятия",
    "Hot squares": "Горячие поля",
    "Knight freeze": "Заморозка конём",
    "Fog of War Chess": "Шахматы с туманом войны",
    "You cannot see everything": "Вы видите не всё",
    "Fog of war": "Туман войны",
    "Random start": "Случайный старт",
    "Hidden information": "Скрытая информация",
    "Draft Chess": "Драфт-шахматы",
    "Build your own army": "Соберите свою армию",
    Budget: "Бюджет",
    "Custom army": "Своя армия",
    "Back-rank king": "Король на задней линии",
    "Mirror Chess": "Зеркальные шахматы",
    "Custom but symmetrical": "Своя расстановка, но симметричная",
    "Custom setup": "Своя расстановка",
    Symmetry: "Симметрия",
    "Fair start": "Честный старт",
    "Variant roadmap": "План вариантов",
    "We build one rules system at a time, starting with local Hotseat before AI or Multiplayer.":
      "Сначала строим локальный Hotseat, затем добавляем ИИ и мультиплеер.",
    "Fifteen ways to turn classic chess into something completely different.":
      "Пятнадцать способов превратить классические шахматы в совсем другую игру.",
    "Chess Roulette": "Шахматная рулетка",
    "Every Lucky Square is a gamble": "Каждое счастливое поле — азартная игра",
    "Visible Lucky Squares can destroy, teleport, swap or transform the piece that lands on them.":
      "Видимые счастливые поля могут уничтожить, телепортировать, поменять местами или преобразовать попавшую на них фигуру.",
    "Lucky Squares": "Счастливые поля",
    "Random effects": "Случайные эффекты",
    Transformations: "Превращения",
    "Hot Potato Chess": "Шахматы «Горячая картошка»",
    "The bomb always belongs to someone": "Бомба всегда у кого-то",
    "A random non-king piece carries a ticking bomb. Move it, pass it by capture, or escape before the 3×3 blast.":
      "Случайная фигура, кроме короля, несёт бомбу. Перемещайте её, передавайте взятием или спасайтесь до взрыва 3×3.",
    "Bomb carrier": "Носитель бомбы",
    "4–12 fuse": "Фитиль 4–12",
    Explosions: "Взрывы",
    "Chess Collapse": "Шахматный коллапс",
    "The board is disappearing": "Доска исчезает",
    "Warned outer edges collapse permanently while both Kings race toward the surviving central battlefield.":
      "Предупреждённые внешние края навсегда обрушиваются, пока короли бегут к уцелевшему центру.",
    "Shrinking board": "Сжимающаяся доска",
    "3 King lives": "3 жизни короля",
    Survival: "Выживание",
    "Boss Battle Chess": "Шахматы: битва с боссом",
    "White plays chess. Black plays the boss.":
      "Белые играют в шахматы. Чёрные играют за босса.",
    "A full White army faces a reduced Black force led by a 5-HP Boss King with powers, armor and Rage.":
      "Полная белая армия сражается с сокращённой чёрной армией во главе с Королём-боссом на 5 HP, силами, бронёй и яростью.",
    Asymmetric: "Асимметрия",
    "Boss Powers": "Силы босса",
    Rage: "Ярость",
    "Four Player Chess": "Шахматы на четверых",
    "Four armies. One battlefield.": "Четыре армии. Одно поле боя.",
    "Four players fight around a cross-shaped board. Checkmate eliminates a player; the last army standing wins.":
      "Четыре игрока сражаются на крестообразной доске. Мат исключает игрока; побеждает последняя армия.",
    "4 Players": "4 игрока",
    "Free-for-all": "Каждый за себя",
    Elimination: "Выбывание",
    "Random Start Chess": "Шахматы со случайным стартом",
    "Forget your opening book": "Забудьте дебютную книгу",
    "White and Black receive independently shuffled back ranks, creating a different non-mirrored opening every game.":
      "Задние ряды белых и чёрных перемешиваются независимо, создавая каждый раз новую несимметричную стартовую позицию.",
    "Random setup": "Случайная расстановка",
    "Asymmetric start": "Асимметричный старт",
    "No castling": "Без рокировки",
    "Tectonic Chess": "Тектонические шахматы",
    "Move pieces. Then move the board.":
      "Двигайте фигуры. Затем двигайте саму доску.",
    "Every four normal plies, a player can rotate one 4×4 quadrant and reshape the geometry of the entire position.":
      "Каждые четыре обычных полухода игрок может повернуть один квадрант 4×4 и изменить геометрию всей позиции.",
    "4×4 Rotation": "Поворот 4×4",
    "Board Shift": "Сдвиг доски",
    Strategy: "Стратегия",
    "Chess Market": "Шахматный рынок",
    "Every move has a price": "У каждого хода есть цена",
    "Earn coins through captures, checks, missions and bounties, then spend them on limited Royal Powers.":
      "Зарабатывайте монеты взятиями, шахами, миссиями и наградами, затем тратьте их на ограниченные королевские силы.",
    "Royal Powers": "Королевские силы",
    "Complete Chaos": "Полный хаос",
    "Nothing starts where it should": "Ничто не начинает там, где должно",
    "Every starting piece is scattered onto a random square across the entire board. Pure positional madness from move one.":
      "Все стартовые фигуры разбрасываются по случайным полям всей доски. Полное позиционное безумие с первого хода.",
    "Full-board setup": "Расстановка по всей доске",
    "Maximum chaos": "Максимальный хаос",
    Future: "Будущее",
  },
};

function t(language: Language, key: string): string {
  if (language === "en") return key;

  if (language === "bar") {
    return translations.bar[key] ?? translations.de[key] ?? key;
  }

  return translations[language][key] ?? key;
}

const variants: VariantCard[] = [
  {
    id: "draft",
    icon: "⚔",
    title: "Draft Chess",
    subtitle: "Build your own army",
    description:
      "Spend a point budget on your starting army. The king must remain on the back rank.",
    tags: ["Budget", "Custom army", "Back-rank king"],
    available: true,
    route: "/games/chess/variants/draft/hotseat",
    aiRoute: "/games/chess/variants/draft/ai",
    rulesRoute: "/games/chess/variants/draft/rules",
    accent: "emerald",
  },
  {
    id: "mirror",
    icon: "◈",
    title: "Mirror Chess",
    subtitle: "Custom but symmetrical",
    description:
      "Create a custom legal formation and mirror it for the opponent so both sides begin symmetrically.",
    tags: ["Custom setup", "Symmetry", "Fair start"],
    available: true,
    route: "/games/chess/variants/mirror/hotseat",
    aiRoute: "/games/chess/variants/mirror/ai",
    rulesRoute: "/games/chess/variants/mirror/rules",
    accent: "zinc",
  },
  {
    id: "randomstart",
    icon: "🎲",
    title: "Random Start Chess",
    subtitle: "Forget your opening book",
    description:
      "White and Black receive independently shuffled back ranks, creating a different non-mirrored opening every game.",
    tags: ["Random setup", "Asymmetric start", "No castling"],
    available: true,
    route: "/games/chess/variants/randomstart/hotseat",
    aiRoute: "/games/chess/variants/randomstart/ai",
    accent: "lime",
  },
  {
    id: "fog-of-war",
    icon: "🌫",
    title: "Fog of War Chess",
    subtitle: "You cannot see everything",
    description:
      "Limited vision combines with randomized legal starting positions to create hidden-information chess.",
    tags: ["Fog of war", "Random start", "Hidden information"],
    available: true,
    route: "/games/chess/variants/fogofwar/hotseat",
    aiRoute: "/games/chess/variants/fogofwar/ai",
    rulesRoute: "/games/chess/variants/fogofwar/rules",
    accent: "sky",
  },
  {
    id: "roulette",
    icon: "🎰",
    title: "Chess Roulette",
    subtitle: "Every Lucky Square is a gamble",
    description:
      "Visible Lucky Squares can destroy, teleport, swap or transform the piece that lands on them.",
    tags: ["Lucky Squares", "Random effects", "Transformations"],
    available: true,
    route: "/games/chess/variants/roulette/hotseat",
    aiRoute: "/games/chess/variants/roulette/ai",
    rulesRoute: "/games/chess/variants/roulette/rules",
    accent: "fuchsia",
  },
  {
    id: "mutation",
    icon: "🧬",
    title: "Mutation Chess",
    subtitle: "The board changes itself",
    description:
      "Every ten plies, a random non-king piece mutates into another piece.",
    tags: ["Random events", "Mutations", "Hotseat"],
    route: "/games/chess/variants/mutation/hotseat",
    aiRoute: "/games/chess/variants/mutation/ai",
    available: true,
    accent: "violet",
  },
  {
    id: "four-player",
    icon: "✣",
    title: "Four Player Chess",
    subtitle: "Four armies. One battlefield.",
    description:
      "Four players fight around a cross-shaped board. Checkmate eliminates a player; the last army standing wins.",
    tags: ["4 Players", "Free-for-all", "Elimination"],
    available: true,
    route: "/games/chess/variants/4-players/hotseat",
    aiRoute: "/games/chess/variants/4-players/ai",
    accent: "cyan",
  },
  {
    id: "complete-chaos",
    icon: "🌀",
    title: "Total Chaos Chess",
    subtitle: "Nothing starts where it should",
    description:
      "All 32 standard pieces are scattered across the board into a playable random position. Understand the chaos before your opponent does.",
    tags: ["Full-board setup", "Random geometry", "No opening theory"],
    available: true,
    route: "/games/chess/variants/complete-chaos/hotseat",
    aiRoute: "/games/chess/variants/complete-chaos/ai",
    rulesRoute: "/games/chess/variants/complete-chaos/rules",
    accent: "pink",
  },
  {
    id: "horror",
    icon: "☠",
    title: "Horror Chess",
    subtitle: "The board is dangerous",
    description:
      "Infection, cursed pieces, burning squares and knight-triggered freezing turn the board into a survival game.",
    tags: ["Infection", "Curses", "Hot squares", "Knight freeze"],
    route: "/games/chess/variants/horror/hotseat",
    aiRoute: "/games/chess/variants/horror/ai",
    rulesRoute: "/games/chess/variants/horror/rules",
    available: true,
    accent: "rose",
  },
  {
    id: "hotpotato",
    icon: "💣",
    title: "Hot Potato Chess",
    subtitle: "The bomb always belongs to someone",
    description:
      "A random non-king piece carries a ticking bomb. Move it, pass it by capture, or escape before the 3×3 blast.",
    tags: ["Bomb carrier", "4–12 fuse", "Explosions"],
    available: true,
    route: "/games/chess/variants/hotpotato/hotseat",
    aiRoute: "/games/chess/variants/hotpotato/ai",
    rulesRoute: "/games/chess/variants/hotpotato/rules",
    accent: "orange",
  },
  {
    id: "collapse",
    icon: "⚠",
    title: "Chess Collapse",
    subtitle: "The board is disappearing",
    description:
      "Warned outer edges collapse permanently while both Kings race toward the surviving central battlefield.",
    tags: ["Shrinking board", "3 King lives", "Survival"],
    available: true,
    route: "/games/chess/variants/collapse/hotseat",
    aiRoute: "/games/chess/variants/collapse/ai",
    rulesRoute: "/games/chess/variants/hotpotato/rules",
    accent: "red",
  },
  {
    id: "boss",
    icon: "♚",
    title: "Boss Battle Chess",
    subtitle: "White plays chess. Black plays the boss.",
    description:
      "A full White army faces a reduced Black force led by a 5-HP Boss King with powers, armor and Rage.",
    tags: ["Asymmetric", "Boss Powers", "Rage"],
    available: true,
    route: "/games/chess/variants/boss/hotseat",
    aiRoute: "/games/chess/variants/boss/ai",
    rulesRoute: "/games/chess/variants/boss/rules",
    accent: "indigo",
  },
  {
    id: "three-lives",
    icon: "♥",
    title: "Three Lives Chess",
    subtitle: "Every check hurts",
    description:
      "Both players start with three lives. Every check removes one life; checkmate still wins instantly.",
    tags: ["3 HP", "Check damage", "Hotseat"],
    route: "/games/chess/variants/three-lives/hotseat",
    aiRoute: "/games/chess/variants/three-lives/ai",
    available: true,
    accent: "red",
  },
  {
    id: "tectonic",
    icon: "↻",
    title: "Tectonic Chess",
    subtitle: "Move pieces. Then move the board.",
    description:
      "Every four normal plies, a player can rotate one 4×4 quadrant and reshape the geometry of the entire position.",
    tags: ["4×4 Rotation", "Board Shift", "Strategy"],
    available: true,
    route: "/games/chess/variants/tectonic/hotseat",
    aiRoute: "/games/chess/variants/tectonic/ai",
    rulesRoute: "/games/chess/variants/tectonic/rules",
    accent: "teal",
  },
  {
    id: "capitalism",
    icon: "🪙",
    title: "Chess Market",
    subtitle: "Every move has a price",
    description:
      "Earn coins through captures, checks, missions and bounties, then spend them on limited Royal Powers.",
    tags: ["Economy", "Bounties", "Missions", "Royal Powers", "Hotseat"],
    route: "/games/chess/variants/chessmarket/hotseat",
    aiRoute: "/games/chess/variants/chessmarket/ai",
    rulesRoute: "/games/chess/variants/chessmarket/rules",
    available: true,
    accent: "amber",
  },
  {
    id: "3d-chess",
    icon: "🧊",
    title: "3D Chess",
    subtitle: "Think beyond one board",
    description:
      "A future chess variant played across multiple vertical layers, where pieces can attack, defend and move through three-dimensional space.",
    tags: ["3D Board", "Multiple Layers", "Future"],
    available: false,
    accent: "blue",
  },
];

const accentClasses: Record<VariantCard["accent"], string> = {
  red: "border-red-400/20 bg-red-400/[0.05] text-red-300",
  violet: "border-violet-400/20 bg-violet-400/[0.05] text-violet-300",
  amber: "border-amber-400/20 bg-amber-400/[0.05] text-amber-300",
  rose: "border-rose-400/20 bg-rose-400/[0.05] text-rose-300",
  sky: "border-sky-400/20 bg-sky-400/[0.05] text-sky-300",
  emerald: "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300",
  zinc: "border-zinc-500/30 bg-zinc-500/[0.06] text-zinc-300",
  orange: "border-orange-400/20 bg-orange-400/[0.06] text-orange-300",
  cyan: "border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-300",
  fuchsia: "border-fuchsia-400/20 bg-fuchsia-400/[0.06] text-fuchsia-300",
  indigo: "border-indigo-400/20 bg-indigo-400/[0.06] text-indigo-300",
  lime: "border-lime-400/20 bg-lime-400/[0.06] text-lime-300",
  pink: "border-pink-400/20 bg-pink-400/[0.06] text-pink-300",
  teal: "border-teal-400/20 bg-teal-400/[0.06] text-teal-300",
  blue: "border-blue-400/20 bg-blue-400/[0.06] text-blue-300",
};

const buttonClasses: Record<VariantCard["accent"], string> = {
  red: "bg-red-300 text-zinc-950 hover:bg-red-200",
  violet: "bg-violet-300 text-zinc-950 hover:bg-violet-200",
  amber: "bg-amber-300 text-zinc-950 hover:bg-amber-200",
  rose: "bg-rose-300 text-zinc-950 hover:bg-rose-200",
  sky: "bg-sky-300 text-zinc-950 hover:bg-sky-200",
  emerald: "bg-emerald-300 text-zinc-950 hover:bg-emerald-200",
  zinc: "bg-zinc-300 text-zinc-950 hover:bg-zinc-200",
  orange: "bg-orange-300 text-zinc-950 hover:bg-orange-200",
  cyan: "bg-cyan-300 text-zinc-950 hover:bg-cyan-200",
  fuchsia: "bg-fuchsia-300 text-zinc-950 hover:bg-fuchsia-200",
  indigo: "bg-indigo-300 text-white hover:bg-indigo-200 hover:text-zinc-950",
  lime: "bg-lime-300 text-zinc-950 hover:bg-lime-200",
  pink: "bg-pink-300 text-zinc-950 hover:bg-pink-200",
  teal: "bg-teal-300 text-zinc-950 hover:bg-teal-200",
  blue: "bg-blue-300 text-zinc-950 hover:bg-blue-200",
};

function LanguageSelector({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  return (
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
      <span className="hidden sm:inline">{t(language, "Language")}</span>

      <select
        value={language}
        onChange={(event) => onChange(event.target.value as Language)}
        className="
          bg-transparent
          text-xs
          font-bold
          text-zinc-200
          outline-none
          [color-scheme:dark]
        "
        aria-label={t(language, "Language")}
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
  );
}

const artGlowClasses: Record<VariantCard["accent"], string> = {
  red: "from-red-500/18 via-red-500/[0.04] to-transparent",
  violet: "from-violet-500/18 via-violet-500/[0.04] to-transparent",
  amber: "from-amber-500/18 via-amber-500/[0.04] to-transparent",
  rose: "from-rose-500/18 via-rose-500/[0.04] to-transparent",
  sky: "from-sky-500/18 via-sky-500/[0.04] to-transparent",
  emerald: "from-emerald-500/18 via-emerald-500/[0.04] to-transparent",
  zinc: "from-zinc-400/14 via-zinc-400/[0.03] to-transparent",
  orange: "from-orange-500/18 via-orange-500/[0.04] to-transparent",
  cyan: "from-cyan-500/18 via-cyan-500/[0.04] to-transparent",
  fuchsia: "from-fuchsia-500/18 via-fuchsia-500/[0.04] to-transparent",
  indigo: "from-indigo-500/18 via-indigo-500/[0.04] to-transparent",
  lime: "from-lime-500/18 via-lime-500/[0.04] to-transparent",
  pink: "from-pink-500/18 via-pink-500/[0.04] to-transparent",
  teal: "from-teal-500/18 via-teal-500/[0.04] to-transparent",
  blue: "from-blue-500/18 via-blue-500/[0.04] to-transparent",
};

type VariantArtworkSpec = {
  main: string;
  left: string;
  right: string;
  footer: string;
};

const variantArtwork: Record<string, VariantArtworkSpec> = {
  draft: {
    main: "⚔",
    left: "♜ ♞",
    right: "♝ ♛",
    footer: "BUILD YOUR ARMY",
  },
  mirror: {
    main: "◈",
    left: "♔",
    right: "♚",
    footer: "d2 ↕ d7",
  },
  randomstart: {
    main: "🎲",
    left: "♜♝♞",
    right: "♛♚♜",
    footer: "NO TWO BACK RANKS ALIKE",
  },
  "fog-of-war": {
    main: "♚",
    left: "░▒",
    right: "▓░",
    footer: "WHAT CAN YOU SEE?",
  },
  roulette: {
    main: "🎰",
    left: "? 🎴",
    right: "🌀 💥",
    footer: "DESTROY · SWAP · TELEPORT",
  },
  mutation: {
    main: "🧬",
    left: "♙ → ♘",
    right: "→ ♕",
    footer: "MUTATE",
  },
  "four-player": {
    main: "✣",
    left: "♜  ♞",
    right: "♝  ♛",
    footer: "RED · BLUE · YELLOW · GREEN",
  },
  "complete-chaos": {
    main: "🌀",
    left: "♚ ? ♙",
    right: "? ♜ ?",
    footer: "EVERY PIECE · ANY SQUARE",
  },
  horror: {
    main: "☠",
    left: "♞ ❄",
    right: "♟ 🔥",
    footer: "CURSE · INFECT · SURVIVE",
  },
  hotpotato: {
    main: "💣",
    left: "♟",
    right: "4…12",
    footer: "MOVE IT BEFORE IT BLOWS",
  },
  collapse: {
    main: "⚠",
    left: "▦",
    right: "▣",
    footer: "EDGE → WARNING → VOID",
  },
  boss: {
    main: "♚",
    left: "♥♥♥",
    right: "⚡🔥",
    footer: "5 HP · POWERS · RAGE",
  },
  "three-lives": {
    main: "♔",
    left: "♥ ♥",
    right: "♥",
    footer: "CHECK → −1 HP",
  },
  tectonic: {
    main: "↻",
    left: "A │ B",
    right: "C │ D",
    footer: "ROTATE THE POSITION",
  },
  capitalism: {
    main: "♛",
    left: "🪙 🪙",
    right: "♜ + 🪙",
    footer: "CAPTURE · EARN · SPEND",
  },
};

function VariantArtwork({ variant }: { variant: VariantCard }) {
  const art = variantArtwork[variant.id] ?? {
    main: variant.icon,
    left: "♜",
    right: "♞",
    footer: "CHESS VARIANT",
  };

  return (
    <div
      className={`
        relative
        mb-5
        h-32
        overflow-hidden
        rounded-2xl
        border
        ${accentClasses[variant.accent]}
        bg-gradient-to-br
        ${artGlowClasses[variant.accent]}
      `}
    >
      <div
        className="
          pointer-events-none
          absolute
          inset-0
          opacity-[0.08]
          [background-image:linear-gradient(rgba(255,255,255,.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.55)_1px,transparent_1px)]
          [background-size:25%_25%]
        "
      />

      <div className="absolute left-4 top-4 whitespace-pre text-sm font-black tracking-widest opacity-55">
        {art.left}
      </div>

      <div className="absolute right-4 top-4 whitespace-pre text-sm font-black tracking-widest opacity-55">
        {art.right}
      </div>

      <div
        className="
          absolute
          left-1/2
          top-1/2
          -translate-x-1/2
          -translate-y-[58%]
          select-none
          text-6xl
          font-black
          leading-none
          drop-shadow-[0_8px_20px_rgba(0,0,0,.5)]
          transition
          duration-500
          group-hover:scale-110
          group-hover:-rotate-3
        "
      >
        {art.main}
      </div>

      <div
        className="
          absolute
          bottom-3
          left-1/2
          -translate-x-1/2
          whitespace-nowrap
          text-[8px]
          font-black
          uppercase
          tracking-[0.22em]
          opacity-45
        "
      >
        {art.footer}
      </div>

      <div className="absolute -bottom-10 -right-8 text-[110px] font-black leading-none opacity-[0.035]">
        {variant.icon}
      </div>
    </div>
  );
}

function shuffleVariants(items: VariantCard[]): VariantCard[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));

    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function VariantPreviewCarousel({ language }: { language: Language }) {
  const [previewOrder, setPreviewOrder] = useState<VariantCard[]>(() =>
    shuffleVariants(variants),
  );

  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPreviewIndex((current) => {
        const next = current + 1;

        if (next < previewOrder.length) {
          return next;
        }

        setPreviewOrder(shuffleVariants(variants));
        return 0;
      });
    }, 3600);

    return () => window.clearInterval(timer);
  }, [previewOrder.length]);

  function goTo(index: number) {
    setPreviewIndex((index + previewOrder.length) % previewOrder.length);
  }

  return (
    <section
      className="
        relative
        min-h-[360px]
        overflow-hidden
        rounded-3xl
        border
        border-white/10
        bg-zinc-900/65
        shadow-xl
        shadow-black/20
        backdrop-blur-md
      "
    >
      <div
        className="
          pointer-events-none
          absolute
          inset-0
          bg-[radial-gradient(circle_at_75%_20%,rgba(255,255,255,.055),transparent_32%)]
        "
      />

      <div
        className="
          relative
          flex
          h-full
          transition-transform
          duration-700
          ease-[cubic-bezier(.22,1,.36,1)]
        "
        style={{
          transform: `translateX(-${previewIndex * 100}%)`,
        }}
      >
        {previewOrder.map((variant, index) => (
          <div
            key={`${variant.id}-${index}`}
            className="
              min-w-full
              p-5
              sm:p-6
            "
          >
            <div className="grid min-h-[310px] items-center gap-5 md:grid-cols-[minmax(0,1fr)_270px]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`
                      rounded-full
                      border
                      px-2.5
                      py-1
                      text-[9px]
                      font-black
                      uppercase
                      tracking-widest
                      ${
                        variant.available
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                          : "border-white/10 bg-white/5 text-zinc-600"
                      }
                    `}
                  >
                    {t(
                      language,
                      variant.available ? "Available" : "Coming soon",
                    )}
                  </span>

                  <span className="text-[10px] font-black tracking-[0.2em] text-zinc-700">
                    {String(index + 1).padStart(2, "0")} /{" "}
                    {String(previewOrder.length).padStart(2, "0")}
                  </span>
                </div>

                <p
                  className={`
                    mt-5
                    text-[10px]
                    font-black
                    uppercase
                    tracking-[0.24em]
                    ${accentClasses[variant.accent]}
                    border-0
                    bg-transparent
                  `}
                >
                  {t(language, variant.subtitle)}
                </p>

                <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  {t(language, variant.title)}
                </h2>

                <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">
                  {t(language, variant.description)}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {variant.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`
                        rounded-full
                        border
                        px-2.5
                        py-1
                        text-[10px]
                        font-bold
                        ${accentClasses[variant.accent]}
                      `}
                    >
                      {t(language, tag)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="min-w-0">
                <VariantArtwork variant={variant} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between gap-4">
        <div className="flex max-w-[70%] gap-1.5 overflow-hidden">
          {previewOrder.map((variant, index) => (
            <button
              key={variant.id}
              type="button"
              onClick={() => goTo(index)}
              className={`
                h-1.5
                rounded-full
                transition-all
                ${
                  index === previewIndex
                    ? "w-7 bg-white/65"
                    : "w-1.5 bg-white/15 hover:bg-white/30"
                }
              `}
              aria-label={`${t(language, variant.title)} ${index + 1}`}
            />
          ))}
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => goTo(previewIndex - 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/25 text-lg font-black text-zinc-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Previous variant"
          >
            ‹
          </button>

          <button
            type="button"
            onClick={() => goTo(previewIndex + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/25 text-lg font-black text-zinc-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Next variant"
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}

function VariantCardView({
  variant,
  language,
  number,
}: {
  variant: VariantCard;
  language: Language;
  number: number;
}) {
  return (
    <article
      className="
        group
        relative
        flex
        min-h-[430px]
        flex-col
        overflow-hidden
        rounded-3xl
        border
        border-white/10
        bg-zinc-900/70
        p-4
        shadow-xl
        shadow-black/20
        backdrop-blur-md
        transition
        duration-300
        hover:-translate-y-1.5
        hover:border-white/20
        hover:bg-zinc-900
        hover:shadow-2xl
        hover:shadow-black/30
      "
    >
      <div
        className="
          pointer-events-none
          absolute
          -right-14
          -top-14
          h-44
          w-44
          rounded-full
          bg-white/[0.025]
          blur-3xl
        "
      />

      <VariantArtwork variant={variant} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              border
              text-xl
              shadow-inner
              ${accentClasses[variant.accent]}
            `}
          >
            {variant.icon}
          </div>

          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
              {String(number).padStart(2, "0")} ·{" "}
              {t(language, variant.subtitle)}
            </p>

            <h2 className="mt-1 truncate text-xl font-black tracking-tight text-white">
              {t(language, variant.title)}
            </h2>
          </div>
        </div>

        <span
          className={`
            shrink-0
            rounded-full
            border
            px-2.5
            py-1
            text-[9px]
            font-black
            uppercase
            tracking-widest
            ${
              variant.available
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                : "border-white/10 bg-white/5 text-zinc-600"
            }
          `}
        >
          {t(language, variant.available ? "Available" : "Coming soon")}
        </span>
      </div>

      <p className="relative mt-4 text-sm leading-6 text-zinc-500">
        {t(language, variant.description)}
      </p>

      <div className="relative mt-4 flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {variant.tags.map((tag) => (
            <span
              key={tag}
              className={`
                rounded-full
                border
                px-2.5
                py-1
                text-[10px]
                font-bold
                ${accentClasses[variant.accent]}
              `}
            >
              {t(language, tag)}
            </span>
          ))}
        </div>

        {variant.rulesRoute && (
          <Link
            to={variant.rulesRoute}
            onClick={(event) => event.stopPropagation()}
            className={`
              inline-flex
              shrink-0
              items-center
              gap-2
              rounded-xl
              border
              px-3.5
              py-2.5
              text-xs
              font-black
              uppercase
              tracking-wide
              transition
              hover:-translate-y-0.5
              hover:brightness-125
              ${accentClasses[variant.accent]}
            `}
            aria-label={`${t(language, "Rules")} — ${t(
              language,
              variant.title,
            )}`}
          >
            <span aria-hidden="true" className="text-base">
              📖
            </span>
            <span>{t(language, "Rules")}</span>
          </Link>
        )}
      </div>

      <div className="relative mt-auto pt-5">
        {variant.available && (
          <div className="relative mt-auto grid grid-cols-2 gap-2">
            {/* HOTSEAT */}
            {variant.route && (
              <Link
                to={variant.route}
                className={`
          flex
          items-center
          justify-center
          gap-2
          rounded-xl
          border
          border-white/10
          bg-white/5
          px-3
          py-3
          text-sm
          font-black
          text-zinc-200
          transition
          hover:bg-white/10
        `}
              >
                <span>👥</span>
                <span>{t(language, "Hotseat")}</span>
              </Link>
            )}

            {/* VS AI */}
            {variant.aiRoute && (
              <Link
                to={variant.aiRoute}
                className={`
          flex
          items-center
          justify-center
          gap-2
          rounded-xl
          px-3
          py-3
          text-sm
          font-black
          transition
          ${buttonClasses[variant.accent]}
        `}
              >
                <span>🤖</span>
                <span>{t(language, "Vs AI")}</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default function ChessVariantsMenu() {
  const [language, setLanguage] = useState<Language>(getInitialChessLanguage);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("chess-language", nextLanguage);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div
        className="
          pointer-events-none
          fixed
          inset-0
          bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.06),transparent_34%)]
        "
      />

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-7 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <header
            className="
              relative
              flex
              min-h-[360px]
              flex-col
              overflow-hidden
              rounded-3xl
              border
              border-amber-400/10
              bg-zinc-900/60
              p-6
              shadow-xl
              shadow-black/20
              backdrop-blur-md
              lg:aspect-square
            "
          >
            <div
              className="
                pointer-events-none
                absolute
                -right-12
                -top-12
                text-[190px]
                font-black
                leading-none
                text-amber-300/[0.025]
              "
            >
              ♞
            </div>

            <div
              className="
                flex
                h-14
                w-14
                items-center
                justify-center
                rounded-2xl
                border
                border-amber-500/20
                bg-amber-400/10
                text-3xl
                text-amber-200
                shadow-inner
              "
            >
              ♞
            </div>

            <div className="relative mt-6">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-400">
                {t(language, "Different rules. Same board.")}
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-tight text-white">
                {t(language, "Chess Variants")}
              </h1>

              <p className="mt-3 text-sm leading-6 text-zinc-500">
                {t(
                  language,
                  "Fifteen ways to turn classic chess into something completely different.",
                )}
              </p>
            </div>

            <div className="relative mt-auto pt-6">
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <LanguageSelector
                  language={language}
                  onChange={changeLanguage}
                />

                <Link
                  to="/games/chess"
                  className="
                    rounded-full
                    border
                    border-white/10
                    bg-white/5
                    px-3
                    py-1.5
                    text-xs
                    font-semibold
                    text-zinc-400
                    transition
                    hover:bg-white/10
                    hover:text-white
                  "
                >
                  ← {t(language, "Back to Chess")}
                </Link>
              </div>
            </div>
          </header>

          <VariantPreviewCarousel language={language} />
        </section>

        <section
          className="
            grid
            gap-5
            md:grid-cols-2
            xl:grid-cols-3
          "
        >
          {variants.map((variant, index) => (
            <VariantCardView
              key={variant.id}
              variant={variant}
              language={language}
              number={index + 1}
            />
          ))}
        </section>

        <footer className="py-8 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-800">
          Chess Variants · 16 modes
        </footer>
      </div>
    </main>
  );
}
