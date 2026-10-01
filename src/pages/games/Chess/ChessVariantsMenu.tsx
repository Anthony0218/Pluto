import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { variants, type VariantCard } from "@/data/chessVariants";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useAppLanguage } from "@/i18n/languageStore";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { VariantArtwork, VariantDesignCard } from "@/components/chess/VariantDesignCard";

type Language = "en" | "de" | "bar" | "ko" | "ru" | "es" | "pt";

const translations: Record<"de" | "bar" | "ko" | "ru", Record<string, string>> & Partial<Record<"es" | "pt", Record<string, string>>> = {
  de: {
    Rules: "Regeln",
    Singleplayer: "Einzelspieler",
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
    Singleplayer: "Oanspuia",
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
    Singleplayer: "싱글플레이어",
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
    Singleplayer: "Одиночная игра",
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
    return translations.bar[key] ?? translations.de[key] ?? ui(key);
  }

  return translations[language]?.[key] ?? ui(key);
}

function VariantPreviewCarousel({ language }: { language: Language }) {
  useUiLanguage();
  const previewOrder = variants;
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused || previewOrder.length <= 1) return;

    const timer = window.setInterval(() => {
      setPreviewIndex((current) => (current + 1) % previewOrder.length);
    }, 4600);

    return () => window.clearInterval(timer);
  }, [isPaused, previewOrder.length]);

  function goTo(index: number) {
    if (!previewOrder.length) return;
    setPreviewIndex((index + previewOrder.length) % previewOrder.length);
  }

  return (
    <section
      className="group relative w-full max-w-[680px] h-[228px] overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0d1014]/90 shadow-[0_28px_90px_rgba(0,0,0,.35)]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_83%_32%,rgba(217,70,239,.16),transparent_25%),radial-gradient(circle_at_8%_100%,rgba(245,158,11,.06),transparent_34%)]" />

      <div
        className="relative flex h-full transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)]"
        style={{ transform: `translateX(-${previewIndex * 100}%)` }}
      >
        {previewOrder.map((variant, index) => (
          <article
            key={`${variant.id}-${index}`}
            className="variant-slide min-w-full p-3 sm:p-4"
          >
            <div className="grid h-[196px] gap-3 md:grid-cols-[minmax(0,1fr)_35%]">
              <div className="relative z-10 flex min-w-0 flex-col">
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.17em] ${variant.available ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-amber-400/30 bg-amber-400/[0.08] text-amber-300"}`}>
                    {t(language, variant.available ? "Available" : "Coming soon")}
                  </span>
                  <span className="text-[10px] font-black tracking-[0.2em] text-zinc-400">
                    {String(index + 1).padStart(2, "0")} /{" "}
                    {String(previewOrder.length).padStart(2, "0")}
                  </span>
                </div>

                {/* Fixed-height regions keep the play and navigation buttons in the same place for every variant. */}
                <p className="hidden h-4 truncate text-[10px] font-black uppercase tracking-[0.30em] text-amber-300/90">
                  {t(language, variant.subtitle)}
                </p>
                <h2 className="variant-slide-title mt-1 line-clamp-2 h-[2.1em] overflow-hidden font-serif text-2xl leading-[1.02] tracking-[-0.025em] text-white">
                  {t(language, variant.title)}
                </h2>
                <p className="variant-slide-desc mt-1 line-clamp-2 h-8 max-w-xl font-serif text-[11px] leading-4 text-zinc-300/80">
                  {t(language, variant.description)}
                </p>

                <div className="variant-slide-actions mt-2 flex flex-wrap gap-1.5">
                  {variant.available && variant.aiRoute && <Link to={variant.aiRoute} className="flex min-h-8 flex-1 items-center justify-center rounded-lg border border-amber-300/55 bg-amber-300 px-2 text-center text-[10px] font-black text-black transition hover:bg-amber-200">{t(language, "Singleplayer")}</Link>}
                  {variant.available && variant.multiplayerRoute && <Link to={variant.multiplayerRoute} className="flex min-h-8 flex-1 items-center justify-center rounded-lg border border-fuchsia-300/40 bg-fuchsia-300/15 px-2 text-center text-[10px] font-black text-fuchsia-100 transition hover:bg-fuchsia-300/25">{ui("Multiplayer")}</Link>}
                  {variant.available && variant.route && <Link to={variant.route} className="flex min-h-8 flex-1 items-center justify-center rounded-lg border border-white/20 bg-white/[.06] px-2 text-center text-[10px] font-black text-zinc-100 transition hover:bg-white/[.12]">{variant.id === "3d-chess" ? ui("Play") : t(language, "Hotseat")}</Link>}
                </div>

                <div className="variant-slide-nav mt-auto flex items-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => goTo(previewIndex - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/30 text-lg text-zinc-300 transition hover:border-white/35 hover:text-white"
                    aria-label={ui("Previous variant")}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(previewIndex + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/30 text-lg text-zinc-300 transition hover:border-white/35 hover:text-white"
                    aria-label={ui("Next variant")}
                  >
                    ›
                  </button>
                </div>
              </div>

              <div className="variant-slide-art relative hidden overflow-hidden rounded-[14px] border border-white/10 md:block">
                <VariantArtwork variant={variant} />
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="absolute bottom-5 right-5 z-20 hidden max-w-[220px] justify-end gap-1 md:flex">
        {previewOrder.map((variant, index) => (
          <button
            key={`${variant.id}-dot`}
            type="button"
            onClick={() => goTo(index)}
            className={`h-1.5 rounded-full transition-all ${
              index === previewIndex
                ? "w-5 bg-white/75"
                : "w-1.5 bg-white/20 hover:bg-white/35"
            }`}
            aria-label={`${t(language, variant.title)} ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}

function VariantActionButtons({
  variant,
  language,
}: {
  variant: VariantCard;
  language: Language;
}) {
  useUiLanguage();
  if (!variant.available) {
    return (
      <div className="grid grid-cols-3 gap-1.5 opacity-45">
        {["Singleplayer", "Multiplayer", "Hotseat"].map((label) => (
          <span
            key={label}
            className="rounded-lg border border-white/12 bg-black/20 px-2 py-2 text-center text-[9px] font-semibold text-zinc-500"
          >
            {t(language, label)}
          </span>
        ))}
      </div>
    );
  }

  const base =
    "flex min-h-9 items-center justify-center rounded-lg border px-2 py-2 text-center text-[9px] font-semibold transition";

  return (
    <div className="flex gap-1.5">
      {/* 1. Singleplayer (formerly Vs AI) */}
      {variant.aiRoute ? (
        <Link
          to={variant.aiRoute}
          className={`${base} min-w-0 flex-1 border-white/15 bg-black/25 text-zinc-300 hover:bg-white/[0.07] hover:text-white`}
        >
          {t(language, "Singleplayer")}
        </Link>
      ) : (
        <span
          className="hidden"
        >
          {t(language, "Singleplayer")}
        </span>
      )}

      {/* 2. Multiplayer */}
      {variant.multiplayerRoute ? (
        <Link
          to={variant.multiplayerRoute}
          className={`${base} min-w-0 flex-1 border-white/15 bg-black/25 text-zinc-300 hover:bg-white/[0.07] hover:text-white`}
        >{ui("Multiplayer")}</Link>
      ) : (
        <span
          className="hidden"
        >{ui("Multiplayer")}</span>
      )}

      {/* 3. Hotseat */}
      {variant.route ? (
        <Link
          to={variant.route}
          className={`${base} min-w-0 flex-1 border-white/15 bg-black/25 text-zinc-300 hover:bg-white/[0.07] hover:text-white`}
        >
          {variant.id === "3d-chess" ? ui("Play") : t(language, "Hotseat")}
        </Link>
      ) : (
        <span
          className="hidden"
        >
          {t(language, "Hotseat")}
        </span>
      )}

    </div>
  );
}

function VariantCardView({ variant, language, number }: { variant: VariantCard; language: Language; number: number }) {
  return <VariantDesignCard variant={variant} number={number} translate={(key) => t(language, key)} showConfigure={false} badge={ui(variant.configurable === false ? "Not configurable" : variant.available ? "Available" : "Coming soon")} actions={<VariantActionButtons variant={variant} language={language} />} />;
}

export default function ChessVariantsMenu() {
  useUiLanguage();
  const { language } = useAppLanguage();
  const [query, setQuery] = useState("");
  const search = query.trim().toLocaleLowerCase();
  const shownVariants = variants.filter((variant) =>
    [variant.title, variant.subtitle, variant.description, ...variant.tags]
      .some((value) => value.toLocaleLowerCase().includes(search))
  );

  return (
    <main className="chess-custom-page relative left-1/2 min-h-[var(--app-height)] w-screen -translate-x-1/2 bg-[#07090b] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(245,158,11,.07),transparent_32%),radial-gradient(circle_at_88%_80%,rgba(56,189,248,.05),transparent_30%)]" />
      <ChessPageHeader className="chess-menu-header" title="Chess Variants">
          <Link
            to="/games/chess/rules"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
          >
            <span className="text-base">♔</span>
            <span className="hidden sm:inline">{t(language, "Rules")}</span>
          </Link>
      </ChessPageHeader>

      <div className="relative mx-auto w-full max-w-[1800px] px-4 pb-16 sm:px-6">
        <header className="grid items-start gap-5 pt-6 lg:grid-cols-[minmax(0,320px)_minmax(0,680px)] lg:gap-10">
          <div className="min-w-0 max-w-2xl">
            <Link to="/games/chess" className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white">
              <span aria-hidden="true">←</span>{t(language, "Back to Chess")}
            </Link>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300/80">Pluto</p>
            <h1 className="mt-1.5 font-serif text-[32px] leading-tight text-white sm:text-[40px]">{t(language, "Chess Variants")}</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{t(language, "Different rules. Same board.")}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{variants.length} {ui("unique ways to play")}</p>
          </div>
          <VariantPreviewCarousel language={language} />
        </header>

        <section aria-label={t(language, "Chess Variants")} className="mt-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">{ui("Official Pluto games")}</p>
            <label className="relative w-full sm:w-80">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <span className="sr-only">{ui("Search variants")}</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ui("Search variants")} className="w-full rounded-xl border border-white/[0.12] bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-amber-300/50" />
            </label>
          </div>
          {shownVariants.length ? (
            <ul className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
              {shownVariants.map((variant) => (
                <li key={variant.id} className="flex">
                  <VariantCardView variant={variant} language={language} number={variants.indexOf(variant) + 1} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-3xl border border-white/[0.08] bg-white/[0.02] px-6 py-10 text-center text-sm text-zinc-400">{ui("No variants match your search")}</p>
          )}
        </section>
      </div>
    </main>
  );
}
